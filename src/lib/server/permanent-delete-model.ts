export type DescendantFile = {
  id: string;
  parentId: string | null;
};

export function orderDriveDeletionIds(ids: readonly string[]): string[] {
  return [...ids].reverse();
}

export function collectTrashedDescendantIds(
  rootId: string,
  files: readonly DescendantFile[],
  maxDepth = 64
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const file of files) {
    if (!file.parentId) continue;
    const childrenForParent = childrenByParent.get(file.parentId) ?? [];
    childrenForParent.push(file.id);
    childrenByParent.set(file.parentId, childrenForParent);
  }

  const ids = [rootId];
  const seen = new Set(ids);
  let parents = [rootId];
  for (let depth = 0; depth < maxDepth && parents.length > 0; depth += 1) {
    const next: string[] = [];
    for (const parent of parents) {
      for (const id of childrenByParent.get(parent) ?? []) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
        next.push(id);
      }
    }
    parents = next;
  }
  return ids;
}
