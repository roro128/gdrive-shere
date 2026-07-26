import type { RequestHandler } from './$types';
import { resetPassword } from '$lib/server/password-reset';
import { assertSameOrigin, badRequest, readJson, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const input = await readJson<{ token?: string; password?: string }>(event.request);
  if (!input.token || !input.password) badRequest('변경 링크와 새 비밀번호가 필요합니다.');
  await resetPassword(event, input.token, input.password);
  return ok({ changed: true });
};
