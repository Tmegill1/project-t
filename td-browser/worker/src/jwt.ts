/**
 * Minimal HS256 JWT implementation on WebCrypto.
 *
 * Replaces the old `token_<base64 payload>_<base64 secret>` scheme, which
 * embedded the JWT_SECRET (reversibly) in every issued token and was never
 * signature-checked on validation. Tokens issued by that scheme are
 * rejected by verifyToken, so all clients re-authenticate once after deploy.
 *
 * No external deps: the Workers runtime and Node >= 18 both provide
 * crypto.subtle. Signature comparison goes through crypto.subtle.verify,
 * which is constant-time.
 */

export interface TokenPayload {
  userId: string;
  iat: number;
  exp: number;
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const encoder = new TextEncoder();

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stringToBase64url(s: string): string {
  return bytesToBase64url(encoder.encode(s));
}

function base64urlToString(s: string): string {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

function base64urlToBytes(s: string): Uint8Array {
  const binary = base64urlToString(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

export async function signToken(
  userId: string,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: TokenPayload = { userId, iat: now, exp: now + ttlSeconds };

  const signingInput =
    stringToBase64url(JSON.stringify(header)) +
    '.' +
    stringToBase64url(JSON.stringify(payload));

  const key = await hmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return signingInput + '.' + bytesToBase64url(new Uint8Array(signature));
}

/**
 * Returns the payload if the token is authentic and unexpired, null for
 * ANY invalid input (malformed, tampered, wrong secret, expired, legacy
 * format). Never throws.
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<TokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(base64urlToString(headerB64));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const key = await hmacKey(secret, 'verify');
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlToBytes(signatureB64),
      encoder.encode(headerB64 + '.' + payloadB64)
    );
    if (!valid) return null;

    const payload = JSON.parse(base64urlToString(payloadB64)) as TokenPayload;
    if (typeof payload.userId !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
