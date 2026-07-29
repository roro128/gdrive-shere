import { index, integer, blob, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
};

export const authUser = sqliteTable(
  'auth_user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    username: text('username').notNull(),
    displayUsername: text('display_username'),
    ...timestamps
  },
  (table) => ({
    emailUnique: uniqueIndex('auth_user_email_unique').on(table.email),
    usernameUnique: uniqueIndex('auth_user_username_unique').on(table.username)
  })
);

export const authSession = sqliteTable(
  'auth_session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timestamps
  },
  (table) => ({
    tokenUnique: uniqueIndex('auth_session_token_unique').on(table.token),
    userIndex: index('auth_session_user_index').on(table.userId)
  })
);

export const authAccount = sqliteTable(
  'auth_account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    ...timestamps
  },
  (table) => ({
    providerAccountUnique: uniqueIndex('auth_account_provider_account_unique').on(
      table.providerId,
      table.accountId
    ),
    userIndex: index('auth_account_user_index').on(table.userId)
  })
);

export const authVerification = sqliteTable(
  'auth_verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps
  },
  (table) => ({
    identifierValueUnique: uniqueIndex('auth_verification_identifier_value_unique').on(
      table.identifier,
      table.value
    )
  })
);

export const authPasskey = sqliteTable(
  'auth_passkey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
    transports: text('transports'),
    aaguid: text('aaguid'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (table) => ({
    credentialUnique: uniqueIndex('auth_passkey_credential_unique').on(table.credentialID),
    userIndex: index('auth_passkey_user_index').on(table.userId)
  })
);

export const authSchema = {
  user: authUser,
  session: authSession,
  account: authAccount,
  verification: authVerification,
  passkey: authPasskey
};

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    display_name: text('display_name').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull(),
    invitation_id: text('invitation_id'),
    login_id: text('login_id'),
    handle: text('handle'),
    password_hash: text('password_hash'),
    avatar_url: text('avatar_url'),
    google_subject: text('google_subject'),
    auth_user_id: text('auth_user_id'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull()
  },
  (table) => ({
    loginUnique: uniqueIndex('idx_users_login_id').on(table.login_id),
    handleUnique: uniqueIndex('idx_users_handle').on(table.handle),
    googleUnique: uniqueIndex('idx_users_google_subject').on(table.google_subject),
    authUnique: uniqueIndex('idx_users_auth_user_id').on(table.auth_user_id)
  })
);

export const passkeys = sqliteTable(
  'passkeys',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    credential_id: text('credential_id').notNull(),
    public_key: blob('public_key', { mode: 'buffer' }).notNull(),
    counter: integer('counter').notNull(),
    transports: text('transports').notNull(),
    device_type: text('device_type'),
    backed_up: integer('backed_up').notNull(),
    created_at: text('created_at').notNull()
  },
  (table) => ({
    credentialUnique: uniqueIndex('passkeys_credential_id_unique').on(table.credential_id),
    userIndex: index('idx_passkeys_user_id').on(table.user_id)
  })
);

export const legacySessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    token_hash: text('token_hash').notNull(),
    expires_at: text('expires_at').notNull(),
    created_at: text('created_at').notNull()
  },
  (table) => ({ tokenUnique: uniqueIndex('sessions_token_hash_unique').on(table.token_hash) })
);

export const invitations = sqliteTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    token_hash: text('token_hash').notNull(),
    role: text('role').notNull(),
    expires_at: text('expires_at').notNull(),
    used_at: text('used_at'),
    revoked_at: text('revoked_at'),
    created_by: text('created_by').notNull(),
    created_at: text('created_at').notNull()
  },
  (table) => ({ tokenUnique: uniqueIndex('invitations_token_hash_unique').on(table.token_hash) })
);

export const webauthnChallenges = sqliteTable('webauthn_challenges', {
  id: text('id').primaryKey(),
  user_id: text('user_id'),
  challenge: text('challenge').notNull(),
  kind: text('kind').notNull(),
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').notNull()
});

export const accountDeletionJobs = sqliteTable(
  'account_deletion_jobs',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    status: text('status').notNull(),
    last_error: text('last_error'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull()
  },
  (table) => ({ userUnique: uniqueIndex('account_deletion_jobs_user_unique').on(table.user_id) })
);

