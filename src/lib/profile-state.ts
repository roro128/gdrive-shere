export type ProfileState = {
  displayName: string;
  role: 'admin' | 'member';
  handle?: string | null;
  loginId?: string | null;
  avatarUrl?: string | null;
  googleConnected?: boolean;
  status?: 'active' | 'disabled';
};

export function mergeProfileState(current: ProfileState, updated: Partial<ProfileState>) {
  return { ...current, ...updated };
}

export function removeProfilePasskey<T extends { id: string }>(
  passkeys: readonly T[],
  passkeyId: string
): T[] {
  return passkeys.filter((passkey) => passkey.id !== passkeyId);
}
