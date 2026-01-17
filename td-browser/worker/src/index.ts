/**
 * Cloudflare Worker for Tower Defense Game API
 * 
 * This worker handles authentication and user management using Cloudflare D1 database.
 */

import { validateUsername, validatePassword, validateEmail, sanitizeInput } from './validation';

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

// Simple JWT-like token generation (for production, use a proper JWT library)
function generateToken(userId: string, secret: string): string {
  const payload = {
    userId,
    timestamp: Date.now(),
  };
  const encoded = btoa(JSON.stringify(payload));
  // In production, use proper JWT signing with the secret
  return `token_${encoded}_${btoa(secret)}`;
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

    // Generate token
    const token = generateToken(user.id, env.JWT_SECRET);

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

    // Generate token
    const token = generateToken(userId, env.JWT_SECRET);

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
    
    // Simple token validation (in production, properly verify JWT)
    // For now, just check if token exists and is valid format
    if (!token || !token.startsWith('token_')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract user ID from token (simplified - in production, properly decode JWT)
    try {
      const parts = token.split('_');
      if (parts.length < 2) {
        throw new Error('Invalid token format');
      }
      const payload = JSON.parse(atob(parts[1]));
      const userId = payload.userId;

      // Verify user exists
      const user = await env.DB.prepare(
        'SELECT id, username, email, created_at FROM users WHERE id = ?'
      )
        .bind(userId)
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
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
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
