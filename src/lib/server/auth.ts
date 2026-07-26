import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type WebAuthnCredential
} from '@simplewebauthn/server';
import type { RequestEvent } from '@sveltejs/kit';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { hashPassword, randomToken, sha256, verifyPassword } from './crypto';
import { defaultAvatarUrl } from './avatar';
import {
  database,
  newId,
  now,
  type PasskeyRow,
  type UserRole,
  type UserRow,
  type UserStatus
} from './db';
import {
  invitations,
  legacySessions,
  passkeys,
  users,
  webauthnChallenges
} from './drizzle/auth-schema';
import { badRequest, forbidden, unauthorized } from './http';

const SESSION_COOKIE = 'gdrive_session';
const CHALLENGE_COOKIE = 'gdrive_webauthn_challenge';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type AuthenticatedUser = UserRow;

function env(event: RequestEvent): Env {
  if (!event.platform?.env) throw new Error('Cloudflare environment is not configured');
  return event.platform.env;
}

export function appOrigin(event: RequestEvent): string {
  return env(event).APP_ORIGIN || event.url.origin;
}

export function rpId(event: RequestEvent): string {
  return env(event).RP_ID || new URL(appOrigin(event)).hostname;
}

async function findUserById(event: RequestEvent, userId: string): Promise<UserRow | null> {
  return (await database(event)
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get()) as UserRow | null;
}

async function withDefaultAvatar(event: RequestEvent, user: UserRow): Promise<UserRow> {
  if (user.avatar_url) return user;
  const seed = user.login_id ?? user.handle ?? user.google_subject ?? user.id;
  const avatar_url = await defaultAvatarUrl(seed);
  await database(event)
    .update(users)
    .set({ avatar_url, updated_at: now() })
    .where(eq(users.id, user.id))
    .run();
  return { ...user, avatar_url };
}

export async function currentUser(event: RequestEvent): Promise<AuthenticatedUser | null> {
  try {
    const { createBetterAuth } = await import('./better-auth');
    const betterSession = await createBetterAuth(event).api.getSession({
      headers: event.request.headers
    });
    if (betterSession) {
      const linked = (await database(event)
        .select()
        .from(users)
        .where(and(eq(users.auth_user_id, betterSession.user.id), eq(users.status, 'active')))
        .get()) as UserRow | null;
      if (linked) return withDefaultAvatar(event, linked);
    }
  } catch {
    // Keep the legacy session path available while auth migration is in progress.
  }

  const rawToken = event.cookies.get(SESSION_COOKIE);
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const joined = await database(event)
    .select({ user: users })
    .from(legacySessions)
    .innerJoin(users, eq(users.id, legacySessions.user_id))
    .where(and(eq(legacySessions.token_hash, tokenHash), gt(legacySessions.expires_at, now())))
    .get();
  const row = joined?.user as UserRow | undefined;
  if (row?.status !== 'active') return null;
  return row ? withDefaultAvatar(event, row) : null;
}

export async function requireUser(
  event: RequestEvent,
  role?: UserRole
): Promise<AuthenticatedUser> {
  const user = await currentUser(event);
  if (!user) unauthorized();
  if (role && user.role !== role) forbidden();
  return user;
}

export async function createSession(event: RequestEvent, userId: string): Promise<void> {
  const rawToken = randomToken(32);
  await database(event)
    .insert(legacySessions)
    .values({
      id: newId(),
      user_id: userId,
      token_hash: await sha256(rawToken),
      expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
      created_at: now()
    })
    .run();

  event.cookies.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: event.url.protocol === 'https:',
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function destroySession(event: RequestEvent): Promise<void> {
  const rawToken = event.cookies.get(SESSION_COOKIE);
  if (rawToken) {
    await database(event)
      .delete(legacySessions)
      .where(eq(legacySessions.token_hash, await sha256(rawToken)))
      .run();
  }
  event.cookies.delete(SESSION_COOKIE, { path: '/' });
}

function setChallengeCookie(event: RequestEvent, id: string): void {
  event.cookies.set(CHALLENGE_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: event.url.protocol === 'https:',
    path: '/api/auth',
    maxAge: 300
  });
}

function clearChallengeCookie(event: RequestEvent): void {
  event.cookies.delete(CHALLENGE_COOKIE, { path: '/api/auth' });
}

