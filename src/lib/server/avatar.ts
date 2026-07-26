import { identiconFromHash } from '$lib/avatar';
import { sha256 } from './crypto';

export async function defaultAvatarUrl(seed: string): Promise<string> {
  return identiconFromHash(await sha256(`gdrive-share/avatar/v1:${seed}`));
}
