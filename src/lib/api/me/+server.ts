import type { RequestHandler } from '$lib/server/runtime';
import { currentUser, requireUser } from '$lib/server/auth';
import { hashPassword, verifyPassword } from '$lib/server/crypto';
import { database, now } from '$lib/server/db';
import { authUser, users } from '$lib/server/drizzle/auth-schema';
import { and, eq, ne, or } from 'drizzle-orm';
import { badRequest, assertSameOrigin, ok, unauthorized } from '$lib/server/http';
import { readJson } from '$lib/server/http';
import { createBetterAuth } from '$lib/server/better-auth';
import { getGoogleConnectionStatus } from '$lib/server/google';
import { defaultAvatarUrl } from '$lib/server/avatar';
import { toProfileUser } from '$lib/user-profile';
import { isValidPasswordLength } from '$lib/password-policy';
import { isAllowedAvatarUpdate, resolveProfileHandle } from '$lib/profile-input-model';
import {
  buildProfileUpdateResponse,
  buildProfileUpdateValues,
  toAuthUserImageUpdate
} from '$lib/profile-update-model';

export const GET: RequestHandler = async (event) => {
  const user = await currentUser(event);
  const googleConnectionStatus = user ? await getGoogleConnectionStatus(event) : 'missing';
  return ok({
    user: user ? toProfileUser(user) : null,
    googleConnected: googleConnectionStatus === 'connected',
    googleConnectionStatus
  });
};

export const PATCH: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const user = await requireUser(event);
  const input = await readJson<{
    handle?: string;
    avatarUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
  }>(event.request);
  const defaultAvatar = await defaultAvatarUrl(
    user.login_id ?? user.handle ?? user.google_subject ?? user.id
  );
  const handleResult = resolveProfileHandle(input.handle, user.handle, user.login_id);
  if (!handleResult.valid)
    badRequest('아이디는 영문 소문자, 숫자, ., _, -로 3~32자까지 입력해주세요.');
  const handle = handleResult.handle;
  if (!isAllowedAvatarUpdate(input.avatarUrl, defaultAvatar)) {
    if (
      input.avatarUrl !== undefined &&
      input.avatarUrl !== null &&
      input.avatarUrl.length > 1_500_000
    )
      badRequest('아바타 이미지는 1MB 이하로 업로드해주세요.');
    badRequest('PNG, JPG, WEBP, GIF 이미지만 업로드할 수 있습니다.');
  }
  const handleTaken = handle
    ? await database(event)
        .select({ id: users.id })
        .from(users)
        .where(and(or(eq(users.handle, handle), eq(users.login_id, handle)), ne(users.id, user.id)))
        .get()
    : null;
  if (handleTaken) badRequest('이미 사용 중인 핸들입니다. 다른 핸들을 입력해주세요.');

  if (input.newPassword !== undefined) {
    if (!input.currentPassword) unauthorized('현재 비밀번호를 입력해주세요.');
    if (!isValidPasswordLength(input.newPassword))
      badRequest('비밀번호는 8자 이상 128자 이하로 입력해주세요.');
    if (user.auth_user_id) {
      const result = (await createBetterAuth(event).api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: false
        },
        headers: event.request.headers
      })) as { error?: { message: string } };
      if (result.error) unauthorized(result.error.message);
    } else if (
      !user.password_hash ||
      !(await verifyPassword(input.currentPassword, user.password_hash))
    ) {
      unauthorized('현재 비밀번호가 올바르지 않습니다.');
    }
  }

  const nextPasswordHash =
    input.newPassword && !user.auth_user_id ? await hashPassword(input.newPassword) : undefined;
  const values = buildProfileUpdateValues(
    user,
    { handle, avatarUrl: input.avatarUrl },
    nextPasswordHash,
    now()
  );
  await database(event).update(users).set(values).where(eq(users.id, user.id)).run();
  if (user.auth_user_id) {
    await database(event)
      .update(authUser)
      .set(toAuthUserImageUpdate(values.avatar_url, new Date(values.updated_at)))
      .where(eq(authUser.id, user.auth_user_id))
      .run();
  }
  return ok({
    user: buildProfileUpdateResponse(user, values)
  });
};
