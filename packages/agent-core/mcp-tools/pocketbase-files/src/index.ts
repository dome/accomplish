#!/usr/bin/env node
/**
 * PocketBase Files MCP Server
 * Provides tools for uploading files to PocketBase
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PocketBaseClient } from './pocketbase-client.js';
import { isAuthenticated, getAuthenticatedEmail, clearAuth } from './auth-storage.js';

// Create MCP server
const server = new McpServer(
  { name: 'pocketbase-files', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

// Create PocketBase client
const client = new PocketBaseClient();

/**
 * Register upload_file tool
 */
server.registerTool(
  'upload_file',
  {
    description:
      'Upload a file to PocketBase files collection at https://wallet.paysonow.com/. Requires authentication.',
    inputSchema: {
      filePath: z.string().describe('Absolute path to the file to upload'),
      filename: z
        .string()
        .optional()
        .describe('Custom filename (optional, uses original name if not provided)'),
    },
  },
  async ({ filePath, filename }) => {
    try {
      // Check authentication
      if (!client.isAuthenticated()) {
        return {
          content: [
            {
              type: 'text',
              text: `Authentication required. Please authenticate with PocketBase first using your email.

Current auth status: ${isAuthenticated() ? `Connected as ${getAuthenticatedEmail()}` : 'Not connected'}

To authenticate:
1. Use the "Connect to PocketBase" button in Settings > Connectors
2. Enter your email address
3. Enter the OTP code sent to your email`,
            },
          ],
          isError: true,
        };
      }

      // Upload file
      const result = await client.uploadFile(filePath, filename);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to upload file: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      // Return success response with metadata
      return {
        content: [
          {
            type: 'text',
            text: `File uploaded successfully!

File ID: ${result.fileId}
Name: ${result.name}
Size: ${result.size ? `${(result.size / 1024).toFixed(2)} KB` : 'Unknown'}
Type: ${result.type}
Filename: ${result.filename}
URL: ${result.fileUrl}

The file is now available in PocketBase files collection.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error uploading file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

/**
 * Register check_auth tool (helper for checking authentication status)
 */
server.registerTool(
  'check_auth',
  {
    description: 'Check current PocketBase authentication status',
    inputSchema: {},
  },
  async () => {
    const authenticated = client.isAuthenticated();
    const email = getAuthenticatedEmail();

    return {
      content: [
        {
          type: 'text',
          text: authenticated
            ? `Connected to PocketBase as: ${email}`
            : 'Not connected to PocketBase. Please authenticate first.',
        },
      ],
    };
  },
);

/**
 * Register logout tool
 */
server.registerTool(
  'logout',
  {
    description: 'Logout from PocketBase and clear authentication token',
    inputSchema: {},
  },
  async () => {
    client.logout();
    clearAuth();

    return {
      content: [
        {
          type: 'text',
          text: 'Logged out from PocketBase successfully.',
        },
      ],
    };
  },
);

/**
 * Start the MCP server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PocketBase Files MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
