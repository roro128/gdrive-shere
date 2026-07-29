CREATE TABLE IF NOT EXISTS account_deletion_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_jobs_user_unique
  ON account_deletion_jobs(user_id);
