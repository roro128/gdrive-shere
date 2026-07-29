export function json<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return json(data, init);
}

export function badRequest(message: string): never {
  throw new Response(JSON.stringify({ message }), {
    status: 400,
    headers: { 'content-type': 'application/json' }
  });
}

export function unauthorized(message = '로그인이 필요합니다.'): never {
  throw new Response(JSON.stringify({ message }), {
    status: 401,
    headers: { 'content-type': 'application/json' }
  });
}

export function forbidden(message = '이 작업을 수행할 권한이 없습니다.'): never {
  throw new Response(JSON.stringify({ message }), {
    status: 403,
    headers: { 'content-type': 'application/json' }
  });
}

export function notFound(message = '대상을 찾을 수 없습니다.'): never {
  throw new Response(JSON.stringify({ message }), {
    status: 404,
    headers: { 'content-type': 'application/json' }
  });
}

export function assertSameOrigin(request: Request, origin: string): void {
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && requestOrigin !== origin) forbidden('허용되지 않은 출처입니다.');
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    badRequest('JSON 요청 본문이 필요합니다.');
  }
}
