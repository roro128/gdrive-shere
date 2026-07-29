export async function readResponseMessage(
  response: Response,
  fallback = '요청을 처리하지 못했습니다.'
): Promise<string> {
  const text = (await response.text()).trim();
  if (!text) return fallback;
  try {
    const payload = JSON.parse(text) as { message?: unknown };
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
  } catch {
    // Plain-text API errors are already user-facing.
  }
  return text;
}
