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
  const seenIncomingNames = new Set<string>();
  const existingByName = new Map<string, TExisting>();
  for (const item of existingFiles) {
    if (isFolder(item)) continue;
    const normalizedName = item.name.toLocaleLowerCase();
    if (!existingByName.has(normalizedName)) existingByName.set(normalizedName, item);
  }

  const ready: TFile[] = [];
  const conflicts: UploadConflict<TFile, TExisting>[] = [];
  for (const file of incoming) {
    const normalizedName = file.name.toLocaleLowerCase();
    if (seenIncomingNames.has(normalizedName)) continue;
    seenIncomingNames.add(normalizedName);
    const existing = existingByName.get(normalizedName);
    if (existing) conflicts.push({ file, existing, targetParentId });
    else ready.push(file);
  }
  return { ready, conflicts };
}
