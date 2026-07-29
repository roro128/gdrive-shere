import { describe, expect, it } from 'vitest';
import {
  acceptsAccountDeletion,
  toAccountDeletionRequest,
  updateAccountDeletionAcknowledgement
} from './account-deletion';

describe('account deletion confirmation', () => {
  it('accepts deletion only after every destructive scope is acknowledged', () => {
    expect(acceptsAccountDeletion('계정 삭제', { files: true, shares: true, passkeys: true })).toBe(
      true
    );
  });

  it('rejects a mistyped confirmation or an unchecked cleanup scope', () => {
    expect(acceptsAccountDeletion('삭제', { files: true, shares: true, passkeys: true })).toBe(
      false
    );
    expect(
      acceptsAccountDeletion('계정 삭제', { files: true, shares: false, passkeys: true })
    ).toBe(false);
  });

  it('updates one acknowledgement immutably', () => {
    const current = { files: false, shares: false, passkeys: false };
    expect(updateAccountDeletionAcknowledgement(current, 'shares', true)).toEqual({
      files: false,
      shares: true,
      passkeys: false
    });
    expect(current).toEqual({ files: false, shares: false, passkeys: false });
  });

  it('builds an account deletion request without sharing acknowledgement state', () => {
    const acknowledged = { files: true, shares: false, passkeys: true };
    const request = toAccountDeletionRequest({ confirmation: '계정 삭제', acknowledged });
    expect(request).toEqual({ confirmation: '계정 삭제', acknowledged });
    expect(request.acknowledged).not.toBe(acknowledged);
  });
});
