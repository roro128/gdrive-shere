export type SessionState<TUser> = {
  user: TUser | null;
  loading: boolean;
};

export type SessionAction<TUser> =
  | { type: 'set-user'; user: TUser }
  | { type: 'clear-user' }
  | { type: 'finish-loading'; user: TUser | null };

export function initialSessionState<TUser>(): SessionState<TUser> {
  return { user: null, loading: true };
}

export function sessionReducer<TUser>(
  state: SessionState<TUser>,
  action: SessionAction<TUser>
): SessionState<TUser> {
  void state;
  switch (action.type) {
    case 'set-user':
      return { user: action.user, loading: false };
    case 'clear-user':
      return { user: null, loading: false };
    case 'finish-loading':
      return { user: action.user, loading: false };
  }
}
