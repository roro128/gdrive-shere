import type { UserRole, UserRow } from './db';

export type GoogleAdminRecordInput = {
  id: string;
  subject: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toGoogleAdminUser(input: GoogleAdminRecordInput): UserRow {
  return {
    id: input.id,
    display_name: input.name?.trim().slice(0, 80) || input.email.split('@')[0],
    role: 'admin',
    status: 'active',
    invitation_id: null,
    login_id: null,
    handle: null,
    avatar_url: null,
    password_hash: null,
    google_subject: input.subject,
    auth_user_id: null,
    created_at: input.createdAt,
    updated_at: input.updatedAt
  };
}

export function buildGoogleAdminUser(
  input: Omit<GoogleAdminRecordInput, 'id' | 'createdAt' | 'updatedAt'>,
  runtime: AuthRecordRuntime
) {
  const timestamp = runtime.now();
  return toGoogleAdminUser({
    ...input,
    id: runtime.newId(),
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export type InvitationRecordInput = {
  id: string;
  tokenHash: string;
  role: UserRole;
  expiresAt: string;
  createdAt: string;
};

export function buildInvitationRecord(
  input: { tokenHash: string; role: UserRole; ttlMs: number },
  runtime: AuthRecordRuntime
) {
  const createdAt = runtime.now();
  return toInvitationRecord({
    id: runtime.newId(),
    tokenHash: input.tokenHash,
    role: input.role,
    expiresAt: new Date(Date.parse(createdAt) + input.ttlMs).toISOString(),
    createdAt
  });
}

export function toInvitationRecord(input: InvitationRecordInput) {
  return { ...input };
}

export function toInvitationDbRecord(input: InvitationRecordInput & { createdBy: string }) {
  return {
    id: input.id,
    token_hash: input.tokenHash,
    role: input.role,
    expires_at: input.expiresAt,
    created_by: input.createdBy,
    created_at: input.createdAt
  };
}

export type LegacySessionRecordInput = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
};

export type AuthRecordRuntime = {
  now: () => string;
  newId: () => string;
};

export function buildLegacySessionRecord(
  input: { userId: string; tokenHash: string; ttlSeconds: number },
  runtime: AuthRecordRuntime
) {
  const createdAt = runtime.now();
  return toLegacySessionRecord({
    id: runtime.newId(),
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: new Date(Date.parse(createdAt) + input.ttlSeconds * 1000).toISOString(),
    createdAt
  });
}

export function toLegacySessionRecord(input: LegacySessionRecordInput) {
  return {
    id: input.id,
    user_id: input.userId,
    token_hash: input.tokenHash,
    expires_at: input.expiresAt,
    created_at: input.createdAt
  };
}

export function toPendingMemberUser(input: {
  id: string;
  displayName: string;
  invitationId: string;
  loginId: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}): UserRow {
  return {
    id: input.id,
    display_name: input.displayName,
    role: 'member',
    status: 'pending',
    invitation_id: input.invitationId,
    login_id: input.loginId,
    handle: input.loginId,
    avatar_url: null,
    password_hash: input.passwordHash,
    google_subject: null,
    auth_user_id: null,
    created_at: input.createdAt,
    updated_at: input.updatedAt
  };
}

export function buildPendingMemberUser(
  input: Omit<Parameters<typeof toPendingMemberUser>[0], 'id' | 'createdAt' | 'updatedAt'>,
  runtime: AuthRecordRuntime
) {
  const createdAt = runtime.now();
  return toPendingMemberUser({ ...input, id: runtime.newId(), createdAt, updatedAt: createdAt });
}

export function toPendingMemberUserUpdate(input: {
  displayName: string;
  loginId: string;
  passwordHash: string;
  updatedAt: string;
}) {
  return {
    display_name: input.displayName,
    login_id: input.loginId,
    handle: input.loginId,
    password_hash: input.passwordHash,
    updated_at: input.updatedAt
  };
}

export function toLinkedMemberUser(input: {
  id: string;
  displayName: string;
  invitationId: string;
  loginId: string;
  authUserId: string;
  createdAt: string;
  updatedAt: string;
}): UserRow {
  return {
    id: input.id,
    display_name: input.displayName,
    role: 'member',
    status: 'active',
    invitation_id: input.invitationId,
    login_id: input.loginId,
    handle: input.loginId,
    avatar_url: null,
    password_hash: null,
    google_subject: null,
    auth_user_id: input.authUserId,
    created_at: input.createdAt,
    updated_at: input.updatedAt
  };
}

export function buildLinkedMemberUser(
  input: Omit<Parameters<typeof toLinkedMemberUser>[0], 'id' | 'createdAt' | 'updatedAt'>,
  runtime: AuthRecordRuntime
) {
  const createdAt = runtime.now();
  return toLinkedMemberUser({ ...input, id: runtime.newId(), createdAt, updatedAt: createdAt });
}

export function toLinkedMemberClaim(input: {
  user: Pick<
    UserRow,
    'id' | 'display_name' | 'login_id' | 'handle' | 'auth_user_id' | 'created_at' | 'updated_at'
  >;
  invitationId: string;
  claimedAt: string;
}) {
  return {
    userId: input.user.id,
    displayName: input.user.display_name,
    loginId: input.user.login_id,
    handle: input.user.handle,
    authUserId: input.user.auth_user_id,
    createdAt: input.user.created_at,
    updatedAt: input.user.updated_at,
    invitationId: input.invitationId,
    claimedAt: input.claimedAt
  };
}

export function buildLinkedMemberClaim(
  user: Parameters<typeof toLinkedMemberClaim>[0]['user'],
  invitationId: string,
  runtime: AuthRecordRuntime
) {
  return toLinkedMemberClaim({ user, invitationId, claimedAt: runtime.now() });
}

export function toUserStatusUpdate(status: 'active' | 'disabled', updatedAt: string) {
  return { status, updated_at: updatedAt };
}

export function toActiveMemberUpdate(loginId: string, updatedAt: string) {
  return { status: 'active' as const, handle: loginId, updated_at: updatedAt };
}

export function toAvatarUpdate(avatarUrl: string, updatedAt: string) {
  return { avatar_url: avatarUrl, updated_at: updatedAt };
}

export function toInvitationUsedUpdate(usedAt: string) {
  return { used_at: usedAt };
}

export function toPasskeyCounterUpdate(counter: number) {
  return { counter };
}
