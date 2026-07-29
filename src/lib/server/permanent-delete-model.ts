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
  const childrenByParent = files.reduce((children, file) => {
    if (!file.parentId) return children;
    return new Map([
      ...children,
      [file.parentId, [...(children.get(file.parentId) ?? []), file.id]] as [string, string[]]
    ]);
  }, new Map<string, string[]>());

  const collect = (ids: readonly string[], parents: readonly string[], depth: number): string[] => {
    if (depth >= maxDepth || parents.length === 0) return [...ids];
    const next = [
      ...new Set(parents.flatMap((parent) => childrenByParent.get(parent) ?? []))
    ].filter((id) => !ids.includes(id));
    return next.length === 0 ? [...ids] : collect([...ids, ...next], next, depth + 1);
  };

  return collect([rootId], [rootId], 0);
}
