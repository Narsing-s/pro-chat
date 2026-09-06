import {Pool, neonConfig} from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor=ws;
const url=process.env.DATABASE_URL;
if(!url)throw new Error('DATABASE_URL is required for the Pro Chat server');
export const db=new Pool({connectionString:url,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
export async function initDb(){
  await db.query(`
    CREATE TABLE IF NOT EXISTS pro_chat_users(
      id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),email TEXT,phone_number TEXT,username TEXT,password_hash TEXT,online BOOLEAN NOT NULL DEFAULT FALSE,email_verified BOOLEAN NOT NULL DEFAULT TRUE
    );
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
    CREATE UNIQUE INDEX IF NOT EXISTS pro_chat_users_email_uq ON pro_chat_users(email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS pro_chat_users_phone_uq ON pro_chat_users(phone_number) WHERE phone_number IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS pro_chat_users_username_uq ON pro_chat_users(username) WHERE username IS NOT NULL;
    CREATE INDEX IF NOT EXISTS pro_chat_users_name_idx ON pro_chat_users(name);
    CREATE TABLE IF NOT EXISTS pro_chat_sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL,expires_at TIMESTAMPTZ NOT NULL);
    CREATE INDEX IF NOT EXISTS pro_chat_sessions_user_idx ON pro_chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS pro_chat_sessions_expiry_idx ON pro_chat_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS pro_chat_messages(id TEXT PRIMARY KEY,chat_id TEXT NOT NULL,sender_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,text TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL,delivered BOOLEAN NOT NULL DEFAULT FALSE,read BOOLEAN NOT NULL DEFAULT FALSE);
    CREATE INDEX IF NOT EXISTS pro_chat_messages_chat_idx ON pro_chat_messages(chat_id,created_at);
    CREATE INDEX IF NOT EXISTS pro_chat_messages_sender_idx ON pro_chat_messages(sender_id);
    CREATE TABLE IF NOT EXISTS pro_chat_reset_tokens(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL);
    CREATE INDEX IF NOT EXISTS pro_chat_reset_expiry_idx ON pro_chat_reset_tokens(expires_at);
    CREATE TABLE IF NOT EXISTS pro_chat_auth_codes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,code_hash TEXT NOT NULL,purpose TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS pro_chat_auth_codes_user_purpose_idx ON pro_chat_auth_codes(user_id,purpose,created_at DESC);
    CREATE INDEX IF NOT EXISTS pro_chat_auth_codes_expiry_idx ON pro_chat_auth_codes(expires_at);
  `);
}
export async function closeDb(){await db.end()}
