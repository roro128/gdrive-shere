ALTER TABLE users ADD COLUMN login_id TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN google_subject TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_id ON users(login_id) WHERE login_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_subject ON users(google_subject)
WHERE google_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'link_created', 'completed')) DEFAULT 'pending',
  created_at TEXT NOT NULL,
  handled_at TEXT,
  handled_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS password_reset_links (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES password_reset_requests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status
  ON password_reset_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_links_token
  ON password_reset_links(token_hash, expires_at, used_at);
