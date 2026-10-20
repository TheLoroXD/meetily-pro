'use client';

import { Switch } from '@/components/ui/switch';
import type { AssistantSettings } from '@/lib/live-assistant';

interface LiveAssistantSettingsProps {
  settings: AssistantSettings;
  loaded: boolean;
  persist: (next: AssistantSettings) => Promise<void>;
}

export function LiveAssistantSettings({ settings, loaded, persist }: LiveAssistantSettingsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-gray-800">Live assistant</div>
          <div className="text-xs text-gray-500">Suggests questions and tips while you record, using the AI model.</div>
        </div>
        <Switch checked={settings.enabled} onCheckedChange={(enabled) => persist({ ...settings, enabled })} disabled={!loaded} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-gray-800">Look up answers in work tools</div>
          <div className="text-xs text-gray-500">With Claude Code, chat answers can read Notion, Linear, Microsoft 365, Confluence and Jira. Read-only.</div>
        </div>
        <Switch checked={settings.lookup} onCheckedChange={(lookup) => persist({ ...settings, lookup })} disabled={!loaded} />
      </div>
    </div>
  );
}
