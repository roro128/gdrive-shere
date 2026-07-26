import type { RequestHandler } from './$types';
import { requestPasswordReset } from '$lib/server/password-reset';
import { assertSameOrigin, badRequest, readJson, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const input = await readJson<{ loginId?: string }>(event.request);
  if (!input.loginId?.trim()) badRequest('아이디를 입력해주세요.');
  await requestPasswordReset(event, input.loginId);
  return ok({ requested: true });
};
