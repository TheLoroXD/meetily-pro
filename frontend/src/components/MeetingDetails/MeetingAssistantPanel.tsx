'use client';

import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatInput, ChatThread } from '@/components/AssistantChat';
import { SuggestionCard } from '@/components/SuggestionCard';
import { useMeetingChat } from '@/hooks/meeting-details/useMeetingChat';
import { useMeetingSuggestions } from '@/hooks/meeting-details/useMeetingSuggestions';
import { suggestionQuestion } from '@/lib/live-assistant';

interface MeetingAssistantPanelProps {
  meetingId: string;
  hasTranscript: boolean;
  summary: ReactNode;
}

export function MeetingAssistantPanel({ meetingId, hasTranscript, summary }: MeetingAssistantPanelProps) {
  const { messages, context, answering, ask, compact } = useMeetingChat(meetingId);
  const { suggestions, dismiss } = useMeetingSuggestions(meetingId);
  const canAsk = hasTranscript && !answering;

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
        lead={suggestions.length > 0 && (
          <div className="space-y-2 border-b border-gray-200 pb-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">From the call ({suggestions.length})</div>
            {suggestions.map((item) => (
              <SuggestionCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} onAsk={canAsk ? () => ask(suggestionQuestion(item)) : undefined} />
            ))}
          </div>
        )}
        emptyHint={hasTranscript ? `Ask anything about this meeting, for example who owns what or a follow-up email.${suggestions.length > 0 ? ' Click a suggestion to look into it.' : ''}` : 'Questions work once the meeting has a transcript.'}
      />
      <ChatInput placeholder="Ask about this meeting" disabled={!hasTranscript} canSend={canAsk} onSend={ask} context={context} onCompact={compact} />
    </div>
  );
}
