export type ProfileUserSource = {
  id: string;
  display_name: string;
  handle: string | null;
  login_id: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
};

export function toProfileUser(user: ProfileUserSource) {
  return {
    id: user.id,
    displayName: user.display_name,
    handle: user.handle ?? user.login_id,
    loginId: user.login_id,
    avatarUrl: user.avatar_url,
    role: user.role,
    status: user.status
  };
}
