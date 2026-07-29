import { describe, expect, it, vi } from 'vitest';
import { browserUploadRuntime } from './upload-runtime-client';

describe('upload runtime client', () => {
  it('creates unique runtime ids and abort controllers', () => {
    const first = browserUploadRuntime.createId();
    const second = browserUploadRuntime.createId();

    expect(first).toEqual(expect.any(String));
    expect(second).toEqual(expect.any(String));
    expect(second).not.toBe(first);
    expect(browserUploadRuntime.createController()).toBeInstanceOf(AbortController);
  });

  it('keeps sleep injectable at the upload client boundary', async () => {
    vi.useFakeTimers();
    const pending = browserUploadRuntime.sleep(25);
    vi.advanceTimersByTime(25);
    await expect(pending).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
