'use client';

import { memo, useEffect, useRef, useState, type FormEvent } from 'react';
import { Copy, Pin, PinOff, Pause, Play, RefreshCw, Send, Sparkles, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useLiveAssistant } from '@/hooks/useLiveAssistant';
import { catalogLabel } from '@/lib/model-catalog';
import { KIND_META, describeAge, formatClock, hasCloudConsent, sortSuggestions, splitCitations, withCloudConsent, type AssistantSettings, type ChatMessage, type Suggestion } from '@/lib/live-assistant';
import { assistantService } from '@/services/assistantService';
import { SCROLL_TO_SEGMENT_EVENT } from '@/components/VirtualizedTranscriptView';
import { AssistantConsentDialog } from '@/components/AssistantConsentDialog';
import { toast } from 'sonner';

interface AssistantPanelProps {
  open: boolean;
  isRecording: boolean;
  onToggle: () => void;
}

function scrollToSegment(atSeconds: number) {
  window.dispatchEvent(new CustomEvent(SCROLL_TO_SEGMENT_EVENT, { detail: { atSeconds } }));
}

function ClockLink({ seconds, label, className }: { seconds: number; label: string; className: string }) {
  return (
    <button type="button" className={`font-mono ${className}`} onClick={() => scrollToSegment(seconds)} title="Show in transcript">
      {label}
    </button>
  );
}

