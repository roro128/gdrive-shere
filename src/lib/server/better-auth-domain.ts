import type { RequestEvent } from '$lib/server/runtime';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { sha256 } from './crypto';
import { createBetterAuth } from './better-auth';
import { database, newId, now, type UserRole, type UserRow } from './db';
import { badRequest, forbidden } from './http';
import { normalizeLoginId } from './auth';
import { buildBetterAuthRegistrationBody } from './auth-model';
import { invitations, users } from './drizzle/auth-schema';
import { isValidPasswordLength } from '../password-policy';
import {
  toActiveMemberUpdate,
  toInvitationUsedUpdate,
  buildLinkedMemberClaim,
  buildLinkedMemberUser
} from './auth-record-model';

async function removePartialRegistration(
  event: RequestEvent,
  authUserId: string,
  domainUserId?: string
): Promise<void> {
  const d1 = event.platform?.env.DB;
  if (!d1) return;
  const statements = [
    ...(domainUserId ? [d1.prepare('DELETE FROM users WHERE id = ?').bind(domainUserId)] : []),
    d1.prepare('DELETE FROM auth_user WHERE id = ?').bind(authUserId)
  ];
  try {
    await d1.batch(statements);
  } catch (cause) {
    console.error('Failed to remove a partial member registration', {
      authUserId,
      domainUserId,
      cause: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

export async function registerMemberWithBetterAuth(
  event: RequestEvent,
  input: { displayName?: string; inviteToken?: string; loginId?: string; password?: string }
): Promise<{ user: UserRow }> {
  if (!input.inviteToken || !input.loginId || !input.password)
    badRequest('초대 링크, 아이디, 비밀번호가 필요합니다.');

  const invitation = (await database(event)
    .select({
      id: invitations.id,
      role: invitations.role,
      used_at: invitations.used_at
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.token_hash, await sha256(input.inviteToken)),
        isNull(invitations.revoked_at),
        gt(invitations.expires_at, now())
      )
    )
    .get()) as { id: string; role: UserRole; used_at: string | null } | undefined;
  if (!invitation) badRequest('초대 링크가 만료되었거나 이미 사용되었습니다.');
  if (invitation.role !== 'member') forbidden('관리자 계정은 Google OAuth로만 생성합니다.');

  const displayName = input.displayName?.trim().slice(0, 80);
  if (!displayName) badRequest('이름을 입력해주세요.');
  const loginId = normalizeLoginId(input.loginId);
  if (!isValidPasswordLength(input.password))
    badRequest('비밀번호는 8자 이상 128자 이하로 입력해주세요.');

  const existing = await database(event)
    .select()
    .from(users)
    .where(eq(users.invitation_id, invitation.id))
    .get();
  if (existing) {
    if (existing.status !== 'pending' || existing.login_id !== loginId || !existing.auth_user_id) {
      badRequest('이미 사용된 초대 링크입니다.');
    }
    if (!invitation.used_at) {
      await database(event)
        .update(invitations)
        .set(toInvitationUsedUpdate(now()))
        .where(and(eq(invitations.id, invitation.id), isNull(invitations.used_at)))
        .run();
    }
    await database(event)
      .update(users)
      .set(toActiveMemberUpdate(loginId, now()))
      .where(eq(users.id, existing.id))
      .run();
    return { user: { ...(existing as UserRow), status: 'active' } };
  }
  if (invitation.used_at) badRequest('이미 사용된 초대 링크입니다.');

  const handleTaken = await database(event)
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.handle, loginId), eq(users.login_id, loginId)))
    .get();
  if (handleTaken) badRequest('이미 사용 중인 핸들입니다. 다른 핸들을 입력해주세요.');

  const auth = createBetterAuth(event, undefined, true);
  const result = await auth.api.signUpEmail({
    body: buildBetterAuthRegistrationBody({ displayName, loginId, password: input.password })
  });

  const user = buildLinkedMemberUser(
    {
      displayName,
      invitationId: invitation.id,
      loginId,
      authUserId: result.user.id
    },
    { now, newId }
  );

  const d1 = event.platform?.env.DB;
  if (!d1) {
    await removePartialRegistration(event, result.user.id);
    throw new Error('Cloudflare D1 binding is not configured');
  }

  try {
    const claim = buildLinkedMemberClaim(user, invitation.id, { now, newId });
    const results = await d1.batch([
      d1
        .prepare(
          `INSERT INTO users (
            id, display_name, role, status, invitation_id, login_id, handle, password_hash,
            google_subject, auth_user_id, created_at, updated_at
          )
          SELECT ?, ?, 'member', 'active', id, ?, ?, NULL, NULL, ?, ?, ?
          FROM invitations
          WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`
        )
        .bind(
          claim.userId,
          claim.displayName,
          claim.loginId,
          claim.handle,
          claim.authUserId,
          claim.createdAt,
          claim.updatedAt,
          claim.invitationId,
          claim.claimedAt
        ),
      d1
        .prepare(
          `UPDATE invitations
           SET used_at = ?
           WHERE id = ? AND used_at IS NULL
             AND EXISTS (
               SELECT 1 FROM users
               WHERE invitation_id = ? AND auth_user_id = ?
             )`
        )
        .bind(claim.claimedAt, claim.invitationId, claim.invitationId, claim.authUserId)
    ]);
    if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) {
      await removePartialRegistration(event, result.user.id, user.id);
      badRequest('이미 사용된 초대 링크입니다.');
    }
  } catch (cause) {
    await removePartialRegistration(event, result.user.id, user.id);
    throw cause;
  }

  return { user };
}
