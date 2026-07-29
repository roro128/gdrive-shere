export function wouldCreateFolderCycle(
  fileId: string,
  targetParentId: string,
  parentById: ReadonlyMap<string, string | null>,
  maxDepth = 64
): boolean {
  const visit = (currentId: string, depth: number): boolean => {
    if (currentId === fileId) return true;
    if (depth >= maxDepth) return false;
    const parentId = parentById.get(currentId);
    return parentId ? visit(parentId, depth + 1) : false;
  };

  return visit(targetParentId, 0);
}