function NextTickBar({ initial, generating, local }: { initial: number; generating: boolean; local: boolean }) {
  const [progress, setProgress] = useState(initial);

  useEffect(() => {
    setProgress(initial);
  }, [initial]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    assistantService.onProgress(setProgress).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    });
    assistantService.getState().then((current) => {
      if (!cancelled) setProgress(current.progress);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  let label = `Next tip ${progress}%`;
  if (generating) label = local ? 'Thinking... the transcript catches up after' : 'Thinking...';
  else if (progress >= 100) label = 'Waiting for a pause in speech';

  return (
    <div className="space-y-1" title="Fills as the conversation gives the assistant enough to work with">
      <Progress value={generating ? 100 : progress} className={`h-1.5 ${generating ? 'animate-pulse' : ''}`} />
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}

function ChatInput({ active, canSend, onSend }: { active: boolean; canSend: boolean; onSend: (question: string) => Promise<boolean> }) {
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
        placeholder={active ? 'Ask the assistant' : 'Start recording to chat'}
        disabled={!active}
        className="h-9 text-sm"
      />
      <Button type="submit" size="sm" className="h-9 px-3" disabled={!canSend || !draft.trim()} title="Send">
        <Send size={14} />
      </Button>
    </form>
  );
}

function SuggestionCard({ item, onPin, onDismiss, onAsk }: { item: Suggestion; onPin: (pinned: boolean) => void; onDismiss: () => void; onAsk?: () => void }) {
  const meta = KIND_META[item.kind];
  return (
    <div className={`rounded-lg border p-3 text-sm ${item.pinned ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'}`} title={item.why || undefined}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.badge}`}>{meta.label}</span>
          <ClockLink seconds={item.at_seconds} label={formatClock(item.at_seconds)} className="text-[11px] text-gray-500 hover:text-blue-600" />
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" className="p-1 text-gray-400 hover:text-gray-700" title="Copy" onClick={() => { navigator.clipboard?.writeText(item.text); toast.success('Copied'); }}>
            <Copy size={14} />
          </button>
          <button type="button" className="p-1 text-gray-400 hover:text-blue-600" title={item.pinned ? 'Unpin' : 'Pin'} onClick={() => onPin(!item.pinned)}>
            {item.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button type="button" className="p-1 text-gray-400 hover:text-red-600" title="Dismiss" onClick={onDismiss}>
            <X size={14} />
          </button>
        </div>
      </div>
      <button
        type="button"
        className="block w-full text-left text-gray-800 leading-snug enabled:hover:text-blue-700 disabled:cursor-default"
        onClick={onAsk}
        disabled={!onAsk}
        title={onAsk ? 'Ask the assistant about this' : undefined}
      >
        {item.text}
      </button>
      {item.why && <p className="text-xs text-gray-500 mt-1">{item.why}</p>}
    </div>
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

export const AssistantPanel = memo(function AssistantPanel({ open, isRecording, onToggle }: AssistantPanelProps) {
  const { state, pin, dismiss, refresh, setPaused, ask, start } = useLiveAssistant();
  const suggestions = state.suggestions;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [consentFor, setConsentFor] = useState<string | null>(null);
  const [, setClock] = useState(0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [state.chat.length, state.chat_pending, open]);

  useEffect(() => {
    if (!open) return;
    assistantService.getSettings().then(setSettings).catch(() => setSettings(null));
  }, [open, state.active]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setClock((n) => n + 1), 10_000);
    return () => clearInterval(interval);
  }, [open]);

  const openCount = suggestions.filter((item) => !item.dismissed).length;
  const enabled = settings?.enabled ?? null;

  if (!open) {
    return (
      <div className="w-10 border-l border-gray-200 bg-white flex flex-col items-center pt-3">
        <button type="button" onClick={onToggle} className="p-2 rounded-md text-gray-500 hover:bg-gray-100" title="Show assistant">
          <Sparkles size={18} className={state.active ? 'text-blue-600' : undefined} />
        </button>
        {openCount > 0 && <span className="mt-1 text-[10px] font-semibold text-blue-600">{openCount}</span>}
        <button type="button" onClick={onToggle} className="mt-auto mb-3 p-2 text-gray-400 hover:text-gray-700" title="Expand">
          <ChevronLeft size={16} />
        </button>
      </div>
    );
  }

  const visible = sortSuggestions(suggestions);
  const age = describeAge(state.last_tick_at);
  const generating = state.status === 'generating';
  const paused = state.status === 'paused';
  const errored = state.status === 'error';

  const needsConsent = state.active && state.is_cloud && settings !== null && !hasCloudConsent(settings, state.provider);

  const confirmConsent = async (provider: string) => {
    setConsentFor(null);
    if (!settings) return;
    const next = withCloudConsent(settings, provider);
    try {
      await assistantService.saveSettings(next);
      setSettings(next);
      if (paused || errored) await setPaused(false);
    } catch (error) {
      toast.error('Could not save assistant settings', { description: String(error) });
    }
  };

  const canChat = state.active && !state.chat_pending && !needsConsent;

  let emptyMessage: string | null = null;
  if (visible.length === 0) {
    if (!state.active && enabled === false) emptyMessage = 'Turn on the live assistant in Settings, Models.';
    else if (!state.active && !isRecording) emptyMessage = 'Suggestions appear here while you record.';
    else if (!state.active) emptyMessage = 'Assistant is not running for this recording.';
    else if (needsConsent) emptyMessage = 'Waiting for permission to send the transcript.';
    else if (paused) emptyMessage = 'Paused. Press play to resume suggestions.';
    else if (errored) emptyMessage = 'Suggestions stopped after an error.';
    else emptyMessage = generating ? 'Reading the conversation...' : 'Listening. Suggestions arrive after enough has been said.';
  }

  return (
    <div className="w-[320px] shrink-0 border-l border-gray-200 bg-white flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-600" />
            <span className="font-semibold text-sm text-gray-800">Assistant</span>
            {state.active && (
              <span className={`inline-block w-2 h-2 rounded-full ${generating ? 'bg-blue-500 animate-pulse' : paused || errored ? 'bg-orange-400' : 'bg-green-500'}`} />
            )}
          </div>
          <div className="flex items-center gap-1">
            {state.active && !needsConsent && (
              <>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={refresh} title="Suggest now" disabled={generating}>
                  <RefreshCw size={14} className={generating ? 'animate-spin' : undefined} />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setPaused(!paused && !errored)} title={paused || errored ? 'Resume' : 'Pause'}>
                  {paused || errored ? <Play size={14} /> : <Pause size={14} />}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onToggle} title="Collapse">
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
        {state.active && (
          <div className="flex items-center justify-between text-[11px]">
            <span className={`px-1.5 py-0.5 rounded ${state.is_cloud ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`} title={`${state.provider} / ${state.model}`}>
              {needsConsent ? 'Needs permission' : state.is_cloud ? `Sending to ${catalogLabel(state.provider)}` : 'On device'}
            </span>
            <span className={age.stale ? 'text-orange-600' : 'text-gray-500'}>{age.label}</span>
          </div>
        )}
        {state.active && !paused && !errored && !needsConsent && <NextTickBar initial={state.progress} generating={generating} local={!state.is_cloud} />}
        {needsConsent && (
          <div className="text-xs text-orange-800 bg-orange-50 rounded p-2 flex items-start justify-between gap-2">
            <span>{catalogLabel(state.provider)} is a cloud provider. Allow sending the live transcript to get suggestions.</span>
            <button type="button" className="underline shrink-0" onClick={() => setConsentFor(state.provider)}>Allow</button>
          </div>
        )}
        {state.error && !needsConsent && (
          <div className="text-xs text-red-700 bg-red-50 rounded p-2 flex items-start justify-between gap-2">
            <span>{state.error}</span>
            <button type="button" className="underline shrink-0" onClick={refresh}>Retry</button>
          </div>
        )}
      </div>
      <div className="max-h-[45%] shrink-0 overflow-y-auto p-3 space-y-2 border-b border-gray-200">
        {emptyMessage ? (
          <div className="text-xs text-gray-500 text-center pt-6 px-2">
            <p>{emptyMessage}</p>
            {enabled !== false && isRecording && !state.active && (
              <Button variant="outline" size="sm" className="mt-3" onClick={start}>Start assistant</Button>
            )}
          </div>
        ) : (
          visible.map((item) => (
            <SuggestionCard
              key={item.id}
              item={item}
              onPin={(pinned) => pin(item.id, pinned)}
              onDismiss={() => dismiss(item.id)}
              onAsk={canChat ? () => ask(item.text) : undefined}
            />
          ))
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {state.chat.length === 0 && !state.chat_pending && (
          <p className="text-xs text-gray-500 text-center pt-2 px-2">
            {state.active ? 'Ask anything about the conversation. Click a suggestion to ask about it.' : 'Chat works while a recording is running.'}
          </p>
        )}
        {state.chat.map((message) => <ChatBubble key={message.id} message={message} />)}
        {state.chat_pending && <div className="w-fit rounded-lg bg-gray-100 text-gray-500 px-3 py-2 text-sm animate-pulse">Thinking...</div>}
        <div ref={chatEndRef} />
      </div>
      <ChatInput active={state.active} canSend={canChat} onSend={ask} />
      <AssistantConsentDialog provider={consentFor} onConfirm={confirmConsent} onCancel={() => setConsentFor(null)} />
    </div>
  );
});
