type AcceptedCredentialSignal = {
  rpId: string;
  userId: string;
  allAcceptedCredentialIds: string[];
};

export type PasskeyCredentialApi = {
  signalAllAcceptedCredentials?: (options: AcceptedCredentialSignal) => Promise<void>;
};

export function encodeWebAuthnUserId(userId: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(userId)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

export async function signalDeletedPasskeyWithDevice(input: {
  rpId: string;
  userId: string;
  acceptedCredentialIds: string[];
  credentialApi?: PasskeyCredentialApi;
}): Promise<boolean> {
  const credentialApi =
    input.credentialApi ??
    ((globalThis as typeof globalThis & { PublicKeyCredential?: PasskeyCredentialApi })
      .PublicKeyCredential as PasskeyCredentialApi | undefined);
  if (!credentialApi?.signalAllAcceptedCredentials) return false;
  try {
    await credentialApi.signalAllAcceptedCredentials({
      rpId: input.rpId,
      userId: encodeWebAuthnUserId(input.userId),
      allAcceptedCredentialIds: input.acceptedCredentialIds
    });
    return true;
  } catch {
    return false;
  }
}
