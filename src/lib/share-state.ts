type SharePermission = 'viewer' | 'editor';
type ShareStatus = 'pending' | 'accepted';

export type ShareMember = {
  id: string;
  displayName: string;
  handle?: string | null;
  permission?: SharePermission;
  status?: ShareStatus;
};

export type ShareGrant = {
  userId: string;
  permission: SharePermission;
  displayName?: string;
  handle?: string | null;
  status?: ShareStatus;
};

export function mergeSharePermissions(
  members: readonly ShareMember[],
  grants: readonly ShareGrant[]
): ShareMember[] {
  const permissions = new Map(grants.map((grant) => [grant.userId, grant.permission]));
  const grantsById = new Map(grants.map((grant) => [grant.userId, grant]));
  const merged = members.map((member) => ({
    ...member,
    permission: permissions.get(member.id) ?? member.permission ?? 'viewer',
    status: grantsById.get(member.id)?.status ?? member.status
  }));
  const knownIds = new Set(merged.map((member) => member.id));
  return [
    ...merged,
    ...grants
      .filter((grant) => !knownIds.has(grant.userId))
      .map((grant) => ({
        id: grant.userId,
        displayName: grant.displayName ?? '알 수 없는 사용자',
        handle: grant.handle,
        permission: grant.permission,
        status: grant.status
      }))
  ];
}

export function selectedShareMembers<T extends { id: string }>(
  members: readonly T[],
  selectedIds: ReadonlySet<string>
): T[] {
  return members.filter((member) => selectedIds.has(member.id));
}

export function buildShareGrants(
  members: readonly ShareMember[],
  selectedIds: ReadonlySet<string>
): ShareGrant[] {
  return members
    .filter((member) => selectedIds.has(member.id))
    .map((member) => ({ userId: member.id, permission: member.permission ?? 'viewer' }));
}

export function mergeShareSearchResults<T extends ShareMember>(
  current: readonly T[],
  available: readonly T[],
  selectedIds: ReadonlySet<string>
): T[] {
  const previous = new Map(current.map((member) => [member.id, member]));
  const result = available.map((member) => ({
    ...member,
    permission: previous.get(member.id)?.permission ?? member.permission ?? 'viewer'
  }));
  const resultIds = new Set(result.map((member) => member.id));
  return [
    ...current.filter((member) => selectedIds.has(member.id) && !resultIds.has(member.id)),
    ...result
  ];
}

export function updateSharePermission<T extends { id: string }>(
  members: readonly T[],
  memberId: string,
  permission: 'viewer' | 'editor'
): T[] {
  return members.map((member) =>
    member.id === memberId ? ({ ...member, permission } as T) : member
  );
}
