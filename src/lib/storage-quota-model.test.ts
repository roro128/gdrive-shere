import { describe, expect, it } from 'vitest';
import { initialStorageQuotaState, storageQuotaReducer } from './storage-quota-model';

describe('storageQuotaReducer', () => {
  it('copies available quota data and clears unavailable responses', () => {
    const initial = initialStorageQuotaState();
    const quota = { usage: 25, limit: 100, available: true };
    const loaded = storageQuotaReducer(initial, { type: 'set-quota', quota });
    const cleared = storageQuotaReducer(loaded, { type: 'clear-quota' });

    expect(loaded.quota).toEqual(quota);
    expect(loaded.quota).not.toBe(quota);
    expect(cleared.quota).toBeNull();
    expect(initial.quota).toBeNull();
  });

  it('represents an unavailable quota as null', () => {
    expect(
      storageQuotaReducer(initialStorageQuotaState(), { type: 'set-quota', quota: null })
    ).toEqual({
      quota: null
    });
  });
});
