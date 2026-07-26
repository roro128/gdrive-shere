CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`target_id` text,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drive_files` (
	`id` text PRIMARY KEY NOT NULL,
	`drive_file_id` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`parent_drive_id` text,
	`created_by` text,
	`trashed` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_files_drive_file_id_unique` ON `drive_files` (`drive_file_id`);--> statement-breakpoint
CREATE INDEX `idx_drive_files_parent` ON `drive_files` (`parent_drive_id`,`trashed`,`name`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`revoked_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_hash_unique` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer NOT NULL,
	`transports` text NOT NULL,
	`device_type` text,
	`backed_up` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkeys_credential_id_unique` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `idx_passkeys_user_id` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE TABLE `password_reset_links` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_links_token_unique` ON `password_reset_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_password_reset_links_token` ON `password_reset_links` (`token_hash`,`expires_at`,`used_at`);--> statement-breakpoint
CREATE TABLE `password_reset_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`handled_at` text,
	`handled_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_password_reset_requests_status` ON `password_reset_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`parent_drive_id` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`total_bytes` integer NOT NULL,
	`received_bytes` integer NOT NULL,
	`drive_session_url` text NOT NULL,
	`drive_file_id` text,
	`status` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_upload_sessions_user` ON `upload_sessions` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`invitation_id` text,
	`login_id` text,
	`password_hash` text,
	`google_subject` text,
	`auth_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_login_id` ON `users` (`login_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_google_subject` ON `users` (`google_subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_auth_user_id` ON `users` (`auth_user_id`);--> statement-breakpoint
CREATE TABLE `webauthn_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`challenge` text NOT NULL,
	`kind` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
