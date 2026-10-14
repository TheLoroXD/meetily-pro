'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { catalogLabel, type CliAgentProvider, type ProviderState } from '@/lib/model-catalog';

const SETUP: Record<CliAgentProvider, { install: string; signIn: string }> = {
  'claude-code': { install: 'curl -fsSL https://claude.ai/install.sh | bash', signIn: 'claude' },
  codex: { install: 'npm install -g @openai/codex', signIn: 'codex login' },
};

interface CliAgentCardProps {
  provider: CliAgentProvider;
  state: ProviderState | undefined;
  onRecheck: () => Promise<void>;
}

export function CliAgentCard({ provider, state, onRecheck }: CliAgentCardProps) {
  const label = catalogLabel(provider);
  const { install, signIn } = SETUP[provider];
  const ready = state?.status === 'ready';
  const [rechecking, setRechecking] = useState(false);
  const checking = rechecking || !state || state.status === 'loading';

  const recheck = async () => {
    setRechecking(true);
    try {
      await onRecheck();
    } finally {
      setRechecking(false);
    }
  };

  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p>
        Uses the {label} app on this computer with your own sign-in. Calls count against that account, your plan or your API key.
        It runs with its tools turned off and saves no session files. Only the standard sign-in works, not Bedrock, Vertex or a custom model provider.
      </p>
      {!ready && !checking && (
        <ol className="list-decimal space-y-1.5 pl-5 text-xs text-gray-600">
          <li>Install it in a terminal: <code className="rounded bg-gray-100 px-1.5 py-0.5">{install}</code></li>
          <li>Sign in once: <code className="rounded bg-gray-100 px-1.5 py-0.5">{signIn}</code></li>
        </ol>
      )}
      <Button size="sm" variant="outline" onClick={recheck} disabled={checking}>
        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${rechecking ? 'animate-spin' : ''}`} />Check again
      </Button>
    </div>
  );
}
