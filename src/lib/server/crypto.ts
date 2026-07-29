import { isValidPasswordLength } from '../password-policy';

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded =
    value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(size = 32): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function toBase64Url(value: Uint8Array | ArrayBuffer): string {
  return bytesToBase64Url(value instanceof Uint8Array ? value : new Uint8Array(value));
}

function fromBase64Url(value: string): Uint8Array {
  return base64UrlToBytes(value);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toBase64Url(digest);
}

function encryptionKey(raw: string): Uint8Array {
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Uint8Array.from(raw.match(/.{2}/g) ?? [], (pair) => parseInt(pair, 16));
  }

  const decoded = fromBase64Url(raw);
  if (decoded.byteLength !== 32) throw new Error('APP_ENCRYPTION_KEY must decode to 32 bytes');
  return decoded;
}

async function importEncryptionKey(raw: string): Promise<CryptoKey> {
  const bytes = encryptionKey(raw);
  return crypto.subtle.importKey('raw', bytes.slice().buffer as ArrayBuffer, 'AES-GCM', false, [
    'encrypt',
    'decrypt'
  ]);
}

export async function encrypt(value: string, secret: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await importEncryptionKey(secret);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(value)
  );
  const packed = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), iv.byteLength);
  return toBase64Url(packed);
}

export async function decrypt(value: string, secret: string): Promise<string> {
  const packed = fromBase64Url(value);
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const key = await importEncryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.byteLength ^ rightBytes.byteLength;
  const length = Math.max(leftBytes.byteLength, rightBytes.byteLength);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

const PASSWORD_ITERATIONS = 100_000;

async function passwordKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits'
  ]);
  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.slice().buffer as ArrayBuffer,
      iterations: PASSWORD_ITERATIONS,
      hash: 'SHA-256'
    },
    key,
    256
  );
}

export async function hashPassword(password: string): Promise<string> {
  if (!isValidPasswordLength(password))
    throw new Error('비밀번호는 8자 이상 128자 이하로 입력해주세요.');
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const derived = await passwordKey(password, salt);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationText, saltText, digestText] = encoded.split('$');
  if (algorithm !== 'pbkdf2-sha256' || iterationText !== String(PASSWORD_ITERATIONS)) return false;
  try {
    const digest = toBase64Url(await passwordKey(password, fromBase64Url(saltText)));
    return constantTimeEqual(digest, digestText);
  } catch {
    return false;
  }
}
