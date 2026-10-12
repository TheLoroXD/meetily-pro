'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pin, Sparkles } from 'lucide-react';
import { assistantService } from '@/services/assistantService';
import { KIND_META, formatClock, sortSuggestions, type Suggestion } from '@/lib/live-assistant';

export function DuringCallSuggestions({ meetingId }: { meetingId: string }) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    assistantService.getMeetingSuggestions(meetingId)
      .then((loaded) => { if (!cancelled) setItems(sortSuggestions(loaded)); })
      .catch((error) => console.warn('Failed to load during-call suggestions:', error));
    return () => { cancelled = true; };
  }, [meetingId]);

  if (items.length === 0) return null;

  return (
    <div className="border-b border-gray-200 bg-gray-50/60">
      <button type="button" className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100" onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Sparkles size={14} className="text-blue-600" />
        <span>During the call ({items.length})</span>
      </button>
      {open && (
        <ul className="px-4 pb-3 space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="text-sm text-gray-800 flex items-start gap-2">
              <span className="font-mono text-[11px] text-gray-500 mt-0.5 shrink-0">{formatClock(item.at_seconds)}</span>
              <span className={`text-[10px] font-semibold uppercase mt-0.5 shrink-0 ${KIND_META[item.kind].text}`}>{KIND_META[item.kind].label}</span>
              <span className="flex-1">{item.text}</span>
              {item.pinned && <Pin size={12} className="text-blue-600 mt-1 shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
