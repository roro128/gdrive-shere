import { describe, expect, it } from 'vitest';
import {
  buildFolderShareMutations,
  buildShareInvitationResponse,
  planFolderShareMutations,
  planShareInvitationResponse
} from './share-persistence-model';

describe('share persistence model', () => {
  it('plans reset, accepted grants, and pending invitations immutably', () => {
    const userIds = ['accepted-user', 'pending-user'];
    const permissions = new Map([
      ['accepted-user', 'editor' as const],
      ['pending-user', 'viewer' as const]
    ]);
    const acceptedIds = new Set(['accepted-user']);
    const invitationIdByUser = new Map([
      ['accepted-user', 'grant-id'],
      ['pending-user', 'invitation-id']
    ]);

    expect(
      planFolderShareMutations('folder-1', userIds, permissions, acceptedIds, {
        managerId: 'manager-1',
        createdAt: 'created',
        invitationIdByUser
      })
    ).toEqual([
      { kind: 'delete-grants', folderId: 'folder-1' },
      { kind: 'revoke-pending', folderId: 'folder-1', respondedAt: 'created' },
      {
        kind: 'accept-invitation',
        folderId: 'folder-1',
        userId: 'accepted-user',
        permission: 'editor'
      },
      {
        kind: 'insert-grant',
        id: 'grant-id',
        folderId: 'folder-1',
        userId: 'accepted-user',
        permission: 'editor',
        createdBy: 'manager-1',
        createdAt: 'created'
      },
      {
        kind: 'upsert-invitation',
        id: 'invitation-id',
        folderId: 'folder-1',
        userId: 'pending-user',
        permission: 'viewer',
        invitedBy: 'manager-1',
        createdAt: 'created'
      }
    ]);
    expect(userIds).toEqual(['accepted-user', 'pending-user']);
  });

  it('applies the viewer default when a selected user has no permission entry', () => {
    const [reset, revoke, mutation] = planFolderShareMutations(
      'folder-1',
      ['user-1'],
      new Map(),
      new Set(),
      {
        managerId: 'manager-1',
        createdAt: 'created',
        invitationIdByUser: new Map([['user-1', 'invitation-1']])
      }
    );
    expect(reset.kind).toBe('delete-grants');
    expect(revoke.kind).toBe('revoke-pending');
    expect(mutation).toMatchObject({ kind: 'upsert-invitation', permission: 'viewer' });
  });

  it('injects clock and ID effects before planning folder mutations', () => {
    const result = buildFolderShareMutations(
      'folder-1',
      ['user-1'],
      new Map([['user-1', 'editor' as const]]),
      new Set(),
      'manager-1',
      {
        now: () => '2026-07-29T00:00:00.000Z',
        newId: () => 'invitation-1'
      }
    );

    expect(result).toContainEqual({
      kind: 'upsert-invitation',
      id: 'invitation-1',
      folderId: 'folder-1',
      userId: 'user-1',
      permission: 'editor',
      invitedBy: 'manager-1',
      createdAt: '2026-07-29T00:00:00.000Z'
    });
  });

  it('plans a single decline mutation without creating a grant', () => {
    expect(
      planShareInvitationResponse(
        { id: 'invitation-1', folderId: 'folder-1', permission: 'viewer', invitedBy: 'owner-1' },
        'user-1',
        false,
        { respondedAt: 'responded', grantId: 'grant-1' }
      )
    ).toEqual([
      { kind: 'decline-invitation', invitationId: 'invitation-1', respondedAt: 'responded' }
    ]);
  });

  it('injects response time and accepted grant ID effects', () => {
    expect(
      buildShareInvitationResponse(
        { id: 'invitation-1', folderId: 'folder-1', permission: 'viewer', invitedBy: 'owner-1' },
        'user-1',
        true,
        { now: () => '2026-07-29T00:00:00.000Z', newId: () => 'grant-1' }
      )
    ).toContainEqual({
      kind: 'upsert-accepted-grant',
      id: 'grant-1',
      folderId: 'folder-1',
      userId: 'user-1',
      permission: 'viewer',
      createdBy: 'owner-1',
      createdAt: '2026-07-29T00:00:00.000Z'
    });
  });

  it('plans acceptance before the idempotent grant upsert', () => {
    expect(
      planShareInvitationResponse(
        { id: 'invitation-1', folderId: 'folder-1', permission: 'editor', invitedBy: 'owner-1' },
        'user-1',
        true,
        { respondedAt: 'responded', grantId: 'grant-1' }
      )
    ).toEqual([
      {
        kind: 'accept-invitation-response',
        invitationId: 'invitation-1',
        respondedAt: 'responded'
      },
      {
        kind: 'upsert-accepted-grant',
        id: 'grant-1',
        folderId: 'folder-1',
        userId: 'user-1',
        permission: 'editor',
        createdBy: 'owner-1',
        createdAt: 'responded'
      }
    ]);
  });
});
