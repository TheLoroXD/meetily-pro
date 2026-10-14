'use client';

import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatInput, ChatThread } from '@/components/AssistantChat';
import { useMeetingChat } from '@/hooks/meeting-details/useMeetingChat';

interface MeetingAssistantPanelProps {
  meetingId: string;
  hasTranscript: boolean;
  summary: ReactNode;
}

export function MeetingAssistantPanel({ meetingId, hasTranscript, summary }: MeetingAssistantPanelProps) {
  const { messages, answering, ask } = useMeetingChat(meetingId);

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <Sparkles size={16} className="text-blue-600" />
        <span className="text-sm font-semibold text-gray-800">Assistant</span>
      </div>
      <div className="shrink-0 border-b border-gray-200 p-3">{summary}</div>
      <ChatThread
        messages={messages}
        pending={answering}
        emptyHint={hasTranscript ? 'Ask anything about this meeting, for example who owns what or a follow-up email.' : 'Questions work once the meeting has a transcript.'}
      />
      <ChatInput placeholder="Ask about this meeting" disabled={!hasTranscript} canSend={hasTranscript && !answering} onSend={ask} />
    </div>
  );
}
