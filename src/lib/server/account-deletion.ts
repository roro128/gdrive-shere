import type { ExecutionContext } from '@cloudflare/workers-types';
import { eq, or } from 'drizzle-orm';
import { database, newId, now } from './db';
import { createDatabase } from './drizzle/client';
import {
  accountDeletionJobs,
  auditEvents,
  authUser,
  driveFiles,
  folderShareInvitations,
  folderShares,
  legacySessions,
  passkeys,
  passwordResetLinks,
  passwordResetRequests,
  uploadSessions,
  userSpaces,
  users,
  webauthnChallenges
} from './drizzle/auth-schema';
import { deleteDriveFile } from './google';
import { deleteDriveFilesSequentially } from './drive-deletion-workflow';
import { createRequestEvent, type RequestEvent } from './runtime';
import {
  accountDeletionErrorMessage,
  buildProcessingAccountDeletionJob,
  buildQueuedAccountDeletionJob,
  buildRetryAccountDeletionJob,
  isMissingDriveFileError
} from './account-deletion-model';

const CLEANUP_BATCH_SIZE = 100;

function systemEvent(env: Env, ctx: ExecutionContext): RequestEvent {
  return createRequestEvent(
    new Request('https://gshare.internal/maintenance/account-deletion'),
    env,
    ctx
  );
}

export async function queueAccountDeletion(event: RequestEvent, userId: string): Promise<string> {
  const queuedJob = buildQueuedAccountDeletionJob(userId, { now, newId });
  await database(event)
    .insert(accountDeletionJobs)
    .values(queuedJob)
    .onConflictDoNothing({ target: accountDeletionJobs.user_id })
    .run();
  const job = await database(event)
    .select({ id: accountDeletionJobs.id })
    .from(accountDeletionJobs)
    .where(eq(accountDeletionJobs.user_id, userId))
    .get();
  return job?.id ?? queuedJob.id;
}

export async function cleanupQueuedAccountDeletions(
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const event = systemEvent(env, ctx);
  const jobs = await database(event)
    .select({ id: accountDeletionJobs.id })
    .from(accountDeletionJobs)
    .limit(CLEANUP_BATCH_SIZE)
    .all();
  for (const job of jobs) await cleanupAccountDeletion(env, ctx, job.id);
}

export async function cleanupAccountDeletion(
  env: Env,
  ctx: ExecutionContext,
  jobId: string
): Promise<void> {
  const event = systemEvent(env, ctx);
  const job = await database(event)
    .select()
    .from(accountDeletionJobs)
    .where(eq(accountDeletionJobs.id, jobId))
    .get();
  if (!job) return;

  const db = database(event);
  await db
    .update(accountDeletionJobs)
    .set(buildProcessingAccountDeletionJob({ now, newId }))
    .where(eq(accountDeletionJobs.id, job.id))
    .run();

  try {
    const ownedFiles = await db
      .select({ id: driveFiles.id, driveFileId: driveFiles.drive_file_id })
      .from(driveFiles)
      .where(eq(driveFiles.owner_user_id, job.user_id))
      .all();
    await deleteDriveFilesSequentially(
      ownedFiles.map((file) => file.driveFileId),
      {
        deleteFile: (driveFileId) => deleteDriveFile(event, driveFileId),
        isMissingFileError: isMissingDriveFileError
      }
    );

    const authId = await db
      .select({ authUserId: users.auth_user_id })
      .from(users)
      .where(eq(users.id, job.user_id))
      .get();

    await db.delete(driveFiles).where(eq(driveFiles.owner_user_id, job.user_id)).run();
    await db
      .delete(uploadSessions)
      .where(
        or(eq(uploadSessions.user_id, job.user_id), eq(uploadSessions.owner_user_id, job.user_id))
      )
      .run();
    await db
      .delete(folderShares)
      .where(or(eq(folderShares.user_id, job.user_id), eq(folderShares.created_by, job.user_id)))
      .run();
    await db
      .delete(folderShareInvitations)
      .where(
        or(
          eq(folderShareInvitations.invited_user_id, job.user_id),
          eq(folderShareInvitations.invited_by, job.user_id)
        )
      )
      .run();
    await db.delete(userSpaces).where(eq(userSpaces.user_id, job.user_id)).run();
    await db.delete(passkeys).where(eq(passkeys.user_id, job.user_id)).run();
    await db.delete(legacySessions).where(eq(legacySessions.user_id, job.user_id)).run();
    await db.delete(webauthnChallenges).where(eq(webauthnChallenges.user_id, job.user_id)).run();
    await db.delete(passwordResetLinks).where(eq(passwordResetLinks.user_id, job.user_id)).run();
    await db
      .delete(passwordResetRequests)
      .where(eq(passwordResetRequests.user_id, job.user_id))
      .run();
    await db.delete(auditEvents).where(eq(auditEvents.user_id, job.user_id)).run();
    await db.delete(users).where(eq(users.id, job.user_id)).run();
    if (authId?.authUserId) {
      await createDatabase(event).delete(authUser).where(eq(authUser.id, authId.authUserId)).run();
    }
    await db.delete(accountDeletionJobs).where(eq(accountDeletionJobs.id, job.id)).run();
  } catch (cause) {
    await db
      .update(accountDeletionJobs)
      .set(buildRetryAccountDeletionJob(accountDeletionErrorMessage(cause), { now, newId }))
      .where(eq(accountDeletionJobs.id, job.id))
      .run();
  }
}
