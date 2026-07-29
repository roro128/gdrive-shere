import { readResponseMessage } from './response-message';
import type { AccountDeletionState } from './account-deletion';

type AccountRequest = (input: string, init?: RequestInit) => Promise<Response>;

export async function requestAccountDeletion(input: {
  request: AccountRequest;
  confirmation: string;
  acknowledged: AccountDeletionState;
}): Promise<void> {
  const response = await input.request('/api/me/deletion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      confirmation: input.confirmation,
      acknowledged: { ...input.acknowledged }
    })
  });
  if (!response.ok)
    throw new Error(await readResponseMessage(response, '계정 삭제를 시작하지 못했습니다.'));
}
