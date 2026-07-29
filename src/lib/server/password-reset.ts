import type { RequestEvent } from '$lib/server/runtime';
import { hashPassword, randomToken, sha256 } from './crypto';
import { database, newId, now, recordAudit } from './db';
import { requireUser, normalizeLoginId } from './auth';
import { badRequest, notFound } from './http';
import { and, asc, eq, gt, isNull, ne } from 'drizzle-orm';
import { createDatabase } from './drizzle/client';
import {
  authAccount,
  authSession,
  passwordResetLinks,
  passwordResetRequests,
  users,
  legacySessions
} from './drizzle/auth-schema';
import { isValidPasswordLength } from '../password-policy';
import {
  buildPasswordResetLinkPlan,
  buildPendingPasswordResetRequest,
  toPasswordResetContext,
  toAuthAccountPasswordUpdate,
  toPasswordResetLinkUsedUpdate,
  toPasswordResetRequestHandledUpdate,
  toPasswordResetRequestView,
  toUserPasswordUpdate
} from './password-reset-model';

const RESET_TTL_MS = 60 * 60 * 1000;

export async function requestPasswordReset(event: RequestEvent, rawLoginId: string): Promise<void> {
  const loginId = normalizeLoginId(rawLoginId);
  const user = await database(event)
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.login_id, loginId), eq(users.role, 'member'), eq(users.status, 'active')))
    .get();
  if (!user) return;
  const existing = await database(event)
    .select({ id: passwordResetRequests.id })
    .from(passwordResetRequests)
    .where(
      and(eq(passwordResetRequests.user_id, user.id), ne(passwordResetRequests.status, 'completed'))
    )
    .limit(1)
    .get();
  if (existing) return;
  await database(event)
    .insert(passwordResetRequests)
    .values(buildPendingPasswordResetRequest(user.id, { now, newId }))
    .run();
}

export async function listPasswordResetRequests(event: RequestEvent) {
  await requireUser(event, 'admin');
  const rows = await database(event)
    .select({
      request: passwordResetRequests,
      login_id: users.login_id,
      display_name: users.display_name,
      expires_at: passwordResetLinks.expires_at
    })
    .from(passwordResetRequests)
    .innerJoin(users, eq(users.id, passwordResetRequests.user_id))
    .leftJoin(
      passwordResetLinks,
      and(
        eq(passwordResetLinks.request_id, passwordResetRequests.id),
        isNull(passwordResetLinks.used_at),
        gt(passwordResetLinks.expires_at, now())
      )
    )
    .where(ne(passwordResetRequests.status, 'completed'))
    .orderBy(asc(passwordResetRequests.created_at))
    .all();
  return rows.map(toPasswordResetRequestView);
}

export async function createPasswordResetLink(event: RequestEvent, requestId: string) {
  const admin = await requireUser(event, 'admin');
  const joined = await database(event)
    .select({ request: passwordResetRequests, user_status: users.status })
    .from(passwordResetRequests)
    .innerJoin(users, eq(users.id, passwordResetRequests.user_id))
    .where(eq(passwordResetRequests.id, requestId))
    .get();
  const request = joined && joined.user_status === 'active' ? joined.request : undefined;
  if (!request || request.status === 'completed')
    notFound('비밀번호 변경 요청을 찾을 수 없습니다.');

  return issuePasswordResetLink(event, admin.id, request);
}

/** Creates a reset link for an active member without requiring a prior self-service request. */
export async function createDirectPasswordResetLink(event: RequestEvent, userId: string) {
  const admin = await requireUser(event, 'admin');
  const member = await database(event)
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, 'member'), eq(users.status, 'active')))
    .get();
  if (!member) notFound('활성 멤버 계정을 찾을 수 없습니다.');

  const existing = await database(event)
    .select()
    .from(passwordResetRequests)
    .where(
      and(
        eq(passwordResetRequests.user_id, member.id),
        ne(passwordResetRequests.status, 'completed')
      )
    )
    .orderBy(asc(passwordResetRequests.created_at))
    .get();
  const request = existing ?? buildPendingPasswordResetRequest(member.id, { now, newId });
  if (!existing) await database(event).insert(passwordResetRequests).values(request).run();

  const result = await issuePasswordResetLink(event, admin.id, request);
  await recordAudit(event, admin.id, 'password_reset.link_created_directly', member.id);
  return result;
}

