ALTER TABLE folder_shares RENAME TO folder_shares_old;
--> statement-breakpoint
CREATE TABLE folder_shares (
  id TEXT PRIMARY KEY NOT NULL,
  folder_drive_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'editor' CHECK (permission IN ('viewer', 'editor')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO folder_shares (id, folder_drive_id, user_id, permission, created_by, created_at)
SELECT id, folder_drive_id, user_id, 'editor', created_by, created_at FROM folder_shares_old;
--> statement-breakpoint
DROP TABLE folder_shares_old;
--> statement-breakpoint
CREATE UNIQUE INDEX folder_shares_folder_user_unique ON folder_shares(folder_drive_id, user_id);
--> statement-breakpoint
CREATE INDEX idx_folder_shares_user ON folder_shares(user_id, folder_drive_id);
--> statement-breakpoint
CREATE TABLE folder_share_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  folder_drive_id TEXT NOT NULL,
  invited_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'viewer' CHECK (permission IN ('viewer', 'editor')),
  invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  created_at TEXT NOT NULL,
  responded_at TEXT
);
--> statement-breakpoint
CREATE UNIQUE INDEX folder_share_invitations_folder_user_unique ON folder_share_invitations(folder_drive_id, invited_user_id);
--> statement-breakpoint
CREATE INDEX idx_folder_share_invitations_user_status ON folder_share_invitations(invited_user_id, status);
