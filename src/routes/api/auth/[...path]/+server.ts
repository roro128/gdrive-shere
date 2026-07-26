import type { RequestHandler } from './$types';
import { createBetterAuth } from '$lib/server/better-auth';

export const GET: RequestHandler = async (event) => createBetterAuth(event).handler(event.request);
export const POST: RequestHandler = async (event) => createBetterAuth(event).handler(event.request);
