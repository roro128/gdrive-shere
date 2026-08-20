import type { RequestHandler } from '$lib/server/runtime';
import { createBetterAuth, isPublicBetterAuthSignUpPath } from '$lib/server/better-auth';
import { assertSameOrigin, forbidden } from '$lib/server/http';

function rejectPublicSignup(event: Parameters<RequestHandler>[0]): void {
  if (isPublicBetterAuthSignUpPath(event.url.pathname))
    forbidden('초대 링크를 통해서만 계정을 만들 수 있습니다.');
}

export const GET: RequestHandler = async (event) => {
  rejectPublicSignup(event);
  return createBetterAuth(event).handler(event.request);
};

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  rejectPublicSignup(event);
  return createBetterAuth(event).handler(event.request);
};
