import type { RequestHandler } from './$types';
import { passwordAuthenticationOptions } from '$lib/server/auth';
import { assertSameOrigin, readJson, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const input = await readJson<{ loginId?: string; password?: string }>(event.request);
  return ok(await passwordAuthenticationOptions(event, input));
};
