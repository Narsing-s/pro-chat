import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, initDb } from './db.js';

const app = Fastify({ logger: true, bodyLimit: 512 * 1024 });
const origins = process.env.WEB_ORIGIN?.split(',').map(v => v.trim()).filter(Boolean) ?? [];
await app.register(cors, { origin: origins.length ? origins : true, credentials: true });
const secret = process.env.SESSION_SECRET?.trim();
if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
const SESSION_SECRET = secret;

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const phone = (v: unknown) => String(v ?? '').replace(/[^0-9+]/g, '').trim();
const passwordHash = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
  return `${salt}:${hash}`;
};
const verifyPassword = (password: string, stored: string) => {
  try {
    const [salt, encoded] = String(stored || '').split(':');
    if (!salt || !encoded) return false;
    const expected = Buffer.from(encoded, 'hex');
    const actual = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
};
const token = (userId: string) => {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now(), nonce: randomBytes(16).toString('hex') })).toString('base64url');
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
};
const verifyToken = (value: string) => {
  try {
    const [payload, sig] = value.split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { userId?: string; issuedAt?: number };
    if (!data.userId || !data.issuedAt || Date.now() - data.issuedAt > 30 * 24 * 60 * 60 * 1000) return null;
    return data.userId;
  } catch { return null; }
};
const bearer = (req: any) => {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? verifyToken(value.slice(7)) : null;
};
const publicUser = (u: any, t?: string) => ({ id: String(u.id), name: String(u.name), email: u.email ?? undefined, phoneNumber: u.phone_number ?? undefined, username: u.username ?? undefined, createdAt: new Date(u.created_at).toISOString(), online: Boolean(u.online), ...(t ? { token: t } : {}) });
const validIdentifier = (v: string) => v.length >= 1 && v.length <= 120;
const participants = (chatId: string) => chatId.split(':');
const validChat = (chatId: string, uid: string) => { const p = participants(chatId); return p.length === 2 && p.includes(uid) && p[0] !== p[1]; };
const connected = new Map<string, Set<string>>();

await initDb();

app.get('/health', async () => ({ ok: true, service: 'pro-chat', database: 'neon-postgresql', network: true, time: new Date().toISOString() }));

app.post('/api/auth/register', async (req: any, reply) => {
  const email = norm(req.body?.email), phoneNumber = phone(req.body?.phoneNumber), username = norm(req.body?.username), password = String(req.body?.password || ''), name = String(req.body?.profileName || username).trim().slice(0, 80) || username;
  if (!email.includes('@') || email.length > 254) return reply.code(400).send({ error: 'Enter a valid email address' });
  if (phoneNumber.replace(/\D/g, '').length < 7) return reply.code(400).send({ error: 'Enter a valid phone number' });
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return reply.code(400).send({ error: 'Username must be 3-30 characters using letters, numbers, or underscore' });
  if (password.length < 8 || password.length > 128) return reply.code(400).send({ error: 'Password must be 8-128 characters' });
  const duplicate = await db.query('SELECT email,phone_number,username FROM pro_chat_users WHERE email=$1 OR phone_number=$2 OR username=$3 LIMIT 1', [email, phoneNumber, username]);
  if (duplicate.rowCount) {
    const row = duplicate.rows[0];
    const field = row.email === email ? 'email' : row.phone_number === phoneNumber ? 'phone number' : 'username';
    return reply.code(409).send({ error: `An account already exists with that ${field}` });
  }
  const id = randomUUID();
  const result = await db.query('INSERT INTO pro_chat_users(id,name,created_at,email,phone_number,username,password_hash,email_verified) VALUES($1,$2,NOW(),$3,$4,$5,$6,true) RETURNING *', [id, name, email, phoneNumber, username, passwordHash(password)]);
  const session = token(id);
  await db.query('INSERT INTO pro_chat_sessions(token,user_id,created_at,expires_at) VALUES($1,$2,NOW(),NOW()+INTERVAL \'30 days\')', [session, id]);
  reply.header('Cache-Control', 'no-store');
  return publicUser(result.rows[0], session);
});

app.post('/api/auth/login', async (req: any, reply) => {
  const identifier = String(req.body?.identifier || '').trim(), password = String(req.body?.password || '');
  if (!validIdentifier(identifier) || !password) return reply.code(400).send({ error: 'Enter your login details' });
  const result = await db.query('SELECT * FROM pro_chat_users WHERE email=$1 OR phone_number=$2 OR username=$3 LIMIT 1', [norm(identifier), phone(identifier), norm(identifier)]);
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return reply.code(401).send({ error: 'Invalid username, email/phone, or password' });
  const session = token(user.id);
  await db.query('INSERT INTO pro_chat_sessions(token,user_id,created_at,expires_at) VALUES($1,$2,NOW(),NOW()+INTERVAL \'30 days\')', [session, user.id]);
  await db.query('UPDATE pro_chat_users SET online=true WHERE id=$1', [user.id]);
  reply.header('Cache-Control', 'no-store');
  return publicUser(user, session);
});

