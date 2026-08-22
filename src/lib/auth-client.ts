import { readResponseMessage } from './response-message';
import type { GoogleConnectionStatus } from './google-connection-status';

type AuthRequest = (input: string, init?: RequestInit) => Promise<Response>;

export async function fetchCurrentUser<T>(request: AuthRequest = fetch): Promise<{
  user: T | null;
  googleConnected: boolean;
  googleConnectionStatus: GoogleConnectionStatus;
} | null> {
  const response = await request('/api/me');
  if (!response.ok) return null;
  const value = (await response.json()) as {
    user?: T | null;
    googleConnected?: boolean;
    googleConnectionStatus?: GoogleConnectionStatus;
  };
  const googleConnectionStatus =
    value.googleConnectionStatus ?? (value.googleConnected === true ? 'connected' : 'missing');
  return {
    user: value.user ?? null,
    googleConnected: googleConnectionStatus === 'connected',
    googleConnectionStatus
  };
}

export async function logout(request: AuthRequest = fetch): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' });
}

async function postJson(request: AuthRequest, path: string, body: Record<string, unknown>) {
  const response = await request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await readResponseMessage(response));
}

export function requestPasswordReset(request: AuthRequest, loginId: string): Promise<void> {
  return postJson(request, '/api/auth/password/reset-request', { loginId });
}

export function loginLegacyPassword(
  request: AuthRequest,
  loginId: string,
  password: string
): Promise<void> {
  return postJson(request, '/api/auth/password/login', { loginId, password });
}

export function registerInvite(request: AuthRequest, body: Record<string, unknown>): Promise<void> {
  return postJson(request, '/api/auth/better/register', body);
}

export function resetPassword(request: AuthRequest, body: Record<string, unknown>): Promise<void> {
  return postJson(request, '/api/auth/password/reset', body);
}