async function storeChallenge(
  event: RequestEvent,
  userId: string | null,
  challenge: string,
  kind: 'registration' | 'authentication'
) {
  const id = newId();
  await database(event)
    .insert(webauthnChallenges)
    .values({
      id,
      user_id: userId,
      challenge,
      kind,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      created_at: now()
    })
    .run();
  setChallengeCookie(event, id);
}

async function consumeChallenge(event: RequestEvent, kind: 'registration' | 'authentication') {
  const id = event.cookies.get(CHALLENGE_COOKIE);
  if (!id) badRequest('WebAuthn challenge가 없습니다.');
  const challenge = await database(event)
    .select()
    .from(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.id, id),
        eq(webauthnChallenges.kind, kind),
        gt(webauthnChallenges.expires_at, now())
      )
    )
    .get();
  if (!challenge) badRequest('WebAuthn challenge가 만료되었습니다.');
  await database(event).delete(webauthnChallenges).where(eq(webauthnChallenges.id, id)).run();
  clearChallengeCookie(event);
  return challenge;
}

export function normalizeLoginId(value: string): string {
  const loginId = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(loginId))
    badRequest('아이디는 영문 소문자, 숫자, ., _, -로 3~32자까지 입력해주세요.');
  return loginId;
}

async function userForInvite(
  event: RequestEvent,
  inviteToken: string,
  displayName: string,
  rawLoginId: string,
  password: string
): Promise<UserRow> {
  const tokenHash = await sha256(inviteToken);
  const invitation = await database(event)
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.token_hash, tokenHash),
        isNull(invitations.used_at),
        isNull(invitations.revoked_at),
        gt(invitations.expires_at, now())
      )
    )
    .get();
  if (!invitation) badRequest('초대 링크가 만료되었거나 이미 사용되었습니다.');
  if (invitation.role !== 'member') forbidden('관리자 계정은 Google OAuth로만 생성합니다.');

  const loginId = normalizeLoginId(rawLoginId);
  const passwordHash = await hashPassword(password);
  const display = displayName.trim().slice(0, 80);
  if (!display) badRequest('이름을 입력해주세요.');

  const existing = (await database(event)
    .select()
    .from(users)
    .where(eq(users.invitation_id, invitation.id))
    .get()) as UserRow | null;
  if (existing) {
    if (existing.status !== 'pending') badRequest('이미 사용된 초대 링크입니다.');
    await database(event)
      .update(users)
      .set({
        display_name: display,
        login_id: loginId,
        handle: loginId,
        password_hash: passwordHash,
        updated_at: now()
      })
      .where(eq(users.id, existing.id))
      .run();
    const updated = await findUserById(event, existing.id);
    if (!updated) throw new Error('사용자 계정을 찾을 수 없습니다.');
    return updated;
  }

  const user: UserRow = {
    id: newId(),
    display_name: display,
    role: invitation.role,
    status: 'pending',
    invitation_id: invitation.id,
    login_id: loginId,
    handle: loginId,
    avatar_url: null,
    password_hash: passwordHash,
    google_subject: null,
    auth_user_id: null,
    created_at: now(),
    updated_at: now()
  };
  if (!user.display_name) badRequest('이름을 입력해주세요.');
  await database(event).insert(users).values(user).run();
  return user;
}

export async function registrationOptions(
  event: RequestEvent,
  input: { displayName?: string; inviteToken?: string; loginId?: string; password?: string }
) {
  if (!input.inviteToken || !input.loginId || !input.password)
    unauthorized('초대 링크, 아이디, 비밀번호가 필요합니다.');
  const user = await userForInvite(
    event,
    input.inviteToken,
    input.displayName ?? '',
    input.loginId,
    input.password
  );
  if (user.role !== 'member') forbidden('사용자 초대만 패스키 등록을 지원합니다.');

  const currentPasskeys = await database(event)
    .select({ credential_id: passkeys.credential_id, transports: passkeys.transports })
    .from(passkeys)
    .where(eq(passkeys.user_id, user.id))
    .all();
  const options = await generateRegistrationOptions({
    rpName: 'GShare',
    rpID: rpId(event),
    userID: new TextEncoder().encode(user.id),
    userName: user.display_name,
    userDisplayName: user.display_name,
    attestationType: 'none',
    excludeCredentials: currentPasskeys.map(
      (passkey: { credential_id: string; transports: string }) => ({
        id: passkey.credential_id,
        transports: JSON.parse(passkey.transports) as never[]
      })
    ),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred'
    }
  });
  await storeChallenge(event, user.id, options.challenge, 'registration');
  return options;
}

