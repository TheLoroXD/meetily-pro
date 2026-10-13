'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfig } from '@/contexts/ConfigContext';
import { assistantService } from '@/services/assistantService';
import { configService } from '@/services/configService';
import { AssistantConsentDialog } from '@/components/AssistantConsentDialog';
import { BuiltInAIAPI, isModelAvailable } from '@/lib/builtin-ai';
import { PROVIDERS, hasCloudConsent, isCloudProvider, providerLabel, withCloudConsent, type AssistantSettings as Settings } from '@/lib/live-assistant';

const DEFAULT_SETTINGS: Settings = { enabled: true, provider: null, model: null, cloud_consent: {} };
const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

export function AssistantSettings() {
  const { modelConfig, modelOptions, providerApiKeys } = useConfig();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [consentFor, setConsentFor] = useState<string | null>(null);
  const [builtinModels, setBuiltinModels] = useState<string[] | null>(null);
  const [customServer, setCustomServer] = useState<{ endpoint: string; model: string } | null | undefined>(undefined);

  useEffect(() => {
    assistantService.getSettings()
      .then((loadedSettings) => setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings }))
      .catch((error) => console.warn('Failed to load assistant settings:', error))
      .finally(() => setLoaded(true));
  }, []);

  const sameAsSummary = !settings.provider;
  const effectiveProvider = settings.provider || modelConfig.provider;
  const effectiveModel = settings.provider ? settings.model || '' : modelConfig.model;
  const cloud = isCloudProvider(effectiveProvider, modelConfig.ollamaEndpoint);
  const consented = !cloud || hasCloudConsent(settings, effectiveProvider);

  const loadBuiltinModels = useCallback(() => {
    BuiltInAIAPI.listModels()
      .then((models) => setBuiltinModels(models.filter((m) => isModelAvailable(m.status)).map((m) => m.name)))
      .catch((error) => console.warn('Failed to list built-in models:', error));
  }, []);

  useEffect(() => {
    if (effectiveProvider === 'builtin-ai') loadBuiltinModels();
  }, [effectiveProvider, loadBuiltinModels]);

  useEffect(() => {
    if (effectiveProvider !== 'custom-openai') return;
    configService.getCustomOpenAIConfig()
      .then((config) => setCustomServer(config ? { endpoint: config.endpoint, model: config.model } : null))
      .catch((error) => {
        console.warn('Failed to load the custom server config:', error);
        setCustomServer(null);
      });
  }, [effectiveProvider]);

  const persist = async (next: Settings) => {
    const previous = settings;
    setSettings(next);
    try {
      await assistantService.saveSettings(next);
    } catch (error) {
      setSettings(previous);
      toast.error('Could not save assistant settings', { description: String(error) });
    }
  };

  const modelChoices = (provider: string): string[] => {
    if (provider === 'builtin-ai') return builtinModels ?? [];
    if (provider === 'custom-openai') return customServer?.model ? [customServer.model] : [];
    return modelOptions[provider as keyof typeof modelOptions] ?? [];
  };

  const handleEnable = (enabled: boolean) => persist({ ...settings, enabled });

  const handleSameAsSummary = (same: boolean) => {
    if (same) persist({ ...settings, provider: null, model: null });
    else persist({ ...settings, provider: modelConfig.provider, model: modelConfig.model });
  };

  const handleProvider = (provider: string) => {
    const model = provider === modelConfig.provider ? modelConfig.model : modelChoices(provider)[0] ?? '';
    persist({ ...settings, provider, model });
  };

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

  const label = providerLabel(effectiveProvider);
  let source: { text: string; missing: boolean };
  if (effectiveProvider === 'builtin-ai') {
    source = builtinModels === null || builtinModels.length > 0
      ? { text: 'Runs the built-in model on this device.', missing: false }
      : { text: 'No built-in model downloaded yet. Download one in the summary model settings.', missing: true };
  } else if (effectiveProvider === 'ollama') {
    source = { text: `Ollama at ${modelConfig.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT}, set in the summary model settings.`, missing: false };
  } else if (effectiveProvider === 'custom-openai') {
    if (customServer === undefined) source = { text: 'Loading the custom server settings...', missing: false };
    else if (customServer === null) source = { text: 'No custom server yet. Set it up in the summary model settings.', missing: true };
    else source = { text: `Custom server ${customServer.endpoint} with its key, set in the summary model settings.`, missing: false };
  } else {
    const hasKey = !!providerApiKeys[effectiveProvider as keyof typeof providerApiKeys]?.trim();
    source = hasKey
      ? { text: `Uses your ${label} API key from the summary model settings.`, missing: false }
      : { text: `No ${label} API key saved. Add it in the summary model settings first.`, missing: true };
  }

  if (!sameAsSummary && !effectiveModel.trim() && !source.missing) {
    source = { text: 'Pick a model for the live assistant.', missing: true };
  }

  const choices = modelChoices(effectiveProvider);
  const pickFromList = effectiveProvider === 'builtin-ai' || (effectiveProvider === 'ollama' && choices.length > 0);

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Live assistant</h3>
          <p className="text-xs text-gray-500 mt-1">
            Suggests questions to ask and facts to clarify while you record, and answers questions about the call so far.
          </p>
        </div>
        <Switch checked={settings.enabled} onCheckedChange={handleEnable} disabled={!loaded} />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input type="checkbox" checked={sameAsSummary} onChange={(event) => handleSameAsSummary(event.target.checked)} disabled={!loaded} />
        Same as summary model
        {sameAsSummary && <span className="text-xs text-gray-500">({providerLabel(modelConfig.provider)}, {modelConfig.model || 'no model'})</span>}
      </label>

      {!sameAsSummary && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Provider</label>
            <Select value={effectiveProvider} onValueChange={handleProvider}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((provider) => (
                  <SelectItem key={provider} value={provider}>{providerLabel(provider)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Model</label>
            {pickFromList ? (
              <Select value={effectiveModel} onValueChange={(model) => persist({ ...settings, model })} onOpenChange={(open) => { if (open && effectiveProvider === 'builtin-ai') loadBuiltinModels(); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pick a model" /></SelectTrigger>
                <SelectContent>
                  {choices.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input list="assistant-model-choices" value={settings.model ?? ''} onChange={(event) => setSettings({ ...settings, model: event.target.value })} onBlur={() => persist({ ...settings, model: (settings.model ?? '').trim() })} placeholder="model name" className="h-9 text-sm" />
                <datalist id="assistant-model-choices">
                  {choices.map((model) => <option key={model} value={model} />)}
                </datalist>
              </>
            )}
          </div>
        </div>
      )}

      <p className={`text-xs ${source.missing ? 'text-red-700' : 'text-gray-500'}`}>{source.text}</p>

      <div className={`text-xs rounded p-2 flex items-center justify-between gap-2 ${cloud ? 'bg-orange-50 text-orange-800' : 'bg-green-50 text-green-800'}`}>
        {cloud ? (
          <>
            <span>
              {consented
                ? `Live transcript will be sent to ${label} while recording.`
                : `${label} is a cloud provider. Confirm before the live transcript can leave this computer.`}
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
