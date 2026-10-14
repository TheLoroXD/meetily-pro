'use client';

import { memo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp, Copy, RefreshCw, Sparkles, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SummaryStatus } from '@/hooks/meeting-details/useSummaryGeneration';

interface SummaryBubbleProps {
  markdown: string;
  status: SummaryStatus;
  error: string | null;
  hasTranscript: boolean;
  hasModel: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  onStop: () => void;
  onCopy: () => void;
}

const MODELS_LINK = '/settings?tab=models';
const REMARK_PLUGINS = [remarkGfm];

const SummaryMarkdown = memo(function SummaryMarkdown({ markdown }: { markdown: string }) {
  return <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{markdown}</ReactMarkdown>;
});

export function SummaryBubble({ markdown, status, error, hasTranscript, hasModel, onGenerate, onRegenerate, onStop, onCopy }: SummaryBubbleProps) {
  const [collapsed, setCollapsed] = useState(false);
  const working = status === 'processing' || status === 'summarizing' || status === 'regenerating';
  const hasSummary = markdown.length > 0;

  const iconButton = (title: string, onClick: () => void, icon: ReactNode) => (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-500 hover:text-gray-800" onClick={onClick} title={title} aria-label={title}>
      {icon}
    </Button>
  );

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 text-sm text-gray-800">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <Sparkles size={14} className="text-blue-600" />
          Summary
          {working && <span className="text-xs font-normal text-gray-500 animate-pulse">Writing...</span>}
        </div>
        <div className="flex items-center">
          {working && iconButton('Stop', onStop, <Square size={14} />)}
          {!working && hasSummary && iconButton('Copy summary', onCopy, <Copy size={14} />)}
          {!working && hasSummary && hasModel && iconButton('Write again', onRegenerate, <RefreshCw size={14} />)}
          {hasSummary && iconButton(collapsed ? 'Show summary' : 'Hide summary', () => setCollapsed(!collapsed), collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />)}
        </div>
      </div>
      {!collapsed && (
        <div className="max-h-[45vh] overflow-y-auto px-3 pb-3">
          {hasSummary ? (
            <div className={`prose prose-sm max-w-none dark:prose-invert prose-headings:mb-1 prose-headings:mt-3 prose-p:my-1 prose-ul:my-1 prose-li:my-0 ${working ? 'opacity-50' : ''}`}>
              <SummaryMarkdown markdown={markdown} />
            </div>
          ) : working ? (
            <p className="text-gray-500">The summary appears here in a moment.</p>
          ) : (
            <div className="space-y-2">
              {error && <p role="alert" className="rounded bg-red-50 px-2 py-1 text-red-700">{error}</p>}
              {!hasModel ? (
                <p className="text-gray-600">
                  Pick an AI model in <Link href={MODELS_LINK} className="text-blue-600 underline">Settings, Models</Link> to get a summary.
                </p>
              ) : hasTranscript ? (
                <Button size="sm" onClick={onGenerate}>{error ? 'Try again' : 'Write summary'}</Button>
              ) : (
                <p className="text-gray-600">A summary needs a transcript.</p>
              )}
            </div>
          )}
          {hasSummary && error && !working && <p role="alert" className="mt-2 rounded bg-red-50 px-2 py-1 text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
