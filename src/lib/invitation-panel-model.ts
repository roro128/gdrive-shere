export type InvitationPanelState<TInvitation> = {
  invitations: readonly TInvitation[];
  respondingId: string | null;
};

export type InvitationPanelAction<TInvitation> =
  | { type: 'set-invitations'; invitations: readonly TInvitation[] }
  | { type: 'clear-invitations' }
  | { type: 'start-response'; invitationId: string }
  | { type: 'finish-response' };

export function initialInvitationPanelState<TInvitation>(): InvitationPanelState<TInvitation> {
  return { invitations: [], respondingId: null };
}

export function invitationPanelReducer<TInvitation>(
  state: InvitationPanelState<TInvitation>,
  action: InvitationPanelAction<TInvitation>
): InvitationPanelState<TInvitation> {
  switch (action.type) {
    case 'set-invitations':
      return { ...state, invitations: [...action.invitations] };
    case 'clear-invitations':
      return { ...state, invitations: [] };
    case 'start-response':
      return state.respondingId ? state : { ...state, respondingId: action.invitationId };
    case 'finish-response':
      return { ...state, respondingId: null };
  }
}
