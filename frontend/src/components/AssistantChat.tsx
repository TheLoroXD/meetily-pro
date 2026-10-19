'use client';

import { memo, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { splitCitations, type ChatMessage } from '@/lib/live-assistant';
import { SCROLL_TO_SEGMENT_EVENT } from '@/components/VirtualizedTranscriptView';

function scrollToSegment(atSeconds: number) {
  window.dispatchEvent(new CustomEvent(SCROLL_TO_SEGMENT_EVENT, { detail: { atSeconds } }));
}

export function ClockLink({ seconds, label, className }: { seconds: number; label: string; className: string }) {
  return (
    <button type="button" className={`font-mono ${className}`} onClick={() => scrollToSegment(seconds)} title="Show in transcript">
      {label}
    </button>
  );
}

const ChatBubble = memo(function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-blue-600 text-white px-3 py-2 text-sm whitespace-pre-wrap">{message.text}</div>
      </div>
    );
  }
  return (
    <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${message.error ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-800'}`}>
      {splitCitations(message.text).map((part, index) => ('clock' in part ? (
        <ClockLink key={index} seconds={part.seconds} label={`[${part.clock}]`} className="text-blue-600 hover:underline" />
      ) : (
        <span key={index}>{part.text}</span>
      )))}
    </div>
  );
});

interface ChatThreadProps {
  messages: ChatMessage[];
  pending: boolean;
  emptyHint: string;
  lead?: ReactNode;
}

export function ChatThread({ messages, pending, emptyHint, lead }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0 && !pending) return;
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, pending]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
      {lead}
      {messages.length === 0 && !pending && <p className="text-xs text-gray-500 text-center pt-2 px-2">{emptyHint}</p>}
      {messages.map((message) => <ChatBubble key={message.id} message={message} />)}
      {pending && <div className="w-fit rounded-lg bg-gray-100 text-gray-500 px-3 py-2 text-sm animate-pulse">Thinking...</div>}
      <div ref={endRef} />
    </div>
  );
}

interface ChatInputProps {
  placeholder: string;
  disabled: boolean;
  canSend: boolean;
  onSend: (question: string) => Promise<boolean>;
}

export function ChatInput({ placeholder, disabled, canSend, onSend }: ChatInputProps) {
  const [draft, setDraft] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !canSend) return;
    setDraft('');
    if (!(await onSend(text))) setDraft(text);
  };

  return (
    <form onSubmit={submit} className="p-3 border-t border-gray-200 flex items-center gap-2">
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-9 text-sm"
      />
      <Button type="submit" size="sm" className="h-9 px-3" disabled={!canSend || !draft.trim()} title="Send">
        <Send size={14} />
      </Button>
    </form>
  );
}
