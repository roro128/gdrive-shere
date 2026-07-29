export type ShareMutationPermission = 'viewer' | 'editor';

export type SharePersistenceRuntime = {
  now: () => string;
  newId: () => string;
};

export type FolderShareMutation =
  | { kind: 'delete-grants'; folderId: string }
  | { kind: 'revoke-pending'; folderId: string; respondedAt: string }
  | {
      kind: 'accept-invitation';
      folderId: string;
      userId: string;
      permission: ShareMutationPermission;
    }
  | {
      kind: 'insert-grant';
      id: string;
      folderId: string;
      userId: string;
      permission: ShareMutationPermission;
      createdBy: string;
      createdAt: string;
    }
  | {
      kind: 'upsert-invitation';
      id: string;
      folderId: string;
      userId: string;
      permission: ShareMutationPermission;
      invitedBy: string;
      createdAt: string;
    };

export type ShareInvitationMutation =
  | { kind: 'decline-invitation'; invitationId: string; respondedAt: string }
  | {
      kind: 'accept-invitation-response';
      invitationId: string;
      respondedAt: string;
    }
  | {
      kind: 'upsert-accepted-grant';
      id: string;
      folderId: string;
      userId: string;
      permission: ShareMutationPermission;
      createdBy: string;
      createdAt: string;
    };

export function planShareInvitationResponse(
  invitation: {
    id: string;
    folderId: string;
    permission: ShareMutationPermission;
    invitedBy: string;
  },
  userId: string,
  accept: boolean,
  context: { respondedAt: string; grantId: string }
): ShareInvitationMutation[] {
  if (!accept) {
    return [
      { kind: 'decline-invitation', invitationId: invitation.id, respondedAt: context.respondedAt }
    ];
  }
  return [
    {
      kind: 'accept-invitation-response',
      invitationId: invitation.id,
      respondedAt: context.respondedAt
    },
    {
      kind: 'upsert-accepted-grant',
      id: context.grantId,
      folderId: invitation.folderId,
      userId,
      permission: invitation.permission,
      createdBy: invitation.invitedBy,
      createdAt: context.respondedAt
    }
  ];
}

export function buildShareInvitationResponse(
  invitation: {
    id: string;
    folderId: string;
    permission: ShareMutationPermission;
    invitedBy: string;
  },
  userId: string,
  accept: boolean,
  runtime: SharePersistenceRuntime
): ShareInvitationMutation[] {
  return planShareInvitationResponse(invitation, userId, accept, {
    respondedAt: runtime.now(),
    grantId: accept ? runtime.newId() : ''
  });
}

export function planFolderShareMutations(
  folderId: string,
  userIds: readonly string[],
  permissions: ReadonlyMap<string, ShareMutationPermission>,
  acceptedIds: ReadonlySet<string>,
  context: { managerId: string; createdAt: string; invitationIdByUser: ReadonlyMap<string, string> }
): FolderShareMutation[] {
  const base: FolderShareMutation[] = [
    { kind: 'delete-grants', folderId },
    { kind: 'revoke-pending', folderId, respondedAt: context.createdAt }
  ];
  return userIds.reduce<FolderShareMutation[]>((mutations, userId) => {
    const permission = permissions.get(userId) ?? 'viewer';
    if (acceptedIds.has(userId)) {
      return [
        ...mutations,
        { kind: 'accept-invitation', folderId, userId, permission },
        {
          kind: 'insert-grant',
          id: context.invitationIdByUser.get(userId) ?? '',
          folderId,
          userId,
          permission,
          createdBy: context.managerId,
          createdAt: context.createdAt
        }
      ];
    }
    return [
      ...mutations,
      {
        kind: 'upsert-invitation',
        id: context.invitationIdByUser.get(userId) ?? '',
        folderId,
        userId,
        permission,
        invitedBy: context.managerId,
        createdAt: context.createdAt
      }
    ];
  }, base);
}

export function buildFolderShareMutations(
  folderId: string,
  userIds: readonly string[],
  permissions: ReadonlyMap<string, ShareMutationPermission>,
  acceptedIds: ReadonlySet<string>,
  managerId: string,
  runtime: SharePersistenceRuntime
): FolderShareMutation[] {
  return planFolderShareMutations(folderId, userIds, permissions, acceptedIds, {
    managerId,
    createdAt: runtime.now(),
    invitationIdByUser: new Map(userIds.map((userId) => [userId, runtime.newId()]))
  });
}
