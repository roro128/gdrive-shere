import { handleAvailabilityFromResponse, type HandleAvailability } from './handle-availability';

type HandleAvailabilityRequest = (input: string, init: RequestInit) => Promise<Response>;

export async function fetchHandleAvailability(input: {
  handle: string;
  mock: boolean;
  signal: AbortSignal;
  request?: HandleAvailabilityRequest;
}): Promise<HandleAvailability> {
  if (input.mock) return 'available';
  const request = input.request ?? fetch;
  const response = await request(`/api/handles/check?handle=${encodeURIComponent(input.handle)}`, {
    signal: input.signal
  });
  const result = (await response.json()) as { available?: boolean; valid?: boolean };
  return handleAvailabilityFromResponse(result, response.ok);
}
