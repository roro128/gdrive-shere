export const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const TRASH_CLEANUP_BATCH_SIZE = 100;

export function buildTrashCleanupPlan(
  nowMs: number,
  retentionMs = TRASH_RETENTION_MS,
  batchSize = TRASH_CLEANUP_BATCH_SIZE
) {
  return {
    cutoff: new Date(nowMs - retentionMs).toISOString(),
    batchSize
  };
}
