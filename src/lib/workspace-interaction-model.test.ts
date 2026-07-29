import { describe, expect, it } from 'vitest';
import {
  initialWorkspaceInteractionState,
  workspaceInteractionReducer
} from './workspace-interaction-model';

describe('workspaceInteractionReducer', () => {
  it('updates sort and dragging state immutably', () => {
    const initial = initialWorkspaceInteractionState<{ id: string }>();
    const sorted = workspaceInteractionReducer(initial, { type: 'set-sort', sortBy: 'size' });
    const descending = workspaceInteractionReducer(sorted, { type: 'toggle-sort-direction' });
    const files = [{ id: 'file-1' }];
    const dragging = workspaceInteractionReducer(descending, {
      type: 'set-dragging-files',
      files
    });

    expect(dragging.sortBy).toBe('size');
    expect(dragging.sortDescending).toBe(true);
    expect(dragging.draggingFiles).toEqual(files);
    expect(dragging.draggingFiles).not.toBe(files);
    expect(initial.sortBy).toBe('name');
  });

  it('adds and removes pending IDs without clearing unrelated work', () => {
    const initial = initialWorkspaceInteractionState<never>();
    const pending = workspaceInteractionReducer(initial, {
      type: 'mark-pending',
      ids: ['one', 'two']
    });
    const busy = workspaceInteractionReducer(pending, {
      type: 'set-selection-busy',
      busy: true
    });
    const cleared = workspaceInteractionReducer(busy, {
      type: 'clear-pending',
      ids: ['one']
    });

    expect([...cleared.pendingOperationIds]).toEqual(['two']);
    expect(cleared.selectionBusy).toBe(true);
    expect(initial.pendingOperationIds.size).toBe(0);
  });
});
