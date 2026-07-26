import type { RequestHandler } from './$types';
import { registerMemberWithBetterAuth } from '$lib/server/better-auth-domain';
import { assertSameOrigin, readJson, ok } from '$lib/server/http';

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
    user: {
      id: result.user.id,
      displayName: result.user.display_name,
      handle: result.user.handle ?? result.user.login_id,
      role: result.user.role
    }
  });
};
