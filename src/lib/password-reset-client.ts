export type PasswordResetContext = {
  valid: boolean;
  handle?: string | null;
  loginId?: string | null;
  expiresAt?: string;
};

type PasswordResetRequest = (input: string, init?: RequestInit) => Promise<Response>;

export async function fetchPasswordResetContext(input: {
  token: string;
  mock: boolean;
  request?: PasswordResetRequest;
}): Promise<PasswordResetContext> {
  if (input.mock) {
    return {
      valid: true,
      handle: input.token.startsWith('mock-') ? 'member' : 'mock',
      loginId: input.token.replace(/^mock-/, '') || 'mock'
    };
  }
  const request = input.request ?? fetch;
  const response = await request(
    `/api/auth/password/reset-context?token=${encodeURIComponent(input.token)}`
  );
  return (await response.json()) as PasswordResetContext;
}
