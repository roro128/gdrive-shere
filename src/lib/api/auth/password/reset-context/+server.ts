import type { RequestHandler } from '$lib/server/runtime';
import { getPasswordResetContext } from '$lib/server/password-reset';
import { ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const token = event.url.searchParams.get('token') ?? '';
  return ok(await getPasswordResetContext(event, token));
};
