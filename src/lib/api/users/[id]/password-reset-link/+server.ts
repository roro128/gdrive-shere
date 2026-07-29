import type { RequestHandler } from '$lib/server/runtime';
import { createDirectPasswordResetLink } from '$lib/server/password-reset';
import { assertSameOrigin, ok } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  return ok(await createDirectPasswordResetLink(event, event.params.id));
};
