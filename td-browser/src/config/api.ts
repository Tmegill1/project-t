/**
 * API Configuration
 *
 * Default: your deployed Worker at td-game-api.tyler-megill9.workers.dev
 * Override with .env for local worker: VITE_API_BASE_URL=http://localhost:8787
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "https://td-game-api.tyler-megill9.workers.dev";

// API endpoints
export const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  VALIDATE: '/api/auth/validate',
  HEALTH: '/api/health',
} as const;

// Helper function to build full API URL
export function getApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}
