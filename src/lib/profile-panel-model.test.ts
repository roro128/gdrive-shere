import { describe, expect, it } from 'vitest';
import { initialProfilePanelState, profilePanelReducer } from './profile-panel-model';

type Passkey = { id: string };

describe('profile panel reducer', () => {
  it('opens with fresh profile values and resets account deletion confirmation', () => {
    const state = {
      ...initialProfilePanelState<Passkey>(),
      accountDeletionOpen: true,
      deletionConfirmation: '계정 삭제',
      deletionAcknowledged: { files: true, shares: true, passkeys: true }
    };

    const next = profilePanelReducer(state, {
      type: 'open',
      handle: 'member',
      avatarUrl: 'data:image/png;base64,a',
      loading: true
    });

    expect(next).toMatchObject({
      open: true,
      handle: 'member',
      avatarUrl: 'data:image/png;base64,a',
      loading: true,
      accountDeletionOpen: false,
      deletionConfirmation: '',
      deletionAcknowledged: { files: false, shares: false, passkeys: false }
    });
  });

  it('updates deletion acknowledgement immutably and clears password fields together', () => {
    const state = {
      ...initialProfilePanelState<Passkey>(),
      currentPassword: 'old',
      newPassword: 'new'
    };
    const acknowledged = profilePanelReducer(state, {
      type: 'set-deletion-acknowledged',
      key: 'files',
      value: true
    });
    const next = profilePanelReducer(acknowledged, { type: 'clear-passwords' });

    expect(acknowledged.deletionAcknowledged.files).toBe(true);
    expect(state.deletionAcknowledged.files).toBe(false);
    expect(next).toMatchObject({ currentPassword: '', newPassword: '' });
  });

  it('copies passkeys instead of retaining a mutable input array', () => {
    const passkeys = [{ id: 'key-1' }];
    const next = profilePanelReducer(initialProfilePanelState<Passkey>(), {
      type: 'set-passkeys',
      value: passkeys
    });

    expect(next.passkeys).toEqual(passkeys);
    expect(next.passkeys).not.toBe(passkeys);
  });
});
