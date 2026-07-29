import { describe, expect, it } from 'vitest';
import {
  beginNativeDrag,
  clearDragInteraction,
  dragInteractionReducer,
  enterExternalDrag,
  enterInternalDrag,
  initialDragInteraction,
  leaveDragTarget,
  updateDragTarget
} from './drag-interaction-model';

describe('drag interaction model', () => {
  it('tracks native source and internal target immutably', () => {
    const started = beginNativeDrag('file-1');
    const targeted = enterInternalDrag(started, 'file-1', 'folder-1');

    expect(started).toEqual({
      nativeDragFileId: 'file-1',
      moveDropTarget: null,
      externalDragActive: false
    });
    expect(targeted).toEqual({
      nativeDragFileId: 'file-1',
      moveDropTarget: 'folder-1',
      externalDragActive: false
    });
  });

  it('switches to external drag and clears only a matching target', () => {
    const external = enterExternalDrag('folder-1');

    expect(leaveDragTarget(external, 'other-folder')).toBe(external);
    expect(leaveDragTarget(external, 'folder-1')).toEqual({
      nativeDragFileId: null,
      moveDropTarget: null,
      externalDragActive: false
    });
  });

  it('updates targets and provides a stable clear state', () => {
    const state = enterExternalDrag(null);

    expect(updateDragTarget(state, 'folder-2')).toEqual({
      nativeDragFileId: null,
      moveDropTarget: 'folder-2',
      externalDragActive: true
    });
    expect(clearDragInteraction()).toEqual(initialDragInteraction);
  });

  it('reduces UI actions through the same immutable transition functions', () => {
    const started = dragInteractionReducer(initialDragInteraction, {
      type: 'begin-native',
      sourceId: 'file-1'
    });
    const targeted = dragInteractionReducer(started, {
      type: 'enter-internal',
      sourceId: 'file-1',
      targetParentId: 'folder-1'
    });

    expect(targeted).toEqual({
      nativeDragFileId: 'file-1',
      moveDropTarget: 'folder-1',
      externalDragActive: false
    });
    expect(dragInteractionReducer(targeted, { type: 'clear' })).toEqual(initialDragInteraction);
  });
});
