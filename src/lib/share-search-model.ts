export type ShareSearchMember = {
  displayName: string;
  handle?: string | null;
};

export function nextSearchGeneration(current: number): number {
  return current + 1;
}

export function isCurrentSearchGeneration(generation: number, current: number): boolean {
  return generation === current;
}

export function filterShareUsers<T extends ShareSearchMember>(
  members: readonly T[],
  query: string
): T[] {
  const normalized = query.trim().toLowerCase();
  return members
    .filter(
      (member) =>
        !normalized ||
        member.displayName.toLowerCase().includes(normalized) ||
        (member.handle ?? '').toLowerCase().includes(normalized)
    )
    .map((member) => ({ ...member }));
}
