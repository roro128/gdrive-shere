export type HandleAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function nextHandleCheckSequence(current: number): number {
  return current + 1;
}

export function isCurrentHandleCheck(sequence: number, current: number): boolean {
  return sequence === current;
}

export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export function isValidHandle(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

export function handleAvailabilityFromResponse(
  response: { valid?: boolean; available?: boolean },
  ok = true
): HandleAvailability {
  if (!ok) return 'invalid';
  if (response.valid !== true) return 'invalid';
  return response.available === true ? 'available' : 'taken';
}
