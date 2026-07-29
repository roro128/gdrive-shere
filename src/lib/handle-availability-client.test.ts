import { describe, expect, it } from 'vitest';
import { fetchHandleAvailability } from './handle-availability-client';

describe('handle availability client', () => {
  it('uses the deterministic mock result without a request', async () => {
    let requested = false;
    await expect(
      fetchHandleAvailability({
        handle: 'member',
        mock: true,
        signal: new AbortController().signal,
        request: async () => {
          requested = true;
          return new Response(null, { status: 500 });
        }
      })
    ).resolves.toBe('available');
    expect(requested).toBe(false);
  });

  it('maps remote response validity and preserves abortable request options', async () => {
    const controller = new AbortController();
    await expect(
      fetchHandleAvailability({
        handle: 'member.name',
        mock: false,
        signal: controller.signal,
        request: async (input, init) => {
          expect(input).toBe('/api/handles/check?handle=member.name');
          expect(init.signal).toBe(controller.signal);
          return new Response(JSON.stringify({ valid: true, available: false }), { status: 200 });
        }
      })
    ).resolves.toBe('taken');
  });

  it('rejects transport failures for the caller to classify', async () => {
    await expect(
      fetchHandleAvailability({
        handle: 'member',
        mock: false,
        signal: new AbortController().signal,
        request: async () => {
          throw new Error('network down');
        }
      })
    ).rejects.toThrow('network down');
  });
});
