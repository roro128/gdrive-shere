export type SharedFolderIdentity = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
};

export type SharedFolderListing = SharedFolderIdentity & {
  ownerName?: string;
  permission?: string;
  sharedByMe: boolean;
  sharedWithCount: number;
  sharedWithNames: string[];
};

export type AdminSpaceIdentity = {
  id: string;
  name: string;
  handle: string | null;
  loginId: string | null;
  modifiedTime: string;
};

export function toAdminSpaceFile(space: AdminSpaceIdentity) {
  return {
    id: space.id,
    name: space.name,
    mimeType: 'application/vnd.google-apps.folder',
    size: '0',
    parents: [],
    modifiedTime: space.modifiedTime,
    ownerName: `${space.name} · @${space.handle ?? space.loginId ?? 'member'}`,
    permission: 'admin',
    isAdminSpace: true,
    canShare: false
  };
}

export function mergeSharedFolderListings(
  received: readonly (SharedFolderIdentity & { permission?: string })[],
  owned: readonly SharedFolderListing[]
): SharedFolderListing[] {
  const receivedListings = received.map((folder) => ({
    ...folder,
    sharedByMe: false,
    sharedWithCount: 0,
    sharedWithNames: []
  }));
  return [...receivedListings, ...owned];
}

export function toSharedWithNames(rows: readonly { displayName: string }[]): string[] {
  return rows.map((row) => row.displayName);
}

export function decorateOwnedSharedFolder<T extends SharedFolderIdentity>(
  folder: T,
  ownerName: string,
  sharedWithNames: readonly string[]
): (T & SharedFolderListing) | null {
  if (!sharedWithNames.length) return null;
  return {
    ...folder,
    ownerName,
    permission: 'owner',
    sharedByMe: true,
    sharedWithCount: sharedWithNames.length,
    sharedWithNames: sharedWithNames.slice(0, 3)
  };
}

export function buildOwnedSharedFolderListing<T extends SharedFolderIdentity>(
  folder: T,
  ownerName: string,
  accepted: readonly { displayName: string }[],
  pending: readonly { displayName: string }[]
): (T & SharedFolderListing) | null {
  return decorateOwnedSharedFolder(folder, ownerName, toSharedWithNames([...accepted, ...pending]));
}

export function toSharedFolderFile(folder: SharedFolderListing) {
  return {
    ...folder,
    size: '0',
    parents: [],
    shared: true,
    canShare: folder.sharedByMe,
    sharedByMe: folder.sharedByMe,
    sharedRoot: true,
    sharedWithCount: folder.sharedWithCount,
    sharedWithNames: folder.sharedWithNames
  };
}
