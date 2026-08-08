import { describe, test, expect } from 'vitest';
import { signToken, verifyToken } from './jwt';

const SECRET = 'test-secret-do-not-use-in-prod';

describe('signToken / verifyToken', () => {
  test('verifies a token it signed and returns the userId', async () => {
    const token = await signToken('user_123', SECRET);
    const payload = await verifyToken(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe('user_123');
  });

  test('sets an expiry in the future', async () => {
    const token = await signToken('user_123', SECRET);
    const payload = await verifyToken(token, SECRET);
    expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('rejects a token whose payload was tampered with', async () => {
    const token = await signToken('user_123', SECRET);
    const [header, payload, sig] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    decoded.userId = 'user_456';
    const forged = [
      header,
      Buffer.from(JSON.stringify(decoded)).toString('base64url'),
      sig,
    ].join('.');
    expect(await verifyToken(forged, SECRET)).toBeNull();
  });

  test('rejects a token signed with a different secret', async () => {
    const token = await signToken('user_123', 'some-other-secret');
    expect(await verifyToken(token, SECRET)).toBeNull();
  });

  test('rejects an expired token', async () => {
    const token = await signToken('user_123', SECRET, -10);
    expect(await verifyToken(token, SECRET)).toBeNull();
  });

  test('rejects legacy token_ format tokens', async () => {
    const payload = btoa(JSON.stringify({ userId: 'user_123', timestamp: Date.now() }));
    const legacy = `token_${payload}_${btoa(SECRET)}`;
    expect(await verifyToken(legacy, SECRET)).toBeNull();
  });

  test('rejects garbage input without throwing', async () => {
    expect(await verifyToken('', SECRET)).toBeNull();
    expect(await verifyToken('a.b', SECRET)).toBeNull();
    expect(await verifyToken('not.a.token', SECRET)).toBeNull();
  });

  test('does not embed the secret in the token', async () => {
    const token = await signToken('user_123', SECRET);
    expect(token).not.toContain(SECRET);
    expect(token).not.toContain(btoa(SECRET));
    expect(token).not.toContain(Buffer.from(SECRET).toString('base64url'));
  });
});
