'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { useConfig } from '@/contexts/ConfigContext';
import { assistantService } from '@/services/assistantService';
import { AssistantConsentDialog } from '@/components/AssistantConsentDialog';
import { hasCloudConsent, isCloudProvider, withCloudConsent, type AssistantSettings } from '@/lib/live-assistant';
import { catalogLabel } from '@/lib/model-catalog';

interface LiveAssistantSettingsProps {
  settings: AssistantSettings;
  loaded: boolean;
  persist: (next: AssistantSettings) => Promise<void>;
}

export function LiveAssistantSettings({ settings, loaded, persist }: LiveAssistantSettingsProps) {
  const { modelConfig } = useConfig();
  const [consentFor, setConsentFor] = useState<string | null>(null);

  const provider = modelConfig.provider;
  const label = catalogLabel(provider);
  const cloud = isCloudProvider(provider, modelConfig.ollamaEndpoint);
  const consented = !cloud || hasCloudConsent(settings, provider);

  const confirmConsent = async (confirmed: string) => {
    setConsentFor(null);
    await persist(withCloudConsent(settings, confirmed));
    assistantService.setPaused(false).catch(() => undefined);
  };

  const revokeConsent = () => {
    const next = { ...settings.cloud_consent };
    delete next[provider];
    persist({ ...settings, cloud_consent: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-gray-800">Live assistant</div>
          <div className="text-xs text-gray-500">Suggests questions while you record.</div>
        </div>
        <Switch checked={settings.enabled} onCheckedChange={(enabled) => persist({ ...settings, enabled })} disabled={!loaded} />
      </div>
      {modelConfig.model && (
        <div className={`flex items-center justify-between gap-2 rounded p-2 text-xs ${cloud ? 'bg-orange-50 text-orange-800' : 'bg-green-50 text-green-800'}`}>
          {cloud ? (
            <>
              <span>
                {consented
                  ? `The live transcript is sent to ${label} while you record.`
                  : `${label} runs online. Confirm before your live transcript leaves this computer.`}
              </span>
              {consented ? (
                <button type="button" className="shrink-0 underline" onClick={revokeConsent}>Revoke</button>
              ) : (
                <button type="button" className="shrink-0 underline" onClick={() => setConsentFor(provider)}>Confirm</button>
              )}
            </>
          ) : (
            <span>Runs on this device. Nothing leaves your computer.</span>
          )}
        </div>
      )}
      <AssistantConsentDialog provider={consentFor} onConfirm={confirmConsent} onCancel={() => setConsentFor(null)} />
    </div>
  );
}
