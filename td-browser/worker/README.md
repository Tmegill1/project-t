# Cloudflare Worker API for Tower Defense Game

This Cloudflare Worker provides a serverless API for authentication and user management using Cloudflare D1 database.

## Setup Instructions

### Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://www.cloudflare.com)
2. **Wrangler CLI**: Install globally with `npm install -g wrangler`
3. **Node.js**: Version 18 or higher

### Step 1: Install Dependencies

```bash
cd worker
npm install
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate with Cloudflare.

### Step 3: D1 Database (tdd_db)

The project uses a D1 database named **tdd_db**. The `database_id` is configured in `wrangler.toml`.

If you need to create a new database:
```bash
wrangler d1 create tdd_db
```
Then update `wrangler.toml` with the returned `database_id`.

### Step 4: Run Database Migrations

```bash
# For local development
npm run db:migrate:local

# For production (remote) database
npm run db:migrate
```

If you **already have a `users` table** from before `password_salt` was added, run this once to add the column:
```bash
npm run db:migrate:add-salt        # remote
npm run db:migrate:add-salt:local  # local
```

### Step 5: Set JWT Secret

```bash
wrangler secret put JWT_SECRET
```

Enter a secure random string when prompted (e.g., generate one with `openssl rand -hex 32`).

### Step 6: Test Locally

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`

Test the health endpoint:
```bash
curl http://localhost:8787/api/health
```

### Step 7: Deploy to Cloudflare

```bash
# Deploy to production
npm run deploy

# Or deploy to a specific environment
npm run deploy:prod
```

After deployment, you'll get a URL like:
```
https://td-game-api.YOUR_SUBDOMAIN.workers.dev
```

### Step 8: Update Frontend Configuration

1. Update `td-browser/src/config/api.ts` with your deployed worker URL:
   ```typescript
   export const API_BASE_URL = 'https://td-game-api.YOUR_SUBDOMAIN.workers.dev';
   ```

2. Or set it as an environment variable:
   ```bash
   # In .env file
   VITE_API_BASE_URL=https://td-game-api.YOUR_SUBDOMAIN.workers.dev
   ```

## API Endpoints

### POST `/api/auth/login`
Login with username and password.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_1234567890",
    "username": "admin",
    "email": "admin@example.com",
    "createdAt": 1234567890
  },
  "token": "token_..."
}
```

### POST `/api/auth/register`
Register a new user.

**Request:**
```json
{
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com" // optional
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_1234567890",
    "username": "newuser",
    "email": "user@example.com",
    "createdAt": 1234567890
  },
  "token": "token_..."
}
```

### POST `/api/auth/validate`
Validate a session token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_1234567890",
    "username": "admin",
    "email": "admin@example.com",
    "createdAt": 1234567890
  }
}
```

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Database Queries

### Query Database (Local)
```bash
npm run db:query:local "SELECT * FROM users"
```

### Query Database (Production)
```bash
npm run db:query "SELECT * FROM users"
```

## Development

### Local Development
```bash
npm run dev
```

### Deploy
```bash
npm run deploy
```

## Security Notes

⚠️ **Important**: The current implementation uses basic SHA-256 hashing for passwords. For production, consider:

1. **Password Hashing**: Use bcrypt, Argon2, or similar with proper salt
2. **JWT Tokens**: Implement proper JWT signing and verification
3. **Rate Limiting**: Add rate limiting to prevent brute force attacks
4. **CORS**: Configure CORS properly for your domain
5. **HTTPS**: Always use HTTPS in production

## Troubleshooting

### Database not found
- Make sure you've created the database and updated `wrangler.toml` with the correct `database_id`
- Check that you're using the correct environment (local vs production)

### CORS errors
- The worker includes CORS headers, but you may need to restrict `Access-Control-Allow-Origin` to your specific domain in production

### Secret not found
- Make sure you've set `JWT_SECRET` using `wrangler secret put JWT_SECRET`
- For local development, you may need to add it to `.dev.vars` file

## Next Steps

- Add game stats tracking
- Implement leaderboards
- Add user profiles
- Implement proper JWT tokens
- Add rate limiting
- Add request logging
