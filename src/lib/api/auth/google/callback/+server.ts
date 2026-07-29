import type { RequestHandler } from '$lib/server/runtime';
import {
  createAdminFromGoogle,
  createSession,
  currentUser,
  findAdminByGoogleSubject,
  assertGoogleAdminEmail
} from '$lib/server/auth';
import { constantTimeEqual } from '$lib/server/crypto';
import { exchangeGoogleCode, persistGoogleConnection } from '$lib/server/google';
import { forbidden } from '$lib/server/http';
import { parseGoogleOAuthMode, resolveGoogleOAuthCallbackPlan } from '$lib/oauth-mode-model';

const OAUTH_COOKIE_PATH = '/api/auth';
export const GET: RequestHandler = async (event) => {
  const code = event.url.searchParams.get('code');
  const state = event.url.searchParams.get('state');
  const stateCookie = event.cookies.get('gdrive_google_state');
  const modeCookie = event.cookies.get('gdrive_google_mode');
  if (!code || !state || !stateCookie || !constantTimeEqual(state, stateCookie)) {
    return new Response('OAuth state가 올바르지 않습니다.', { status: 400 });
  }
  const mode = parseGoogleOAuthMode(modeCookie);
  if (!mode) {
    return new Response('OAuth 로그인 모드가 올바르지 않습니다.', { status: 400 });
  }
  event.cookies.delete('gdrive_google_state', { path: OAUTH_COOKIE_PATH });
  event.cookies.delete('gdrive_google_mode', { path: OAUTH_COOKIE_PATH });
  try {
    const connection = await exchangeGoogleCode(event, code);
    const plan = resolveGoogleOAuthCallbackPlan(mode);
    if (mode === 'bootstrap') {
      await createAdminFromGoogle(event, {
        subject: connection.subject ?? '',
        email: connection.email,
        name: connection.name
      });
    } else if (mode === 'connect') {
      const user = await currentUser(event);
      if (user?.role !== 'admin') forbidden('관리자 로그인이 필요합니다.');
    } else {
      if (plan.requireAdminEmail) assertGoogleAdminEmail(event, connection.email);
      const user = connection.subject
        ? await findAdminByGoogleSubject(event, connection.subject)
        : null;
      if (!user) forbidden('등록된 관리자 Google 계정이 아닙니다.');
    }
    if (plan.persistConnection) await persistGoogleConnection(event, connection);
    if (plan.createSession) {
      const admin = connection.subject
        ? await findAdminByGoogleSubject(event, connection.subject)
        : null;
      if (!admin) forbidden('관리자 계정을 찾을 수 없습니다.');
      await createSession(event, admin.id);
    }
    return new Response(null, { status: 302, headers: { location: '/?connected=1' } });
  } catch (cause) {
    const authError = cause as { status?: number; body?: { message?: string } };
    if (authError.status) {
      return new Response(authError.body?.message ?? 'Google 관리자 인증이 거부되었습니다.', {
        status: authError.status
      });
    }
    return new Response(
      `Google 연결 실패: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      { status: 502 }
    );
  }
};
