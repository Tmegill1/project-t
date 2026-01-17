# Authentication Service

This authentication service provides user login, registration, and session management. It's designed to work with Cloudflare D1 database and Workers.

## Current Implementation

The service currently uses a **mock implementation** for development purposes. All authentication is handled locally with localStorage for session persistence.

## Connecting to Cloudflare

To connect this service to your Cloudflare database, you'll need to:

### 1. Set up Cloudflare Worker

Create a Cloudflare Worker that handles authentication endpoints:

```typescript
// worker.ts
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }
    
    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      return handleRegister(request, env);
    }
    
    if (url.pathname === '/api/auth/validate' && request.method === 'POST') {
      return handleValidate(request, env);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { username, password } = await request.json();
  
  // Query user from D1 database
  const user = await env.DB.prepare(
    'SELECT id, username, email, password_hash FROM users WHERE username = ?'
  ).bind(username).first();
  
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Verify password (use bcrypt or similar)
  const isValid = await verifyPassword(password, user.password_hash);
  
  if (!isValid) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Generate JWT token
  const token = await generateJWT(user.id, env.JWT_SECRET);
  
  return new Response(JSON.stringify({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    },
    token
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 2. Update AuthService.ts

Replace the `mockLogin` method in `AuthService.ts` with actual API calls:

```typescript
async login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    const response = await fetch('https://your-worker.your-subdomain.workers.dev/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      return {
        success: false,
        error: 'Login failed'
      };
    }

    const data = await response.json();
    
    if (data.success && data.user && data.token) {
      this.currentUser = data.user;
      this.authToken = data.token;
      this.saveSession();
      return data;
    }

    return {
      success: false,
      error: data.error || 'Login failed'
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}
```

### 3. Database Schema

Create a `users` table in your Cloudflare D1 database:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_username ON users(username);
CREATE INDEX idx_email ON users(email);
```

### 4. Environment Variables

Add your Cloudflare Worker URL to an environment configuration file:

```typescript
// config.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://your-worker.your-subdomain.workers.dev';
```

Then update `AuthService.ts` to use this:

```typescript
import { API_BASE_URL } from '../config';

// In login method:
const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
  // ...
});
```

## API Endpoints Expected

The service expects the following endpoints:

- `POST /api/auth/login` - Login with username and password
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/validate` - Validate a session token

All endpoints should return JSON in the format:

```typescript
{
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}
```

## Session Management

The service automatically:
- Saves sessions to localStorage
- Restores sessions on page load
- Validates sessions when restored
- Clears sessions on logout

## Security Notes

- **Never store passwords in plain text** - Always hash passwords (use bcrypt, Argon2, etc.)
- **Use HTTPS** - Always use HTTPS in production
- **Validate tokens** - Implement proper JWT validation on the server
- **Rate limiting** - Add rate limiting to prevent brute force attacks
- **CORS** - Configure CORS properly on your Cloudflare Worker
