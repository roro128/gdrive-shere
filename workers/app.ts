import { createRequestHandler } from '@react-router/cloudflare';
import { RouterContextProvider } from 'react-router';
import { cleanupExpiredTrash } from '../src/lib/server/trash-cleanup';
import { cleanupQueuedAccountDeletions } from '../src/lib/server/account-deletion';
import { cloudflareContext } from '../src/lib/server/cloudflare-context';
import { checkGoogleConnection } from '../src/lib/server/google-maintenance';
import { applySecurityHeaders } from '../src/lib/server/security-headers';

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
    const response = await requestHandler({
      request: request as never,
      env,
      executionContext: ctx,
      waitUntil: ctx.waitUntil.bind(ctx),
      passThroughOnException: ctx.passThroughOnException.bind(ctx)
    } as never);
    return applySecurityHeaders(response, request);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    await cleanupExpiredTrash(env, ctx);
    await cleanupQueuedAccountDeletions(env, ctx);
    try {
      const status = await checkGoogleConnection(env, ctx);
      if (status === 'reauthorization-required') {
        console.warn('Google Drive requires administrator reauthorization');
      }
    } catch {
      console.warn('Google Drive connection check failed');
    }
  }
};
