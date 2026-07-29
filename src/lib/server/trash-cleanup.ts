import { createRequestEvent, type RequestEvent } from '$lib/server/runtime';
import type { ExecutionContext } from '@cloudflare/workers-types';
import { and, eq, lt } from 'drizzle-orm';
import { deleteDriveFile } from './google';
import { database, now } from './db';
import { driveFiles } from './drizzle/auth-schema';
import { buildTrashCleanupPlan } from './trash-cleanup-model';
import { processTrashCleanup } from './trash-cleanup-workflow';

function systemEvent(env: Env, ctx: ExecutionContext): RequestEvent {
  return createRequestEvent(new Request('https://gshare.internal/maintenance/trash'), env, ctx);
}

export async function cleanupExpiredTrash(env: Env, ctx: ExecutionContext): Promise<void> {
  const event = systemEvent(env, ctx);
  const plan = buildTrashCleanupPlan(Date.now());
  const expired = await database(event)
    .select({ id: driveFiles.id, driveFileId: driveFiles.drive_file_id })
    .from(driveFiles)
    .where(and(eq(driveFiles.trashed, 1), lt(driveFiles.updated_at, plan.cutoff)))
    .limit(plan.batchSize)
    .all();

  const results = await processTrashCleanup(expired, {
    deleteDriveFile: (driveFileId) => deleteDriveFile(event, driveFileId),
    deleteDatabaseRow: (id) =>
      database(event)
        .delete(driveFiles)
        .where(eq(driveFiles.id, id))
        .run()
        .then(() => undefined)
  });
  results
    .filter((result) => result.status === 'retry')
    .forEach((result) => {
      console.error('Trash cleanup failed', {
        driveFileId: result.target.driveFileId,
        at: now(),
        cause: result.error
      });
    });
}
