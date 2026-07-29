import type { RequestHandler } from '$lib/server/runtime';
import { createBetterAuth } from '$lib/server/better-auth';

export const GET: RequestHandler = async (event) => createBetterAuth(event).handler(event.request);
export const POST: RequestHandler = async (event) => createBetterAuth(event).handler(event.request);
