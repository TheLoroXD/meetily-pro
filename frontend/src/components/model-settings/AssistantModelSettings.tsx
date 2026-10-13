'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { useConfig } from '@/contexts/ConfigContext';
import { assistantService } from '@/services/assistantService';
import { AssistantConsentDialog } from '@/components/AssistantConsentDialog';
import { hasCloudConsent, isCloudProvider, withCloudConsent, type AssistantSettings } from '@/lib/live-assistant';
import { TEXT_PROVIDERS, catalogLabel, type Catalog, type ModelChoice } from '@/lib/model-catalog';
import { ModelPicker } from './ModelPicker';

interface AssistantModelSettingsProps {
  catalog: Catalog;
  onSetUp: () => void;
  settings: AssistantSettings;
  loaded: boolean;
  persist: (next: AssistantSettings) => Promise<void>;
}

export function AssistantModelSettings({ catalog, onSetUp, settings, loaded, persist }: AssistantModelSettingsProps) {
  const { modelConfig } = useConfig();
  const [consentFor, setConsentFor] = useState<string | null>(null);

  const sameAsSummary = !settings.provider;
  const effectiveProvider = settings.provider || modelConfig.provider;
  const label = catalogLabel(effectiveProvider);
  const cloud = isCloudProvider(effectiveProvider, modelConfig.ollamaEndpoint);
  const consented = !cloud || hasCloudConsent(settings, effectiveProvider);
  const summaryText = modelConfig.model ? `${catalogLabel(modelConfig.provider)} - ${modelConfig.model}` : 'no model yet';

  const pick = (choice: ModelChoice) => persist({ ...settings, provider: choice.provider, model: choice.model });

  const confirmConsent = async (provider: string) => {
    setConsentFor(null);
    await persist(withCloudConsent(settings, provider));
    assistantService.setPaused(false).catch(() => undefined);
  };

  const revokeConsent = () => {
    const next = { ...settings.cloud_consent };
    delete next[effectiveProvider];
    persist({ ...settings, cloud_consent: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-gray-700">Turn on the live assistant</span>
        <Switch checked={settings.enabled} onCheckedChange={(enabled) => persist({ ...settings, enabled })} disabled={!loaded} />
      </div>
      <ModelPicker
        catalog={catalog}
        providers={TEXT_PROVIDERS}
        value={sameAsSummary ? null : { provider: settings.provider ?? '', model: settings.model ?? '' }}
        extra={{ label: `Same as summary (${summaryText})`, selected: sameAsSummary, onSelect: () => persist({ ...settings, provider: null, model: null }) }}
        onChange={pick}
        emptyText="No AI model yet"
        setUpText="Set one up in Providers"
        onSetUp={onSetUp}
        disabled={!loaded}
      />
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
              <button type="button" className="shrink-0 underline" onClick={() => setConsentFor(effectiveProvider)}>Confirm</button>
            )}
          </>
        ) : (
          <span>Runs on this device. Nothing leaves your computer.</span>
        )}
      </div>
      <AssistantConsentDialog provider={consentFor} onConfirm={confirmConsent} onCancel={() => setConsentFor(null)} />
    </div>
  );
}
