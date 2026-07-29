export type ProfileUpdateSource = {
  id: string;
  avatar_url: string | null;
  password_hash: string | null;
  role: string;
  status: string;
};

export type ProfileUpdateInput = {
  handle: string | null;
  avatarUrl?: string | null;
};

export type ProfileUpdateValues = {
  handle: string | null;
  avatar_url: string | null | undefined;
  password_hash: string | null;
  updated_at: string;
};

export function buildProfileUpdateValues(
  current: ProfileUpdateSource,
  input: ProfileUpdateInput,
  nextPasswordHash: string | null | undefined,
  updatedAt: string
): ProfileUpdateValues {
  return {
    handle: input.handle,
    avatar_url: input.avatarUrl === undefined ? current.avatar_url : input.avatarUrl,
    password_hash: nextPasswordHash === undefined ? current.password_hash : nextPasswordHash,
    updated_at: updatedAt
  };
}

export function buildProfileUpdateResponse(
  current: ProfileUpdateSource,
  values: ProfileUpdateValues
) {
  return {
    id: current.id,
    handle: values.handle,
    avatarUrl: values.avatar_url,
    role: current.role,
    status: current.status
  };
}

export function toAuthUserImageUpdate(image: string | null | undefined, updatedAt: Date) {
  return { image, updatedAt };
}

export function toProfilePatchRequest(input: {
  handle: string | null;
  avatarUrl: string | null;
  currentPassword: string;
  newPassword: string;
}) {
  return {
    handle: input.handle,
    avatarUrl: input.avatarUrl,
    ...(input.newPassword
      ? { currentPassword: input.currentPassword, newPassword: input.newPassword }
      : {})
  };
}
