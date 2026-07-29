import { describe, expect, it, vi } from 'vitest';
import { encodeWebAuthnUserId, signalDeletedPasskeyWithDevice } from './passkey-device-client';

describe('passkey device client', () => {
  it('encodes the WebAuthn user id as base64url', () => {
    expect(encodeWebAuthnUserId('사용자-1')).toBe('7IKs7Jqp7J6QLTE');
  });

  it('signals accepted credentials through the injected browser API', async () => {
    const signal = vi.fn().mockResolvedValue(undefined);

    await expect(
      signalDeletedPasskeyWithDevice({
        rpId: 'example.com',
        userId: 'user-1',
        acceptedCredentialIds: ['credential-1'],
        credentialApi: { signalAllAcceptedCredentials: signal }
      })
    ).resolves.toBe(true);
    expect(signal).toHaveBeenCalledWith({
      rpId: 'example.com',
      userId: 'dXNlci0x',
      allAcceptedCredentialIds: ['credential-1']
    });
  });

  it('returns false when the browser API is unavailable or rejects', async () => {
    const signal = vi.fn().mockRejectedValue(new Error('unsupported'));

    await expect(
      signalDeletedPasskeyWithDevice({
        rpId: 'example.com',
        userId: 'user-1',
        acceptedCredentialIds: [],
        credentialApi: {}
      })
    ).resolves.toBe(false);
    await expect(
      signalDeletedPasskeyWithDevice({
        rpId: 'example.com',
        userId: 'user-1',
        acceptedCredentialIds: [],
        credentialApi: { signalAllAcceptedCredentials: signal }
      })
    ).resolves.toBe(false);
  });
});
