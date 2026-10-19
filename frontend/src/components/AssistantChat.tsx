'use client';

import { memo, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { COMPACT_FROM_PERCENT, contextPercent, splitCitations, type ChatContext, type ChatMessage } from '@/lib/live-assistant';
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

function CitedText({ text }: { text: string }) {
  return (
    <>
      {splitCitations(text).map((part, index) => ('clock' in part ? (
        <ClockLink key={index} seconds={part.seconds} label={`[${part.clock}]`} className="text-blue-600 hover:underline" />
      ) : (
        <span key={index}>{part.text}</span>
      )))}
    </>
  );
}

const ChatBubble = memo(function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] max-h-64 overflow-y-auto rounded-lg bg-blue-600 text-white px-3 py-2 text-sm whitespace-pre-wrap break-words">{message.text}</div>
      </div>
    );
  }
  if (message.role === 'summary') {
    return (
      <details className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500">
        <summary className="cursor-pointer select-none">Chat compacted. The assistant keeps this summary of the messages above.</summary>
        <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap"><CitedText text={message.text} /></div>
      </details>
    );
  }
  return (
    <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${message.error ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-800'}`}>
      <CitedText text={message.text} />
    </div>
  );
}, (previous, next) => (
  previous.message.id === next.message.id
  && previous.message.role === next.message.role
  && previous.message.text === next.message.text
  && previous.message.error === next.message.error
));

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

function Speedometer({ percent }: { percent: number }) {
  const shown = Math.min(percent, 100);
  const angle = Math.PI * (1 - shown / 100);
  const color = percent >= 80 ? 'text-red-500' : percent >= COMPACT_FROM_PERCENT ? 'text-amber-500' : 'text-green-500';
  return (
    <svg width="28" height="16" viewBox="0 0 28 16" className={color} aria-hidden>
      <path d="M4 14 A10 10 0 0 1 24 14" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-gray-200" />
      <path d="M4 14 A10 10 0 0 1 24 14" fill="none" strokeWidth="3" strokeLinecap="round" stroke="currentColor" pathLength={100} strokeDasharray={`${shown} 100`} />
      <line x1="14" y1="14" x2={14 + 8 * Math.cos(angle)} y2={14 - 8 * Math.sin(angle)} strokeWidth="1.5" strokeLinecap="round" className="stroke-gray-700" />
      <circle cx="14" cy="14" r="1.5" className="fill-gray-700" />
    </svg>
  );
}

interface ContextMeterProps {
  context: ChatContext;
  busy: boolean;
  onCompact: () => void;
}

function ContextMeter({ context, busy, onCompact }: ContextMeterProps) {
  const percent = contextPercent(context);
  const full = percent > 100;
  return (
    <div className="flex items-center gap-2 text-[11px] text-gray-500">
      <span className="flex items-center gap-1.5" title="How much of the chat the assistant keeps in mind. Past 100% it forgets the oldest messages; compact to keep their gist.">
        <Speedometer percent={percent} />
        Context {percent}%{full && ', oldest messages forgotten'}
      </span>
      {percent > COMPACT_FROM_PERCENT && (
        <Button type="button" variant="outline" size="sm" className="ml-auto h-6 px-2 text-[11px]" disabled={busy} onClick={onCompact} title="Replace the chat so far with a short summary the assistant keeps">
          Compact
        </Button>
      )}
    </div>
  );
}

interface ChatInputProps {
  placeholder: string;
  disabled: boolean;
  canSend: boolean;
  onSend: (question: string) => Promise<boolean>;
  context?: ChatContext | null;
  onCompact?: () => void;
}

const MAX_INPUT_HEIGHT = 160;

export function ChatInput({ placeholder, disabled, canSend, onSend, context, onCompact }: ChatInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [draft]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || !canSend) return;
    setDraft('');
    if (!(await onSend(text))) setDraft(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  };

  return (
    <form onSubmit={submit} className="p-3 border-t border-gray-200 space-y-2">
      {context && context.used > 0 && onCompact && <ContextMeter context={context} busy={!canSend} onCompact={onCompact} />}
      <div className="flex items-end gap-2">
        <Textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-9 resize-none py-2 text-sm"
          style={{ maxHeight: MAX_INPUT_HEIGHT }}
        />
        <Button type="submit" size="sm" className="h-9 px-3" disabled={!canSend || !draft.trim()} title="Send (Shift+Enter for a new line)">
          <Send size={14} />
        </Button>
      </div>
    </form>
  );
}
