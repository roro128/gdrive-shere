import type { RequestEvent } from '@sveltejs/kit';
import type { ExecutionContext } from '@cloudflare/workers-types';
import { and, eq, lt } from 'drizzle-orm';
import { deleteDriveFile } from './google';
import { database, now } from './db';
import { driveFiles } from './drizzle/auth-schema';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;

function systemEvent(env: Env, ctx: ExecutionContext): RequestEvent {
  return {
    platform: { env, context: ctx, caches },
    request: new Request('https://gshare.internal/maintenance/trash'),
    url: new URL('https://gshare.internal/maintenance/trash')
  } as unknown as RequestEvent;
}

export async function cleanupExpiredTrash(env: Env, ctx: ExecutionContext): Promise<void> {
  const event = systemEvent(env, ctx);
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  const expired = await database(event)
    .select({ id: driveFiles.id, driveFileId: driveFiles.drive_file_id })
    .from(driveFiles)
    .where(and(eq(driveFiles.trashed, 1), lt(driveFiles.updated_at, cutoff)))
    .limit(CLEANUP_BATCH_SIZE)
    .all();

  for (const file of expired) {
    try {
      await deleteDriveFile(event, file.driveFileId);
      await database(event).delete(driveFiles).where(eq(driveFiles.id, file.id)).run();
    } catch (cause) {
      // Keep the D1 row so the next scheduled run can retry a transient Drive failure.
      console.error('Trash cleanup failed', {
        driveFileId: file.driveFileId,
        at: now(),
        cause: cause instanceof Error ? cause.message : String(cause)
      });
    }
  }
}
