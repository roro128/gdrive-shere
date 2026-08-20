const DOCUMENT_POLICY = "base-uri 'none'; object-src 'none'; frame-ancestors 'none'";

export function applySecurityHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  if (headers.get('content-type')?.toLowerCase().startsWith('text/html')) {
    headers.set('x-frame-options', 'DENY');
    headers.set('content-security-policy', DOCUMENT_POLICY);
  }
  if (new URL(request.url).protocol === 'https:')
    headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
