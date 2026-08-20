import { describe, expect, it } from 'vitest';
import {
  initialWorkspaceNavigation,
  workspaceNavigationReducer,
  type NavigationFolder
} from './workspace-navigation-model';

type Folder = NavigationFolder & { name: string };

const folder = (id: string): Folder => ({ id, name: id });

describe('workspace navigation reducer', () => {
  it('resets view-local navigation and selection when opening a view', () => {
    const state = {
      ...initialWorkspaceNavigation<Folder>(),
      folderId: 'child',
      folderPath: [folder('root'), folder('child')],
      search: 'report',
      selectedIds: new Set(['file-1']),
      lastSelectedId: 'file-1'
    };

    const next = workspaceNavigationReducer(state, { type: 'open-view', view: 'trash' });

    expect(next).toMatchObject({
      folderId: null,
      folderPath: [],
      search: '',
      trash: true,
      showShared: false,
      showRequests: false,
      lastSelectedId: null
    });
    expect(next.selectedIds).toEqual(new Set());
  });

  it('opens a folder and can return to a breadcrumb without mutating the prior state', () => {
    const state = initialWorkspaceNavigation<Folder>();
    const child = folder('child');
    const opened = workspaceNavigationReducer(state, { type: 'open-folder', folder: child });
    const root = workspaceNavigationReducer(opened, { type: 'open-root' });

    expect(state.folderPath).toEqual([]);
    expect(opened.folderPath).toEqual([child]);
    expect(opened.folderId).toBe('child');
    expect(root.folderPath).toEqual([]);
    expect(root.folderId).toBeNull();
  });

  it('does not append the current folder again when repeated clicks dispatch before rendering', () => {
    const child = folder('child');
    const opened = workspaceNavigationReducer(initialWorkspaceNavigation<Folder>(), {
      type: 'open-folder',
      folder: child
    });
    const repeated = workspaceNavigationReducer(opened, { type: 'open-folder', folder: child });

    expect(repeated).toBe(opened);
    expect(repeated.folderPath).toEqual([child]);
  });

  it('removes selection and its anchor only for requested ids', () => {
    const state = {
      ...initialWorkspaceNavigation<Folder>(),
      selectedIds: new Set(['a', 'b']),
      lastSelectedId: 'b'
    };

    const next = workspaceNavigationReducer(state, { type: 'remove-selection', ids: ['b'] });

    expect(next.selectedIds).toEqual(new Set(['a']));
    expect(next.lastSelectedId).toBeNull();
    expect(state.selectedIds).toEqual(new Set(['a', 'b']));
  });
});
