import { describe, expect, it } from 'vitest';
import {
  buildLinkedMemberClaim,
  buildLinkedMemberUser,
  buildGoogleAdminUser,
  buildPendingMemberUser,
  toGoogleAdminUser,
  toInvitationDbRecord,
  toInvitationRecord,
  toLegacySessionRecord,
  toLinkedMemberUser,
  toLinkedMemberClaim,
  toPendingMemberUser,
  toPendingMemberUserUpdate,
  toActiveMemberUpdate,
  toAvatarUpdate,
  toInvitationUsedUpdate,
  toPasskeyCounterUpdate,
  toUserStatusUpdate
} from './auth-record-model';

describe('auth record model', () => {
  it('injects ID and clock effects when creating a Google admin user', () => {
    expect(
      buildGoogleAdminUser(
        { subject: 'google-subject', email: 'person@example.com', name: 'Person' },
        { now: () => '2026-07-29T00:00:00.000Z', newId: () => 'user-1' }
      )
    ).toMatchObject({
      id: 'user-1',
      google_subject: 'google-subject',
      created_at: '2026-07-29T00:00:00.000Z',
      updated_at: '2026-07-29T00:00:00.000Z'
    });
  });

  it('builds a Google admin user with a bounded fallback display name', () => {
    expect(
      toGoogleAdminUser({
        id: 'user-1',
        subject: 'google-subject',
        email: 'person@example.com',
        name: `  ${'a'.repeat(100)}  `,
        createdAt: 'created',
        updatedAt: 'updated'
      })
    ).toMatchObject({
      id: 'user-1',
      display_name: 'a'.repeat(80),
      role: 'admin',
      status: 'active',
      google_subject: 'google-subject'
    });
  });

  it('uses the email local part when the Google profile name is missing', () => {
    expect(
      toGoogleAdminUser({
        id: 'user-1',
        subject: 'google-subject',
        email: 'person@example.com',
        name: '   ',
        createdAt: 'created',
        updatedAt: 'updated'
      }).display_name
    ).toBe('person');
  });

  it('returns invitation persistence values without changing them', () => {
    const input = {
      id: 'invite-1',
      tokenHash: 'hash',
      role: 'member' as const,
      expiresAt: 'expires',
      createdAt: 'created'
    };
    expect(toInvitationRecord(input)).toEqual(input);
    expect(toInvitationRecord(input)).not.toBe(input);
    expect(toInvitationDbRecord({ ...input, createdBy: 'admin-1' })).toEqual({
      id: 'invite-1',
      token_hash: 'hash',
      role: 'member',
      expires_at: 'expires',
      created_by: 'admin-1',
      created_at: 'created'
    });
  });

  it('maps a legacy session record to database column names immutably', () => {
    const input = {
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: 'expires',
      createdAt: 'created'
    };
    expect(toLegacySessionRecord(input)).toEqual({
      id: 'session-1',
      user_id: 'user-1',
      token_hash: 'hash',
      expires_at: 'expires',
      created_at: 'created'
    });
    expect(input).toEqual({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: 'expires',
      createdAt: 'created'
    });
  });

  it('builds pending member insert and update payloads consistently', () => {
    expect(
      toPendingMemberUser({
        id: 'user-1',
        displayName: 'Member',
        invitationId: 'invitation-1',
        loginId: 'member-1',
        passwordHash: 'hash',
        createdAt: 'created',
        updatedAt: 'updated'
      })
    ).toMatchObject({
      id: 'user-1',
      display_name: 'Member',
      role: 'member',
      status: 'pending',
      invitation_id: 'invitation-1',
      login_id: 'member-1',
      handle: 'member-1'
    });
    expect(
      toPendingMemberUserUpdate({
        displayName: 'Member',
        loginId: 'member-1',
        passwordHash: 'new-hash',
        updatedAt: 'updated'
      })
    ).toEqual({
      display_name: 'Member',
      login_id: 'member-1',
      handle: 'member-1',
      password_hash: 'new-hash',
      updated_at: 'updated'
    });
  });

  it('injects ID and clock effects for pending and linked member records', () => {
    const runtime = { now: () => 'created', newId: () => 'user-1' };
    const pending = buildPendingMemberUser(
      {
        displayName: 'Member',
        invitationId: 'invitation-1',
        loginId: 'member-1',
        passwordHash: 'hash'
      },
      runtime
    );
    const linked = buildLinkedMemberUser(
      {
        displayName: 'Member',
        invitationId: 'invitation-1',
        loginId: 'member-1',
        authUserId: 'auth-user-1'
      },
      runtime
    );

    expect(pending).toMatchObject({ id: 'user-1', created_at: 'created' });
    expect(linked).toMatchObject({ id: 'user-1', auth_user_id: 'auth-user-1' });
    expect(
      buildLinkedMemberClaim(linked, 'invitation-1', { ...runtime, now: () => 'claimed' })
    ).toMatchObject({
      claimedAt: 'claimed'
    });
  });

  it('builds an active Better Auth-linked member record', () => {
    expect(
      toLinkedMemberUser({
        id: 'user-1',
        displayName: 'Member',
        invitationId: 'invitation-1',
        loginId: 'member-1',
        authUserId: 'auth-user-1',
        createdAt: 'created',
        updatedAt: 'updated'
      })
    ).toMatchObject({
      id: 'user-1',
      role: 'member',
      status: 'active',
      invitation_id: 'invitation-1',
      auth_user_id: 'auth-user-1',
      handle: 'member-1'
    });
  });

  it('builds the atomic invitation claim parameters from the linked member record', () => {
    const user = toLinkedMemberUser({
      id: 'user-1',
      displayName: 'Member',
      invitationId: 'invitation-1',
      loginId: 'member-1',
      authUserId: 'auth-user-1',
      createdAt: 'created',
      updatedAt: 'updated'
    });
    expect(
      toLinkedMemberClaim({ user, invitationId: 'invitation-1', claimedAt: 'claimed' })
    ).toEqual({
      userId: 'user-1',
      displayName: 'Member',
      loginId: 'member-1',
      handle: 'member-1',
      authUserId: 'auth-user-1',
      createdAt: 'created',
      updatedAt: 'updated',
      invitationId: 'invitation-1',
      claimedAt: 'claimed'
    });
  });

  it('builds consistent user status transition payloads', () => {
    expect(toUserStatusUpdate('active', 'active')).toEqual({
      status: 'active',
      updated_at: 'active'
    });
    expect(toUserStatusUpdate('disabled', 'disabled')).toEqual({
      status: 'disabled',
      updated_at: 'disabled'
    });
    expect(toActiveMemberUpdate('member-1', 'updated')).toEqual({
      status: 'active',
      handle: 'member-1',
      updated_at: 'updated'
    });
    expect(toAvatarUpdate('avatar', 'updated')).toEqual({
      avatar_url: 'avatar',
      updated_at: 'updated'
    });
    expect(toInvitationUsedUpdate('used')).toEqual({ used_at: 'used' });
    expect(toPasskeyCounterUpdate(4)).toEqual({ counter: 4 });
  });
});
