import { describe, expect, it } from 'vitest';
import {
  invalidateWorkspaceCache,
  isCurrentRefreshGeneration,
  nextRefreshGeneration,
  readWorkspaceCache,
  writeWorkspaceCache
} from './workspace-refresh-model';

describe('workspace refresh model', () => {
  it('reads and writes cache immutably', () => {
    const original = new Map<string, readonly { id: string }[]>([['root', [{ id: 'old' }]]]);
    const updated = writeWorkspaceCache(original, 'root', [{ id: 'new' }]);

    expect(readWorkspaceCache(original, 'root')).toEqual([{ id: 'old' }]);
    expect(readWorkspaceCache(updated, 'root')).toEqual([{ id: 'new' }]);
    expect(updated).not.toBe(original);
    expect(readWorkspaceCache(updated, 'missing')).toBeUndefined();
  });

  it('invalidates all entries without mutating the source cache', () => {
    const original = new Map([['root', [{ id: 'file-1' }]]]);
    const empty = invalidateWorkspaceCache();

    expect(empty.size).toBe(0);
    expect(original.size).toBe(1);
  });

  it('accepts only the latest refresh generation', () => {
    const first = nextRefreshGeneration(0);
    const second = nextRefreshGeneration(first);

    expect(isCurrentRefreshGeneration(first, first)).toBe(true);
    expect(isCurrentRefreshGeneration(first, second)).toBe(false);
    expect(isCurrentRefreshGeneration(second, second)).toBe(true);
  });
});
