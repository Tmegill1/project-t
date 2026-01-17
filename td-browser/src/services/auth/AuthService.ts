/**
 * Authentication Service
 * 
 * This service handles user authentication and session management.
 * It's designed to work with Cloudflare D1 database and Workers.
 */

import { getApiUrl, API_ENDPOINTS } from '../../config/api';

export interface User {
  id: string;
  username: string;
  email?: string;
  createdAt?: Date;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

class AuthService {
  private currentUser: User | null = null;
  private authToken: string | null = null;
  private readonly TOKEN_KEY = 'td_auth_token';
  private readonly USER_KEY = 'td_user';

  constructor() {
    // Try to restore session from localStorage on initialization
    this.restoreSession();
  }

  /**
   * Attempts to log in a user with username and password
   * @param credentials - Username and password
   * @returns Promise with authentication response
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(getApiUrl(API_ENDPOINTS.LOGIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data: AuthResponse = await response.json();

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

  /**
   * Logs out the current user
   */
  logout(): void {
    this.currentUser = null;
    this.authToken = null;
    this.clearSession();
  }

  /**
   * Checks if a user is currently authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.authToken !== null;
  }

  /**
   * Gets the current authenticated user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Gets the current authentication token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Validates the current session token with Cloudflare API
   */
  async validateSession(): Promise<boolean> {
    if (!this.authToken) {
      return false;
    }

    try {
      const response = await fetch(getApiUrl(API_ENDPOINTS.VALIDATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.user) {
        this.currentUser = data.user;
        this.saveSession();
        return true;
      }

      // Token is invalid, clear session
      this.clearSession();
      return false;
    } catch (error) {
      console.error('Session validation error:', error);
      this.clearSession();
      return false;
    }
  }

  /**
   * Saves the current session to localStorage
   */
  private saveSession(): void {
    if (this.authToken && this.currentUser) {
      localStorage.setItem(this.TOKEN_KEY, this.authToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(this.currentUser));
    }
  }

  /**
   * Restores session from localStorage
   */
  private restoreSession(): void {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      const userStr = localStorage.getItem(this.USER_KEY);

      if (token && userStr) {
        this.authToken = token;
        this.currentUser = JSON.parse(userStr);
        
        // Validate the restored session
        this.validateSession().then(isValid => {
          if (!isValid) {
            this.clearSession();
          }
        });
      }
    } catch (error) {
      console.error('Error restoring session:', error);
      this.clearSession();
    }
  }

  /**
   * Clears the session from localStorage
   */
  private clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  /**
   * Register a new user with Cloudflare API
   */
  async register(credentials: LoginCredentials & { email?: string }): Promise<AuthResponse> {
    try {
      const response = await fetch(getApiUrl(API_ENDPOINTS.REGISTER), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data: AuthResponse = await response.json();

      // Check if registration was successful
      if (data.success && data.user && data.token) {
        this.currentUser = data.user;
        this.authToken = data.token;
        this.saveSession();
        return data;
      }

      // Return error from API (e.g., "Username already exists")
      return {
        success: false,
        error: data.error || 'Registration failed'
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
