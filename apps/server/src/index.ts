import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, initDb, closeDb } from './db.js';

const app = Fastify({ logger: true, bodyLimit: 256 * 1024 });
const configuredOrigin = process.env.WEB_ORIGIN?.trim();
const corsOrigin = configuredOrigin || true;
await app.register(cors, { origin: corsOrigin });

const secret = process.env.SESSION_SECRET?.trim();
if (!secret) throw new Error('SESSION_SECRET is required in production');
const SESSION_SECRET = secret;

type PublicUser = {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  username?: string;
  createdAt: string;
  online: boolean;
  token?: string;
};

type Message = {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  delivered: boolean;
  read: boolean;
};

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const normalizePhone = (value: unknown) => String(value ?? '').replace(/[\s().-]/g, '').trim();

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, stored?: string) {
  try {
    if (!stored) return false;
    const [salt, encoded] = stored.split(':');
    if (!salt || !encoded) return false;
    const expected = Buffer.from(encoded, 'hex');
    const actual = scryptSync(password, salt, 64);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function sign(payload: string) {
  return createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

function createToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string) {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = sign(payload);
    if (signature.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: string; issuedAt?: number };
    if (!data.userId || !data.issuedAt) return null;
    if (Date.now() - data.issuedAt > 30 * 24 * 60 * 60 * 1000) return null;
    return data.userId;
  } catch {
    return null;
  }
}

function getBearerUser(request: any) {
  const header = String(request.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7));
}

function toPublicUser(user: any, token?: string): PublicUser {
  return {
    id: String(user.id),
    name: String(user.name),
    email: user.email ?? undefined,
    phoneNumber: user.phone_number ?? user.phoneNumber ?? undefined,
    username: user.username ?? undefined,
    createdAt: new Date(user.created_at ?? user.createdAt).toISOString(),
    online: Boolean(user.online),
    ...(token ? { token } : {})
  };
}

function chatParticipants(chatId: string) {
  return chatId.split(':');
}

const connectedUsers = new Map<string, string>();

await initDb();

app.get('/health', async () => ({
  ok: true,
  service: 'pro-chat',
  database: 'neon-postgresql',
  time: new Date().toISOString()
}));

app.post<{ Body: { email?: string; phoneNumber?: string; username?: string; password?: string } }>('/api/auth/register', async (request, reply) => {
  const email = normalize(request.body?.email);
  const phoneNumber = normalizePhone(request.body?.phoneNumber);
  const username = normalize(request.body?.username);
  const password = String(request.body?.password || '');

  if (!email.includes('@')) return reply.code(400).send({ error: 'Enter a valid email address' });
  if (phoneNumber.replace(/\D/g, '').length < 7) return reply.code(400).send({ error: 'Enter a valid phone number' });
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return reply.code(400).send({ error: 'Username must be 3-30 characters using letters, numbers, or underscore' });
  if (password.length < 8) return reply.code(400).send({ error: 'Password must contain at least 8 characters' });

  const duplicate = await db.query(
    'SELECT id FROM pro_chat_users WHERE email=$1 OR phone_number=$2 OR username=$3 LIMIT 1',
    [email, phoneNumber, username]
  );
  if (duplicate.rowCount) return reply.code(409).send({ error: 'An account already exists with that email, phone number, or username' });

  const id = randomUUID();
  const createdAt = new Date();
  const name = username;
  await db.query(
    'INSERT INTO pro_chat_users(id,name,created_at,email,phone_number,username,password_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [id, name, createdAt, email, phoneNumber, username, hashPassword(password)]
  );

  const token = createToken(id);
  await db.query(
    'INSERT INTO pro_chat_sessions(token,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)',
    [token, id, createdAt, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
  );

  return { id, name, email, phoneNumber, username, createdAt: createdAt.toISOString(), online: false, token };
});

app.post<{ Body: { identifier?: string; password?: string } }>('/api/auth/login', async (request, reply) => {
  const identifier = String(request.body?.identifier || '').trim();
  const password = String(request.body?.password || '');
  if (!identifier || !password) return reply.code(400).send({ error: 'Enter your login details' });

  const email = normalize(identifier);
  const phoneNumber = normalizePhone(identifier);
  const username = normalize(identifier);
  const result = await db.query(
    'SELECT * FROM pro_chat_users WHERE email=$1 OR phone_number=$2 OR username=$3 LIMIT 1',
    [email, phoneNumber, username]
  );
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return reply.code(401).send({ error: 'Invalid username, email/phone, or password' });

  const token = createToken(user.id);
  await db.query(
    'INSERT INTO pro_chat_sessions(token,user_id,created_at,expires_at) VALUES($1,$2,NOW(),NOW()+INTERVAL \'30 days\')',
    [token, user.id]
  );
  return toPublicUser(user, token);
});

app.post<{ Body: { identifier?: string } }>('/api/auth/forgot-password', async (request) => {
  const identifier = String(request.body?.identifier || '').trim();
  const result = await db.query(
    'SELECT * FROM pro_chat_users WHERE email=$1 OR phone_number=$2 OR username=$3 LIMIT 1',
    [normalize(identifier), normalizePhone(identifier), normalize(identifier)]
  );
  const user = result.rows[0];

  if (user?.email) {
    const token = randomBytes(32).toString('hex');
    await db.query('DELETE FROM pro_chat_reset_tokens WHERE user_id=$1', [user.id]);
    await db.query(
      'INSERT INTO pro_chat_reset_tokens(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL \'15 minutes\')',
      [token, user.id]
    );

    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'Pro Chat <onboarding@resend.dev>',
            to: [user.email],
            subject: 'Pro Chat password reset',
            html: `<p><a href="${process.env.WEB_ORIGIN || ''}/?reset=${token}">Reset your Pro Chat password</a></p><p>This link expires in 15 minutes.</p>`
          })
        });
      } catch (error) {
        app.log.error(error);
      }
    }
  }

  return { message: 'If the account exists and has an email address, password reset instructions have been sent.' };
});

