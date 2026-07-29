export type ApiRoutePattern = {
  pattern: RegExp;
  score: number;
  paramNames: string[];
};

export type ApiRoute<TModule> = ApiRoutePattern & {
  key: string;
  module: TModule;
};

export function buildApiRoutes<TModule>(
  modules: Readonly<Record<string, TModule>>
): ApiRoute<TModule>[] {
  return Object.entries(modules)
    .map(([key, module]) => ({ key, module, ...routePattern(key) }))
    .sort((left, right) => right.score - left.score);
}

export function matchApiRoute<TModule>(
  routes: readonly ApiRoute<TModule>[],
  pathname: string
): { route: ApiRoute<TModule>; params: Record<string, string> } | null {
  const matched = routes
    .map((route) => ({ route, params: extractRouteParams(route, pathname) }))
    .find(
      (entry): entry is { route: ApiRoute<TModule>; params: Record<string, string> } =>
        entry.params !== null
    );
  return matched ?? null;
}

export function mergeApiRouteParams(
  requestParams: Readonly<Record<string, string | undefined>>,
  routeParams: Readonly<Record<string, string>>
): Record<string, string> {
  return Object.fromEntries([
    ...Object.entries(requestParams).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    ),
    ...Object.entries(routeParams)
  ]);
}

export function routePattern(key: string): ApiRoutePattern {
  const normalized = key.replaceAll('\\', '/');
  const apiIndex = normalized.lastIndexOf('/api/');
  const relative = normalized
    .slice(apiIndex >= 0 ? apiIndex + 1 : 0)
    .replace(/\/\+server\.ts$/, '');
  const segments = relative.split('/');
  const compiled = segments.reduce(
    (result, segment) => {
      if (/^\[\.\.\..+\]$/.test(segment))
        return {
          source: [...result.source, '(.+)'],
          score: result.score,
          paramNames: [...result.paramNames, segment.slice(4, -1)]
        };
      if (/^\[.+\]$/.test(segment))
        return {
          source: [...result.source, '([^/]+)'],
          score: result.score,
          paramNames: [...result.paramNames, segment.slice(1, -1)]
        };
      return {
        source: [...result.source, segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')],
        score: result.score + 2,
        paramNames: result.paramNames
      };
    },
    { source: [] as string[], score: segments.length, paramNames: [] as string[] }
  );
  return {
    pattern: new RegExp(`^/${compiled.source.join('/')}/?$`),
    score: compiled.score,
    paramNames: compiled.paramNames
  };
}

export function extractRouteParams(
  route: ApiRoutePattern,
  pathname: string
): Record<string, string> | null {
  const match = pathname.match(route.pattern);
  if (!match) return null;
  return Object.fromEntries(
    route.paramNames.map((name, index) => {
      const value = match[index + 1] ?? '';
      try {
        return [name, decodeURIComponent(value)];
      } catch {
        return [name, value];
      }
    })
  );
}
