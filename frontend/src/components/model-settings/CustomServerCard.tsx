'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfig } from '@/contexts/ConfigContext';
import { configService } from '@/services/configService';

interface CustomServerCardProps {
  onSaved: (model: string) => void;
}

function numberOrNull(value: string): number | null {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}

export function CustomServerCard({ onSaved }: CustomServerCardProps) {
  const { setModelConfig } = useConfig();
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [maxTokens, setMaxTokens] = useState('');
  const [temperature, setTemperature] = useState('');
  const [topP, setTopP] = useState('');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    configService.getCustomOpenAIConfig()
      .then((config) => {
        if (!config) return;
        setEndpoint(config.endpoint);
        setApiKey(config.apiKey ?? '');
        setModel(config.model);
        setMaxTokens(config.maxTokens?.toString() ?? '');
        setTemperature(config.temperature?.toString() ?? '');
        setTopP(config.topP?.toString() ?? '');
      })
      .catch((error) => console.warn('Failed to load the custom server config:', error));
  }, []);

  const ready = endpoint.trim() && model.trim();

  const test = async () => {
    setBusy(true);
    try {
      const result = await configService.testCustomOpenAIConnection(endpoint.trim(), apiKey.trim() || null, model.trim());
      toast.success(result.message || 'The server answered.');
    } catch (error) {
      toast.error('Could not reach the server. Check the address and key.', { description: String(error) });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const nextModel = model.trim();
      await configService.saveCustomOpenAIConfig({
        endpoint: endpoint.trim(),
        apiKey: apiKey.trim() || null,
        model: nextModel,
        maxTokens: numberOrNull(maxTokens),
        temperature: numberOrNull(temperature),
        topP: numberOrNull(topP),
      });
      setModelConfig((prev) => (prev.provider === 'custom-openai' ? { ...prev, model: nextModel } : prev));
      toast.success('Custom server saved');
      onSaved(nextModel);
    } catch (error) {
      toast.error('Could not save the custom server', { description: String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-gray-700">Address</label>
          <Input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="http://localhost:8000/v1" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">Model name</label>
          <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="llama-3.1-8b-instruct" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">API key (optional)</label>
          <Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Only if the server needs one" />
        </div>
      </div>
      <button type="button" className="text-xs text-blue-600 underline" onClick={() => setMore(!more)}>{more ? 'Fewer options' : 'More options'}</button>
      {more && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Max tokens</label>
            <Input type="number" value={maxTokens} onChange={(event) => setMaxTokens(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Temperature</label>
            <Input type="number" step="0.1" value={temperature} onChange={(event) => setTemperature(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Top P</label>
            <Input type="number" step="0.05" value={topP} onChange={(event) => setTopP(event.target.value)} />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy || !ready}>Save</Button>
        <Button variant="outline" onClick={test} disabled={busy || !ready}>Test connection</Button>
      </div>
    </div>
  );
}
