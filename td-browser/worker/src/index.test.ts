import { describe, test, expect, beforeEach } from 'vitest';
import worker, { Env } from './index';
import { signToken, verifyToken } from './jwt';
import { createFakeDb, FakeDb } from './test/fakeD1';

const SECRET = 'test-secret';

let db: FakeDb;
let env: Env;

beforeEach(() => {
  db = createFakeDb();
  env = { DB: db as unknown as D1Database, JWT_SECRET: SECRET };
});

function post(path: string, body: unknown, token?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function registerAlice(): Promise<{ token: string; userId: string }> {
  const res = await worker.fetch(
    post('/api/auth/register', { username: 'alice', password: 'hunter2secure' }),
    env
  );
  const json = (await res.json()) as { success: boolean; token: string; user: { id: string } };
  expect(json.success).toBe(true);
  return { token: json.token, userId: json.user.id };
}

describe('auth token issuance', () => {
  test('register issues an HMAC-signed token', async () => {
    const { token, userId } = await registerAlice();
    const payload = await verifyToken(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(userId);
  });

  test('login issues an HMAC-signed token', async () => {
    const { userId } = await registerAlice();
    const res = await worker.fetch(
      post('/api/auth/login', { username: 'alice', password: 'hunter2secure' }),
      env
    );
    const json = (await res.json()) as { success: boolean; token: string };
    expect(json.success).toBe(true);
    const payload = await verifyToken(json.token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(userId);
  });

  test('login with wrong password is rejected', async () => {
    await registerAlice();
    const res = await worker.fetch(
      post('/api/auth/login', { username: 'alice', password: 'wrong-password' }),
      env
    );
    expect(res.status).toBe(401);
  });
});

describe('token validation', () => {
  test('accepts a token issued at registration', async () => {
    const { token } = await registerAlice();
    const res = await worker.fetch(post('/api/auth/validate', {}, token), env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; user: { username: string } };
    expect(json.success).toBe(true);
    expect(json.user.username).toBe('alice');
  });

  test('rejects a forged unsigned token naming a real user', async () => {
    const { userId } = await registerAlice();
    // The pre-fix format: no signature, userId chosen by the attacker.
    const forged = `token_${btoa(JSON.stringify({ userId, timestamp: Date.now() }))}_anything`;
    const res = await worker.fetch(post('/api/auth/validate', {}, forged), env);
    expect(res.status).toBe(401);
  });

  test('rejects a token signed with the wrong secret', async () => {
    const { userId } = await registerAlice();
    const forged = await signToken(userId, 'attacker-guess');
    const res = await worker.fetch(post('/api/auth/validate', {}, forged), env);
    expect(res.status).toBe(401);
  });

  test('rejects an expired token for a real user', async () => {
    const { userId } = await registerAlice();
    const expired = await signToken(userId, SECRET, -10);
    const res = await worker.fetch(post('/api/auth/validate', {}, expired), env);
    expect(res.status).toBe(401);
  });

  test('rejects a valid-format token for a deleted user', async () => {
    const token = await signToken('user_never_existed', SECRET);
    const res = await worker.fetch(post('/api/auth/validate', {}, token), env);
    expect(res.status).toBe(401);
  });
});

function get(path: string): Request {
  return new Request(`http://localhost${path}`, { method: 'GET' });
}

const VALID_SCORE = { score: 1500, waveReached: 8, enemiesKilled: 42, towersPlaced: 6 };

describe('POST /api/scores', () => {
  test('records a score for an authenticated user', async () => {
    const { token, userId } = await registerAlice();
    const res = await worker.fetch(post('/api/scores', VALID_SCORE, token), env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
    expect(db.sessions).toHaveLength(1);
    expect(db.sessions[0].user_id).toBe(userId);
    expect(db.sessions[0].score).toBe(1500);
    expect(db.sessions[0].wave_reached).toBe(8);
  });

  test('rejects submission without a token', async () => {
    await registerAlice();
    const res = await worker.fetch(post('/api/scores', VALID_SCORE), env);
    expect(res.status).toBe(401);
    expect(db.sessions).toHaveLength(0);
  });

  test('rejects submission with a forged token', async () => {
    const { userId } = await registerAlice();
    const forged = await signToken(userId, 'attacker-guess');
    const res = await worker.fetch(post('/api/scores', VALID_SCORE, forged), env);
    expect(res.status).toBe(401);
    expect(db.sessions).toHaveLength(0);
  });

  test('rejects a non-integer score', async () => {
    const { token } = await registerAlice();
    const res = await worker.fetch(
      post('/api/scores', { ...VALID_SCORE, score: 12.5 }, token),
      env
    );
    expect(res.status).toBe(400);
    expect(db.sessions).toHaveLength(0);
  });

  test('rejects negative and absurdly large values', async () => {
    const { token } = await registerAlice();
    for (const bad of [
      { ...VALID_SCORE, score: -1 },
      { ...VALID_SCORE, waveReached: -5 },
      { ...VALID_SCORE, score: 10_000_001 },
      { ...VALID_SCORE, enemiesKilled: 'lots' },
    ]) {
      const res = await worker.fetch(post('/api/scores', bad, token), env);
      expect(res.status).toBe(400);
    }
    expect(db.sessions).toHaveLength(0);
  });
});

describe('GET /api/leaderboard', () => {
  test('returns scores sorted highest first with usernames', async () => {
    const { token } = await registerAlice();
    await worker.fetch(post('/api/scores', { ...VALID_SCORE, score: 100 }, token), env);
    await worker.fetch(post('/api/scores', { ...VALID_SCORE, score: 900 }, token), env);
    await worker.fetch(post('/api/scores', { ...VALID_SCORE, score: 500 }, token), env);

    const res = await worker.fetch(get('/api/leaderboard'), env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      leaderboard: { username: string; score: number }[];
    };
    expect(json.success).toBe(true);
    expect(json.leaderboard.map((e) => e.score)).toEqual([900, 500, 100]);
    expect(json.leaderboard[0].username).toBe('alice');
  });

  test('returns an empty list when no scores exist', async () => {
    const res = await worker.fetch(get('/api/leaderboard'), env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; leaderboard: unknown[] };
    expect(json.leaderboard).toEqual([]);
  });
});
