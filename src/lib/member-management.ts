export type MemberListEntry = { role?: string };
export type ResetRequestEntry = {
  id: string;
  status: string;
  link?: string;
  expires_at?: string;
};

export function membersOnly<T extends MemberListEntry>(users: readonly T[]): T[] {
  return users.filter((user) => user.role === 'member');
}

export function updateMemberStatus<T extends { id?: string }>(
  users: readonly T[],
  userId: string,
  status: 'active' | 'disabled'
): T[] {
  return users.map((user) => (user.id === userId ? ({ ...user, status } as T) : user));
}

export function updateResetRequestLink<T extends ResetRequestEntry>(
  requests: readonly T[],
  requestId: string,
  link: string,
  expiresAt: string
): T[] {
  return requests.map((request) =>
    request.id === requestId
      ? ({ ...request, status: 'link_created', link, expires_at: expiresAt } as T)
      : request
  );
}

export function mergeGeneratedResetLink<T>(
  links: Readonly<Record<string, T>>,
  userId: string,
  link: T
): Record<string, T> {
  return { ...links, [userId]: link };
}

export function buildMockResetLink(
  origin: string,
  userId: string,
  nowMs: number,
  ttlMs = 60 * 60 * 1000
) {
  return {
    link: `${origin}/reset/mock-${userId}?mock=1`,
    expiresAt: new Date(nowMs + ttlMs).toISOString()
  };
}
