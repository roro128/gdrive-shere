import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { database } from '$lib/server/db';
import { driveConnected } from '$lib/server/google';
import { settings } from '$lib/server/drizzle/auth-schema';

export const GET: RequestHandler = async (event) => {
  try {
    await database(event).select({ key: settings.key }).from(settings).limit(1).get();
    return json({ ok: true, database: true, googleConnected: await driveConnected(event) });
  } catch (cause) {
    return json(
      { ok: false, error: cause instanceof Error ? cause.message : 'health check failed' },
      { status: 503 }
    );
  }
};
