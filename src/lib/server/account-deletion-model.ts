export type AccountDeletionRuntime = {
  now: () => string;
  newId: () => string;
};

export function buildQueuedAccountDeletionJob(userId: string, runtime: AccountDeletionRuntime) {
  return toQueuedAccountDeletionJob({
    id: runtime.newId(),
    userId,
    createdAt: runtime.now()
  });
}

export function toQueuedAccountDeletionJob(input: {
  id: string;
  userId: string;
  createdAt: string;
}) {
  return {
    id: input.id,
    user_id: input.userId,
    status: 'queued' as const,
    created_at: input.createdAt,
    updated_at: input.createdAt
  };
}

export function toProcessingAccountDeletionJob(updatedAt: string) {
  return { status: 'processing' as const, updated_at: updatedAt, last_error: null };
}

export function buildProcessingAccountDeletionJob(runtime: AccountDeletionRuntime) {
  return toProcessingAccountDeletionJob(runtime.now());
}

export function toRetryAccountDeletionJob(updatedAt: string, lastError: string) {
  return { status: 'queued' as const, last_error: lastError, updated_at: updatedAt };
}

export function buildRetryAccountDeletionJob(lastError: string, runtime: AccountDeletionRuntime) {
  return toRetryAccountDeletionJob(runtime.now(), lastError);
}

export function toDisabledUserUpdate(updatedAt: string) {
  return { status: 'disabled' as const, updated_at: updatedAt };
}

export function isMissingDriveFileError(cause: unknown): boolean {
  return cause instanceof Error && cause.message.startsWith('Google API 404:');
}

export function accountDeletionErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message.slice(0, 500) : 'cleanup failed';
}
