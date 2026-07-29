export type WebAuthnRuntime = {
  now: () => string;
  newId: () => string;
};

export function buildWebAuthnChallengeRecord(
  input: {
    userId: string | null;
    challenge: string;
    kind: 'registration' | 'authentication';
    ttlMs: number;
  },
  runtime: WebAuthnRuntime
) {
  const createdAt = runtime.now();
  return toWebAuthnChallengeRecord({
    id: runtime.newId(),
    userId: input.userId,
    challenge: input.challenge,
    kind: input.kind,
    expiresAt: new Date(Date.parse(createdAt) + input.ttlMs).toISOString(),
    createdAt
  });
}

export function parsePasskeyTransports(value: string): never[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as never[]) : [];
  } catch {
    return [];
  }
}

export function toWebAuthnChallengeRecord(input: {
  id: string;
  userId: string | null;
  challenge: string;
  kind: 'registration' | 'authentication';
  expiresAt: string;
  createdAt: string;
}) {
  return {
    id: input.id,
    user_id: input.userId,
    challenge: input.challenge,
    kind: input.kind,
    expires_at: input.expiresAt,
    created_at: input.createdAt
  };
}

export function toRegisteredPasskeyRecord(input: {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: ArrayLike<number>;
  counter: number;
  deviceType?: string | null;
  backedUp?: boolean;
  createdAt: string;
}) {
  return {
    id: input.id,
    user_id: input.userId,
    credential_id: input.credentialId,
    public_key: input.publicKey as never,
    counter: input.counter,
    transports: '[]',
    device_type: input.deviceType ?? null,
    backed_up: input.backedUp ? 1 : 0,
    created_at: input.createdAt
  };
}

export function buildRegisteredPasskeyRecord(
  input: Omit<Parameters<typeof toRegisteredPasskeyRecord>[0], 'id' | 'createdAt'>,
  runtime: WebAuthnRuntime
) {
  return toRegisteredPasskeyRecord({
    ...input,
    id: runtime.newId(),
    createdAt: runtime.now()
  });
}

export type PasskeyRegistrationContext = {
  userId: string;
  expiresAt: number;
};

export function buildPasskeyRegistrationContext(
  userId: string,
  nowMs: number,
  ttlMs: number
): string {
  return JSON.stringify({ userId, expiresAt: nowMs + ttlMs });
}

export function parsePasskeyRegistrationContext(
  value: string,
  nowMs: number
): PasskeyRegistrationContext | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const context = parsed as { userId?: unknown; expiresAt?: unknown };
    if (
      typeof context.userId !== 'string' ||
      !context.userId ||
      typeof context.expiresAt !== 'number' ||
      !Number.isFinite(context.expiresAt) ||
      context.expiresAt < nowMs
    ) {
      return null;
    }
    return { userId: context.userId, expiresAt: context.expiresAt };
  } catch {
    return null;
  }
}

export type StoredPasskeyCredential = {
  credential_id: string;
  transports: string;
};

export function toPasskeyCredentialOptions(
  passkeys: readonly StoredPasskeyCredential[]
): Array<{ id: string; transports: never[] }> {
  return passkeys.map((passkey) => ({
    id: passkey.credential_id,
    transports: parsePasskeyTransports(passkey.transports)
  }));
}

export function toWebAuthnCredential(passkey: {
  credential_id: string;
  public_key: ArrayLike<number>;
  counter: number;
  transports: string;
}): {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports: never[];
} {
  return {
    id: passkey.credential_id,
    publicKey: new Uint8Array(passkey.public_key) as Uint8Array<ArrayBuffer>,
    counter: passkey.counter,
    transports: parsePasskeyTransports(passkey.transports)
  };
}
