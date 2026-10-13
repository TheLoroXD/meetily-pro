'use client';

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useConfig } from '@/contexts/ConfigContext';
import { RecordingStatus, useRecordingState } from '@/contexts/RecordingStateContext';
import type { TranscriptModelProps } from '@/services/configService';
import { SPEECH_PROVIDERS, type Catalog, type ModelChoice } from '@/lib/model-catalog';
import { ModelPicker } from './ModelPicker';

const IDLE_STATES = [RecordingStatus.IDLE, RecordingStatus.COMPLETED, RecordingStatus.ERROR];

interface VoiceModelPickerProps {
  catalog: Catalog;
  onSetUp: () => void;
}

export function VoiceModelPicker({ catalog, onSetUp }: VoiceModelPickerProps) {
  const { transcriptModelConfig, setTranscriptModelConfig } = useConfig();
  const { isRecording, status } = useRecordingState();
  const busy = isRecording || !IDLE_STATES.includes(status);

  const save = async (choice: ModelChoice) => {
    const previous = transcriptModelConfig;
    const next: TranscriptModelProps = { provider: choice.provider as TranscriptModelProps['provider'], model: choice.model, apiKey: null };
    setTranscriptModelConfig(next);
    try {
      await invoke('api_save_transcript_config', { provider: next.provider, model: next.model, apiKey: null });
      toast.success('Voice transcript model saved');
    } catch (error) {
      setTranscriptModelConfig(previous);
      toast.error('Could not save. Your previous choice is back.', { description: String(error) });
    }
  };

  return (
    <ModelPicker
      catalog={catalog}
      providers={SPEECH_PROVIDERS}
      value={{ provider: transcriptModelConfig.provider, model: transcriptModelConfig.model }}
      onChange={save}
      emptyText="No speech model yet"
      setUpText="Download one in Providers"
      onSetUp={onSetUp}
      disabled={busy}
      disabledReason="You can change this after the current recording is saved."
    />
  );
}
