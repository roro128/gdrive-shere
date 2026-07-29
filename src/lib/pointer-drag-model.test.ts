import { describe, expect, it } from 'vitest';
import {
  activatePointerDrag,
  createPointerDragSession,
  isPointerDragSession,
  pointerDragPosition,
  pointerDragDistance,
  shouldActivatePointerDrag,
  updatePointerDropTarget
} from './pointer-drag-model';

describe('pointer drag model', () => {
  it('creates an inactive session with a stable payload and matches pointer ids', () => {
    const source = null;
    const session = createPointerDragSession({
      pointerId: 7,
      payload: { id: 'file-1' },
      source,
      startX: 10,
      startY: 20
    });

    expect(session).toEqual({
      pointerId: 7,
      payload: { id: 'file-1' },
      source,
      startX: 10,
      startY: 20,
      active: false,
      targetParentId: null
    });
    expect(isPointerDragSession(session, 7)).toBe(true);
    expect(isPointerDragSession(session, 8)).toBe(false);
    expect(pointerDragPosition(session, 15, 25)).toEqual({
      startX: 10,
      startY: 20,
      clientX: 15,
      clientY: 25
    });
  });

  it('calculates movement distance and respects the activation threshold', () => {
    const position = { startX: 10, startY: 10, clientX: 13, clientY: 14 };

    expect(pointerDragDistance(position)).toBe(5);
    expect(shouldActivatePointerDrag(position, 5)).toBe(true);
    expect(shouldActivatePointerDrag(position, 6)).toBe(false);
  });

  it('returns immutable active and target-updated drag states', () => {
    const drag = { active: false, targetParentId: null as string | null, id: 'drag' };
    const active = activatePointerDrag(drag);
    const targeted = updatePointerDropTarget(active, 'folder');

    expect(active).toEqual({ active: true, targetParentId: null, id: 'drag' });
    expect(targeted).toEqual({ active: true, targetParentId: 'folder', id: 'drag' });
    expect(drag).toEqual({ active: false, targetParentId: null, id: 'drag' });
  });
});
