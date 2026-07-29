export type SelectableListItem = {
  id: string;
  isAdminSpace?: boolean;
};

export function selectableIds<T extends SelectableListItem>(items: readonly T[]) {
  return items.filter((item) => !item.isAdminSpace).map((item) => item.id);
}

export function removeSelectedIds(
  selectedIds: Iterable<string>,
  removedIds: Iterable<string>
): string[] {
  const removed = new Set(removedIds);
  return [...selectedIds].filter((id) => !removed.has(id));
}

export function removeSelectedIdSet(
  selectedIds: ReadonlySet<string>,
  removedIds: Iterable<string>
): Set<string> {
  return new Set(removeSelectedIds(selectedIds, removedIds));
}

export function selectableIdSet<T extends SelectableListItem>(items: readonly T[]): Set<string> {
  return new Set(selectableIds(items));
}

export function updateSelectedId(
  selectedIds: ReadonlySet<string>,
  id: string,
  selected: boolean
): Set<string> {
  return selected
    ? new Set([...selectedIds, id])
    : new Set([...selectedIds].filter((selectedId) => selectedId !== id));
}

type SelectionTransition<T extends SelectableListItem> = {
  selectedIds: ReadonlySet<string>;
  visibleItems: readonly T[];
  targetId: string;
  checked: boolean;
  shiftKey: boolean;
  anchorId: string | null;
};

export function nextSelectedIds<T extends SelectableListItem>(
  transition: SelectionTransition<T>
): Set<string> {
  const target = transition.visibleItems.find((item) => item.id === transition.targetId);
  if (target?.isAdminSpace) return new Set(transition.selectedIds);

  if (!transition.checked) {
    return new Set([...transition.selectedIds].filter((id) => id !== transition.targetId));
  }

  if (!transition.shiftKey || !transition.anchorId) {
    return new Set([...transition.selectedIds, transition.targetId]);
  }

  const selectable = transition.visibleItems.filter((item) => !item.isAdminSpace);
  const start = selectable.findIndex((item) => item.id === transition.anchorId);
  const end = selectable.findIndex((item) => item.id === transition.targetId);
  if (start < 0 || end < 0) {
    return new Set([...transition.selectedIds, transition.targetId]);
  }

  const rangeIds = selectable
    .slice(Math.min(start, end), Math.max(start, end) + 1)
    .map((item) => item.id);
  return new Set([...transition.selectedIds, ...rangeIds]);
}
