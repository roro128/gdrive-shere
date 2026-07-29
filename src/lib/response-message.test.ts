import { describe, expect, it } from 'vitest';
import { readResponseMessage } from './response-message';

describe('response message parsing', () => {
  it('extracts a user-facing message from JSON API errors', async () => {
    await expect(
      readResponseMessage(
        new Response(JSON.stringify({ message: '대상 폴더를 찾을 수 없습니다.' }), { status: 404 })
      )
    ).resolves.toBe('대상 폴더를 찾을 수 없습니다.');
  });

  it('keeps plain text and uses a fallback for an empty response', async () => {
    await expect(readResponseMessage(new Response('잠시 후 다시 시도해주세요.'))).resolves.toBe(
      '잠시 후 다시 시도해주세요.'
    );
    await expect(readResponseMessage(new Response(''), '업로드 실패')).resolves.toBe('업로드 실패');
  });
});
