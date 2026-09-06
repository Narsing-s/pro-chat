import Fastify from 'fastify';
import { createHash } from 'node:crypto';
import { db } from './db.js';

const COOKIE = 'prochat_session';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const bearerRaw = (req: any) => {
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return String(req.headers.cookie || '').split(';').map((x: string) => x.trim()).find((x: string) => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || '';
};

async function authenticate(req: any) {
  const raw = bearerRaw(req);
  if (!raw) return null;
  const result = await db.query(
    'SELECT s.*, u.id AS uid, u.name, u.email, u.username FROM pro_chat_sessions s JOIN pro_chat_users u ON u.id=s.user_id WHERE s.token=$1 AND s.revoked_at IS NULL AND s.expires_at>NOW() AND u.deleted_at IS NULL',
    [hash(raw)]
  );
  if (!result.rowCount) return null;
  return { userId: String(result.rows[0].uid), name: result.rows[0].name, email: result.rows[0].email, username: result.rows[0].username };
}

async function supportPlugin(app: any) {
  app.post('/api/support/requests', async (req: any, reply: any) => {
    const user = await authenticate(req);
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const subject = String(req.body?.subject || '').trim().slice(0, 200);
    const details = String(req.body?.details || '').trim().slice(0, 10000);
    const name = String(req.body?.name || user.name || '').trim().slice(0, 120);
    const email = String(req.body?.email || user.email || '').trim().slice(0, 254) || null;
    if (!subject || !details) return reply.code(400).send({ error: 'Subject and details are required' });
    const id = crypto.randomUUID();
    await db.query(
      'INSERT INTO pro_chat_support_tickets(id,user_id,name,email,subject,details,status) VALUES($1,$2,$3,$4,$5,$6,\'open\')',
      [id, user.userId, name || user.username || 'Pro Chat user', email, subject, details]
    );
    await db.query(
      'INSERT INTO pro_chat_support_messages(id,ticket_id,sender_type,sender_user_id,body) VALUES($1,$2,\'user\',$3,$4)',
      [crypto.randomUUID(), id, user.userId, details]
    );
    return { ok: true, ticket: { id, subject, details, status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
  });

  app.get('/api/support/requests', async (req: any, reply: any) => {
    const user = await authenticate(req);
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const result = await db.query(
      'SELECT id, name, email, subject, details, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM pro_chat_support_tickets WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100',
      [user.userId]
    );
    return result.rows;
  });

  app.get('/api/support/requests/:id', async (req: any, reply: any) => {
    const user = await authenticate(req);
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const ticket = await db.query(
      'SELECT id, name, email, subject, details, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM pro_chat_support_tickets WHERE id=$1 AND user_id=$2',
      [String(req.params.id), user.userId]
    );
    if (!ticket.rowCount) return reply.code(404).send({ error: 'Support ticket not found' });
    const messages = await db.query(
      'SELECT id, sender_type AS "senderType", body, created_at AS "createdAt" FROM pro_chat_support_messages WHERE ticket_id=$1 ORDER BY created_at ASC',
      [String(req.params.id)]
    );
    return { ...ticket.rows[0], messages: messages.rows };
  });

  app.post('/api/support/requests/:id/messages', async (req: any, reply: any) => {
    const user = await authenticate(req);
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const id = String(req.params.id);
    const body = String(req.body?.body || '').trim().slice(0, 10000);
    if (!body) return reply.code(400).send({ error: 'Message is required' });
    const ticket = await db.query('SELECT id FROM pro_chat_support_tickets WHERE id=$1 AND user_id=$2 AND status<>\'closed\'', [id, user.userId]);
    if (!ticket.rowCount) return reply.code(404).send({ error: 'Support ticket not found or closed' });
    const messageId = crypto.randomUUID();
    await db.query(
      'INSERT INTO pro_chat_support_messages(id,ticket_id,sender_type,sender_user_id,body) VALUES($1,$2,\'user\',$3,$4)',
      [messageId, id, user.userId, body]
    );
    await db.query('UPDATE pro_chat_support_tickets SET updated_at=NOW(),status=\'open\' WHERE id=$1', [id]);
    return { ok: true, message: { id: messageId, senderType: 'user', body, createdAt: new Date().toISOString() } };
  });
}

const probe = Fastify();
const prototype = Object.getPrototypeOf(probe);
await probe.close();
const originalListen = prototype.listen;
let supportInstalled = false;
prototype.listen = async function patchedListen(this: any, ...args: any[]) {
  if (!supportInstalled) {
    supportInstalled = true;
    this.register(supportPlugin);
  }
  return originalListen.apply(this, args);
};
