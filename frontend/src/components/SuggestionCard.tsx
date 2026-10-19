'use client';

import { Copy, Pin, PinOff, X } from 'lucide-react';
import { ClockLink, copyText } from '@/components/AssistantChat';
import { KIND_META, formatClock, type Suggestion } from '@/lib/live-assistant';

export function SuggestionCard({ item, onPin, onDismiss, onAsk }: { item: Suggestion; onPin?: (pinned: boolean) => void; onDismiss: () => void; onAsk?: () => void }) {
  const meta = KIND_META[item.kind];
  return (
    <div className={`rounded-lg border p-3 text-sm ${item.pinned ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'}`} title={item.why || undefined}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.badge}`}>{meta.label}</span>
          <ClockLink seconds={item.at_seconds} label={formatClock(item.at_seconds)} className="text-[11px] text-gray-500 hover:text-blue-600" />
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" className="p-1 text-gray-400 hover:text-gray-700" title="Copy" onClick={() => copyText(item.text)}>
            <Copy size={14} />
          </button>
          {onPin && (
            <button type="button" className="p-1 text-gray-400 hover:text-blue-600" title={item.pinned ? 'Unpin' : 'Pin'} onClick={() => onPin(!item.pinned)}>
              {item.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          )}
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
