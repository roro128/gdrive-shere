import { describe, expect, it } from 'vitest';
import { buildAuditEventRecord, buildSettingMutation } from './db-runtime-model';

describe('db runtime model', () => {
  const runtime = {
    now: () => '2026-07-29T00:00:00.000Z',
    newId: () => 'audit-1'
  };

  it('builds deterministic setting insert/update payloads from injected time', () => {
    expect(buildSettingMutation({ key: 'mode', value: 'connected' }, runtime)).toEqual({
      insert: { key: 'mode', value: 'connected', updated_at: '2026-07-29T00:00:00.000Z' },
      update: { value: 'connected', updated_at: '2026-07-29T00:00:00.000Z' }
    });
  });

  it('builds deterministic audit records from injected id and time', () => {
    expect(
      buildAuditEventRecord(
        {
          userId: 'user-1',
          action: 'file.deleted',
          targetId: 'file-1',
          metadata: { source: 'test' }
        },
        runtime
      )
    ).toEqual({
      id: 'audit-1',
      user_id: 'user-1',
      action: 'file.deleted',
      target_id: 'file-1',
      metadata: '{"source":"test"}',
      created_at: '2026-07-29T00:00:00.000Z'
    });
  });
});
