import { describe, expect, it } from 'vitest';
import {
  buildOwnedSharedFolderListing,
  buildOwnedSharedFolderListings,
  decorateOwnedSharedFolder,
  mergeSharedFolderListings,
  toSharedWithNames,
  toAdminSpaceFile,
  toSharedFolderFile
} from './shared-folder-model';

describe('shared folder model', () => {
  it('maps an admin space to a read-only workspace file', () => {
    expect(
      toAdminSpaceFile({
        id: 'space-1',
        name: 'Ada',
        handle: null,
        loginId: 'ada-login',
        modifiedTime: '2026-01-01T00:00:00.000Z'
      })
    ).toEqual({
      id: 'space-1',
      name: 'Ada',
      mimeType: 'application/vnd.google-apps.folder',
      size: '0',
      parents: [],
      modifiedTime: '2026-01-01T00:00:00.000Z',
      ownerName: 'Ada · @ada-login',
      permission: 'admin',
      isAdminSpace: true,
      canShare: false
    });
  });
  const folder = {
    id: 'folder-1',
    name: 'Shared',
    mimeType: 'application/vnd.google-apps.folder',
    modifiedTime: '2026-07-29'
  };

  it('decorates owned folders only when recipients exist and limits visible names', () => {
    expect(decorateOwnedSharedFolder(folder, 'Owner', ['Ada', 'Grace', 'Lin', 'Noor'])).toEqual({
      ...folder,
      ownerName: 'Owner',
      permission: 'owner',
      sharedByMe: true,
      sharedWithCount: 4,
      sharedWithNames: ['Ada', 'Grace', 'Lin']
    });
    expect(decorateOwnedSharedFolder(folder, 'Owner', [])).toBeNull();
  });

  it('combines accepted and pending recipients before decorating an owned folder', () => {
    expect(
      buildOwnedSharedFolderListing(
        folder,
        'Owner',
        [{ displayName: 'Ada' }],
        [{ displayName: 'Grace' }]
      )
    ).toMatchObject({
      ownerName: 'Owner',
      sharedWithCount: 2,
      sharedWithNames: ['Ada', 'Grace']
    });
  });

  it('merges received and owned listings without mutating source arrays', () => {
    const received = [{ ...folder, permission: 'viewer' }];
    const receivedSnapshot = structuredClone(received);
    const owned = [
      {
        ...folder,
        id: 'folder-2',
        ownerName: 'Owner',
        permission: 'owner',
        sharedByMe: true,
        sharedWithCount: 1,
        sharedWithNames: ['Ada']
      }
    ];
    const ownedSnapshot = structuredClone(owned);
    expect(mergeSharedFolderListings(received, owned)).toEqual([
      {
        ...folder,
        permission: 'viewer',
        sharedByMe: false,
        sharedWithCount: 0,
        sharedWithNames: []
      },
      {
        ...owned[0]
      }
    ]);
    expect(received).toEqual(receivedSnapshot);
    expect(owned).toEqual(ownedSnapshot);
  });

  it('projects a shared listing into the file API shape', () => {
    expect(
      toSharedFolderFile({
        ...folder,
        permission: 'owner',
        sharedByMe: true,
        sharedWithCount: 1,
        sharedWithNames: ['Ada']
      })
    ).toMatchObject({
      size: '0',
      parents: [],
      shared: true,
      canShare: true,
      sharedRoot: true
    });
  });

  it('projects accepted and pending recipient rows into an immutable name list', () => {
    const rows = [{ displayName: 'Ada' }, { displayName: 'Grace' }];
    expect(toSharedWithNames(rows)).toEqual(['Ada', 'Grace']);
    expect(rows).toEqual([{ displayName: 'Ada' }, { displayName: 'Grace' }]);
  });

  it('groups recipients once when building multiple owned shared folders', () => {
    const folders = [folder, { ...folder, id: 'folder-2', name: 'Other' }];
    const recipients = [
      { folderId: 'folder-1', displayName: 'Ada' },
      { folderId: 'folder-1', displayName: 'Grace' },
      { folderId: 'folder-2', displayName: 'Lin' },
      { folderId: 'unknown', displayName: 'Ignored' }
    ];
    const snapshot = structuredClone(recipients);

    expect(buildOwnedSharedFolderListings(folders, 'Owner', recipients)).toMatchObject([
      { id: 'folder-1', sharedWithCount: 2, sharedWithNames: ['Ada', 'Grace'] },
      { id: 'folder-2', sharedWithCount: 1, sharedWithNames: ['Lin'] }
    ]);
    expect(recipients).toEqual(snapshot);
  });
});
