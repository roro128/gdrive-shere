import { attachCookies, createRequestEvent, type RequestHandler } from './runtime';
import { cloudflareContext } from './cloudflare-context';
import { buildApiRoutes, matchApiRoute, mergeApiRouteParams } from './api-route-matching';

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
  const response = await handler(event);
  return attachCookies(response, event.cookies);
}
