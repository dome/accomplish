#!/usr/bin/env node
/**
 * Test script for PocketBase MCP tools
 * Run with: npx tsx test-pocketbase.ts
 */

import { PocketBaseClient } from './src/pocketbase-client.js';
import { isAuthenticated, clearAuth } from './src/auth-storage.js';

async function testAuth() {
  console.log('=== Testing Authentication ===');

  const client = new PocketBaseClient();

  // Check current auth status
  console.log('Current auth status:', isAuthenticated());
  console.log('Client isAuthenticated:', client.isAuthenticated());

  // Test authentication (you'll need to provide real credentials)
  const email = process.env.TEST_EMAIL || 'test@example.com';
  const password = process.env.TEST_PASSWORD;

  if (password) {
    console.log(`\nAttempting to authenticate as ${email}...`);
    try {
      await client.authenticateWithEmailPassword(email, password);
      console.log('✅ Authentication successful!');
      console.log('Auth status after login:', client.isAuthenticated());
    } catch (error) {
      console.error('❌ Authentication failed:', error);
    }
  } else {
    console.log(
      '\n⚠️  Set TEST_EMAIL and TEST_PASSWORD environment variables to test authentication',
    );
  }
}

async function testUpload() {
  console.log('\n=== Testing File Upload ===');

  const client = new PocketBaseClient();

  if (!client.isAuthenticated()) {
    console.log('❌ Not authenticated. Please authenticate first.');
    return;
  }

  // Create a test file
  const testFilePath = '/tmp/test-pocketbase-upload.txt';
  const fs = await import('fs');
  fs.writeFileSync(testFilePath, 'This is a test file for PocketBase upload');

  console.log(`\nUploading test file: ${testFilePath}`);

  try {
    const result = await client.uploadFile(testFilePath, 'test-upload.txt');

    if (result.success) {
      console.log('✅ Upload successful!');
      console.log('File ID:', result.fileId);
      console.log('File URL:', result.fileUrl);
      console.log('Filename:', result.filename);
    } else {
      console.error('❌ Upload failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Upload error:', error);
  }
}

async function testLogout() {
  console.log('\n=== Testing Logout ===');

  clearAuth();
  console.log('✅ Logged out successfully');
  console.log('Auth status after logout:', isAuthenticated());
}

async function main() {
  console.log('PocketBase MCP Tool Test Suite\n');

  const test = process.argv[2] || 'all';

  switch (test) {
    case 'auth':
      await testAuth();
      break;
    case 'upload':
      await testUpload();
      break;
    case 'logout':
      await testLogout();
      break;
    case 'all':
      await testAuth();
      await testUpload();
      await testLogout();
      break;
    default:
      console.log('Usage: npx tsx test-pocketbase.ts [auth|upload|logout|all]');
  }
}

main().catch(console.error);
