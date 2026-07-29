export type PointerDragPosition = {
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
};

export type PointerDragSession<T> = {
  pointerId: number;
  payload: T;
  source: HTMLElement | null;
  startX: number;
  startY: number;
  active: boolean;
  targetParentId: string | null;
};

export function createPointerDragSession<T>(input: {
  pointerId: number;
  payload: T;
  source: HTMLElement | null;
  startX: number;
  startY: number;
}): PointerDragSession<T> {
  return { ...input, active: false, targetParentId: null };
}

export function isPointerDragSession<T>(
  session: PointerDragSession<T> | null,
  pointerId: number
): session is PointerDragSession<T> {
  return session?.pointerId === pointerId;
}

export function pointerDragPosition<T>(
  session: PointerDragSession<T>,
  clientX: number,
  clientY: number
): PointerDragPosition {
  return {
    startX: session.startX,
    startY: session.startY,
    clientX,
    clientY
  };
}

export function pointerDragDistance(position: PointerDragPosition): number {
  return Math.hypot(position.clientX - position.startX, position.clientY - position.startY);
}

export function shouldActivatePointerDrag(
  position: PointerDragPosition,
  threshold: number
): boolean {
  return pointerDragDistance(position) >= threshold;
}

export function activatePointerDrag<T extends { active: boolean }>(drag: T): T {
  return drag.active ? drag : { ...drag, active: true };
}

export function updatePointerDropTarget<T extends { targetParentId: string | null }>(
  drag: T,
  targetParentId: string | null
): T {
  return { ...drag, targetParentId };
}
