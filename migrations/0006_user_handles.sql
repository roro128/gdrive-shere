ALTER TABLE users ADD COLUMN handle TEXT;
--> statement-breakpoint
UPDATE users SET handle = login_id WHERE handle IS NULL AND login_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle) WHERE handle IS NOT NULL;
