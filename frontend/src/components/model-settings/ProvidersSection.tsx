'use client';

import type { ReactNode } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useConfig } from '@/contexts/ConfigContext';
import { ModelManager as WhisperModelManager } from '@/components/WhisperModelManager';
import { ParakeetModelManager } from '@/components/ParakeetModelManager';
import { BuiltInModelManager } from '@/components/BuiltInModelManager';
import { CLOUD_PROVIDERS, catalogLabel, isOnDevice, type Catalog, type CatalogProvider, type CloudProvider, type ProviderState } from '@/lib/model-catalog';
import { CloudKeyCard } from './CloudKeyCard';
import { OllamaCard } from './OllamaCard';
import { CustomServerCard } from './CustomServerCard';

type Badge = { text: string; className: string };

const BADGES = {
  ready: { text: 'Ready', className: 'bg-green-50 text-green-700' },
  missing: { text: 'Not set up', className: 'bg-gray-100 text-gray-600' },
  checking: { text: 'Checking', className: 'bg-gray-100 text-gray-500' },
  unreachable: { text: 'Unreachable', className: 'bg-red-50 text-red-700' },
} satisfies Record<string, Badge>;

function count(models: string[], noun: string): string {
  return `${models.length} ${noun}${models.length === 1 ? '' : 's'}`;
}

function describe(provider: CatalogProvider, state: ProviderState | undefined, hasKey: boolean): { line: string; badge: Badge } {
  if (!state || state.status === 'loading') return { line: '', badge: BADGES.checking };
  const onDevice = isOnDevice(provider);
  if (state.status === 'ready') {
    if (onDevice) return { line: `${count(state.models, 'model')} downloaded`, badge: BADGES.ready };
    if (provider === 'ollama') return { line: `Connected - ${count(state.models, 'model')}`, badge: BADGES.ready };
    if (provider === 'custom-openai') return { line: state.models[0], badge: BADGES.ready };
    return { line: 'Key saved', badge: BADGES.ready };
  }
  if (state.status === 'error') {
    return { line: hasKey ? `Key saved - ${state.reason}` : 'Could not connect', badge: BADGES.unreachable };
  }
  if (onDevice) return { line: 'No models downloaded', badge: BADGES.missing };
  if (provider === 'ollama') return { line: 'Connected - no models yet', badge: BADGES.missing };
  if (provider === 'custom-openai') return { line: 'No server yet', badge: BADGES.missing };
  return { line: 'No key', badge: BADGES.missing };
}

interface ProvidersSectionProps {
  catalog: Catalog;
  refresh: (only?: CatalogProvider[]) => void;
  open: string;
  onOpenChange: (value: string) => void;
  inUseBy: (provider: string) => string[];
  onCustomServerSaved: () => void;
}

export function ProvidersSection({ catalog, refresh, open, onOpenChange, inUseBy, onCustomServerSaved }: ProvidersSectionProps) {
  const { providerApiKeys } = useConfig();

  const row = (provider: CatalogProvider, tag: string | null, body: ReactNode) => {
    const hasKey = !!providerApiKeys[provider as CloudProvider]?.trim();
    const { line, badge } = describe(provider, catalog[provider], hasKey);
    return (
      <AccordionItem key={provider} value={provider} id={`provider-${provider}`} className="scroll-mt-24">
        <AccordionTrigger className="py-3 hover:no-underline">
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="w-28 shrink-0 font-medium text-gray-900">{catalogLabel(provider)}</span>
            {tag && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-normal text-gray-600">{tag}</span>}
            <span className="min-w-0 flex-1 truncate text-xs font-normal text-gray-500" title={line}>{line}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.text}</span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-1 pt-1 pb-4">{body}</AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">On this device</h4>
        <p className="mb-1 text-xs text-gray-500">Runs on your computer. Nothing leaves it.</p>
        <Accordion type="single" collapsible value={open} onValueChange={onOpenChange}>
          {row('parakeet', 'Speech', <ParakeetModelManager onModelsChange={() => refresh(['parakeet'])} />)}
          {row('localWhisper', 'Speech', <WhisperModelManager onModelsChange={() => refresh(['localWhisper'])} />)}
          {row('builtin-ai', 'Text', <BuiltInModelManager onModelsChange={() => refresh(['builtin-ai'])} />)}
        </Accordion>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI services</h4>
        <p className="mb-1 text-xs text-gray-500">Needs a server or internet. Your transcript is sent to the service you pick.</p>
        <Accordion type="single" collapsible value={open} onValueChange={onOpenChange}>
          {row('ollama', null, <OllamaCard state={catalog.ollama} onChanged={() => refresh(['ollama'])} />)}
          {CLOUD_PROVIDERS.map((provider) => row(provider, null, <CloudKeyCard provider={provider} inUseBy={inUseBy(provider)} />))}
          {row('custom-openai', null, <CustomServerCard onSaved={onCustomServerSaved} />)}
        </Accordion>
      </div>
    </div>
  );
}
