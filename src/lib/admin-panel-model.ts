export type AdminPanelState<TUser, TRequest, TLink> = {
  open: boolean;
  users: readonly TUser[];
  resetRequests: readonly TRequest[];
  generatedResetLinks: Readonly<Record<string, TLink>>;
  updatingMemberId: string | null;
};

export type AdminPanelAction<TUser, TRequest, TLink> =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'set-users'; users: readonly TUser[] }
  | { type: 'set-reset-requests'; requests: readonly TRequest[] }
  | { type: 'set-generated-link'; memberId: string; link: TLink }
  | { type: 'update-member-status'; memberId: string; status: string }
  | { type: 'update-reset-request'; requestId: string; update: (request: TRequest) => TRequest }
  | { type: 'set-updating-member'; memberId: string | null };

export function initialAdminPanelState<TUser, TRequest, TLink>(): AdminPanelState<
  TUser,
  TRequest,
  TLink
> {
  return {
    open: false,
    users: [],
    resetRequests: [],
    generatedResetLinks: {},
    updatingMemberId: null
  };
}

export function adminPanelReducer<
  TUser extends { id?: string | null; status?: string },
  TRequest extends { id: string },
  TLink
>(
  state: AdminPanelState<TUser, TRequest, TLink>,
  action: AdminPanelAction<TUser, TRequest, TLink>
): AdminPanelState<TUser, TRequest, TLink> {
  switch (action.type) {
    case 'open':
      return { ...state, open: true };
    case 'close':
      return { ...state, open: false };
    case 'set-users':
      return { ...state, users: [...action.users] };
    case 'set-reset-requests':
      return { ...state, resetRequests: [...action.requests] };
    case 'set-generated-link':
      return {
        ...state,
        generatedResetLinks: { ...state.generatedResetLinks, [action.memberId]: action.link }
      };
    case 'update-member-status':
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.memberId ? { ...user, status: action.status } : user
        )
      };
    case 'update-reset-request':
      return {
        ...state,
        resetRequests: state.resetRequests.map((request) =>
          request.id === action.requestId ? action.update(request) : request
        )
      };
    case 'set-updating-member':
      return { ...state, updatingMemberId: action.memberId };
  }
}
