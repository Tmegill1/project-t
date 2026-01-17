/**
 * Input validation utilities for protecting against SQL injection and malicious input
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates username input
 * Rules:
 * - 3-20 characters
 * - Alphanumeric, underscore, and hyphen only
 * - No SQL special characters
 * - No control characters
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' };
  }

  // Trim whitespace
  const trimmed = username.trim();

  // Length validation
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }
  if (trimmed.length > 20) {
    return { isValid: false, error: 'Username must be no more than 20 characters' };
  }

  // Character validation - only alphanumeric, underscore, and hyphen
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }

  // Check for SQL injection patterns (defense in depth)
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
    /(--|;|\/\*|\*\/|'|"|`)/,
    /(\bOR\b|\bAND\b).*(\b1\b|\b'1'\b|\b"1"\b)/i,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(trimmed)) {
      return { isValid: false, error: 'Username contains invalid characters' };
    }
  }

  return { isValid: true };
}

/**
 * Validates password input
 * Rules:
 * - 6-128 characters
 * - No control characters
 * - No null bytes
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  // Length validation
  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters' };
  }
  if (password.length > 128) {
    return { isValid: false, error: 'Password must be no more than 128 characters' };
  }

  // Check for null bytes (potential injection vector)
  if (password.includes('\0')) {
    return { isValid: false, error: 'Password contains invalid characters' };
  }

  // Check for control characters (except common whitespace)
  const controlCharRegex = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;
  if (controlCharRegex.test(password)) {
    return { isValid: false, error: 'Password contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Sanitizes string input by removing potentially dangerous characters
 * Note: This is a secondary defense. Primary defense is parameterized queries.
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Remove control characters (except common whitespace)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validates email (optional field)
 */
export function validateEmail(email: string | undefined): ValidationResult {
  if (!email) {
    return { isValid: true }; // Email is optional
  }

  if (typeof email !== 'string') {
    return { isValid: false, error: 'Email must be a string' };
  }

  const trimmed = email.trim();

  if (trimmed.length > 255) {
    return { isValid: false, error: 'Email must be no more than 255 characters' };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
}
