import { describe, expect, it } from 'vitest';
import {
  initialWorkspaceLoadState,
  workspaceLoadReducer,
  type WorkspaceLoadState
} from './workspace-load-state-model';

describe('workspace load reducer', () => {
  it('uses cached files immediately while keeping refresh active', () => {
    const state = initialWorkspaceLoadState<{ id: string }>();
    const cached = [{ id: 'cached' }];
    const next = workspaceLoadReducer(state, {
      type: 'refresh-start',
      cachedFiles: cached,
      hasLoadedFiles: false
    });

    expect(next).toMatchObject({ files: cached, loading: false, refreshing: true });
    expect(state.files).toEqual([]);
    expect(cached).toEqual([{ id: 'cached' }]);
  });

  it('represents empty and unavailable sources without leaving a loading flag', () => {
    const state: WorkspaceLoadState<{ id: string }> = {
      files: [{ id: 'old' }],
      loading: true,
      refreshing: true,
      message: ''
    };

    expect(workspaceLoadReducer(state, { type: 'empty-load' })).toMatchObject({
      files: [],
      loading: false,
      refreshing: false
    });
  });

  it('preserves prior messages when success has no new message and replaces them on failure', () => {
    const state = { ...initialWorkspaceLoadState<{ id: string }>(), message: '이전 안내' };
    const success = workspaceLoadReducer(state, {
      type: 'load-success',
      files: [{ id: 'fresh' }]
    });
    const failed = workspaceLoadReducer(success, {
      type: 'load-failure',
      message: '불러오기 실패'
    });

    expect(success.message).toBe('이전 안내');
    expect(failed).toMatchObject({ message: '불러오기 실패', loading: false, refreshing: false });
  });
});
