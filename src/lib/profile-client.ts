import { readResponseMessage } from './response-message';

type ProfileRequest = (input: string, init?: RequestInit) => Promise<Response>;

export async function fetchProfilePasskeys<T>(request: ProfileRequest): Promise<T[]> {
  const response = await request('/api/me/passkeys');
  if (!response.ok)
    throw new Error(await readResponseMessage(response, '패스키 목록을 불러오지 못했습니다.'));
  return ((await response.json()) as { passkeys?: T[] }).passkeys ?? [];
}

export async function patchProfile<T>(input: {
  request: ProfileRequest;
  body: Record<string, unknown>;
}): Promise<T | null> {
  const response = await input.request('/api/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input.body)
  });
  if (!response.ok)
    throw new Error(await readResponseMessage(response, '프로필을 저장하지 못했습니다.'));
  return ((await response.json()) as { user?: T }).user ?? null;
}