export async function getPasswordResetContext(event: RequestEvent, token: string) {
  if (!token) return { valid: false as const };

  const tokenHash = await sha256(token);
  const link = await database(event)
    .select({
      used_at: passwordResetLinks.used_at,
      expires_at: passwordResetLinks.expires_at,
      user_status: users.status,
      handle: users.handle,
      login_id: users.login_id
    })
    .from(passwordResetLinks)
    .innerJoin(users, eq(users.id, passwordResetLinks.user_id))
    .where(eq(passwordResetLinks.token_hash, tokenHash))
    .get();

  return toPasswordResetContext(link, now());
}

async function issuePasswordResetLink(
  event: RequestEvent,
  adminId: string,
  request: typeof passwordResetRequests.$inferSelect
) {
  const rawToken = randomToken(32);
  const linkPlan = buildPasswordResetLinkPlan(
    {
      requestId: request.id,
      userId: request.user_id,
      tokenHash: await sha256(rawToken),
      createdBy: adminId,
      ttlMs: RESET_TTL_MS
    },
    { now, newId }
  );
  await database(event)
    .update(passwordResetLinks)
    .set(toPasswordResetLinkUsedUpdate(linkPlan.createdAt))
    .where(and(eq(passwordResetLinks.request_id, request.id), isNull(passwordResetLinks.used_at)))
    .run();
  await database(event).insert(passwordResetLinks).values(linkPlan.record).run();
  await database(event)
    .update(passwordResetRequests)
    .set(
      toPasswordResetRequestHandledUpdate({
        status: 'link_created',
        handledAt: linkPlan.createdAt,
        handledBy: adminId
      })
    )
    .where(eq(passwordResetRequests.id, request.id))
    .run();
  return { link: `${event.url.origin}/reset/${rawToken}`, expiresAt: linkPlan.expiresAt };
}

export async function resetPassword(event: RequestEvent, token: string, password: string) {
  if (!isValidPasswordLength(password))
    badRequest('비밀번호는 8자 이상 128자 이하로 입력해주세요.');
  const tokenHash = await sha256(token);
  const joined = await database(event)
    .select({
      link: passwordResetLinks,
      auth_user_id: users.auth_user_id,
      user_status: users.status
    })
    .from(passwordResetLinks)
    .innerJoin(users, eq(users.id, passwordResetLinks.user_id))
    .where(
      and(
        eq(passwordResetLinks.token_hash, tokenHash),
        isNull(passwordResetLinks.used_at),
        gt(passwordResetLinks.expires_at, now()),
        eq(users.status, 'active')
      )
    )
    .get();
  const link = joined ? { ...joined.link, auth_user_id: joined.auth_user_id } : undefined;
  if (!link) badRequest('비밀번호 변경 링크가 만료되었거나 이미 사용되었습니다.');

  const passwordHash = await hashPassword(password);
  const changedAt = now();
  const claim = await database(event)
    .update(passwordResetLinks)
    .set(toPasswordResetLinkUsedUpdate(changedAt))
    .where(
      and(
        eq(passwordResetLinks.id, link.id),
        isNull(passwordResetLinks.used_at),
        gt(passwordResetLinks.expires_at, changedAt)
      )
    )
    .run();
  if (!claim.meta.changes) badRequest('비밀번호 변경 링크가 만료되었거나 이미 사용되었습니다.');

  await database(event)
    .update(users)
    .set(toUserPasswordUpdate(passwordHash, changedAt))
    .where(eq(users.id, link.user_id))
    .run();
  if (link.auth_user_id) {
    const db = createDatabase(event);
    await db
      .update(authAccount)
      .set(toAuthAccountPasswordUpdate(passwordHash, new Date(changedAt)))
      .where(
        and(eq(authAccount.userId, link.auth_user_id), eq(authAccount.providerId, 'credential'))
      )
      .run();
    await db.delete(authSession).where(eq(authSession.userId, link.auth_user_id)).run();
  }
  await database(event)
    .update(passwordResetRequests)
    .set(toPasswordResetRequestHandledUpdate({ status: 'completed', handledAt: changedAt }))
    .where(eq(passwordResetRequests.id, link.request_id))
    .run();
  await database(event)
    .delete(legacySessions)
    .where(eq(legacySessions.user_id, link.user_id))
    .run();
}
