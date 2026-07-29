import { describe, expect, it } from 'vitest';
import {
  buildApiRoutes,
  extractRouteParams,
  matchApiRoute,
  mergeApiRouteParams,
  routePattern
} from './api-route-matching';

describe('API route parameter extraction', () => {
  it('extracts and decodes an id from a dynamic API module path', () => {
    const route = routePattern('../api/files/[id]/+server.ts');

    expect(extractRouteParams(route, '/api/files/file%2Fid')).toEqual({ id: 'file/id' });
    expect(extractRouteParams(route, '/api/files/file-123/')).toEqual({ id: 'file-123' });
  });

  it('supports the Better Auth catch-all path without confusing static routes', () => {
    const route = routePattern('../api/auth/[...path]/+server.ts');

    expect(extractRouteParams(route, '/api/auth/sign-in/username')).toEqual({
      path: 'sign-in/username'
    });
    expect(extractRouteParams(route, '/api/files')).toBeNull();
  });

  it('keeps malformed encoded parameters usable instead of throwing', () => {
    const route = routePattern('../api/files/[id]/+server.ts');

    expect(extractRouteParams(route, '/api/files/%E0%A4%A')).toEqual({ id: '%E0%A4%A' });
  });

  it('builds an immutable-priority route registry and matches the most specific route', () => {
    const modules = {
      '../api/files/[id]/+server.ts': { GET: 'dynamic' },
      '../api/files/+server.ts': { GET: 'static' }
    };
    const routes = buildApiRoutes(modules);
    const matched = matchApiRoute(routes, '/api/files/example');

    expect(routes.map((route) => route.module.GET)).toEqual(['dynamic', 'static']);
    expect(matched?.route.module.GET).toBe('dynamic');
    expect(matched?.params).toEqual({ id: 'example' });
  });

  it('merges external parameters without allowing undefined values through', () => {
    expect(
      mergeApiRouteParams({ fromLoader: 'yes', ignored: undefined }, { id: 'file-1' })
    ).toEqual({ fromLoader: 'yes', id: 'file-1' });
  });
});
