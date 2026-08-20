import { createRequestEvent } from './runtime';
import { getGoogleConnectionStatus } from './google';

export async function checkGoogleConnection(env: Env, ctx: ExecutionContext) {
  const event = createRequestEvent(
    new Request('https://gshare.internal/maintenance/google-connection'),
    env,
    ctx
  );
  return getGoogleConnectionStatus(event);
}