app.post('/api/auth/logout', async (req: any, reply) => {
  const raw = String(req.headers.authorization || '');
  if (raw.startsWith('Bearer ')) await db.query('DELETE FROM pro_chat_sessions WHERE token=$1', [raw.slice(7)]);
  const uid = bearer(req); if (uid) await db.query('UPDATE pro_chat_users SET online=false WHERE id=$1', [uid]);
  return { ok: true };
});

app.post('/api/session', async (req: any, reply) => {
  const uid = bearer(req); if (!uid) return reply.code(401).send({ error: 'Authentication required' });
  const result = await db.query('SELECT * FROM pro_chat_users WHERE id=$1', [uid]);
  if (!result.rowCount) return reply.code(401).send({ error: 'User not found' });
  const fresh = token(uid);
  await db.query('DELETE FROM pro_chat_sessions WHERE user_id=$1 AND expires_at<NOW()', [uid]);
  await db.query('INSERT INTO pro_chat_sessions(token,user_id,created_at,expires_at) VALUES($1,$2,NOW(),NOW()+INTERVAL \'30 days\')', [fresh, uid]);
  return publicUser(result.rows[0], fresh);
});

app.post('/api/auth/forgot-password', async () => ({ ok: true, recoveryAvailable: false, message: 'Password recovery requires a configured recovery channel. Add email/SMS or use account recovery codes when enabled.' }));
app.post('/api/auth/reset-password', async (_req: any, reply) => reply.code(501).send({ error: 'Password reset channel is not configured yet' }));
app.post('/api/auth/verify-email', async (_req: any, reply) => reply.code(410).send({ error: 'Email verification is optional for this account configuration' }));
app.post('/api/auth/resend-verification', async () => ({ ok: true, message: 'Email verification is optional for this account configuration.' }));

app.get('/api/users', async (req: any, reply) => {
  const uid = bearer(req); if (!uid) return reply.code(401).send({ error: 'Authentication required' });
  const q = norm(req.query?.q || ''); if (q.length > 100) return reply.code(400).send({ error: 'Search text is too long' });
  const pq = phone(q);
  const result = await db.query(`SELECT id,name,email,phone_number,username,created_at,online FROM pro_chat_users WHERE id<>$1 AND ($2='' OR LOWER(username) LIKE $3 OR LOWER(name) LIKE $3 OR LOWER(email) LIKE $3 OR phone_number LIKE $4) ORDER BY CASE WHEN LOWER(username)=$2 THEN 0 WHEN LOWER(username) LIKE $5 THEN 1 ELSE 2 END,name LIMIT 50`, [uid, q, `%${q}%`, `%${pq}%`, `${q}%`]);
  return result.rows.map(u => publicUser(u));
});

app.get('/api/users/me', async (req: any, reply) => {
  const uid = bearer(req); if (!uid) return reply.code(401).send({ error: 'Authentication required' });
  const result = await db.query('SELECT * FROM pro_chat_users WHERE id=$1', [uid]); if (!result.rowCount) return reply.code(404).send({ error: 'User not found' }); return publicUser(result.rows[0]);
});

app.get('/api/messages/:chatId', async (req: any, reply) => {
  const uid = bearer(req); if (!uid) return reply.code(401).send({ error: 'Authentication required' });
  const chatId = String(req.params.chatId); if (!validChat(chatId, uid)) return reply.code(403).send({ error: 'Conversation access denied' });
  const result = await db.query(`SELECT id,chat_id AS "chatId",sender_id AS "senderId",text,created_at AS "createdAt",delivered,read,edited,deleted FROM pro_chat_messages WHERE chat_id=$1 ORDER BY created_at ASC LIMIT 500`, [chatId]);
  return result.rows;
});

app.post('/api/messages/:messageId/read', async (req: any, reply) => {
  const uid = bearer(req); if (!uid) return reply.code(401).send({ error: 'Authentication required' });
  const r = await db.query(`UPDATE pro_chat_messages SET read=true,delivered=true WHERE id=$1 AND sender_id<>$2 RETURNING id,chat_id`, [req.params.messageId, uid]);
  if (!r.rowCount) return reply.code(404).send({ error: 'Message not found' });
  io.to(`chat:${r.rows[0].chat_id}`).emit('message:read', { messageId: r.rows[0].id, chatId: r.rows[0].chat_id, userId: uid });
  return { ok: true };
});

app.get('/api/stats', async (req: any, reply) => {
  const uid = bearer(req); if (!uid) return reply.code(401).send({ error: 'Authentication required' });
  const sent = await db.query('SELECT COUNT(*)::int AS count FROM pro_chat_messages WHERE sender_id=$1', [uid]);
  const unread = await db.query(`SELECT COUNT(*)::int AS count FROM pro_chat_messages WHERE read=false AND sender_id<>$1 AND (split_part(chat_id,':',1)=$1 OR split_part(chat_id,':',2)=$1)`, [uid]);
  return { messagesSent: Number(sent.rows[0]?.count || 0), unreadMessages: Number(unread.rows[0]?.count || 0) };
});

