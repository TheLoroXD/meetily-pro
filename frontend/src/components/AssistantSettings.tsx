'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfig } from '@/contexts/ConfigContext';
import { assistantService } from '@/services/assistantService';
import { AssistantConsentDialog } from '@/components/AssistantConsentDialog';
import { PROVIDERS, isCloudProvider, providerLabel, type AssistantSettings as Settings } from '@/lib/live-assistant';

const SAME_AS_SUMMARY = '__same__';

const DEFAULT_SETTINGS: Settings = { enabled: false, provider: null, model: null, cloud_consent: {}, last_goal: '' };

export function AssistantSettings() {
  const { modelConfig, modelOptions } = useConfig();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [consentFor, setConsentFor] = useState<string | null>(null);

  useEffect(() => {
    assistantService.getSettings()
      .then((loadedSettings) => setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings }))
      .catch((error) => console.warn('Failed to load assistant settings:', error))
      .finally(() => setLoaded(true));
  }, []);

  const effectiveProvider = settings.provider || modelConfig.provider;
  const effectiveModel = settings.provider ? settings.model || '' : modelConfig.model;
  const cloud = isCloudProvider(effectiveProvider, modelConfig.ollamaEndpoint);
  const consented = !cloud || settings.cloud_consent[effectiveProvider] === true;

  const persist = async (next: Settings) => {
    setSettings(next);
    try {
      await assistantService.saveSettings(next);
    } catch (error) {
      toast.error('Could not save assistant settings', { description: String(error) });
    }
  };

  const handleEnable = (enabled: boolean) => {
    if (enabled && cloud && !consented) {
      setConsentFor(effectiveProvider);
      return;
    }
    persist({ ...settings, enabled });
  };

  const handleProvider = (value: string) => {
    if (value === SAME_AS_SUMMARY) {
      persist({ ...settings, provider: null, model: null });
      return;
    }
    const models = modelOptions[value as keyof typeof modelOptions] ?? [];
    persist({ ...settings, provider: value, model: models[0] ?? settings.model ?? '' });
  };

  const handleModel = (value: string) => persist({ ...settings, model: value });

  const confirmConsent = (provider: string) => {
    setConsentFor(null);
    persist({ ...settings, enabled: true, cloud_consent: { ...settings.cloud_consent, [provider]: true } });
  };

  const revokeConsent = () => {
    const next = { ...settings.cloud_consent };
    delete next[effectiveProvider];
    persist({ ...settings, enabled: false, cloud_consent: next });
  };

  const modelChoices = settings.provider ? (modelOptions[settings.provider as keyof typeof modelOptions] ?? []) : [];

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Live assistant</h3>
          <p className="text-xs text-gray-500 mt-1">
            Suggests questions to ask and facts to clarify while you record, each tied to a moment in the transcript.
          </p>
        </div>
        <Switch checked={settings.enabled} onCheckedChange={handleEnable} disabled={!loaded} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Provider</label>
          <Select value={settings.provider ?? SAME_AS_SUMMARY} onValueChange={handleProvider}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SAME_AS_SUMMARY}>Same as summary ({providerLabel(modelConfig.provider)})</SelectItem>
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider} value={provider}>{providerLabel(provider)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Model</label>
          {settings.provider ? (
            <>
              <Input list="assistant-model-choices" value={settings.model ?? ''} onChange={(event) => setSettings({ ...settings, model: event.target.value })} onBlur={() => handleModel((settings.model ?? '').trim())} placeholder="model name" className="h-9 text-sm" />
              <datalist id="assistant-model-choices">
                {modelChoices.map((model) => <option key={model} value={model} />)}
              </datalist>
            </>
          ) : (
            <Input value={effectiveModel} disabled className="h-9 text-sm" />
          )}
        </div>
      </div>

      <div className={`text-xs rounded p-2 flex items-center justify-between gap-2 ${cloud ? 'bg-orange-50 text-orange-800' : 'bg-green-50 text-green-800'}`}>
        {cloud ? (
          <>
            <span>
              {consented
                ? `Live transcript will be sent to ${providerLabel(effectiveProvider)} while recording.`
                : `${providerLabel(effectiveProvider)} is a cloud provider. Confirm before the live transcript can leave this computer.`}
            </span>
            {consented ? (
              <button type="button" className="underline shrink-0" onClick={revokeConsent}>Revoke</button>
            ) : (
              <button type="button" className="underline shrink-0" onClick={() => setConsentFor(effectiveProvider)}>Confirm</button>
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
