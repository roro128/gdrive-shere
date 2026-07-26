import type { RequestHandler } from './$types';
import { verifyRegistration } from '$lib/server/auth';
import { assertSameOrigin, readJson, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const input = await readJson<{ credential?: unknown }>(event.request);
  if (!input.credential) return new Response('credential is required', { status: 400 });
  const user = await verifyRegistration(event, input.credential);
  return ok({
    user: {
      id: user.id,
      displayName: user.display_name,
      handle: user.handle ?? user.login_id,
      role: user.role
    }
  });
};
