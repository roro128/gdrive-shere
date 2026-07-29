export function readWorkspaceCache<T>(
  cache: ReadonlyMap<string, readonly T[]>,
  key: string
): readonly T[] | undefined {
  return cache.get(key);
}

export function writeWorkspaceCache<T>(
  cache: ReadonlyMap<string, readonly T[]>,
  key: string,
  files: readonly T[]
): ReadonlyMap<string, T[]> {
  const next = new Map<string, T[]>();
  cache.forEach((cachedFiles, cachedKey) => {
    next.set(cachedKey, [...cachedFiles]);
  });
  next.set(key, [...files]);
  return next;
}

export function invalidateWorkspaceCache<T>(): ReadonlyMap<string, T[]> {
  return new Map();
}

export function nextRefreshGeneration(current: number): number {
  return current + 1;
}

export function isCurrentRefreshGeneration(current: number, expected: number): boolean {
  return current === expected;
}
