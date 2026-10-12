import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { AssistantSettings, LiveAssistantState, Suggestion } from '@/lib/live-assistant';

export interface AssistantErrorEvent {
  message: string | null;
}

export class AssistantService {
  async start(goal?: string | null): Promise<void> {
    return invoke('start_live_assistant', { goal: goal ?? null });
  }

  async refresh(): Promise<void> {
    return invoke('refresh_live_assistant');
  }

  async setPaused(paused: boolean): Promise<void> {
    return invoke('pause_live_assistant', { paused });
  }

  async setGoal(goal: string): Promise<void> {
    return invoke('set_live_assistant_goal', { goal });
  }

  async updateSuggestion(id: string, changes: { pinned?: boolean; dismissed?: boolean }): Promise<void> {
    return invoke('update_live_suggestion', {
      id,
      pinned: changes.pinned ?? null,
      dismissed: changes.dismissed ?? null,
    });
  }

  async getState(): Promise<LiveAssistantState> {
    return invoke<LiveAssistantState>('get_live_assistant_state');
  }

  async getSettings(): Promise<AssistantSettings> {
    return invoke<AssistantSettings>('api_get_assistant_settings');
  }

  async saveSettings(settings: AssistantSettings): Promise<void> {
    return invoke('api_save_assistant_settings', { settings });
  }

  async getMeetingSuggestions(meetingId: string): Promise<Suggestion[]> {
    return invoke<Suggestion[]>('api_get_meeting_suggestions', { meetingId });
  }

  async saveMeetingSuggestions(meetingId: string): Promise<number> {
    return invoke<number>('api_save_meeting_suggestions', { meetingId });
  }

  async importSnapshot(meetingId: string, folder: string): Promise<number> {
    return invoke<number>('api_import_assistant_snapshot', { meetingId, folder });
  }

  async onStatus(callback: (state: LiveAssistantState) => void): Promise<UnlistenFn> {
    return listen<LiveAssistantState>('assistant-status', (event) => callback(event.payload));
  }

  async onError(callback: (event: AssistantErrorEvent) => void): Promise<UnlistenFn> {
    return listen<AssistantErrorEvent>('assistant-error', (event) => callback(event.payload));
  }
}

export const assistantService = new AssistantService();
