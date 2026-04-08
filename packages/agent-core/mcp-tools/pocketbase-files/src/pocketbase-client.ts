/**
 * PocketBase API client for file operations
 */

import * as fs from 'fs';
import type { PocketBaseFileRecord, UploadFileResult } from './types.js';
import { getAuthToken, writeAuth, clearAuth } from './auth-storage.js';

const POCKETBASE_URL = 'https://wallet.paysonow.com';
const FILES_COLLECTION = 'files';

/**
 * PocketBase client class
 */
export class PocketBaseClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = POCKETBASE_URL;
    this.authToken = getAuthToken();
  }

  /**
   * Refresh auth token from storage
   */
  refreshAuth(): void {
    this.authToken = getAuthToken();
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.authToken !== null && this.authToken.length > 0;
  }

  /**
   * Set auth token manually (called after OTP verification)
   */
  setAuthToken(token: string, email: string): void {
    this.authToken = token;
    writeAuth({ token, email });
  }

  /**
   * Clear authentication
   */
  logout(): void {
    this.authToken = null;
    clearAuth();
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add auth token if available
    if (this.authToken) {
      headers['Authorization'] = this.authToken;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PocketBase API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Send OTP to email for authentication
   * Note: This assumes PocketBase has a custom OTP endpoint
   * Adjust according to your actual PocketBase setup
   */
  async sendOTP(email: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Attempt to use PocketBase's request password reset as OTP mechanism
      // Or use a custom endpoint if you have one set up
      await this.request('/api/collections/users/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      return {
        success: true,
        message: 'OTP sent to your email. Please check your inbox.',
      };
    } catch (error) {
      console.error('[PocketBase] Failed to send OTP:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to send OTP. Please try again.',
      );
    }
  }

  /**
   * Verify OTP and authenticate
   * Note: This assumes a custom OTP verification endpoint
   * Adjust according to your actual PocketBase setup
   */
  async verifyOTP(email: string, otp: string): Promise<void> {
    try {
      // This is a placeholder - adjust to your actual OTP verification endpoint
      // You might need to create a custom endpoint in PocketBase
      const response = await fetch(`${this.baseUrl}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OTP verification failed: ${error}`);
      }

      const data = await response.json();

      // Store the token
      if (data.token) {
        this.setAuthToken(data.token, email);
      } else {
        throw new Error('No token received from server');
      }
    } catch (error) {
      console.error('[PocketBase] Failed to verify OTP:', error);
      throw error;
    }
  }

  /**
   * Alternative: Authenticate with email/password (if OTP is not available)
   */
  async authenticateWithEmailPassword(email: string, password: string): Promise<void> {
    try {
      const response = await this.request<{ token: string; record: { email: string } }>(
        '/api/collections/users/auth-with-password',
        {
          method: 'POST',
          body: JSON.stringify({ identity: email, password }),
        },
      );

      this.setAuthToken(response.token, response.record.email);
    } catch (error) {
      console.error('[PocketBase] Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Upload a file to PocketBase with metadata
   */
  async uploadFile(filePath: string, customFilename?: string): Promise<UploadFileResult> {
    try {
      // Check if authenticated
      if (!this.isAuthenticated()) {
        return {
          success: false,
          error: 'Not authenticated. Please authenticate first.',
        };
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      }

      // Read file and get metadata
      const fileBuffer = fs.readFileSync(filePath);
      const filename = customFilename || filePath.split('/').pop() || 'file';
      const contentType = this.getContentType(filename);
      const fileSize = fileBuffer.length;

      // Create Blob from buffer
      const blob = new Blob([fileBuffer], { type: contentType });

      // Create FormData for file upload with metadata
      const formData = new FormData();
      formData.append('file', blob, filename);

      // Add metadata fields
      formData.append('name', filename);
      formData.append('size', String(fileSize));
      formData.append('type', contentType);

      // Upload to PocketBase
      const url = `${this.baseUrl}/api/collections/${FILES_COLLECTION}/records`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.authToken!,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Upload failed (${response.status}): ${error}`,
        };
      }

      const record = (await response.json()) as PocketBaseFileRecord;

      // Construct file URL
      const fileUrl = record.file
        ? `${this.baseUrl}/api/files/${FILES_COLLECTION}/${record.id}/${record.file}`
        : undefined;

      return {
        success: true,
        fileId: record.id,
        fileUrl,
        filename,
        name: filename,
        size: fileSize,
        type: contentType,
      };
    } catch (error) {
      console.error('[PocketBase] Upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
      json: 'application/json',
      csv: 'text/csv',
      zip: 'application/zip',
    };

    return contentTypes[ext || ''] || 'application/octet-stream';
  }
}
