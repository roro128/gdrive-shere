export function downloadableFiles<T extends { mimeType: string }>(
  files: readonly T[],
  isFolder: (file: T) => boolean
): T[] {
  return files.filter((file) => !isFolder(file));
}

export function actionableFiles<T extends { id: string }>(
  files: readonly T[],
  canAct: (file: T) => boolean,
  pendingIds: ReadonlySet<string>
): T[] {
  return files.filter((file) => canAct(file) && !pendingIds.has(file.id));
}

export function uploadConflictTargets<T>(
  conflicts: readonly T[],
  applyAll: boolean
): { targets: T[]; remaining: T[] } {
  const [current, ...remaining] = conflicts;
  if (!current) return { targets: [], remaining: [] };
  return applyAll
    ? { targets: [current, ...remaining], remaining: [] }
    : { targets: [current], remaining };
}

export function countSuccessful(results: readonly boolean[]): number {
  return results.filter(Boolean).length;
}
