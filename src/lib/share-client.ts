export type ShareRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonRequest(method: 'PATCH' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

export function listShareInvitations(request: ShareRequest): Promise<Response> {
  return request('/api/share-invitations');
}

export function respondToShareInvitation(
  request: ShareRequest,
  invitationId: string,
  accept: boolean
): Promise<Response> {
  return request('/api/share-invitations', jsonRequest('PATCH', { invitationId, accept }));
}

export function fetchFolderShares(request: ShareRequest, folderId: string): Promise<Response> {
  return request(`/api/folders/${folderId}/shares`);
}

export function saveFolderShares(
  request: ShareRequest,
  folderId: string,
  users: readonly { userId: string; permission: 'viewer' | 'editor' }[]
): Promise<Response> {
  return request(`/api/folders/${folderId}/shares`, jsonRequest('PUT', { users }));
}
