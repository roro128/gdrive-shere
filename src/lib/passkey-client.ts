export type PasskeyRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createPasskeyRegistrationContext(request: PasskeyRequest): Promise<Response> {
  return request('/api/me/passkeys', { method: 'POST' });
}

export function deletePasskey(request: PasskeyRequest, passkeyId: string): Promise<Response> {
  return request(`/api/me/passkeys/${passkeyId}`, { method: 'DELETE' });
}
