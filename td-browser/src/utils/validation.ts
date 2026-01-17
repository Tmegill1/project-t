/**
 * Frontend input validation utilities
 * These match the backend validation rules for consistency
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates username input (matches backend rules)
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }
  if (trimmed.length > 20) {
    return { isValid: false, error: 'Username must be no more than 20 characters' };
  }

  // Only alphanumeric, underscore, and hyphen
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }

  return { isValid: true };
}

/**
 * Validates password input (matches backend rules)
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters' };
  }
  if (password.length > 128) {
    return { isValid: false, error: 'Password must be no more than 128 characters' };
  }

  return { isValid: true };
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
}
