import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { assistantService } from '@/services/assistantService';
import type { AssistantSettings } from '@/lib/live-assistant';

const DEFAULT_SETTINGS: AssistantSettings = { enabled: true, cloud_consent: {} };

export function useAssistantSettings() {
  const [settings, setSettings] = useState<AssistantSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const current = useRef(settings);
  current.current = settings;

  useEffect(() => {
    assistantService.getSettings()
      .then((stored) => setSettings({ ...DEFAULT_SETTINGS, ...stored }))
      .catch((error) => console.warn('Failed to load assistant settings:', error))
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback(async (next: AssistantSettings) => {
    const previous = current.current;
    setSettings(next);
    try {
      await assistantService.saveSettings(next);
    } catch (error) {
      setSettings(previous);
      toast.error('Could not save. Your previous choice is back.', { description: String(error) });
    }
  }, []);

  return { settings, loaded, persist };
}
