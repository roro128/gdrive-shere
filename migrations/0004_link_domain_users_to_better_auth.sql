ALTER TABLE users ADD COLUMN auth_user_id TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;