const io = new Server(app.server, { cors: { origin: origins.length ? origins : true, methods: ['GET','POST'] }, maxHttpBufferSize: 512 * 1024 });
io.use((socket, next) => { const uid = verifyToken(String(socket.handshake.auth?.token || '')); if (!uid) return next(new Error('Authentication required')); socket.data.userId = uid; next(); });
const sendUser = (uid: string, event: string, payload: any) => { for (const sid of connected.get(uid) || []) io.to(sid).emit(event, payload); };

io.on('connection', socket => {
  const uid = String(socket.data.userId); if (!connected.has(uid)) connected.set(uid, new Set()); connected.get(uid)!.add(socket.id);
  void db.query('UPDATE pro_chat_users SET online=true WHERE id=$1', [uid]); io.emit('presence:update', { userId: uid, online: true });
  socket.on('chat:join', (chatId: string) => { if (validChat(String(chatId), uid)) socket.join(`chat:${chatId}`); });
  socket.on('typing:start', (p: any) => { const chatId = String(p?.chatId || ''); if (!validChat(chatId, uid)) return; const other = participants(chatId).find(x => x !== uid); if (other) sendUser(other, 'typing:update', { chatId, userId: uid, typing: true }); });
  socket.on('typing:stop', (p: any) => { const chatId = String(p?.chatId || ''); if (!validChat(chatId, uid)) return; const other = participants(chatId).find(x => x !== uid); if (other) sendUser(other, 'typing:update', { chatId, userId: uid, typing: false }); });
  socket.on('message:send', async (input: any, ack?: Function) => {
    try {
      const chatId = String(input?.chatId || ''), text = String(input?.text || '').trim(); if (!validChat(chatId, uid) || !text || text.length > 10000) return ack?.({ ok:false, error:'Invalid message' });
      const id = String(input?.id || randomUUID()); const existing = await db.query('SELECT id,chat_id AS "chatId",sender_id AS "senderId",text,created_at AS "createdAt",delivered,read,edited,deleted FROM pro_chat_messages WHERE id=$1', [id]); if (existing.rowCount) return ack?.({ ok:true, message:existing.rows[0] });
      const recipient = participants(chatId).find(x => x !== uid)!; const delivered = Boolean(connected.get(recipient)?.size);
      const r = await db.query(`INSERT INTO pro_chat_messages(id,chat_id,sender_id,text,created_at,delivered,read,edited,deleted) VALUES($1,$2,$3,$4,NOW(),$5,false,false,false) RETURNING id,chat_id AS "chatId",sender_id AS "senderId",text,created_at AS "createdAt",delivered,read,edited,deleted`, [id,chatId,uid,text.slice(0,10000),delivered]);
      const message = r.rows[0]; io.to(`chat:${chatId}`).emit('message:new', message); sendUser(recipient, 'message:new', message); ack?.({ ok:true, message });
    } catch (e) { app.log.error(e); ack?.({ ok:false, error:'Message could not be saved' }); }
  });
  socket.on('message:read', async (p: any) => { const chatId = String(p?.chatId || ''), messageId = String(p?.messageId || ''); if (!validChat(chatId, uid) || !messageId) return; await db.query('UPDATE pro_chat_messages SET read=true,delivered=true WHERE id=$1 AND chat_id=$2 AND sender_id<>$3', [messageId,chatId,uid]); io.to(`chat:${chatId}`).emit('message:read',{chatId,messageId,userId:uid}); });
  socket.on('call:start', (p:any) => { const chatId=String(p?.chatId||''); if(!validChat(chatId,uid))return; const other=participants(chatId).find(x=>x!==uid); if(!other)return; const callId=String(p?.callId||randomUUID()); if(!connected.get(other)?.size)return socket.emit('call:unavailable',{callId,reason:'offline'}); sendUser(other,'call:incoming',{callId,chatId,video:Boolean(p?.video),callerId:uid,username:String(p?.username||'contact')}); socket.emit('call:started',{callId,chatId,video:Boolean(p?.video)}); });
  const relay=(event:string)=>(p:any)=>{const chatId=String(p?.chatId||'');if(!validChat(chatId,uid))return;const other=participants(chatId).find(x=>x!==uid);if(other)sendUser(other,event,{...p,from:uid});};
  socket.on('call:offer',relay('call:offer')); socket.on('call:answer',relay('call:answer')); socket.on('call:ice',relay('call:ice')); socket.on('call:reject',relay('call:reject')); socket.on('call:end',relay('call:end'));
  socket.on('disconnect',()=>{const set=connected.get(uid);set?.delete(socket.id);if(!set?.size){connected.delete(uid);void db.query('UPDATE pro_chat_users SET online=false WHERE id=$1',[uid]);io.emit('presence:update',{userId:uid,online:false});}});
});

await app.listen({ host: process.env.HOST || '0.0.0.0', port: Number(process.env.PORT || 3000) });
