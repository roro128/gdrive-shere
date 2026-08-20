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

export function payloadTooLarge(message = '요청 본문이 너무 큽니다.'): never {
  throw new Response(JSON.stringify({ message }), {
    status: 413,
    headers: { 'content-type': 'application/json' }
  });
}

export function assertSameOrigin(request: Request, origin: string): void {
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin !== origin) forbidden('허용되지 않은 출처입니다.');
}

const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

export async function readJson<T>(request: Request): Promise<T> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength > MAX_JSON_BODY_BYTES)
      payloadTooLarge();
  }

  if (!request.body) badRequest('JSON 요청 본문이 필요합니다.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_JSON_BODY_BYTES) payloadTooLarge();
      chunks.push(value);
    }
  } catch {
    if (totalBytes > MAX_JSON_BODY_BYTES) payloadTooLarge();
    badRequest('JSON 요청 본문이 필요합니다.');
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    badRequest('JSON 요청 본문이 필요합니다.');
  }
}
