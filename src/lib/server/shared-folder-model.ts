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

export function buildOwnedSharedFolderListings<T extends SharedFolderIdentity>(
  folders: readonly T[],
  ownerName: string,
  recipients: readonly { folderId: string; displayName: string }[]
): Array<T & SharedFolderListing> {
  const namesByFolder = new Map<string, string[]>();
  for (const recipient of recipients) {
    const names = namesByFolder.get(recipient.folderId);
    if (names) names.push(recipient.displayName);
    else namesByFolder.set(recipient.folderId, [recipient.displayName]);
  }

  return folders
    .map((folder) =>
      decorateOwnedSharedFolder(folder, ownerName, namesByFolder.get(folder.id) ?? [])
    )
    .filter((folder): folder is T & SharedFolderListing => folder !== null);
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
