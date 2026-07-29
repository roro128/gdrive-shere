import type { RequestHandler } from '$lib/server/runtime';
import { registerMemberWithBetterAuth } from '$lib/server/better-auth-domain';
import { assertSameOrigin, readJson, ok } from '$lib/server/http';
import { toAuthUserResponse } from '$lib/auth-response-model';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const input = await readJson<{
    displayName?: string;
    inviteToken?: string;
    loginId?: string;
    password?: string;
  }>(event.request);
  const result = await registerMemberWithBetterAuth(event, input);
  return ok({
    user: toAuthUserResponse(result.user)
  });
};
