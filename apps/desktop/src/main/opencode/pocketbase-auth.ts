/**
 * PocketBase authentication manager for desktop app
 * Handles communication with PocketBase instance
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface PocketBaseAuthStatus {
  connected: boolean;
  email?: string;
}

export interface PocketBaseAuth {
  token: string;
  email: string;
  expiresAt?: number;
}

const AUTH_DIR = path.join(os.homedir(), '.domework');
const AUTH_FILE = path.join(AUTH_DIR, 'pocketbase-auth.json');
const POCKETBASE_URL = 'https://wallet.paysonow.com';

/**
 * Read auth data from storage
 */
function readAuth(): PocketBaseAuth | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(AUTH_FILE, 'utf8');
    const auth = JSON.parse(raw) as PocketBaseAuth;

    // Check if token is expired
    if (auth.expiresAt && Date.now() > auth.expiresAt) {
      clearAuth();
      return null;
    }

    return auth;
  } catch (error) {
    console.error('[PocketBase Auth] Failed to read auth file:', error);
    return null;
  }
}

/**
 * Write auth data to storage
 */
function writeAuth(auth: PocketBaseAuth): void {
  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), 'utf8');
  } catch (error) {
    console.error('[PocketBase Auth] Failed to write auth file:', error);
    throw new Error('Failed to save authentication token');
  }
}

/**
 * Clear auth data from storage
 */
function clearAuth(): void {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
    }
  } catch (error) {
    console.error('[PocketBase Auth] Failed to clear auth file:', error);
  }
}

/**
 * Get current PocketBase authentication status
 */
export function getPocketBaseAuthStatus(): PocketBaseAuthStatus {
  const auth = readAuth();
  return {
    connected: auth !== null && auth.token.length > 0,
    email: auth?.email,
  };
}

/**
 * Send OTP to email for authentication
 * Note: This uses PocketBase's password reset as OTP mechanism
 */
export async function sendPocketBaseOTP(
  email: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${POCKETBASE_URL}/api/collections/users/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send OTP: ${error}`);
    }

    return {
      success: true,
      message: 'OTP sent to your email. Please check your inbox.',
    };
  } catch (error) {
    console.error('[PocketBase Auth] Failed to send OTP:', error);
    throw error;
  }
}

/**
 * Verify OTP and authenticate with PocketBase
 * Note: This requires a custom endpoint in your PocketBase instance
 */
export async function verifyPocketBaseOTP(email: string, otp: string): Promise<void> {
  try {
    // This is a placeholder - adjust to your actual OTP verification endpoint
    const response = await fetch(`${POCKETBASE_URL}/api/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OTP verification failed: ${error}`);
    }

    const data = (await response.json()) as { token?: string };

    if (data.token) {
      writeAuth({ token: data.token, email });
    } else {
      throw new Error('No token received from server');
    }
  } catch (error) {
    console.error('[PocketBase Auth] Failed to verify OTP:', error);
    throw error;
  }
}

/**
 * Alternative: Authenticate with email/password
 */
export async function authenticatePocketBaseWithEmailPassword(
  email: string,
  password: string,
): Promise<void> {
  try {
    const response = await fetch(`${POCKETBASE_URL}/api/collections/users/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${error}`);
    }

    const data = (await response.json()) as { token?: string };

    if (data.token) {
      writeAuth({ token: data.token, email });
    } else {
      throw new Error('No token received from server');
    }
  } catch (error) {
    console.error('[PocketBase Auth] Authentication failed:', error);
    throw error;
  }
}

/**
 * Logout from PocketBase
 */
export function logoutPocketBase(): void {
  clearAuth();
}
