export type ShareLinkRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createShareLink(request: ShareLinkRequest, fileId: string): Promise<Response> {
  return request('/api/share-links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileId })
  });
}
