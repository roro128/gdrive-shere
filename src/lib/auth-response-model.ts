export type AuthUserResponseSource = {
  id: string;
  display_name: string;
  handle?: string | null;
  login_id?: string | null;
  role: string;
};

export type AuthUserResponse = {
  id: string;
  displayName: string;
  handle: string | null;
  role: string;
};

export function toAuthUserResponse(user: AuthUserResponseSource): AuthUserResponse {
  return {
    id: user.id,
    displayName: user.display_name,
    handle: user.handle ?? user.login_id ?? null,
    role: user.role
  };
}

export type AdminUserResponseSource = AuthUserResponseSource & {
  status: string;
  created_at: string;
  updated_at: string;
};

export function toAdminUserResponse(user: AdminUserResponseSource) {
  return {
    ...toAuthUserResponse(user),
    loginId: user.login_id,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}
