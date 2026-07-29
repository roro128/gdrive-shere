import { identiconFromHash } from '../avatar';
import { sha256 } from './crypto';

export type AvatarHash = (value: string) => Promise<string>;

export async function defaultAvatarUrl(seed: string, hash: AvatarHash = sha256): Promise<string> {
  return identiconFromHash(await hash(`gdrive-share/avatar/v1:${seed}`));
}
