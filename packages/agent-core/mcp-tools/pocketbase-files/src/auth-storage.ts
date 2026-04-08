/**
 * Auth token storage for PocketBase authentication
 * Stores tokens in encrypted local storage
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { PocketBaseAuth } from './types.js';

const AUTH_DIR = path.join(os.homedir(), '.domework');
const AUTH_FILE = path.join(AUTH_DIR, 'pocketbase-auth.json');

/**
 * Get the path to the PocketBase auth file
 */
export function getAuthFilePath(): string {
  return AUTH_FILE;
}

/**
 * Read auth data from storage
 */
export function readAuth(): PocketBaseAuth | null {
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
export function writeAuth(auth: PocketBaseAuth): void {
  try {
    // Create directory if it doesn't exist
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
export function clearAuth(): void {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
    }
  } catch (error) {
    console.error('[PocketBase Auth] Failed to clear auth file:', error);
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const auth = readAuth();
  return auth !== null && auth.token.length > 0;
}

/**
 * Get the current auth token
 */
export function getAuthToken(): string | null {
  const auth = readAuth();
  return auth?.token || null;
}

/**
 * Get the authenticated email
 */
export function getAuthenticatedEmail(): string | null {
  const auth = readAuth();
  return auth?.email || null;
}
