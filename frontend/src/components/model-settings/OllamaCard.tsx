'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Download, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfig } from '@/contexts/ConfigContext';
import { useOllamaDownload } from '@/contexts/OllamaDownloadContext';
import { isOllamaNotInstalledError } from '@/lib/utils';
import type { ProviderState } from '@/lib/model-catalog';

const DEFAULT_ENDPOINT = 'http://localhost:11434';

interface OllamaCardProps {
  state: ProviderState | undefined;
  onChanged: () => void;
}

export function OllamaCard({ state, onChanged }: OllamaCardProps) {
  const { modelConfig, setModelConfig } = useConfig();
  const { downloadingModels, isDownloading, getProgress } = useOllamaDownload();
  const saved = modelConfig.ollamaEndpoint || '';
  const [address, setAddress] = useState(saved);
  const [pullName, setPullName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setAddress(saved), [saved]);

  const endpoint = saved || null;
  const dirty = address.trim().replace(/\/+$/, '') !== saved;

  const saveAddress = async () => {
    setBusy(true);
    try {
      const value = address.trim().replace(/\/+$/, '') || null;
      await invoke('api_save_ollama_endpoint', { endpoint: value });
      setModelConfig((prev) => ({ ...prev, ollamaEndpoint: value }));
      if ((value ?? '') === saved) onChanged();
    } catch (error) {
      toast.error('Could not save the address', { description: String(error) });
    } finally {
      setBusy(false);
    }
  };

  const pull = async () => {
    const name = pullName.trim();
    if (!name || isDownloading(name)) return;
    try {
      setPullName('');
      await invoke('pull_ollama_model', { modelName: name, endpoint });
    } catch (error) {
      if (isOllamaNotInstalledError(String(error))) toast.error('Ollama is not running at this address.');
    }
  };

  const remove = async (name: string) => {
    try {
      await invoke('delete_ollama_model', { modelName: name, endpoint });
      toast.success(`${name} deleted`);
      onChanged();
    } catch (error) {
      toast.error(`Could not delete ${name}`, { description: String(error) });
    }
  };

  const models = state?.status === 'ready' ? state.models : [];
  const unreachable = state?.status === 'error';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700">Address</label>
        <div className="flex gap-2">
          <Input value={address} onChange={(event) => setAddress(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveAddress(); }} placeholder={DEFAULT_ENDPOINT} />
          <Button variant="outline" onClick={saveAddress} disabled={busy}>{dirty ? 'Save and check' : 'Check again'}</Button>
        </div>
        <p className="text-xs text-gray-500">Leave empty for Ollama on this computer.</p>
      </div>

      {unreachable && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
          <span>Could not reach Ollama at {saved || DEFAULT_ENDPOINT}. Is it running?</span>
          <Button size="sm" variant="outline" onClick={() => invoke('open_external_url', { url: 'https://ollama.com/download' })}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Get Ollama
          </Button>
        </div>
      )}

      {!unreachable && (
        <>
          {models.length > 0 && (
            <ul className="divide-y rounded-md border">
              {models.map((name) => (
                <li key={name} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-mono">{name}</span>
                  <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => remove(name)} aria-label={`Delete ${name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Get a model</label>
            <div className="flex gap-2">
              <Input value={pullName} onChange={(event) => setPullName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') pull(); }} placeholder="gemma3:1b" />
              <Button variant="outline" onClick={pull} disabled={!pullName.trim() || isDownloading(pullName.trim())}>
                <Download className="mr-1.5 h-4 w-4" />Download
              </Button>
            </div>
            {[...downloadingModels].map((name) => (
              <div key={name} className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-blue-700">
                  <span>Downloading {name}</span>
                  <span>{Math.round(getProgress(name) ?? 0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full bg-blue-600 transition-all" style={{ width: `${getProgress(name) ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
