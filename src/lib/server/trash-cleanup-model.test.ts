import { describe, expect, it } from 'vitest';
import {
  buildTrashCleanupPlan,
  TRASH_CLEANUP_BATCH_SIZE,
  TRASH_RETENTION_MS
} from './trash-cleanup-model';

describe('trash cleanup model', () => {
  it('builds a deterministic retention cutoff and batch policy', () => {
    const plan = buildTrashCleanupPlan(Date.parse('2026-07-29T00:00:00.000Z'));

    expect(plan).toEqual({
      cutoff: '2026-07-22T00:00:00.000Z',
      batchSize: TRASH_CLEANUP_BATCH_SIZE
    });
  });

  it('accepts explicit retention and batch policies without mutating them', () => {
    expect(buildTrashCleanupPlan(10_000, 2_000, 7)).toEqual({
      cutoff: '1970-01-01T00:00:08.000Z',
      batchSize: 7
    });
    expect(TRASH_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
