import { createRequestHandler } from '@react-router/cloudflare';
import { RouterContextProvider } from 'react-router';
import { cleanupExpiredTrash } from '../src/lib/server/trash-cleanup';
import { cleanupQueuedAccountDeletions } from '../src/lib/server/account-deletion';
import { cloudflareContext } from '../src/lib/server/cloudflare-context';

const requestHandler = createRequestHandler({
  build: () => import('virtual:react-router/server-build'),
  mode: import.meta.env.MODE,
  getLoadContext({ context }) {
    const provider = new RouterContextProvider();
    provider.set(cloudflareContext, {
      env: context.cloudflare.env,
      ctx: (
        context.cloudflare as typeof context.cloudflare & { executionContext: ExecutionContext }
      ).executionContext
    });
    return provider;
  }
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return requestHandler({
      request: request as never,
      env,
      executionContext: ctx,
      waitUntil: ctx.waitUntil.bind(ctx),
      passThroughOnException: ctx.passThroughOnException.bind(ctx)
    } as never);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    await cleanupExpiredTrash(env, ctx);
    await cleanupQueuedAccountDeletions(env, ctx);
  }
};
