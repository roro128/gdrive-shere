import type { RequestHandler } from '$lib/server/runtime';
import { listPasswordResetRequests } from '$lib/server/password-reset';
import { ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const rows = await listPasswordResetRequests(event);
  return ok({ requests: rows });
};
