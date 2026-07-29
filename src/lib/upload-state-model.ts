type UploadStateStatus = 'uploading' | 'complete' | 'error' | 'cancelled';

export type UploadStateItem = {
  id: string;
  progress: number;
  status: UploadStateStatus;
  error?: string;
  sessionId?: string;
};

function updateUploadItem<T extends UploadStateItem>(
  items: readonly T[],
  itemId: string,
  update: (item: T) => T
): T[] {
  return items.map((item) => (item.id === itemId ? update(item) : item));
}

export function completeUpload<T extends UploadStateItem>(
  items: readonly T[],
  itemId: string
): T[] {
  return updateUploadItem(items, itemId, (item) => ({
    ...item,
    progress: 100,
    status: 'complete',
    error: undefined
  }));
}

export function updateUploadProgress<T extends UploadStateItem>(
  items: readonly T[],
  itemId: string,
  progress: number,
  sessionId: string
): T[] {
  return updateUploadItem(items, itemId, (item) => ({ ...item, progress, sessionId }));
}

export function failUpload<T extends UploadStateItem>(
  items: readonly T[],
  itemId: string,
  cancelled: boolean,
  error: string
): T[] {
  return updateUploadItem(items, itemId, (item) => ({
    ...item,
    status: cancelled ? 'cancelled' : 'error',
    error
  }));
}

export function retryUpload<T extends UploadStateItem>(items: readonly T[], itemId: string): T[] {
  return updateUploadItem(items, itemId, (item) => ({
    ...item,
    progress: 0,
    status: 'uploading',
    error: undefined,
    sessionId: undefined
  }));
}
