import { describe, expect, it } from 'vitest';
import {
  buildRegisteredPasskeyRecord,
  buildPasskeyRegistrationContext,
  parsePasskeyRegistrationContext,
  parsePasskeyTransports,
  toRegisteredPasskeyRecord,
  toPasskeyCredentialOptions,
  toWebAuthnChallengeRecord,
  toWebAuthnCredential
} from './webauthn-model';

describe('webauthn model', () => {
  it('builds immutable challenge and registered passkey records', () => {
    const publicKey = new Uint8Array([1, 2, 3]);
    expect(
      toWebAuthnChallengeRecord({
        id: 'challenge-1',
        userId: 'user-1',
        challenge: 'challenge',
        kind: 'registration',
        expiresAt: 'expires',
        createdAt: 'created'
      })
    ).toEqual({
      id: 'challenge-1',
      user_id: 'user-1',
      challenge: 'challenge',
      kind: 'registration',
      expires_at: 'expires',
      created_at: 'created'
    });
    expect(
      toRegisteredPasskeyRecord({
        id: 'passkey-1',
        userId: 'user-1',
        credentialId: 'credential-1',
        publicKey,
        counter: 4,
        deviceType: 'singleDevice',
        backedUp: true,
        createdAt: 'created'
      })
    ).toEqual({
      id: 'passkey-1',
      user_id: 'user-1',
      credential_id: 'credential-1',
      public_key: publicKey,
      counter: 4,
      transports: '[]',
      device_type: 'singleDevice',
      backed_up: 1,
      created_at: 'created'
    });
    expect(publicKey).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('normalizes optional passkey fields to safe database values', () => {
    expect(
      toRegisteredPasskeyRecord({
        id: 'passkey-1',
        userId: 'user-1',
        credentialId: 'credential-1',
        publicKey: [],
        counter: 0,
        createdAt: 'created'
      })
    ).toMatchObject({ device_type: null, backed_up: 0, transports: '[]' });
  });

  it('injects ID and clock effects when building a registered passkey row', () => {
    expect(
      buildRegisteredPasskeyRecord(
        {
          userId: 'user-1',
          credentialId: 'credential-1',
          publicKey: [1, 2, 3],
          counter: 1
        },
        { now: () => '2026-07-29T00:00:00.000Z', newId: () => 'passkey-1' }
      )
    ).toMatchObject({
      id: 'passkey-1',
      user_id: 'user-1',
      created_at: '2026-07-29T00:00:00.000Z'
    });
  });

  it('parses a valid registration context without retaining extra fields', () => {
    expect(
      parsePasskeyRegistrationContext(
        JSON.stringify({ userId: 'user-1', expiresAt: 2_000, ignored: true }),
        1_000
      )
    ).toEqual({ userId: 'user-1', expiresAt: 2_000 });
  });

  it('builds a deterministic registration context from an injected clock value', () => {
    expect(buildPasskeyRegistrationContext('user-1', 1_000, 300_000)).toBe(
      '{"userId":"user-1","expiresAt":301000}'
    );
  });

  it('rejects malformed, incomplete, non-finite, and expired registration contexts', () => {
    expect(parsePasskeyRegistrationContext('not-json', 1_000)).toBeNull();
    expect(
      parsePasskeyRegistrationContext(JSON.stringify({ userId: '', expiresAt: 2_000 }), 1_000)
    ).toBeNull();
    expect(parsePasskeyRegistrationContext(JSON.stringify({ userId: 'user-1' }), 1_000)).toBeNull();
    expect(
      parsePasskeyRegistrationContext(
        JSON.stringify({ userId: 'user-1', expiresAt: '2000' }),
        1_000
      )
    ).toBeNull();
    expect(
      parsePasskeyRegistrationContext(JSON.stringify({ userId: 'user-1', expiresAt: 999 }), 1_000)
    ).toBeNull();
  });

  it('maps stored passkeys to immutable WebAuthn credential options', () => {
    const stored = [
      { credential_id: 'credential-1', transports: '["usb"]' },
      { credential_id: 'credential-2', transports: 'invalid' }
    ];
    expect(toPasskeyCredentialOptions(stored)).toEqual([
      { id: 'credential-1', transports: ['usb'] },
      { id: 'credential-2', transports: [] }
    ]);
    expect(stored).toEqual([
      { credential_id: 'credential-1', transports: '["usb"]' },
      { credential_id: 'credential-2', transports: 'invalid' }
    ]);
  });
  it('parses stored transport arrays', () => {
    expect(parsePasskeyTransports('["usb","hybrid"]')).toEqual(['usb', 'hybrid']);
    expect(parsePasskeyTransports('[]')).toEqual([]);
  });

  it('builds a verification credential without mutating stored bytes', () => {
    const publicKey = new Uint8Array([1, 2, 3]);
    const credential = toWebAuthnCredential({
      credential_id: 'credential-1',
      public_key: publicKey,
      counter: 4,
      transports: '["usb"]'
    });

    expect(credential).toEqual({
      id: 'credential-1',
      publicKey,
      counter: 4,
      transports: ['usb']
    });
    expect(publicKey).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('returns an empty transport list for damaged or non-array storage', () => {
    expect(parsePasskeyTransports('{"transport":"usb"}')).toEqual([]);
    expect(parsePasskeyTransports('not-json')).toEqual([]);
  });
});
