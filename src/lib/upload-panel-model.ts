import {
  completeUpload,
  failUpload,
  retryUpload,
  updateUploadProgress,
  type UploadStateItem
} from './upload-state-model';

export type UploadPanelState<TUpload extends UploadStateItem, TConflict> = {
  uploads: readonly TUpload[];
  showTray: boolean;
  conflicts: readonly TConflict[];
};

export type UploadPanelAction<TUpload extends UploadStateItem, TConflict> =
  | { type: 'enqueue'; upload: TUpload }
  | { type: 'set-tray'; open: boolean }
  | { type: 'complete'; uploadId: string }
  | { type: 'fail'; uploadId: string; cancelled: boolean; error: string }
  | { type: 'progress'; uploadId: string; progress: number; sessionId: string }
  | { type: 'retry'; uploadId: string }
  | { type: 'remove'; uploadId: string }
  | { type: 'append-conflicts'; conflicts: readonly TConflict[] }
  | { type: 'set-conflicts'; conflicts: readonly TConflict[] };

export function initialUploadPanelState<
  TUpload extends UploadStateItem,
  TConflict
>(): UploadPanelState<TUpload, TConflict> {
  return { uploads: [], showTray: true, conflicts: [] };
}

export function uploadPanelReducer<TUpload extends UploadStateItem, TConflict>(
  state: UploadPanelState<TUpload, TConflict>,
  action: UploadPanelAction<TUpload, TConflict>
): UploadPanelState<TUpload, TConflict> {
  switch (action.type) {
    case 'enqueue':
      return { ...state, uploads: [...state.uploads, action.upload], showTray: true };
    case 'set-tray':
      return { ...state, showTray: action.open };
    case 'complete':
      return { ...state, uploads: completeUpload(state.uploads, action.uploadId) };
    case 'fail':
      return {
        ...state,
        uploads: failUpload(state.uploads, action.uploadId, action.cancelled, action.error)
      };
    case 'progress':
      return {
        ...state,
        uploads: updateUploadProgress(
          state.uploads,
          action.uploadId,
          action.progress,
          action.sessionId
        )
      };
    case 'retry':
      return { ...state, uploads: retryUpload(state.uploads, action.uploadId) };
    case 'remove':
      return { ...state, uploads: state.uploads.filter((upload) => upload.id !== action.uploadId) };
    case 'append-conflicts':
      return { ...state, conflicts: [...state.conflicts, ...action.conflicts] };
    case 'set-conflicts':
      return { ...state, conflicts: [...action.conflicts] };
  }
}
