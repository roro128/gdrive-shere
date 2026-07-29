import { describe, expect, it } from 'vitest';
import {
  canEditWorkspaceFolder,
  isSharedFolderIndex,
  canUploadToWorkspace,
  canLoadStorageQuota,
  canLoadWorkspaceFiles,
  resolveWorkspaceLoadSource,
  type WorkspaceEditContext
} from './workspace-availability';

describe('workspace availability', () => {
  it('treats only the shared-folder root as a folder index', () => {
    expect(isSharedFolderIndex(true, null)).toBe(true);
    expect(isSharedFolderIndex(true, 'shared-folder')).toBe(false);
    expect(isSharedFolderIndex(false, null)).toBe(false);
  });

  it('resolves file loading source without performing effects', () => {
    expect(
      resolveWorkspaceLoadSource({
        showRequests: true,
        googleConnected: false,
        mockMode: false,
        trash: false
      })
    ).toBe('requests');
    expect(
      resolveWorkspaceLoadSource({
        showRequests: false,
        googleConnected: false,
        mockMode: false,
        trash: false
      })
    ).toBe('unavailable');
    expect(
      resolveWorkspaceLoadSource({
        showRequests: false,
        googleConnected: false,
        mockMode: true,
        trash: false
      })
    ).toBe('mock');
    expect(
      resolveWorkspaceLoadSource({
        showRequests: false,
        googleConnected: true,
        mockMode: false,
        trash: false
      })
    ).toBe('remote');
  });
  it('allows mock and connected workspaces', () => {
    expect(canLoadWorkspaceFiles(undefined, true, false)).toBe(true);
    expect(canLoadWorkspaceFiles(true, false, false)).toBe(true);
  });

  it('does not request Drive files before the administrator connects Google', () => {
    expect(canLoadWorkspaceFiles(false, false, false)).toBe(false);
  });

  it('still allows the local trash list before Drive reconnect', () => {
    expect(canLoadWorkspaceFiles(false, false, true)).toBe(true);
  });

  it('loads real Drive quota for admins and members but never in mock mode', () => {
    expect(canLoadStorageQuota(false)).toBe(true);
    expect(canLoadStorageQuota(true)).toBe(false);
  });

  it('does not expose writes at the root of the shared-folder view', () => {
    const context: WorkspaceEditContext = {
      googleConnected: true,
      trash: false,
      showRequests: false,
      showShared: true,
      folderId: null,
      currentFolderEditable: false,
      isAdmin: false,
      mockPermission: 'owner'
    };

    expect(canEditWorkspaceFolder(context)).toBe(false);
    expect(
      canEditWorkspaceFolder({
        ...context,
        folderId: 'shared-folder',
        currentFolderEditable: true
      })
    ).toBe(true);
  });

  it('keeps personal root editable while rejecting viewer, admin, and disconnected states', () => {
    const context: WorkspaceEditContext = {
      googleConnected: true,
      trash: false,
      showRequests: false,
      showShared: false,
      folderId: null,
      currentFolderEditable: false,
      isAdmin: false,
      mockPermission: 'owner'
    };

    expect(canEditWorkspaceFolder(context)).toBe(true);
    expect(canEditWorkspaceFolder({ ...context, mockPermission: 'viewer' })).toBe(false);
    expect(canEditWorkspaceFolder({ ...context, isAdmin: true })).toBe(false);
    expect(canEditWorkspaceFolder({ ...context, googleConnected: false })).toBe(false);
  });

  it('rejects upload destinations that are outside the workspace write policy', () => {
    const context = {
      trash: false,
      showRequests: false,
      isAdmin: false,
      showShared: false,
      targetParentId: null,
      currentFolderId: null,
      currentFolderEditable: true
    };
    expect(canUploadToWorkspace(context)).toBe(true);
    expect(canUploadToWorkspace({ ...context, trash: true })).toBe(false);
    expect(canUploadToWorkspace({ ...context, isAdmin: true })).toBe(false);
    expect(canUploadToWorkspace({ ...context, targetFolderEditable: false })).toBe(false);
    expect(
      canUploadToWorkspace({
        ...context,
        showShared: true,
        targetParentId: null
      })
    ).toBe(false);
    expect(
      canUploadToWorkspace({
        ...context,
        targetParentId: 'folder-1',
        currentFolderId: 'folder-1',
        currentFolderEditable: false
      })
    ).toBe(false);
  });
});