export async function verifyRegistration(
  event: RequestEvent,
  response: unknown
): Promise<AuthenticatedUser> {
  const challenge = await consumeChallenge(event, 'registration');
  if (!challenge.user_id) badRequest('등록 대상 사용자가 없습니다.');
  const verification = await verifyRegistrationResponse({
    response: response as never,
    expectedChallenge: challenge.challenge,
    expectedOrigin: appOrigin(event),
    expectedRPID: rpId(event)
  });
  if (!verification.verified || !verification.registrationInfo)
    badRequest('패스키 등록에 실패했습니다.');

  const info = verification.registrationInfo as unknown as {
    credential: { id: string; publicKey: Uint8Array; counter: number };
    credentialDeviceType?: string;
    credentialBackedUp?: boolean;
  };
  const credential = info.credential;
  await database(event)
    .insert(passkeys)
    .values({
      id: newId(),
      user_id: challenge.user_id,
      credential_id: credential.id,
      public_key: credential.publicKey as never,
      counter: credential.counter,
      transports: '[]',
      device_type: info.credentialDeviceType ?? null,
      backed_up: info.credentialBackedUp ? 1 : 0,
      created_at: now()
    })
    .run();

  await database(event)
    .update(users)
    .set({ status: 'active', updated_at: now() })
    .where(eq(users.id, challenge.user_id))
    .run();
  const linkedUser = await findUserById(event, challenge.user_id);
  if (linkedUser?.invitation_id)
    await database(event)
      .update(invitations)
      .set({ used_at: now() })
      .where(and(eq(invitations.id, linkedUser.invitation_id), isNull(invitations.used_at)))
      .run();
  const user = await findUserById(event, challenge.user_id);
  if (!user) throw new Error('등록한 사용자를 찾을 수 없습니다.');
  await createSession(event, user.id);
  return user;
}

export async function passwordAuthenticationOptions(
  event: RequestEvent,
  input: { loginId?: string; password?: string }
) {
  if (!input.loginId || !input.password) unauthorized('아이디와 비밀번호를 입력해주세요.');
  const loginId = normalizeLoginId(input.loginId);
  const user = (await database(event)
    .select()
    .from(users)
    .where(and(eq(users.login_id, loginId), eq(users.role, 'member'), eq(users.status, 'active')))
    .get()) as UserRow | null;
  const valid = Boolean(
    user?.password_hash && (await verifyPassword(input.password, user.password_hash))
  );
  if (!user || !valid) unauthorized('아이디 또는 비밀번호가 올바르지 않습니다.');

  const userPasskeys = await database(event)
    .select({ credential_id: passkeys.credential_id, transports: passkeys.transports })
    .from(passkeys)
    .where(eq(passkeys.user_id, user.id))
    .all();
  if (!userPasskeys.length)
    unauthorized('아직 등록된 패스키가 없습니다. 초대 링크에서 등록해주세요.');
  const options = await generateAuthenticationOptions({
    rpID: rpId(event),
    userVerification: 'preferred',
    timeout: 60_000,
    allowCredentials: userPasskeys.map((passkey) => ({
      id: passkey.credential_id,
      transports: JSON.parse(passkey.transports) as never[]
    }))
  });
  await storeChallenge(event, user.id, options.challenge, 'authentication');
  return options;
}

