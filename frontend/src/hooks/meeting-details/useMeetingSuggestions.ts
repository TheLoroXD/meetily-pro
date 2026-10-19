import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { assistantService } from '@/services/assistantService';
import { sortSuggestions, type Suggestion } from '@/lib/live-assistant';

export function useMeetingSuggestions(meetingId: string) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const currentMeeting = useRef(meetingId);
  currentMeeting.current = meetingId;

  useEffect(() => {
    setSuggestions([]);
    assistantService.getMeetingSuggestions(meetingId)
      .then((items) => {
        if (currentMeeting.current === meetingId) setSuggestions(sortSuggestions(items));
      })
      .catch((error) => console.warn('Failed to load meeting suggestions:', error));
  }, [meetingId]);

  const dismiss = useCallback(async (id: string) => {
    const meeting = currentMeeting.current;
    setSuggestions((items) => items.filter((item) => item.id !== id));
    try {
      await assistantService.dismissMeetingSuggestion(meeting, id);
    } catch (error) {
      toast.error('Could not close the suggestion', { description: String(error) });
      const items = await assistantService.getMeetingSuggestions(meeting).catch(() => null);
      if (items && currentMeeting.current === meeting) setSuggestions(sortSuggestions(items));
    }
  }, []);

  return { suggestions, dismiss };
}
