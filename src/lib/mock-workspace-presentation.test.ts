import { describe, expect, it } from 'vitest';
import {
  decorateMockFiles,
  type MockShareGrant,
  type MockShareUser,
  type MockWorkspaceFile
} from './mock-workspace-model';

describe('mock workspace presentation', () => {
  const files: MockWorkspaceFile[] = [
    {
      id: 'folder-1',
      name: 'Shared folder',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['mock-space'],
      modifiedTime: '2026-07-29'
    },
    {
      id: 'file-1',
      name: 'Note',
      mimeType: 'text/plain',
      parents: ['mock-space'],
      modifiedTime: '2026-07-29'
    }
  ];
  const grants: MockShareGrant[] = [{ userId: 'user-1', permission: 'editor' }];
  const users: MockShareUser[] = [{ id: 'user-1', displayName: 'Ada', handle: 'ada' }];

  it('decorates owner files with share details and folder-only share actions', () => {
    expect(
      decorateMockFiles(files, new Map([['folder-1', grants]]), users, {
        permission: 'owner',
        isAdmin: false,
        showShared: false
      })
    ).toEqual([
      {
        ...files[0],
        permission: 'owner',
        sharedByMe: true,
        sharedRoot: true,
        sharedWithCount: 1,
        sharedWithNames: ['Ada'],
        canShare: true
      },
      { ...files[1], permission: 'owner', canShare: false }
    ]);
  });

  it('does not expose owner sharing metadata to viewers', () => {
    const result = decorateMockFiles(files, new Map([['folder-1', grants]]), users, {
      permission: 'viewer',
      isAdmin: false,
      showShared: true
    });

    expect(result[0]).toEqual({ ...files[0], permission: 'viewer', shared: true, canShare: false });
    expect(result[0]).not.toHaveProperty('sharedWithNames');
    expect(result[1]).toEqual({ ...files[1], permission: 'viewer', shared: true, canShare: false });
  });

  it('does not mutate files, grants, or user inputs', () => {
    const originalFiles = structuredClone(files);
    const originalGrants = structuredClone(grants);
    const originalUsers = structuredClone(users);

    decorateMockFiles(files, new Map([['folder-1', grants]]), users, {
      permission: 'editor',
      isAdmin: false,
      showShared: false
    });

    expect(files).toEqual(originalFiles);
    expect(grants).toEqual(originalGrants);
    expect(users).toEqual(originalUsers);
  });
});
