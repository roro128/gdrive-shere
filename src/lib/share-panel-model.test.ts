import { describe, expect, it } from 'vitest';
import {
  initialSharePanelState,
  sharePanelReducer,
  type SharePanelState
} from './share-panel-model';

type Folder = { id: string; name: string };
type Member = { id: string; displayName: string; permission?: 'viewer' | 'editor' };

describe('share panel reducer', () => {
  it('opens with copied members and selected ids, then closes immutably', () => {
    const state = initialSharePanelState<Folder, Member>();
    const members = [{ id: 'user-1', displayName: 'User' }];
    const selectedIds = new Set(['user-1']);
    const opened = sharePanelReducer(state, {
      type: 'open',
      folder: { id: 'folder-1', name: 'Folder' },
      members,
      selectedIds
    });
    const closed = sharePanelReducer(opened, { type: 'close' });

    expect(opened.folder?.id).toBe('folder-1');
    expect(opened.members).toEqual(members);
    expect(opened.selectedIds).toEqual(selectedIds);
    expect(closed).toEqual(initialSharePanelState<Folder, Member>());
    expect(state.folder).toBeNull();
  });

  it('preserves selection while replacing search results and permissions', () => {
    const state: SharePanelState<Folder, Member> = {
      ...initialSharePanelState<Folder, Member>(),
      selectedIds: new Set(['user-1']),
      members: [{ id: 'user-1', displayName: 'Selected', permission: 'viewer' }]
    };
    const searched = sharePanelReducer(state, {
      type: 'search-success',
      available: [{ id: 'user-2', displayName: 'Available' }]
    });
    const changed = sharePanelReducer(searched, {
      type: 'set-permission',
      memberId: 'user-2',
      permission: 'editor'
    });

    expect(changed.members).toEqual([
      { id: 'user-1', displayName: 'Selected', permission: 'viewer' },
      { id: 'user-2', displayName: 'Available', permission: 'editor' }
    ]);
    expect(changed.selectedIds).toEqual(new Set(['user-1']));
  });

  it('keeps search errors visible until the next search starts', () => {
    const searching = sharePanelReducer(initialSharePanelState<Folder, Member>(), {
      type: 'search-start'
    });
    const failed = sharePanelReducer(searching, {
      type: 'search-failure',
      message: '검색 실패'
    });
    const next = sharePanelReducer(failed, { type: 'search-start' });

    expect(failed).toMatchObject({ searchBusy: true, searchError: '검색 실패' });
    expect(next).toMatchObject({ searchBusy: true, searchError: '' });
  });
});
