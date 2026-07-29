export function parseGoogleJson<T>(input: { ok: boolean; status: number; body: string }): T {
  if (!input.ok) throw new Error(`Google API ${input.status}: ${input.body.slice(0, 500)}`);
  return input.body ? (JSON.parse(input.body) as T) : ({} as T);
}

export function googleRequestError(status: number, body: string): string {
  return `Google API ${status}: ${body.slice(0, 500)}`;
}
