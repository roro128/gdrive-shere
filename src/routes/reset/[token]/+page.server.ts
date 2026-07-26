import type { PageServerLoad } from './$types';
import { getPasswordResetContext } from '$lib/server/password-reset';

export const load: PageServerLoad = async (event) => {
  event.setHeaders({ 'cache-control': 'no-store' });
  const context = await getPasswordResetContext(event, event.params.token);
  return { reset: context };
};
