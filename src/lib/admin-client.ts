export type AdminRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonRequest(method: 'PATCH', body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

export function createMemberInvitation(request: AdminRequest): Promise<Response> {
  return request('/api/invitations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'member' })
  });
}

export function listMembers(request: AdminRequest): Promise<Response> {
  return request('/api/users');
}

export function listPasswordResetRequests(request: AdminRequest): Promise<Response> {
  return request('/api/password-reset-requests');
}

export function updateMemberStatus(
  request: AdminRequest,
  userId: string,
  status: 'active' | 'disabled'
): Promise<Response> {
  return request('/api/users', jsonRequest('PATCH', { userId, status }));
}

export function createMemberResetLink(request: AdminRequest, userId: string): Promise<Response> {
  return request(`/api/users/${userId}/password-reset-link`, { method: 'POST' });
}

export function createPasswordResetRequestLink(
  request: AdminRequest,
  requestId: string
): Promise<Response> {
  return request(`/api/password-reset-requests/${requestId}/link`, { method: 'POST' });
}
