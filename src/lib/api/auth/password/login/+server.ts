import type { RequestHandler } from '$lib/server/runtime';
import { loginWithLegacyPassword } from '$lib/server/auth';
import { assertSameOrigin, readJson } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const input = await readJson<{ loginId?: string; password?: string }>(event.request);
  await loginWithLegacyPassword(event, input);
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};