export async function verifyAuthentication(
  event: RequestEvent,
  response: unknown
): Promise<AuthenticatedUser> {
  const challenge = await consumeChallenge(event, 'authentication');
  const credentialId = (response as { id?: string }).id;
  if (!credentialId) badRequest('패스키 credential id가 없습니다.');
  const joinedPasskey = await database(event)
    .select({ passkey: passkeys, status: users.status })
    .from(passkeys)
    .innerJoin(users, eq(users.id, passkeys.user_id))
    .where(eq(passkeys.credential_id, credentialId))
    .get();
  const passkey = joinedPasskey
    ? ({ ...joinedPasskey.passkey, status: joinedPasskey.status } as PasskeyRow & {
        status: UserStatus;
      })
    : null;
  if (passkey?.status !== 'active') unauthorized('등록된 패스키를 찾을 수 없습니다.');
  if (!challenge.user_id || passkey.user_id !== challenge.user_id)
    unauthorized('아이디와 패스키가 일치하지 않습니다.');

  const credential: WebAuthnCredential = {
    id: passkey.credential_id,
    publicKey: new Uint8Array(passkey.public_key),
    counter: passkey.counter,
    transports: JSON.parse(passkey.transports)
  };
  const verification = await verifyAuthenticationResponse({
    response: response as never,
    expectedChallenge: challenge.challenge,
    expectedOrigin: appOrigin(event),
    expectedRPID: rpId(event),
    credential
  });
  if (!verification.verified) unauthorized('패스키 인증에 실패했습니다.');
  await database(event)
    .update(passkeys)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(passkeys.id, passkey.id))
    .run();
  const user = await findUserById(event, passkey.user_id);
  if (!user) unauthorized();
  await createSession(event, user.id);
  return user;
}

export function assertGoogleAdminEmail(event: RequestEvent, email: string | null): void {
  const allowed = (env(event).GOOGLE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) forbidden('허용된 Google 관리자 계정이 설정되지 않았습니다.');
  if (!email || !allowed.includes(email.trim().toLowerCase()))
    forbidden('허용되지 않은 Google 관리자 계정입니다.');
}

export async function hasUsers(event: RequestEvent): Promise<boolean> {
  return Boolean(await database(event).select({ id: users.id }).from(users).limit(1).get());
}

export async function findAdminByGoogleSubject(
  event: RequestEvent,
  subject: string
): Promise<UserRow | null> {
  return (await database(event)
    .select()
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.google_subject, subject)))
    .get()) as UserRow | null;
}

export async function createAdminFromGoogle(
  event: RequestEvent,
  profile: { subject: string; email: string | null; name: string | null }
): Promise<UserRow> {
  if (await hasUsers(event)) forbidden('초기 관리자 계정은 이미 생성되었습니다.');
  if (!profile.subject || !profile.email) badRequest('Google 계정 이메일을 확인할 수 없습니다.');
  assertGoogleAdminEmail(event, profile.email);
  const displayName = profile.name?.trim().slice(0, 80) || profile.email.split('@')[0];
  const user: UserRow = {
    id: newId(),
    display_name: displayName,
    role: 'admin',
    status: 'active',
    invitation_id: null,
    login_id: null,
    handle: null,
    avatar_url: null,
    password_hash: null,
    google_subject: profile.subject,
    auth_user_id: null,
    created_at: now(),
    updated_at: now()
  };
  await database(event).insert(users).values(user).run();
  return user;
}

export async function createInvitation(event: RequestEvent, role: UserRole = 'member') {
  const admin = await requireUser(event, 'admin');
  if (role !== 'member') forbidden('관리자 계정은 Google OAuth로만 생성합니다.');
  const rawToken = randomToken(24);
  const invitation = {
    id: newId(),
    tokenHash: await sha256(rawToken),
    role,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    createdAt: now()
  };
  await database(event)
    .insert(invitations)
    .values({
      id: invitation.id,
      token_hash: invitation.tokenHash,
      role: invitation.role,
      expires_at: invitation.expiresAt,
      created_by: admin.id,
      created_at: invitation.createdAt
    })
    .run();
  return { token: rawToken, expiresAt: invitation.expiresAt };
}

export async function listUsers(event: RequestEvent) {
  await requireUser(event, 'admin');
  return database(event)
    .select({
      id: users.id,
      display_name: users.display_name,
      login_id: users.login_id,
      handle: users.handle,
      role: users.role,
      status: users.status,
      created_at: users.created_at,
      updated_at: users.updated_at
    })
    .from(users)
    .orderBy(desc(users.created_at))
    .all();
}

export async function setUserStatus(
  event: RequestEvent,
  userId: string,
  status: 'active' | 'disabled'
) {
  const admin = await requireUser(event, 'admin');
  if (admin.id === userId && status === 'disabled')
    forbidden('현재 관리자 계정은 비활성화할 수 없습니다.');
  await database(event)
    .update(users)
    .set({ status, updated_at: now() })
    .where(eq(users.id, userId))
    .run();
}
