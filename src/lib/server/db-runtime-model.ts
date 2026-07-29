import { toAuditEventRecord, toSettingRecord, toSettingUpdate } from './db-record-model';

export type PersistenceRuntime = {
  now: () => string;
  newId: () => string;
};

export function buildSettingMutation(
  input: { key: string; value: string },
  runtime: PersistenceRuntime
) {
  const updatedAt = runtime.now();
  return {
    insert: toSettingRecord({ ...input, updatedAt }),
    update: toSettingUpdate({ value: input.value, updatedAt })
  };
}

export function buildAuditEventRecord(
  input: {
    userId: string | null;
    action: string;
    targetId: string | null;
    metadata: Record<string, unknown>;
  },
  runtime: PersistenceRuntime
) {
  return toAuditEventRecord({
    ...input,
    id: runtime.newId(),
    createdAt: runtime.now()
  });
}
