/**
 * Cloudflare Worker for Tower Defense Game API
 * 
 * This worker handles authentication and user management using Cloudflare D1 database.
 */

import {
  validateUsername,
  validatePassword,
  validateEmail,
  validateScoreSubmission,
  sanitizeInput,
} from './validation';
import { signToken, verifyToken } from './jwt';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

interface User {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  password_salt: string | null;
  created_at: number;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}

interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    email?: string;
    createdAt?: number;
  };
  token?: string;
  error?: string;
}

// ---- Password hashing: before DB (hash then store), after DB (compare only, never send hash to client) ----

const PBKDF2_ITERATIONS = 100000;

function generateSaltHex(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function saltHexToUint8(saltHex: string): Uint8Array {
  const match = saltHex.match(/.{2}/g);
  if (!match) throw new Error('Invalid salt');
  return new Uint8Array(match.map((b) => parseInt(b, 16)));
}

/** Hash password with PBKDF2 + salt before storing in DB. */
async function hashPasswordWithSalt(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = saltHexToUint8(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Legacy SHA-256 (no salt) for rows created before password_salt existed. */
async function legacyHashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Verify password using stored hash and salt. Supports legacy (salt=null) rows. */
async function verifyPassword(
  password: string,
  storedHash: string,
  saltHex: string | null
): Promise<boolean> {
  if (saltHex) {
    const hash = await hashPasswordWithSalt(password, saltHex);
    return hash === storedHash;
  }
  const legacy = await legacyHashPassword(password);
  return legacy === storedHash;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (path === '/api/auth/login' && request.method === 'POST') {
        return handleLogin(request, env, corsHeaders);
      }

      if (path === '/api/auth/register' && request.method === 'POST') {
        return handleRegister(request, env, corsHeaders);
      }

      if (path === '/api/auth/validate' && request.method === 'POST') {
        return handleValidate(request, env, corsHeaders);
      }

      if (path === '/api/scores' && request.method === 'POST') {
        return handleSubmitScore(request, env, corsHeaders);
      }

      if (path === '/api/leaderboard' && request.method === 'GET') {
        return handleLeaderboard(request, env, corsHeaders);
      }

      if (path === '/api/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};

async function handleLogin(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body: LoginRequest = await request.json();

    // Validate and sanitize input
    const usernameValidation = validateUsername(body.username);
    if (!usernameValidation.isValid) {
      return new Response(
        JSON.stringify({ success: false, error: usernameValidation.error || 'Invalid username' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const passwordValidation = validatePassword(body.password);
    if (!passwordValidation.isValid) {
      return new Response(
        JSON.stringify({ success: false, error: passwordValidation.error || 'Invalid password' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Sanitize inputs (defense in depth - parameterized queries are primary defense)
    const sanitizedUsername = sanitizeInput(body.username);
    const sanitizedPassword = body.password; // Don't sanitize password as it may contain special chars

    if (!sanitizedUsername || !sanitizedPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username and password are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Query user from D1 database using parameterized query (SQL injection protection)
    // password_hash and password_salt never leave the worker; used only to verify
    const user = await env.DB.prepare(
      'SELECT id, username, email, password_hash, password_salt, created_at FROM users WHERE username = ?'
    )
      .bind(sanitizedUsername)
      .first<User>();

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify password: hash the input with stored salt and compare to stored hash (never send hash to client)
    const isValid = await verifyPassword(sanitizedPassword, user.password_hash, user.password_salt);

    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Issue an HMAC-signed token (see jwt.ts)
    const token = await signToken(user.id, env.JWT_SECRET);

    const response: AuthResponse = {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email || undefined,
        createdAt: user.created_at,
      },
      token,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Login failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleRegister(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body: RegisterRequest = await request.json();

    // Validate and sanitize input
    const usernameValidation = validateUsername(body.username);
    if (!usernameValidation.isValid) {
      return new Response(
        JSON.stringify({ success: false, error: usernameValidation.error || 'Invalid username' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const passwordValidation = validatePassword(body.password);
    if (!passwordValidation.isValid) {
      return new Response(
        JSON.stringify({ success: false, error: passwordValidation.error || 'Invalid password' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const emailValidation = validateEmail(body.email);
    if (!emailValidation.isValid) {
      return new Response(
        JSON.stringify({ success: false, error: emailValidation.error || 'Invalid email' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Sanitize inputs (defense in depth - parameterized queries are primary defense)
    const sanitizedUsername = sanitizeInput(body.username);
    const sanitizedPassword = body.password; // Don't sanitize password as it may contain special chars
    const sanitizedEmail = body.email ? sanitizeInput(body.email) : undefined;

    if (!sanitizedUsername || !sanitizedPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username and password are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if username already exists (using parameterized query)
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    )
      .bind(sanitizedUsername)
      .first();

    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username already exists' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Hash password with a new salt before storing (never store plain password)
    const passwordSalt = generateSaltHex();
    const passwordHash = await hashPasswordWithSalt(sanitizedPassword, passwordSalt);

    // Generate user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = Date.now();

    // Insert user using parameterized query (SQL injection protection)
    // Only hashed password and salt go to DB
    await env.DB.prepare(
      'INSERT INTO users (id, username, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(userId, sanitizedUsername, sanitizedEmail || null, passwordHash, passwordSalt, createdAt)
      .run();

    // Issue an HMAC-signed token (see jwt.ts)
    const token = await signToken(userId, env.JWT_SECRET);

    const response: AuthResponse = {
      success: true,
      user: {
        id: userId,
        username: sanitizedUsername,
        email: sanitizedEmail,
        createdAt,
      },
      token,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Registration failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleValidate(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'No token provided' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.substring(7);

    // Verify the HMAC signature and expiry. Rejects tampered tokens and
    // anything in the legacy unsigned token_ format.
    const payload = await verifyToken(token, env.JWT_SECRET);
    if (!payload) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user still exists
    const user = await env.DB.prepare(
      'SELECT id, username, email, created_at FROM users WHERE id = ?'
    )
      .bind(payload.userId)
      .first<User>();

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email || undefined,
          createdAt: user.created_at,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Validation failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

/** Returns the authenticated userId, or null if the Bearer token is missing/invalid. */
async function authenticate(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const payload = await verifyToken(authHeader.substring(7), env.JWT_SECRET);
  return payload ? payload.userId : null;
}

async function handleSubmitScore(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userId = await authenticate(request, env);
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await request.json().catch(() => null);
    const validation = validateScoreSubmission(body);
    if (!validation.isValid || !validation.value) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error || 'Invalid score submission' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { score, waveReached, enemiesKilled, towersPlaced } = validation.value;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    await env.DB.prepare(
      'INSERT INTO game_sessions (id, user_id, wave_reached, enemies_killed, towers_placed, score, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(sessionId, userId, waveReached, enemiesKilled, towersPlaced, score, now, now)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Score submission error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Score submission failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleLeaderboard(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const requested = parseInt(url.searchParams.get('limit') || '10', 10);
    const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 10, 1), 50);

    const { results } = await env.DB.prepare(
      'SELECT u.username, s.score, s.wave_reached, s.ended_at FROM game_sessions s JOIN users u ON u.id = s.user_id ORDER BY s.score DESC LIMIT ?'
    )
      .bind(limit)
      .all<{ username: string; score: number; wave_reached: number; ended_at: number | null }>();

    const leaderboard = (results || []).map((row) => ({
      username: row.username,
      score: row.score,
      waveReached: row.wave_reached,
      endedAt: row.ended_at,
    }));

    return new Response(JSON.stringify({ success: true, leaderboard }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Leaderboard unavailable' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
