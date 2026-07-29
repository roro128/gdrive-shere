import type { RequestHandler } from '$lib/server/runtime';
import { randomToken } from '$lib/server/crypto';
import { googleAuthorizeUrl } from '$lib/server/google';
import { currentUser, hasUsers } from '$lib/server/auth';
import { forbidden } from '$lib/server/http';
import { resolveGoogleOAuthStartMode, shouldRequestGoogleDriveAccess } from '$lib/oauth-mode-model';

const OAUTH_COOKIE_PATH = '/api/auth';

export const GET: RequestHandler = async (event) => {
  const user = await currentUser(event);
  if (user) {
    if (user.role !== 'admin') forbidden('관리자 로그인이 필요합니다.');
  }
  const mode = resolveGoogleOAuthStartMode(user?.role ?? null, user ? true : await hasUsers(event));
  const state = randomToken(32);
  const response = new Response(null, {
    status: 302,
    headers: {
      // Drive 권한과 강제 동의는 최초 연결 또는 명시적 재연결에만 필요하다.
      // 기존 관리자의 로그인에는 이미 발급된 앱 세션만 새로 만들면 된다.
      location: googleAuthorizeUrl(event, state, {
        requestDriveAccess: shouldRequestGoogleDriveAccess(mode),
        forceConsent: shouldRequestGoogleDriveAccess(mode)
      }),
      'cache-control': 'no-store'
    }
  });
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: event.url.protocol === 'https:',
    path: OAUTH_COOKIE_PATH,
    maxAge: 600
  };
  event.cookies.set('gdrive_google_state', state, cookieOptions);
  event.cookies.set('gdrive_google_mode', mode, cookieOptions);
  return response;
};
