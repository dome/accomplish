import { useState } from 'react';

interface PocketBaseAuthState {
  connected: boolean;
  email?: string;
}

interface PocketBaseConnectorSectionProps {
  pocketBaseAuth: PocketBaseAuthState;
  pocketBaseActionLoading: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function PocketBaseConnectorSection({
  pocketBaseAuth,
  pocketBaseActionLoading,
  onLogin,
  onDisconnect,
}: PocketBaseConnectorSectionProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }

    setError(null);
    try {
      await onLogin(email.trim(), password.trim());
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    await onDisconnect();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5" data-testid="pocketbase-auth-card">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">DomeWork Files</h3>
          <span
            className={`flex items-center gap-1 text-[11px] ${
              pocketBaseAuth.connected ? 'text-green-600' : 'text-muted-foreground'
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                pocketBaseAuth.connected ? 'bg-green-500' : 'bg-muted-foreground'
              }`}
            />
            {pocketBaseAuth.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">
          Upload files to your PocketBase instance at wallet.paysonow.com.
        </p>

        {/* Connected state - show email and disconnect button */}
        {pocketBaseAuth.connected ? (
          <div className="space-y-3">
            {pocketBaseAuth.email && (
              <p className="text-xs text-muted-foreground">
                Connected as:{' '}
                <span className="font-medium text-foreground">{pocketBaseAuth.email}</span>
              </p>
            )}
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={pocketBaseActionLoading}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
            >
              {pocketBaseActionLoading ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        ) : (
          /* Authentication form */
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={pocketBaseActionLoading}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={pocketBaseActionLoading}
            />
            <button
              type="button"
              onClick={handleLogin}
              disabled={pocketBaseActionLoading || !email.trim() || !password.trim()}
              className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {pocketBaseActionLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Connecting...
                </span>
              ) : (
                'Connect'
              )}
            </button>

            {/* Error message */}
            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Hint */}
            <p className="text-xs text-muted-foreground">
              Connect with your PocketBase credentials. The agent will be able to upload files to
              your instance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
