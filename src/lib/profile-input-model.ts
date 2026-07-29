import { normalizeLoginIdValue } from './server/auth-model';

const AVATAR_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i;
const MAX_AVATAR_DATA_URL_LENGTH = 1_500_000;

export type ProfileHandleResult =
  { valid: true; handle: string | null } | { valid: false; handle: null };

export function resolveProfileHandle(
  inputHandle: string | undefined,
  currentHandle: string | null | undefined,
  currentLoginId: string | null | undefined
): ProfileHandleResult {
  if (inputHandle === undefined) {
    return { valid: true, handle: currentHandle ?? currentLoginId ?? null };
  }
  if (!inputHandle) return { valid: false, handle: null };
  const handle = normalizeLoginIdValue(inputHandle);
  return handle ? { valid: true, handle } : { valid: false, handle: null };
}

export function isAllowedAvatarUpdate(
  avatarUrl: string | null | undefined,
  defaultAvatarUrl: string
): boolean {
  if (avatarUrl === undefined || avatarUrl === null || avatarUrl === defaultAvatarUrl) return true;
  return avatarUrl.length <= MAX_AVATAR_DATA_URL_LENGTH && AVATAR_DATA_URL_PATTERN.test(avatarUrl);
}
