import { describe, expect, it } from 'vitest';
import { initialInvitationPanelState, invitationPanelReducer } from './invitation-panel-model';

describe('invitationPanelReducer', () => {
  it('copies invitation collections and clears failed loads', () => {
    const initial = initialInvitationPanelState<{ id: string }>();
    const source = [{ id: 'invite-1' }];
    const loaded = invitationPanelReducer(initial, {
      type: 'set-invitations',
      invitations: source
    });
    const cleared = invitationPanelReducer(loaded, { type: 'clear-invitations' });

    expect(loaded.invitations).toEqual(source);
    expect(loaded.invitations).not.toBe(source);
    expect(cleared.invitations).toEqual([]);
    expect(initial.invitations).toEqual([]);
  });

  it('does not replace an active response with a second invitation', () => {
    const initial = initialInvitationPanelState<{ id: string }>();
    const first = invitationPanelReducer(initial, { type: 'start-response', invitationId: 'one' });
    const second = invitationPanelReducer(first, { type: 'start-response', invitationId: 'two' });

    expect(second.respondingId).toBe('one');
    expect(invitationPanelReducer(second, { type: 'finish-response' }).respondingId).toBeNull();
  });
});
