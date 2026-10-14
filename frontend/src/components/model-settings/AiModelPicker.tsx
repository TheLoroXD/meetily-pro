'use client';

import { useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useConfig } from '@/contexts/ConfigContext';
import type { ModelConfig } from '@/services/configService';
import { TEXT_PROVIDERS, type Catalog, type ModelChoice } from '@/lib/model-catalog';
import { ModelPicker } from './ModelPicker';

interface AiModelPickerProps {
  catalog: Catalog;
  onSetUp: () => void;
}

export function AiModelPicker({ catalog, onSetUp }: AiModelPickerProps) {
  const { modelConfig, setModelConfig } = useConfig();
  const latest = useRef(0);
  const confirmed = useRef<Pick<ModelConfig, 'provider' | 'model'> | null>(null);

  const save = async (choice: ModelChoice) => {
    const run = ++latest.current;
    confirmed.current ??= { provider: modelConfig.provider, model: modelConfig.model };
    const next = { provider: choice.provider as ModelConfig['provider'], model: choice.model };
    setModelConfig((prev) => ({ ...prev, ...next }));
    try {
      await invoke('api_save_ai_model', next);
      confirmed.current = next;
      if (run === latest.current) toast.success('AI model saved');
    } catch (error) {
      if (run !== latest.current) return;
      const restore = confirmed.current;
      setModelConfig((prev) => ({ ...prev, ...restore }));
      toast.error('Could not save. Your previous choice is back.', { description: String(error) });
    }
  };

  return (
    <ModelPicker
      catalog={catalog}
      providers={TEXT_PROVIDERS}
      value={{ provider: modelConfig.provider, model: modelConfig.model }}
      onChange={save}
      emptyText="No AI model yet"
      setUpText="Set one up in Providers"
      onSetUp={onSetUp}
    />
  );
}
