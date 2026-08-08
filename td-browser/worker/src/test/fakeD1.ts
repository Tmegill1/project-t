/**
 * In-memory stand-in for the D1 database, implementing just the
 * prepare().bind().first()/run()/all() surface the worker uses.
 * Unrecognized SQL throws so a new query can't silently return nothing.
 */

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  password_salt: string | null;
  created_at: number;
}

interface SessionRow {
  id: string;
  user_id: string;
  wave_reached: number;
  enemies_killed: number;
  towers_placed: number;
  score: number;
  started_at: number;
  ended_at: number | null;
}

export function createFakeDb() {
  const users: UserRow[] = [];
  const sessions: SessionRow[] = [];

  return {
    users,
    sessions,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (sql.includes('FROM users WHERE username')) {
                return users.find((u) => u.username === args[0]) ?? null;
              }
              if (sql.includes('FROM users WHERE id')) {
                return users.find((u) => u.id === args[0]) ?? null;
              }
              throw new Error(`FakeD1: unhandled first(): ${sql}`);
            },
            async run() {
              if (sql.startsWith('INSERT INTO users')) {
                const [id, username, email, password_hash, password_salt, created_at] =
                  args as [string, string, string | null, string, string, number];
                users.push({ id, username, email, password_hash, password_salt, created_at });
                return { success: true };
              }
              if (sql.startsWith('INSERT INTO game_sessions')) {
                const [id, user_id, wave_reached, enemies_killed, towers_placed, score, started_at, ended_at] =
                  args as [string, string, number, number, number, number, number, number];
                sessions.push({ id, user_id, wave_reached, enemies_killed, towers_placed, score, started_at, ended_at });
                return { success: true };
              }
              throw new Error(`FakeD1: unhandled run(): ${sql}`);
            },
            async all() {
              if (sql.includes('FROM game_sessions') && sql.includes('ORDER BY')) {
                const limit = (args[0] as number) ?? 10;
                const results = [...sessions]
                  .sort((a, b) => b.score - a.score || b.wave_reached - a.wave_reached)
                  .slice(0, limit)
                  .map((s) => ({
                    username: users.find((u) => u.id === s.user_id)?.username ?? 'unknown',
                    score: s.score,
                    wave_reached: s.wave_reached,
                    ended_at: s.ended_at,
                  }));
                return { results };
              }
              throw new Error(`FakeD1: unhandled all(): ${sql}`);
            },
          };
        },
      };
    },
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;
