import type { RequestHandler } from '$lib/server/runtime';
import { and, eq, or } from 'drizzle-orm';
import { normalizeLoginId } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { users } from '$lib/server/drizzle/auth-schema';
import { ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const rawHandle = event.url.searchParams.get('handle') ?? '';
  if (!rawHandle.trim()) return ok({ available: false, valid: false });

  const handle = (() => {
    try {
      return normalizeLoginId(rawHandle);
    } catch {
      return null;
    }
  })();
  if (!handle) return ok({ available: false, valid: false });

  const existing = await database(event)
    .select({ id: users.id })
    .from(users)
    .where(and(or(eq(users.handle, handle), eq(users.login_id, handle))))
    .get();
  return ok({ available: !existing, valid: true, handle });
};
