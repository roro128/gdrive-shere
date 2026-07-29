export type UploadConflict<TFile, TExisting> = {
  file: TFile;
  existing: TExisting;
  targetParentId: string | null;
};

export function planUploadConflictResolution<T>(
  conflicts: readonly T[],
  action: 'skip' | 'replace' | 'overwrite',
  applyAll: boolean
): { uploads: T[]; remaining: T[] } {
  const [current, ...remaining] = conflicts;
  if (!current) return { uploads: [], remaining: [] };
  const targets = applyAll ? [current, ...remaining] : [current];
  return {
    uploads: action === 'skip' ? [] : targets,
    remaining: applyAll ? [] : remaining
  };
}

export function splitUploadConflicts<
  TFile extends { name: string },
  TExisting extends { name: string; mimeType: string }
>(
  incoming: readonly TFile[],
  existingFiles: readonly TExisting[],
  isFolder: (file: TExisting) => boolean,
  targetParentId: string | null
): { ready: TFile[]; conflicts: UploadConflict<TFile, TExisting>[] } {
  return incoming.reduce(
    (result, file) => {
      const existing = existingFiles.find(
        (item) => !isFolder(item) && item.name.toLocaleLowerCase() === file.name.toLocaleLowerCase()
      );
      return existing
        ? {
            ...result,
            conflicts: [...result.conflicts, { file, existing, targetParentId }]
          }
        : { ...result, ready: [...result.ready, file] };
    },
    { ready: [] as TFile[], conflicts: [] as UploadConflict<TFile, TExisting>[] }
  );
}
