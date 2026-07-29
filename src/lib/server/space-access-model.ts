export type SpacePermission = 'owner' | 'viewer' | 'editor' | 'admin';

export type AccessFile = {
  drive_file_id: string;
  owner_user_id: string | null;
  parent_drive_id: string | null;
};

export type ResolvedSpaceAccess<TFile extends AccessFile> = {
  file: TFile;
  ownerUserId: string;
  permission: SpacePermission;
};

export type AccessPath<TFile extends AccessFile> = {
  ancestors: readonly TFile[];
  shares: ReadonlyMap<string, 'viewer' | 'editor'>;
};

export type AccessPathLookup<TFile extends AccessFile> = {
  findShare: (folderDriveId: string) => Promise<'viewer' | 'editor' | null>;
  findParent: (parentDriveId: string) => Promise<TFile | null>;
};

export async function collectAccessPath<TFile extends AccessFile>(
  requested: TFile,
  userId: string,
  lookup: AccessPathLookup<TFile>,
  maxDepth = 64
): Promise<AccessPath<TFile>> {
  const visit = async (
    current: TFile,
    ancestors: readonly TFile[],
    shares: ReadonlyMap<string, 'viewer' | 'editor'>,
    depth: number
  ): Promise<AccessPath<TFile>> => {
    if (current.owner_user_id === userId) return { ancestors, shares };

    const permission = await lookup.findShare(current.drive_file_id);
    if (permission) {
      return {
        ancestors,
        shares: new Map([...shares, [current.drive_file_id, permission]])
      };
    }

    if (!current.parent_drive_id || depth >= maxDepth - 1) return { ancestors, shares };
    const parent = await lookup.findParent(current.parent_drive_id);
    return parent
      ? visit(parent, [...ancestors, parent], shares, depth + 1)
      : { ancestors, shares };
  };

  return visit(requested, [requested], new Map(), 0);
}

export function resolveFileAccess<TFile extends AccessFile>(
  requested: TFile,
  ancestors: readonly TFile[],
  shares: ReadonlyMap<string, 'viewer' | 'editor'>,
  userId: string,
  isAdmin: boolean
): ResolvedSpaceAccess<TFile> | null {
  if (isAdmin) {
    return {
      file: requested,
      ownerUserId: requested.owner_user_id ?? '',
      permission: 'admin'
    };
  }

  const access = ancestors
    .map((file) => ({ file, share: shares.get(file.drive_file_id) }))
    .find(({ file, share }) => file.owner_user_id === userId || share !== undefined);
  if (!access) return null;

  const permission: SpacePermission =
    access.file.owner_user_id === userId
      ? 'owner'
      : access.share === 'viewer'
        ? 'viewer'
        : 'editor';
  return {
    file: requested,
    ownerUserId: access.file.owner_user_id ?? requested.owner_user_id ?? '',
    permission
  };
}
