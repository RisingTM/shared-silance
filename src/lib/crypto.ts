const enc = new TextEncoder();
const dec = new TextDecoder();

const ITERATIONS = 210_000;
const KEY_VERSION = "v1";

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromB64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export async function deriveAesKey(password: string, salt: Uint8Array, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(plainText: string, password: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveAesKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plainText));
  return {
    ciphertext: toB64(new Uint8Array(cipher)),
    iv: toB64(iv),
    salt: toB64(salt),
    iterations: ITERATIONS,
    keyVersion: KEY_VERSION,
  };
}

export async function decryptText(
  ciphertext: string,
  password: string,
  ivB64: string,
  saltB64: string,
  iterations = ITERATIONS,
) {
  const key = await deriveAesKey(password, fromB64(saltB64), iterations);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(ivB64) as BufferSource },
    key,
    fromB64(ciphertext) as BufferSource,
  );
  return dec.decode(plain);
}

