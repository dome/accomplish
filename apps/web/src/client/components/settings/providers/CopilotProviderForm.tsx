import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { getAccomplish } from '@/lib/accomplish';
import { settingsVariants, settingsTransitions } from '@/lib/animations';
import type { ConnectedProvider, CopilotOAuthCredentials } from '@accomplish_ai/agent-core/common';
import { COPILOT_MODELS } from '@accomplish_ai/agent-core/common';
import { ModelSelector, ConnectedControls, ProviderFormHeader, FormError } from '../shared';
import { PROVIDER_LOGOS } from '@/lib/provider-logos';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CopilotProviderForm');

interface CopilotProviderFormProps {
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function CopilotProviderForm({
  connectedProvider,
  onConnect,
  onDisconnect,
  onModelChange,
  showModelError,
}: CopilotProviderFormProps) {
  const { t } = useTranslation('settings');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);

  const isConnected = connectedProvider?.connectionStatus === 'connected';
  const logoSrc = PROVIDER_LOGOS['copilot'] ?? PROVIDER_LOGOS['github-copilot'];

  const models = connectedProvider?.availableModels?.length
    ? connectedProvider.availableModels.map((m) => ({ id: m.id, name: m.name }))
    : COPILOT_MODELS.map((m) => ({ id: m.id, name: m.displayName }));

  // Check if already connected on mount
  useEffect(() => {
    if (isConnected) return;

    const accomplish = getAccomplish();
    accomplish
      .getCopilotOAuthStatus()
      .then((status) => {
        if (status.connected) {
          const provider: ConnectedProvider = {
            providerId: 'copilot',
            connectionStatus: 'connected',
            selectedModelId: 'copilot/gpt-4o',
            credentials: { type: 'copilot-oauth' } as CopilotOAuthCredentials,
            lastConnectedAt: new Date().toISOString(),
            availableModels: COPILOT_MODELS.map((m) => ({ id: m.id, name: m.displayName })),
          };
          onConnect(provider);
        }
      })
      .catch((err) => logger.error('Failed to check Copilot status:', err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    setUserCode(null);
    setVerificationUri(null);

    try {
      const accomplish = getAccomplish();
      const result = await accomplish.loginGithubCopilot();

      if (result.ok) {
        if (result.userCode) setUserCode(result.userCode);
        if (result.verificationUri) setVerificationUri(result.verificationUri);

        // Verify connection
        const status = await accomplish.getCopilotOAuthStatus();
        if (status.connected) {
          const provider: ConnectedProvider = {
            providerId: 'copilot',
            connectionStatus: 'connected',
            selectedModelId: 'copilot/gpt-4o',
            credentials: { type: 'copilot-oauth' } as CopilotOAuthCredentials,
            lastConnectedAt: new Date().toISOString(),
            availableModels: COPILOT_MODELS.map((m) => ({ id: m.id, name: m.displayName })),
          };
          onConnect(provider);
          setUserCode(null);
          setVerificationUri(null);
        } else {
          setError(
            t('copilot.connectionFailed', {
              defaultValue: 'Failed to connect to GitHub Copilot. Please try again.',
            }),
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('status.connectionFailed'));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const accomplish = getAccomplish();
      await accomplish.logoutGithubCopilot();
    } catch (err) {
      logger.error('Failed to logout from Copilot:', err);
    }
    setUserCode(null);
    setVerificationUri(null);
    onDisconnect();
  };

  return (
    <div
      className="rounded-xl border border-border bg-card p-5"
      data-testid="provider-settings-panel"
    >
      <ProviderFormHeader
        logoSrc={logoSrc}
        providerName={t('providers.copilot', { defaultValue: 'GitHub Copilot' })}
        invertInDark={false}
      />

      <AnimatePresence mode="wait">
        {!isConnected ? (
          <motion.div
            key="disconnected"
            variants={settingsVariants.fadeSlide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={settingsTransitions.enter}
            className="space-y-4"
          >
            <p className="text-sm text-muted-foreground">
              {t('copilot.description', {
                defaultValue:
                  'Connect your GitHub Copilot subscription to use it as your AI provider. You will be redirected to GitHub to authorize access.',
              })}
            </p>

            {userCode && verificationUri && (
              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {t('copilot.enterCode', { defaultValue: 'Enter this code on GitHub:' })}
                </p>
                <div className="flex items-center gap-3">
                  <code className="text-2xl font-mono font-bold tracking-widest text-primary">
                    {userCode}
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('copilot.browserOpened', {
                    defaultValue:
                      'A browser window has been opened. After entering the code, return here.',
                  })}
                </p>
                <a
                  href={verificationUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline"
                >
                  {verificationUri}
                </a>
              </div>
            )}

            <FormError error={error} />

            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              data-testid="copilot-connect-btn"
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {logoSrc && <img src={logoSrc} alt="" className="h-5 w-5" />}
              {connecting
                ? t('copilot.connecting', { defaultValue: 'Waiting for authorization…' })
                : t('copilot.connectButton', { defaultValue: 'Connect with GitHub' })}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="connected"
            variants={settingsVariants.fadeSlide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={settingsTransitions.enter}
            className="space-y-3"
          >
            <ConnectedControls onDisconnect={handleDisconnect} />

            <ModelSelector
              models={models}
              value={connectedProvider?.selectedModelId || null}
              onChange={onModelChange}
              error={showModelError && !connectedProvider?.selectedModelId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
