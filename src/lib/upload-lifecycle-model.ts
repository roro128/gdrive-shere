export type UploadOutcome =
  | { type: 'completed'; refresh: true }
  | { type: 'failed'; cancelled: boolean; error: string; refresh: false };

export function completedUploadOutcome(): UploadOutcome {
  return { type: 'completed', refresh: true };
}

export function failedUploadOutcome(cause: unknown, cancelled: boolean): UploadOutcome {
  return {
    type: 'failed',
    cancelled,
    error: cause instanceof Error ? cause.message : '업로드 실패',
    refresh: false
  };
}
