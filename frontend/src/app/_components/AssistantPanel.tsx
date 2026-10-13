'use client';

import { memo, useEffect, useState } from 'react';
import { Copy, Pin, PinOff, Pause, Play, RefreshCw, Sparkles, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLiveAssistant } from '@/hooks/useLiveAssistant';
import { KIND_META, describeAge, formatClock, providerLabel, sortSuggestions, type Suggestion } from '@/lib/live-assistant';
import { assistantService } from '@/services/assistantService';
import { SCROLL_TO_SEGMENT_EVENT } from '@/components/VirtualizedTranscriptView';
import { toast } from 'sonner';

interface AssistantPanelProps {
  open: boolean;
  isRecording: boolean;
  onToggle: () => void;
}

function scrollToSegment(atSeconds: number) {
  window.dispatchEvent(new CustomEvent(SCROLL_TO_SEGMENT_EVENT, { detail: { atSeconds } }));
}

function SuggestionCard({ item, onPin, onDismiss }: { item: Suggestion; onPin: (pinned: boolean) => void; onDismiss: () => void }) {
  const meta = KIND_META[item.kind];
  return (
    <div className={`rounded-lg border p-3 text-sm ${item.pinned ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'}`} title={item.why || undefined}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.badge}`}>{meta.label}</span>
          <button
            type="button"
            className="text-[11px] text-gray-500 hover:text-blue-600 font-mono"
            onClick={() => scrollToSegment(item.at_seconds)}
            title="Show in transcript"
          >
            {formatClock(item.at_seconds)}
          </button>
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
      <p className="text-gray-800 leading-snug">{item.text}</p>
      {item.why && <p className="text-xs text-gray-500 mt-1">{item.why}</p>}
    </div>
  );
}

export const AssistantPanel = memo(function AssistantPanel({ open, isRecording, onToggle }: AssistantPanelProps) {
  const { state, pin, dismiss, refresh, setPaused, setGoal, start } = useLiveAssistant();
  const suggestions = state.suggestions;
  const [goalDraft, setGoalDraft] = useState(state.goal);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [, setClock] = useState(0);

  useEffect(() => {
    setGoalDraft(state.goal);
  }, [state.goal]);

  useEffect(() => {
    if (!open) return;
    assistantService.getSettings().then((settings) => setEnabled(settings.enabled)).catch(() => setEnabled(null));
  }, [open, state.active]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setClock((n) => n + 1), 10_000);
    return () => clearInterval(interval);
  }, [open]);

  const openCount = suggestions.filter((item) => !item.dismissed).length;

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

  const commitGoal = () => {
    const goal = goalDraft.trim();
    if (goal !== state.goal) setGoal(goal);
  };

  let emptyMessage: string | null = null;
  if (!state.active && enabled === false) emptyMessage = 'Turn on the live assistant in Settings, Summary.';
  else if (!state.active && !isRecording) emptyMessage = 'Suggestions appear here while you record.';
  else if (!state.active && isRecording) emptyMessage = 'Assistant is not running for this recording.';
  else if (visible.length === 0) emptyMessage = generating ? 'Reading the conversation...' : 'Listening. Suggestions arrive after enough has been said.';

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
            {state.active && (
              <>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={refresh} title="Refresh now" disabled={generating}>
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
              {state.is_cloud ? `Sending to ${providerLabel(state.provider)}` : 'On device'}
            </span>
            <span className={age.stale ? 'text-orange-600' : 'text-gray-500'}>{age.label}</span>
          </div>
        )}
        <Input
          value={goalDraft}
          onChange={(event) => setGoalDraft(event.target.value)}
          onBlur={commitGoal}
          onKeyDown={(event) => { if (event.key === 'Enter') { (event.target as HTMLInputElement).blur(); } }}
          placeholder="Goal for this call (optional)"
          className="h-8 text-sm"
        />
        {errored && state.error && (
          <div className="text-xs text-red-700 bg-red-50 rounded p-2 flex items-start justify-between gap-2">
            <span>{state.error}</span>
            <button type="button" className="underline shrink-0" onClick={refresh}>Retry</button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {emptyMessage ? (
          <div className="text-xs text-gray-500 text-center pt-6 px-2">
            <p>{emptyMessage}</p>
            {enabled !== false && isRecording && !state.active && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => start(goalDraft.trim())}>Start assistant</Button>
            )}
          </div>
        ) : (
          visible.map((item) => (
            <SuggestionCard key={item.id} item={item} onPin={(pinned) => pin(item.id, pinned)} onDismiss={() => dismiss(item.id)} />
          ))
        )}
      </div>
    </div>
  );
});
