CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY NOT NULL,
  drive_file_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_share_links_file
  ON share_links(drive_file_id, revoked_at);
