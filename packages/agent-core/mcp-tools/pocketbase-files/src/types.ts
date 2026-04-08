/**
 * Type definitions for PocketBase Files MCP tool
 */

export interface PocketBaseAuth {
  token: string;
  email: string;
  expiresAt?: number;
}

export interface PocketBaseFileRecord {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
  file?: string;
  [key: string]: unknown;
}

export interface UploadFileResult {
  success: boolean;
  fileId?: string;
  fileUrl?: string;
  filename?: string;
  name?: string;
  size?: number;
  type?: string;
  error?: string;
}
