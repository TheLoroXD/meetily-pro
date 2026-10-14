import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { assistantService } from '@/services/assistantService';
import type { ChatMessage } from '@/lib/live-assistant';

const ANSWER_POLL_MS = 2000;

export function useMeetingChat(meetingId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [answeringElsewhere, setAnsweringElsewhere] = useState(false);
  const currentMeeting = useRef(meetingId);
  currentMeeting.current = meetingId;

  const load = useCallback(async (id: string) => {
    try {
      const chat = await assistantService.getMeetingChat(id);
      if (currentMeeting.current !== id) return;
      setMessages(chat.messages);
      setAnsweringElsewhere(chat.answering);
    } catch (error) {
      console.warn('Failed to load meeting chat:', error);
    }
  }, []);

  useEffect(() => {
    setMessages([]);
    setAsking(false);
    setAnsweringElsewhere(false);
    void load(meetingId);
  }, [meetingId, load]);

  useEffect(() => {
    if (!answeringElsewhere) return;
    const timer = setInterval(() => void load(meetingId), ANSWER_POLL_MS);
    return () => clearInterval(timer);
  }, [answeringElsewhere, meetingId, load]);

  const ask = useCallback(async (question: string): Promise<boolean> => {
    const id = meetingId;
    const pending: ChatMessage = { id: 'pending', role: 'user', text: question, error: false };
    setMessages((previous) => [...previous, pending]);
    setAsking(true);
    try {
      const chat = await assistantService.askAboutMeeting(id, question);
      if (currentMeeting.current === id) setMessages(chat);
      return true;
    } catch (error) {
      if (currentMeeting.current === id) {
        setMessages((previous) => previous.filter((message) => message !== pending));
        toast.error('Could not send the question', { description: String(error) });
      }
      return false;
    } finally {
      if (currentMeeting.current === id) setAsking(false);
    }
  }, [meetingId]);

  return { messages, answering: asking || answeringElsewhere, ask };
}
