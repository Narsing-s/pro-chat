import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required for the Pro Chat server');
export const db = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
export async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS pro_chat_users(
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      email TEXT,
      phone_number TEXT,
      username TEXT,
      password_hash TEXT,
      online BOOLEAN NOT NULL DEFAULT FALSE,
      email_verified BOOLEAN NOT NULL DEFAULT TRUE,
      about TEXT,
      profile_photo_url TEXT
    );
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS about TEXT;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS pro_chat_users_email_uq ON pro_chat_users(email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS pro_chat_users_phone_uq ON pro_chat_users(phone_number) WHERE phone_number IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS pro_chat_users_username_uq ON pro_chat_users(username) WHERE username IS NOT NULL;
    CREATE INDEX IF NOT EXISTS pro_chat_users_name_idx ON pro_chat_users(name);

    CREATE TABLE IF NOT EXISTS pro_chat_sessions(
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS pro_chat_sessions_user_idx ON pro_chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS pro_chat_sessions_expiry_idx ON pro_chat_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS pro_chat_messages(
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      sender_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      delivered BOOLEAN NOT NULL DEFAULT FALSE,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      edited BOOLEAN NOT NULL DEFAULT FALSE,
      deleted BOOLEAN NOT NULL DEFAULT FALSE
    );
    ALTER TABLE pro_chat_messages ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE pro_chat_messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS pro_chat_messages_chat_idx ON pro_chat_messages(chat_id,created_at);
    CREATE INDEX IF NOT EXISTS pro_chat_messages_sender_idx ON pro_chat_messages(sender_id);
    CREATE INDEX IF NOT EXISTS pro_chat_messages_search_idx ON pro_chat_messages USING GIN (to_tsvector('simple', text));

    CREATE TABLE IF NOT EXISTS pro_chat_reset_tokens(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL);
    CREATE INDEX IF NOT EXISTS pro_chat_reset_expiry_idx ON pro_chat_reset_tokens(expires_at);
    CREATE TABLE IF NOT EXISTS pro_chat_auth_codes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,code_hash TEXT NOT NULL,purpose TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS pro_chat_auth_codes_user_purpose_idx ON pro_chat_auth_codes(user_id,purpose,created_at DESC);
    CREATE INDEX IF NOT EXISTS pro_chat_auth_codes_expiry_idx ON pro_chat_auth_codes(expires_at);

    CREATE TABLE IF NOT EXISTS pro_chat_blocks(blocker_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,blocked_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(blocker_id,blocked_id));
    CREATE TABLE IF NOT EXISTS pro_chat_groups(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT,created_by TEXT NOT NULL REFERENCES pro_chat_users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pro_chat_group_members(group_id TEXT NOT NULL REFERENCES pro_chat_groups(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,role TEXT NOT NULL DEFAULT 'member',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(group_id,user_id));
    CREATE INDEX IF NOT EXISTS pro_chat_group_members_user_idx ON pro_chat_group_members(user_id);
  `);
}
export async function closeDb(){ await db.end(); }
