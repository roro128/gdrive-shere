export function selectDraggedFiles<T extends { id: string }>(
  files: readonly T[],
  sourceId: string,
  selectedIds: ReadonlySet<string>,
  canMove: (file: T) => boolean
): T[] {
  const candidates = selectedIds.has(sourceId)
    ? files.filter((file) => selectedIds.has(file.id))
    : files.filter((file) => file.id === sourceId);
  return candidates.filter(canMove);
}

export function planDraggedMove<T extends { id: string }>(input: {
  files: readonly T[];
  sourceId: string;
  selectedIds: ReadonlySet<string>;
  targetAllowed: boolean;
  canMove: (file: T) => boolean;
}): T[] {
  if (!input.targetAllowed) return [];
  return selectDraggedFiles(input.files, input.sourceId, input.selectedIds, input.canMove);
}

export function resolveDropTarget(
  sourceId: string,
  hitTargetId: string | null,
  fallbackTargetId: string | null
): string | null {
  return hitTargetId && hitTargetId !== sourceId ? hitTargetId : fallbackTargetId;
}

export function filesFromDragIds<T extends { id: string }>(
  ids: readonly string[],
  files: readonly T[]
): T[] {
  const byId = new Map(files.map((file) => [file.id, file]));
  return ids.flatMap((id) => {
    const file = byId.get(id);
    return file ? [file] : [];
  });
}
