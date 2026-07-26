import { copyFileSync, writeFileSync } from 'node:fs';

const generatedWorker = '.svelte-kit/cloudflare/_worker.js';
const appWorker = '.svelte-kit/cloudflare/_sveltekit-worker.js';
copyFileSync(generatedWorker, appWorker);
writeFileSync(
  generatedWorker,
  `import app from './_sveltekit-worker.js';
import { cleanupExpiredTrash } from '../../src/lib/server/trash-cleanup.ts';

export default {
  fetch(request, env, context) {
    return app.fetch(request, env, context);
  },
  scheduled(controller, env, context) {
    return cleanupExpiredTrash(env, context);
  }
};
`
);
