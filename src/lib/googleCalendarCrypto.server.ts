import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Google tokens are encrypted at rest with a server-only key.
 * GOOGLE_TOKEN_ENC_KEY is provisioned as a project secret.
 */
function key(): Buffer {
  const raw = process.env["GOOGLE_TOKEN_ENC_KEY"];
  if (!raw) throw new Error("GOOGLE_TOKEN_ENC_KEY is not set");
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecretValue(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptSecretValue(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Legacy names kept so older imports keep compiling. */
export const encryptConnectionKey = encryptSecretValue;
export const decryptConnectionKey = decryptSecretValue;
