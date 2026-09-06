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
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
      about TEXT,
      profile_photo_url TEXT,
      pronouns TEXT,
      website TEXT,
      deleted_at TIMESTAMPTZ,
      two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      two_factor_secret TEXT,
      recovery_codes_hash TEXT[]
    );
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS about TEXT;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS pronouns TEXT;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS website TEXT;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
    ALTER TABLE pro_chat_users ADD COLUMN IF NOT EXISTS recovery_codes_hash TEXT[];
    CREATE UNIQUE INDEX IF NOT EXISTS pro_chat_users_email_uq ON pro_chat_users(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS pro_chat_users_phone_uq ON pro_chat_users(phone_number) WHERE phone_number IS NOT NULL AND deleted_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS pro_chat_users_username_uq ON pro_chat_users(username) WHERE username IS NOT NULL AND deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS pro_chat_users_name_idx ON pro_chat_users(name);

    CREATE TABLE IF NOT EXISTS pro_chat_sessions(
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL DEFAULT 'Unknown device',
      user_agent TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      trusted BOOLEAN NOT NULL DEFAULT FALSE,
      revoked_at TIMESTAMPTZ
    );
    ALTER TABLE pro_chat_sessions ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT 'legacy';
    ALTER TABLE pro_chat_sessions ADD COLUMN IF NOT EXISTS device_name TEXT NOT NULL DEFAULT 'Unknown device';
    ALTER TABLE pro_chat_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
    ALTER TABLE pro_chat_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
    ALTER TABLE pro_chat_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE pro_chat_sessions ADD COLUMN IF NOT EXISTS trusted BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE pro_chat_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS pro_chat_sessions_user_idx ON pro_chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS pro_chat_sessions_expiry_idx ON pro_chat_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS pro_chat_sessions_device_idx ON pro_chat_sessions(device_id);

    CREATE TABLE IF NOT EXISTS pro_chat_auth_codes(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      purpose TEXT NOT NULL,
      destination TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed_at TIMESTAMPTZ
    );
    ALTER TABLE pro_chat_auth_codes ADD COLUMN IF NOT EXISTS destination TEXT;
    ALTER TABLE pro_chat_auth_codes ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS pro_chat_auth_codes_user_purpose_idx ON pro_chat_auth_codes(user_id,purpose,created_at DESC);
    CREATE INDEX IF NOT EXISTS pro_chat_auth_codes_expiry_idx ON pro_chat_auth_codes(expires_at);

    CREATE TABLE IF NOT EXISTS pro_chat_reset_tokens(
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ
    );
    ALTER TABLE pro_chat_reset_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE pro_chat_reset_tokens ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS pro_chat_reset_expiry_idx ON pro_chat_reset_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS pro_chat_login_activity(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      session_id TEXT,
      device_id TEXT,
      device_name TEXT,
      ip_address TEXT,
      user_agent TEXT,
      success BOOLEAN NOT NULL,
      reason TEXT,
      suspicious BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pro_chat_login_activity_user_idx ON pro_chat_login_activity(user_id,created_at DESC);

    CREATE TABLE IF NOT EXISTS pro_chat_trusted_devices(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pro_chat_trusted_devices_uq ON pro_chat_trusted_devices(user_id,device_id) WHERE revoked_at IS NULL;

    CREATE TABLE IF NOT EXISTS pro_chat_passkeys(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      device_type TEXT,
      backed_up BOOLEAN NOT NULL DEFAULT FALSE,
      transports TEXT[],
      name TEXT NOT NULL DEFAULT 'Passkey',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS pro_chat_passkeys_user_idx ON pro_chat_passkeys(user_id);

    CREATE TABLE IF NOT EXISTS pro_chat_webauthn_challenges(
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      challenge TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS pro_chat_webauthn_challenge_idx ON pro_chat_webauthn_challenges(challenge);

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

    ALTER TABLE pro_chat_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT REFERENCES pro_chat_messages(id) ON DELETE SET NULL;
    ALTER TABLE pro_chat_messages ADD COLUMN IF NOT EXISTS forwarded_from_id TEXT REFERENCES pro_chat_messages(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS pro_chat_messages_reply_idx ON pro_chat_messages(reply_to_id);
    CREATE INDEX IF NOT EXISTS pro_chat_messages_forward_idx ON pro_chat_messages(forwarded_from_id);

    CREATE TABLE IF NOT EXISTS pro_chat_message_deleted_for_me(
      message_id TEXT NOT NULL REFERENCES pro_chat_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(message_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS pro_chat_message_deleted_user_idx ON pro_chat_message_deleted_for_me(user_id,deleted_at DESC);

    CREATE TABLE IF NOT EXISTS pro_chat_message_reactions(
      message_id TEXT NOT NULL REFERENCES pro_chat_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(message_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS pro_chat_message_reactions_message_idx ON pro_chat_message_reactions(message_id);

    CREATE TABLE IF NOT EXISTS pro_chat_message_pins(
      message_id TEXT PRIMARY KEY REFERENCES pro_chat_messages(id) ON DELETE CASCADE,
      pinned_by TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pro_chat_message_pins_user_idx ON pro_chat_message_pins(pinned_by,pinned_at DESC);

    CREATE TABLE IF NOT EXISTS pro_chat_blocks(blocker_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,blocked_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(blocker_id,blocked_id));
    CREATE TABLE IF NOT EXISTS pro_chat_groups(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT,created_by TEXT NOT NULL REFERENCES pro_chat_users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pro_chat_group_members(group_id TEXT NOT NULL REFERENCES pro_chat_groups(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,role TEXT NOT NULL DEFAULT 'member',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(group_id,user_id));
    CREATE INDEX IF NOT EXISTS pro_chat_group_members_user_idx ON pro_chat_group_members(user_id);

    CREATE TABLE IF NOT EXISTS pro_chat_support_tickets(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT,
      subject TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pro_chat_support_tickets_user_idx ON pro_chat_support_tickets(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS pro_chat_support_tickets_status_idx ON pro_chat_support_tickets(status,updated_at DESC);

    CREATE TABLE IF NOT EXISTS pro_chat_support_messages(
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES pro_chat_support_tickets(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL DEFAULT 'user',
      sender_user_id TEXT REFERENCES pro_chat_users(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pro_chat_support_messages_ticket_idx ON pro_chat_support_messages(ticket_id,created_at);
  `);
}
export async function closeDb(){ await db.end(); }
