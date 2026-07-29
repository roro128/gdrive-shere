export type CookieOptions = {
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
  path?: string;
  maxAge?: number;
  expires?: Date;
};

export function parseCookieHeader(header: string): Record<string, string> {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([name, value]) => name && value)
      .map(([name, ...value]) => [name, value.join('=')])
  );
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const attributes = [
    options.maxAge === undefined ? null : `Max-Age=${options.maxAge}`,
    options.expires ? `Expires=${options.expires.toUTCString()}` : null,
    options.path ? `Path=${options.path}` : null,
    options.httpOnly ? 'HttpOnly' : null,
    options.secure ? 'Secure' : null,
    options.sameSite ? `SameSite=${options.sameSite}` : null
  ].filter((attribute): attribute is string => attribute !== null);
  return [`${name}=${encodeURIComponent(value)}`, ...attributes].join('; ');
}

export type CookieState = {
  readonly requestCookies: Readonly<Record<string, string>>;
  readonly responseCookies: readonly string[];
};

export function createCookieState(cookieHeader: string | null): CookieState {
  return {
    requestCookies: parseCookieHeader(cookieHeader ?? ''),
    responseCookies: []
  };
}

export function appendResponseCookie(
  state: CookieState,
  name: string,
  value: string,
  options: CookieOptions = {}
): CookieState {
  return {
    ...state,
    responseCookies: [...state.responseCookies, serializeCookie(name, value, options)]
  };
}

export type EventCookies = {
  readonly responseCookies: readonly string[];
  get(name: string): string | undefined;
  set(name: string, value: string, options?: CookieOptions): void;
  delete(name: string, options?: CookieOptions): void;
};

export function createEventCookies(request: Request): EventCookies {
  let state = createCookieState(request.headers.get('cookie'));
  return {
    get: (name) => state.requestCookies[name],
    set: (name, value, options) => {
      state = appendResponseCookie(state, name, value, options);
    },
    delete: (name, options) => {
      state = appendResponseCookie(state, name, '', { ...options, maxAge: 0 });
    },
    get responseCookies() {
      return state.responseCookies;
    }
  };
}

export type RequestEvent = {
  request: Request;
  url: URL;
  params: Record<string, string>;
  platform?: { env: Env; ctx: ExecutionContext; context: ExecutionContext; caches: CacheStorage };
  cookies: EventCookies;
  fetch: typeof fetch;
  getClientAddress: () => string;
};

export type RequestHandler = (event: RequestEvent) => Response | Promise<Response>;

export function createRequestEvent(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  params: Record<string, string> = {}
): RequestEvent {
  return {
    request,
    url: new URL(request.url),
    params,
    platform: { env, ctx, context: ctx, caches },
    cookies: createEventCookies(request),
    fetch,
    getClientAddress: () => request.headers.get('CF-Connecting-IP') ?? '0.0.0.0'
  };
}

export function attachCookies(
  response: Response,
  cookies: Pick<EventCookies, 'responseCookies'>
): Response {
  for (const cookie of cookies.responseCookies) response.headers.append('Set-Cookie', cookie);
  return response;
}
