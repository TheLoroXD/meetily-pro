import { useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useConfig } from '@/contexts/ConfigContext';
import { RecordingStatus, useRecordingState } from '@/contexts/RecordingStateContext';
import type { ModelConfig, TranscriptModelProps } from '@/services/configService';
import { catalogLabel, type ModelChoice } from '@/lib/model-catalog';

const IDLE_STATES = [RecordingStatus.IDLE, RecordingStatus.COMPLETED, RecordingStatus.ERROR];
export const VOICE_LOCKED_REASON = 'You can change this after the current recording is saved.';

export type ModelSelection = ReturnType<typeof useModelSelection>;

export function useModelSelection() {
  const { modelConfig, setModelConfig, transcriptModelConfig, setTranscriptModelConfig } = useConfig();
  const { isRecording, status } = useRecordingState();
  const latest = useRef(0);
  const confirmed = useRef<Pick<ModelConfig, 'provider' | 'model'> | null>(null);

  const chooseAiModel = async (choice: ModelChoice) => {
    const run = ++latest.current;
    confirmed.current ??= { provider: modelConfig.provider, model: modelConfig.model };
    const next = { provider: choice.provider as ModelConfig['provider'], model: choice.model };
    setModelConfig((prev) => ({ ...prev, ...next }));
    try {
      await invoke('api_save_ai_model', next);
      confirmed.current = next;
      if (run === latest.current) toast.success(`AI model: ${catalogLabel(choice.provider)} - ${choice.model}`);
    } catch (error) {
      if (run !== latest.current) return;
      const restore = confirmed.current;
      setModelConfig((prev) => ({ ...prev, ...restore }));
      toast.error('Could not save. Your previous choice is back.', { description: String(error) });
    }
  };

  const chooseVoiceModel = async (choice: ModelChoice) => {
    const previous = transcriptModelConfig;
    const next: TranscriptModelProps = { provider: choice.provider as TranscriptModelProps['provider'], model: choice.model, apiKey: null };
    setTranscriptModelConfig(next);
    try {
      await invoke('api_save_transcript_config', { provider: next.provider, model: next.model, apiKey: null });
      toast.success(`Voice model: ${catalogLabel(choice.provider)} - ${choice.model}`);
    } catch (error) {
      setTranscriptModelConfig(previous);
      toast.error('Could not save. Your previous choice is back.', { description: String(error) });
    }
  };

  return {
    ai: { provider: modelConfig.provider, model: modelConfig.model },
    voice: { provider: transcriptModelConfig.provider, model: transcriptModelConfig.model },
    chooseAiModel,
    chooseVoiceModel,
    voiceLocked: isRecording || !IDLE_STATES.includes(status),
  };
}
