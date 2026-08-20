import { json } from '$lib/server/http';
import type { RequestHandler } from '$lib/server/runtime';
import { database } from '$lib/server/db';
import { driveConnected } from '$lib/server/google';
import { settings } from '$lib/server/drizzle/auth-schema';

export const GET: RequestHandler = async (event) => {
  try {
    await database(event).select({ key: settings.key }).from(settings).limit(1).get();
    return json({ ok: true, database: true, googleConnected: await driveConnected(event) });
  } catch {
    return json({ ok: false, error: 'health check failed' }, { status: 503 });
  }
};
