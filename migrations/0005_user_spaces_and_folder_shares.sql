ALTER TABLE drive_files ADD COLUMN owner_user_id TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_drive_files_owner
  ON drive_files(owner_user_id, trashed);
--> statement-breakpoint
ALTER TABLE upload_sessions ADD COLUMN owner_user_id TEXT;
--> statement-breakpoint
CREATE TABLE user_spaces (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  root_drive_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE folder_shares (
  id TEXT PRIMARY KEY NOT NULL,
  folder_drive_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'editor'
    CHECK (permission IN ('editor')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX folder_shares_folder_user_unique
  ON folder_shares(folder_drive_id, user_id);
--> statement-breakpoint
CREATE INDEX idx_folder_shares_user
  ON folder_shares(user_id, folder_drive_id);