app.post<{ Body: { token?: string; password?: string } }>('/api/auth/reset-password', async (request, reply) => {
  const resetToken = String(request.body?.token || '');
  const password = String(request.body?.password || '');
  if (password.length < 8) return reply.code(400).send({ error: 'Password must contain at least 8 characters' });

  const result = await db.query(
    'SELECT * FROM pro_chat_reset_tokens WHERE token=$1 AND expires_at>NOW()',
    [resetToken]
  );
  if (!result.rowCount) return reply.code(400).send({ error: 'Reset link is invalid or expired' });

  const reset = result.rows[0];
  await db.query('UPDATE pro_chat_users SET password_hash=$1 WHERE id=$2', [hashPassword(password), reset.user_id]);
  await db.query('DELETE FROM pro_chat_sessions WHERE user_id=$1', [reset.user_id]);
  await db.query('DELETE FROM pro_chat_reset_tokens WHERE token=$1', [resetToken]);
  return { ok: true, message: 'Password reset successfully' };
});

app.post('/api/session', async (request: any, reply) => {
  const userId = getBearerUser(request);
  if (!userId) return reply.code(401).send({ error: 'Authentication required' });

  const result = await db.query('SELECT * FROM pro_chat_users WHERE id=$1', [userId]);
  if (!result.rowCount) return reply.code(401).send({ error: 'User not found' });

  const token = createToken(userId);
  await db.query(
    'INSERT INTO pro_chat_sessions(token,user_id,created_at,expires_at) VALUES($1,$2,NOW(),NOW()+INTERVAL \'30 days\')',
    [token, userId]
  );
  return toPublicUser(result.rows[0], token);
});

app.get('/api/users', async (request: any, reply) => {
  const userId = getBearerUser(request);
  const query = normalize(request.query?.q || '');
  if (query.length > 100) return reply.code(400).send({ error: 'Search text is too long' });

  const phoneQuery = normalizePhone(query);
  const result = await db.query(
    `SELECT id,name,email,phone_number,username,created_at,online
     FROM pro_chat_users
     WHERE id<>$1
       AND ($2='' OR LOWER(username) LIKE $3 OR LOWER(name) LIKE $3 OR LOWER(email) LIKE $3 OR phone_number LIKE $4)
     ORDER BY CASE WHEN LOWER(username)=$2 THEN 0 WHEN LOWER(username) LIKE $5 THEN 1 ELSE 2 END, name
     LIMIT 50`,
    [userId || '', query, `%${query}%`, `%${phoneQuery}%`, `${query}%`]
  );
  return result.rows.map((user) => toPublicUser(user));
});

