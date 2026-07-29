export type DragInteractionState = {
  nativeDragFileId: string | null;
  moveDropTarget: string | null;
  externalDragActive: boolean;
};

export const initialDragInteraction: DragInteractionState = {
  nativeDragFileId: null,
  moveDropTarget: null,
  externalDragActive: false
};

export type DragInteractionAction =
  | { type: 'begin-native'; sourceId: string }
  | { type: 'enter-internal'; sourceId: string; targetParentId: string }
  | { type: 'enter-external'; targetParentId: string | null }
  | { type: 'update-target'; targetParentId: string | null }
  | { type: 'leave-target'; targetParentId: string | null }
  | { type: 'clear' };

export function dragInteractionReducer(
  state: DragInteractionState,
  action: DragInteractionAction
): DragInteractionState {
  switch (action.type) {
    case 'begin-native':
      return beginNativeDrag(action.sourceId);
    case 'enter-internal':
      return enterInternalDrag(state, action.sourceId, action.targetParentId);
    case 'enter-external':
      return enterExternalDrag(action.targetParentId);
    case 'update-target':
      return updateDragTarget(state, action.targetParentId);
    case 'leave-target':
      return leaveDragTarget(state, action.targetParentId);
    case 'clear':
      return clearDragInteraction();
  }
}

export function beginNativeDrag(sourceId: string): DragInteractionState {
  return {
    nativeDragFileId: sourceId,
    moveDropTarget: null,
    externalDragActive: false
  };
}

export function enterInternalDrag(
  state: DragInteractionState,
  sourceId: string,
  targetParentId: string
): DragInteractionState {
  return {
    nativeDragFileId: state.nativeDragFileId ?? sourceId,
    moveDropTarget: targetParentId,
    externalDragActive: false
  };
}

export function enterExternalDrag(targetParentId: string | null): DragInteractionState {
  return {
    nativeDragFileId: null,
    moveDropTarget: targetParentId,
    externalDragActive: true
  };
}

export function updateDragTarget(
  state: DragInteractionState,
  targetParentId: string | null
): DragInteractionState {
  return { ...state, moveDropTarget: targetParentId };
}

export function leaveDragTarget(
  state: DragInteractionState,
  targetParentId: string | null
): DragInteractionState {
  return state.moveDropTarget === targetParentId
    ? { ...state, moveDropTarget: null, externalDragActive: false }
    : state;
}

export function clearDragInteraction(): DragInteractionState {
  return initialDragInteraction;
}