export const driveFiles = sqliteTable(
  'drive_files',
  {
    id: text('id').primaryKey(),
    drive_file_id: text('drive_file_id').notNull(),
    name: text('name').notNull(),
    mime_type: text('mime_type').notNull(),
    size_bytes: integer('size_bytes').notNull(),
    parent_drive_id: text('parent_drive_id'),
    created_by: text('created_by'),
    owner_user_id: text('owner_user_id'),
    trashed: integer('trashed').notNull(),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull()
  },
  (table) => ({
    driveUnique: uniqueIndex('drive_files_drive_file_id_unique').on(table.drive_file_id),
    parentIndex: index('idx_drive_files_parent').on(
      table.parent_drive_id,
      table.trashed,
      table.name
    ),
    ownerIndex: index('idx_drive_files_owner').on(table.owner_user_id, table.trashed)
  })
);

export const uploadSessions = sqliteTable(
  'upload_sessions',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    parent_drive_id: text('parent_drive_id').notNull(),
    owner_user_id: text('owner_user_id'),
    name: text('name').notNull(),
    mime_type: text('mime_type').notNull(),
    total_bytes: integer('total_bytes').notNull(),
    received_bytes: integer('received_bytes').notNull(),
    drive_session_url: text('drive_session_url').notNull(),
    drive_file_id: text('drive_file_id'),
    status: text('status').notNull(),
    expires_at: text('expires_at').notNull(),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull()
  },
  (table) => ({ userIndex: index('idx_upload_sessions_user').on(table.user_id, table.status) })
);

export const userSpaces = sqliteTable(
  'user_spaces',
  {
    user_id: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    root_drive_id: text('root_drive_id').notNull(),
    created_at: text('created_at').notNull()
  },
  (table) => ({
    rootUnique: uniqueIndex('user_spaces_root_drive_id_unique').on(table.root_drive_id)
  })
);

export const folderShares = sqliteTable(
  'folder_shares',
  {
    id: text('id').primaryKey(),
    folder_drive_id: text('folder_drive_id').notNull(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull().default('editor'),
    created_by: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    created_at: text('created_at').notNull()
  },
  (table) => ({
    folderUserUnique: uniqueIndex('folder_shares_folder_user_unique').on(
      table.folder_drive_id,
      table.user_id
    ),
    userIndex: index('idx_folder_shares_user').on(table.user_id, table.folder_drive_id)
  })
);

export const folderShareInvitations = sqliteTable(
  'folder_share_invitations',
  {
    id: text('id').primaryKey(),
    folder_drive_id: text('folder_drive_id').notNull(),
    invited_user_id: text('invited_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull().default('viewer'),
    invited_by: text('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    created_at: text('created_at').notNull(),
    responded_at: text('responded_at')
  },
  (table) => ({
    folderUserUnique: uniqueIndex('folder_share_invitations_folder_user_unique').on(
      table.folder_drive_id,
      table.invited_user_id
    ),
    userStatusIndex: index('idx_folder_share_invitations_user_status').on(
      table.invited_user_id,
      table.status
    )
  })
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: text('updated_at').notNull()
});

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  user_id: text('user_id'),
  action: text('action').notNull(),
  target_id: text('target_id'),
  metadata: text('metadata').notNull(),
  created_at: text('created_at').notNull()
});

export const passwordResetRequests = sqliteTable(
  'password_reset_requests',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    status: text('status').notNull(),
    created_at: text('created_at').notNull(),
    handled_at: text('handled_at'),
    handled_by: text('handled_by')
  },
  (table) => ({
    statusIndex: index('idx_password_reset_requests_status').on(table.status, table.created_at)
  })
);

export const passwordResetLinks = sqliteTable(
  'password_reset_links',
  {
    id: text('id').primaryKey(),
    request_id: text('request_id').notNull(),
    user_id: text('user_id').notNull(),
    token_hash: text('token_hash').notNull(),
    expires_at: text('expires_at').notNull(),
    used_at: text('used_at'),
    created_by: text('created_by').notNull(),
    created_at: text('created_at').notNull()
  },
  (table) => ({
    tokenUnique: uniqueIndex('password_reset_links_token_unique').on(table.token_hash),
    tokenIndex: index('idx_password_reset_links_token').on(
      table.token_hash,
      table.expires_at,
      table.used_at
    )
  })
);

export const appSchema = {
  users,
  passkeys,
  legacySessions,
  invitations,
  webauthnChallenges,
  accountDeletionJobs,
  driveFiles,
  uploadSessions,
  userSpaces,
  folderShares,
  folderShareInvitations,
  settings,
  auditEvents,
  passwordResetRequests,
  passwordResetLinks
};
export const schema = { ...authSchema, ...appSchema };
