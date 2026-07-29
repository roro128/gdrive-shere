import type { RequestEvent } from '$lib/server/runtime';
import { eq } from 'drizzle-orm';
import { createDatabase } from './drizzle/client';
import {
  auditEvents,
  settings,
  type users,
  type passkeys,
  type driveFiles,
  type uploadSessions
} from './drizzle/auth-schema';
import { buildAuditEventRecord, buildSettingMutation } from './db-runtime-model';

export type UserRole = 'admin' | 'member';
export type UserStatus = 'pending' | 'active' | 'disabled';

export type UserRow = typeof users.$inferSelect;
export type PasskeyRow = typeof passkeys.$inferSelect;
export type DriveFileRow = typeof driveFiles.$inferSelect;
export type UploadSessionRow = typeof uploadSessions.$inferSelect;

export function database(event: RequestEvent) {
  return createDatabase(event);
}

export function now(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

export async function getSetting(event: RequestEvent, key: string): Promise<string | null> {
  const row = await database(event)
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  return row?.value ?? null;
}

export async function setSetting(event: RequestEvent, key: string, value: string): Promise<void> {
  const mutation = buildSettingMutation({ key, value }, { now, newId });
  await database(event)
    .insert(settings)
    .values(mutation.insert)
    .onConflictDoUpdate({
      target: settings.key,
      set: mutation.update
    })
    .run();
}

export async function recordAudit(
  event: RequestEvent,
  userId: string | null,
  action: string,
  targetId: string | null = null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await database(event)
    .insert(auditEvents)
    .values(buildAuditEventRecord({ userId, action, targetId, metadata }, { now, newId }))
    .run();
}
