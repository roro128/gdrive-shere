import { attachCookies, createRequestEvent, type RequestHandler } from './runtime';
import { cloudflareContext } from './cloudflare-context';
import { buildApiRoutes, matchApiRoute, mergeApiRouteParams } from './api-route-matching';
import { GoogleApiError, googleApiUserMessage } from './google-http-model';

type ApiModule = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', RequestHandler>>;

const modules = import.meta.glob('../api/**/+server.ts', { eager: true }) as Record<
  string,
  ApiModule
>;

const routes = buildApiRoutes(modules);

export async function dispatchApiRequest(
  request: Request,
  context: unknown,
  params: Record<string, string | undefined>
): Promise<Response> {
  const cloudflare = (
    context as { get: (key: typeof cloudflareContext) => { env: Env; ctx: ExecutionContext } }
  ).get(cloudflareContext);
  if (!cloudflare)
    return Response.json({ message: 'Cloudflare runtime이 없습니다.' }, { status: 500 });

  const url = new URL(request.url);
  const matched = matchApiRoute(routes, url.pathname);
  if (!matched) return Response.json({ message: 'API를 찾을 수 없습니다.' }, { status: 404 });

  const route = matched.route;
  const handler = route.module[request.method as keyof ApiModule];
  if (!handler) return Response.json({ message: '지원하지 않는 메서드입니다.' }, { status: 405 });

  const event = createRequestEvent(
    request,
    cloudflare.env,
    cloudflare.ctx,
    mergeApiRouteParams(params, matched.params)
  );
  try {
    const response = await handler(event);
    return attachCookies(response, event.cookies);
  } catch (cause) {
    if (cause instanceof Response) return attachCookies(cause, event.cookies);
    console.error('API handler failed', {
      method: request.method,
      path: url.pathname,
      error: cause instanceof Error ? cause.name : 'unknown error'
    });
    return attachCookies(
      Response.json(
        {
          message:
            cause instanceof GoogleApiError
              ? googleApiUserMessage(cause)
              : '요청을 처리하지 못했습니다.'
        },
        { status: cause instanceof GoogleApiError ? 502 : 500 }
      ),
      event.cookies
    );
  }
}
