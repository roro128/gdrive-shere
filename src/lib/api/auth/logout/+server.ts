import type { RequestHandler } from '$lib/server/runtime';
import { destroySession } from '$lib/server/auth';
import { createBetterAuth } from '$lib/server/better-auth';
import { assertSameOrigin } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const betterAuthLogout = await createBetterAuth(event).handler(
    new Request(new URL('/api/auth/sign-out', event.url.origin), {
      method: 'POST',
      headers: event.request.headers
    })
  );
  await destroySession(event);
  if (!betterAuthLogout.ok) return betterAuthLogout;

  const headers = new Headers(betterAuthLogout.headers);
  headers.set('content-type', 'application/json');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
