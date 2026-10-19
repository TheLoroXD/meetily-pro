'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { ChatInput, ChatThread } from '@/components/AssistantChat';
import { SuggestionCard } from '@/components/SuggestionCard';
import { useMeetingChat } from '@/hooks/meeting-details/useMeetingChat';
import { useMeetingSuggestions } from '@/hooks/meeting-details/useMeetingSuggestions';
import type { SummaryStatus } from '@/hooks/meeting-details/useSummaryGeneration';
import { suggestionQuestion } from '@/lib/live-assistant';

interface MeetingAssistantPanelProps {
  meetingId: string;
  hasTranscript: boolean;
  summaryStatus: SummaryStatus;
  summaryError: string | null;
  hasModel: boolean;
  onRetrySummary: () => void;
}

export function MeetingAssistantPanel({ meetingId, hasTranscript, summaryStatus, summaryError, hasModel, onRetrySummary }: MeetingAssistantPanelProps) {
  const { messages, context, answering, ask, compact, reload } = useMeetingChat(meetingId);
  const { suggestions, dismiss } = useMeetingSuggestions(meetingId);
  const canAsk = hasTranscript && !answering;
  const writingSummary = summaryStatus === 'processing';

  const previousSummaryStatus = useRef(summaryStatus);
  useEffect(() => {
    if (previousSummaryStatus.current === 'processing' && summaryStatus === 'completed') void reload();
    previousSummaryStatus.current = summaryStatus;
  }, [summaryStatus, reload]);

  let summaryNote = null;
  if (summaryStatus === 'error') {
    summaryNote = (
      <div role="alert" className="w-fit max-w-[90%] rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {summaryError || 'The summary could not be written.'}{' '}
        <button type="button" className="underline" onClick={onRetrySummary}>Try again</button>
      </div>
    );
  } else if (!hasModel && hasTranscript) {
    summaryNote = (
      <p className="text-xs text-gray-500 text-center px-2">
        Pick an AI model in <Link href="/settings?tab=models" className="text-blue-600 underline">Settings, Models</Link> to get a summary.
      </p>
    );
  }

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <Sparkles size={16} className="text-blue-600" />
        <span className="text-sm font-semibold text-gray-800">Assistant</span>
      </div>
      <ChatThread
        messages={messages}
        pending={answering || writingSummary}
        lead={suggestions.length > 0 && (
          <div className="space-y-2 border-b border-gray-200 pb-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">From the call ({suggestions.length})</div>
            {suggestions.map((item) => (
              <SuggestionCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} onAsk={canAsk ? () => ask(suggestionQuestion(item)) : undefined} />
            ))}
          </div>
        )}
        trail={summaryNote}
        emptyHint={hasTranscript ? `Ask anything about this meeting, for example who owns what or a follow-up email.${suggestions.length > 0 ? ' Click a suggestion to look into it.' : ''}` : 'Questions work once the meeting has a transcript.'}
      />
      <ChatInput placeholder="Ask about this meeting" disabled={!hasTranscript} canSend={canAsk} onSend={ask} context={context} onCompact={compact} />
    </div>
  );
}
