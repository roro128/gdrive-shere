import { describe, expect, it } from 'vitest';
import { fetchShareUsers } from './share-search-client';

describe('share search client', () => {
  const members = [
    { id: '1', displayName: 'Ada Lovelace', handle: 'ada' },
    { id: '2', displayName: 'Grace Hopper', handle: 'grace' }
  ];

  it('uses the pure local filter in mock mode without requesting the network', async () => {
    let requested = false;
    const result = await fetchShareUsers({
      query: 'ada',
      mock: true,
      mockMembers: members,
      request: async () => {
        requested = true;
        return new Response(null, { status: 500 });
      }
    });
    expect(result).toEqual([members[0]]);
    expect(requested).toBe(false);
  });

  it('normalizes remote response and surfaces a useful failed response', async () => {
    const result = await fetchShareUsers({
      query: '  ada ',
      mock: false,
      mockMembers: members,
      request: async (input) => {
        expect(input).toBe('/api/share-users?q=ada');
        return new Response(JSON.stringify({ users: [members[0]] }), { status: 200 });
      }
    });
    expect(result).toEqual([members[0]]);

    await expect(
      fetchShareUsers({
        query: 'ada',
        mock: false,
        mockMembers: members,
        request: async () =>
          new Response(JSON.stringify({ message: 'unavailable' }), { status: 503 })
      })
    ).rejects.toThrow('unavailable');
  });
});
