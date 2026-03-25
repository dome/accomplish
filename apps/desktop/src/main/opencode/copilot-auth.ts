/**
 * GitHub Copilot device OAuth flow handler for the main process.
 *
 * Runs the device-code grant entirely in Node.js (no PTY needed):
 *   1. POST /login/device/code  → get device_code + user_code
 *   2. Open browser to verification_uri
 *   3. Poll /login/oauth/access_token until authorized
 *   4. Persist tokens via setCopilotOAuthTokens (writes auth.json)
 */

import { shell } from 'electron';
import {
  requestCopilotDeviceCode,
  pollCopilotDeviceToken,
  setCopilotOAuthTokens,
  clearCopilotOAuth,
  getCopilotOAuthStatus,
  type CopilotDeviceCodeResponse,
} from '@accomplish_ai/agent-core';
import { getLogCollector } from '../logging';

export interface CopilotLoginResult {
  ok: boolean;
  userCode?: string;
  verificationUri?: string;
}

let activeLoginAbortController: AbortController | null = null;

/**
 * Initiate the GitHub Copilot device OAuth flow.
 * Opens the user's browser, returns the user_code that should be shown in the UI,
 * and resolves once the user completes authorization.
 */
export async function loginGithubCopilot(): Promise<CopilotLoginResult> {
  // Cancel any in-progress login
  if (activeLoginAbortController) {
    activeLoginAbortController.abort();
    activeLoginAbortController = null;
  }

  const abortController = new AbortController();
  activeLoginAbortController = abortController;

  const log = getLogCollector();

  try {
    log.log?.('INFO', 'opencode', '[CopilotAuth] Starting device code flow');

    const deviceCode: CopilotDeviceCodeResponse = await requestCopilotDeviceCode();

    log.log?.(
      'INFO',
      'opencode',
      `[CopilotAuth] Got device code, user_code: ${deviceCode.user_code}`,
    );

    // Open the browser for the user to enter the code
    await shell.openExternal(deviceCode.verification_uri);

    // Poll until authorized (or expired/aborted)
    const tokenResponse = await pollCopilotDeviceToken({
      deviceCode: deviceCode.device_code,
      interval: deviceCode.interval,
      expiresIn: deviceCode.expires_in,
      onPoll: () => {
        if (abortController.signal.aborted) {
          throw new Error('Login cancelled');
        }
        log.log?.('INFO', 'opencode', '[CopilotAuth] Polling for token...');
      },
    });

    if (!tokenResponse.access_token) {
      throw new Error('No access token received from GitHub');
    }

    // Persist to OpenCode-compatible auth.json
    setCopilotOAuthTokens({
      accessToken: tokenResponse.access_token,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000, // GitHub tokens typically valid 8h
    });

    log.log?.('INFO', 'opencode', '[CopilotAuth] Login successful, tokens saved');

    return {
      ok: true,
      userCode: deviceCode.user_code,
      verificationUri: deviceCode.verification_uri,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.log?.('WARN', 'opencode', `[CopilotAuth] Login failed: ${msg}`);
    throw err;
  } finally {
    if (activeLoginAbortController === abortController) {
      activeLoginAbortController = null;
    }
  }
}

export function logoutGithubCopilot(): void {
  clearCopilotOAuth();
}

export { getCopilotOAuthStatus };
