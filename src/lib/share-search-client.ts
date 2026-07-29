import { readResponseMessage } from './response-message';
import { filterShareUsers, type ShareSearchMember } from './share-search-model';

type ShareSearchRequest = (input: string, init?: RequestInit) => Promise<Response>;

export async function fetchShareUsers<T extends ShareSearchMember>(input: {
  query: string;
  mock: boolean;
  mockMembers: readonly T[];
  request: ShareSearchRequest;
}): Promise<T[]> {
  if (input.mock) return filterShareUsers(input.mockMembers, input.query);
  const response = await input.request(
    `/api/share-users?q=${encodeURIComponent(input.query.trim())}`
  );
  if (!response.ok)
    throw new Error(await readResponseMessage(response, '사용자 목록을 불러오지 못했습니다.'));
  return ((await response.json()) as { users?: T[] }).users ?? [];
}
