export type FolderSharePermission = 'owner' | 'viewer' | 'editor' | 'admin';
export type RequestedFolderShare = { userId: string; permission: 'viewer' | 'editor' };

export type PreparedFolderShares = {
  permissions: ReadonlyMap<string, 'viewer' | 'editor'>;
  userIds: string[];
};

export type EligibleShareSelection = {
  userIds: string[];
  hasIneligibleUsers: boolean;
};

export function canManageFolderShares(permission: FolderSharePermission): boolean {
  return permission === 'owner' || permission === 'admin';
}

export function normalizeShareSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/^@/, '').slice(0, 80);
}

export function normalizeRequestedShares(input: unknown): RequestedFolderShare[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (entry): entry is RequestedFolderShare =>
      typeof entry?.userId === 'string' &&
      (entry.permission === 'viewer' || entry.permission === 'editor')
  );
}

export function prepareRequestedShares(
  requestedUsers: readonly RequestedFolderShare[],
  ownerUserId: string,
  maxUsers = 100
): PreparedFolderShares {
  const permissions = new Map(requestedUsers.map((entry) => [entry.userId, entry.permission]));
  const userIds = [...permissions.keys()]
    .filter((userId) => userId !== ownerUserId)
    .slice(0, maxUsers);
  return { permissions, userIds };
}

export function selectEligibleShareIds(
  requestedIds: readonly string[],
  eligibleIds: ReadonlySet<string>
): EligibleShareSelection {
  const userIds = requestedIds.filter((id) => eligibleIds.has(id));
  return {
    userIds,
    hasIneligibleUsers: userIds.length !== requestedIds.length
  };
}
