/**
 * Web Push (RFC 8291 / RFC 8188 aes128gcm) with VAPID, built on WebCrypto only.
 *
 * Runs inside the edge worker: no Node-only crypto, no native modules. The
 * VAPID private key is read from the server environment inside the send call
 * and never leaves the server.
 */

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data as BufferSource));
}

/** HKDF with a single-block expand, which is all Web Push needs. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

export type PushKeys = { endpoint: string; p256dh: string; auth: string };

/** Encrypts the payload for one subscription and returns the request body. */
async function encryptPayload(keys: PushKeys, payload: string): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(keys.p256dh);
  const authSecret = b64urlToBytes(keys.auth);

  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));

  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256),
  );

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const plaintext = concat(enc.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, plaintext as BufferSource),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

async function vapidHeader(audience: string, publicKey: string, privateKey: string, subject: string) {
  const raw = b64urlToBytes(publicKey);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(raw.slice(1, 33)),
    y: bytesToB64url(raw.slice(33, 65)),
    d: privateKey,
    ext: true,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);

  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = bytesToB64url(
    enc.encode(
      JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }),
    ),
  );
  const signingInput = enc.encode(`${header}.${body}`);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, signingInput as BufferSource),
  );
  const jwt = `${header}.${body}.${bytesToB64url(sig)}`;
  return `vapid t=${jwt}, k=${publicKey}`;
}

export type PushResult = { ok: boolean; status: number; gone: boolean; error?: string };

export function pushConfigured(): boolean {
  return Boolean(process.env["VAPID_PUBLIC_KEY"] && process.env["VAPID_PRIVATE_KEY"]);
}

/** Sends one encrypted push. `gone` means the subscription is permanently dead. */
export async function sendWebPush(
  keys: PushKeys,
  payload: Record<string, unknown>,
  ttlSeconds = 3600,
): Promise<PushResult> {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:support@coachside.live";
  if (!publicKey || !privateKey) {
    return { ok: false, status: 0, gone: false, error: "Push keys are not configured" };
  }

  try {
    const url = new URL(keys.endpoint);
    const body = await encryptPayload(keys, JSON.stringify(payload));
    const auth = await vapidHeader(url.origin, publicKey, privateKey, subject);

    const res = await fetch(keys.endpoint, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttlSeconds),
      },
      body: body as BodyInit,
    });

    if (res.ok) return { ok: true, status: res.status, gone: false };
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      gone: res.status === 404 || res.status === 410,
      error: text.slice(0, 300) || `HTTP ${res.status}`,
    };
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: (e as Error).message };
  }
}