app.get<{ Params: { chatId: string } }>('/api/messages/:chatId', async (request, reply) => {
  const userId = getBearerUser(request);
  if (!userId) return reply.code(401).send({ error: 'Authentication required' });
  const participants = chatParticipants(request.params.chatId);
  if (participants.length !== 2 || !participants.includes(userId)) return reply.code(403).send({ error: 'Conversation access denied' });

  const result = await db.query(
    `SELECT id,chat_id AS "chatId",sender_id AS "senderId",text,created_at AS "createdAt",delivered,read
     FROM pro_chat_messages WHERE chat_id=$1 ORDER BY created_at ASC LIMIT 200`,
    [request.params.chatId]
  );
  return result.rows;
});

const httpServer = app.server;
const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 256 * 1024
});

io.use((socket, next) => {
  const userId = verifyToken(String(socket.handshake.auth?.token || ''));
  if (!userId) return next(new Error('Authentication required'));
  socket.data.userId = userId;
  next();
});

io.on('connection', (socket) => {
  const userId = String(socket.data.userId);
  connectedUsers.set(socket.id, userId);

  void db.query('UPDATE pro_chat_users SET online=true WHERE id=$1', [userId]);
  io.emit('presence:update', { userId, online: true });

  socket.on('chat:join', (chatId: string) => {
    const participants = chatParticipants(String(chatId));
    if (participants.length === 2 && participants.includes(userId)) socket.join(`chat:${chatId}`);
  });

  socket.on('message:send', async (input: any, acknowledge?: (value: any) => void) => {
    try {
      const chatId = String(input?.chatId || '');
      const text = String(input?.text || '').trim();
      const participants = chatParticipants(chatId);
      if (!chatId || !text || participants.length !== 2 || !participants.includes(userId)) {
        acknowledge?.({ ok: false, error: 'Invalid message' });
        return;
      }

      const message: Message = {
        id: String(input?.id || randomUUID()),
        chatId,
        senderId: userId,
        text: text.slice(0, 10000),
        createdAt: String(input?.createdAt || new Date().toISOString()),
        delivered: false,
        read: false
      };

      const existing = await db.query(
        'SELECT id,chat_id AS "chatId",sender_id AS "senderId",text,created_at AS "createdAt",delivered,read FROM pro_chat_messages WHERE id=$1',
        [message.id]
      );
      if (existing.rowCount) {
        acknowledge?.({ ok: true, message: existing.rows[0] });
        return;
      }

      const recipient = participants.find((id) => id !== userId) as string;
      message.delivered = Array.from(connectedUsers.values()).includes(recipient);

      await db.query(
        'INSERT INTO pro_chat_messages(id,chat_id,sender_id,text,created_at,delivered,read) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [message.id, message.chatId, message.senderId, message.text, message.createdAt, message.delivered, false]
      );

      for (const [socketId, connectedUserId] of connectedUsers.entries()) {
        if (participants.includes(connectedUserId)) io.to(socketId).emit('message:new', message);
      }
      acknowledge?.({ ok: true, message });
    } catch (error) {
      app.log.error(error);
      acknowledge?.({ ok: false, error: 'Message could not be saved' });
    }
  });

  socket.on('message:read', async (payload: any) => {
    const chatId = String(payload?.chatId || '');
    const messageId = String(payload?.messageId || '');
    if (!chatId || !chatParticipants(chatId).includes(userId)) return;
    if (messageId) {
      await db.query('UPDATE pro_chat_messages SET read=true WHERE id=$1 AND chat_id=$2 AND sender_id<>$3', [messageId, chatId, userId]);
    } else {
      await db.query('UPDATE pro_chat_messages SET read=true WHERE chat_id=$1 AND sender_id<>$2', [chatId, userId]);
    }
  });

  socket.on('disconnect', async () => {
    connectedUsers.delete(socket.id);
    if (!Array.from(connectedUsers.values()).includes(userId)) {
      await db.query('UPDATE pro_chat_users SET online=false WHERE id=$1', [userId]);
      io.emit('presence:update', { userId, online: false });
    }
  });
});

setInterval(() => {
  void db.query('DELETE FROM pro_chat_sessions WHERE expires_at<NOW()').catch((error) => app.log.error(error));
  void db.query('DELETE FROM pro_chat_reset_tokens WHERE expires_at<NOW()').catch((error) => app.log.error(error));
}, 6 * 60 * 60 * 1000).unref();

const port = Number(process.env.PORT || 3000);
await app.listen({ port, host: '0.0.0.0' });
app.log.info(`Pro Chat server listening on ${port}`);

const shutdown = async () => {
  await closeDb();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
