'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { useModelCatalog } from '@/hooks/useModelCatalog';
import { useAssistantSettings } from '@/hooks/useAssistantSettings';
import { SPEECH_PROVIDERS, TEXT_PROVIDERS, type CatalogProvider } from '@/lib/model-catalog';
import { ProvidersSection } from './ProvidersSection';
import { VoiceModelPicker } from './VoiceModelPicker';
import { AiModelPicker } from './AiModelPicker';
import { LiveAssistantSettings } from './LiveAssistantSettings';

const ALL_PROVIDERS: CatalogProvider[] = [...SPEECH_PROVIDERS, ...TEXT_PROVIDERS];

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mb-4 text-sm text-gray-600">{description}</p>
      {children}
    </section>
  );
}

export function ModelsSettings() {
  const { modelConfig } = useConfig();
  const { catalog, refresh } = useModelCatalog(ALL_PROVIDERS);
  const [open, setOpen] = useState('');
  const assistant = useAssistantSettings();

  const showProvider = useCallback((provider: CatalogProvider) => {
    setOpen(provider);
    requestAnimationFrame(() => document.getElementById(`provider-${provider}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const inUseBy = (provider: string) => (modelConfig.provider === provider ? ['Summaries and the assistant'] : []);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Providers" description="Set up each source once. Models you add here show up in the pickers below.">
        <ProvidersSection catalog={catalog} refresh={refresh} open={open} onOpenChange={setOpen} inUseBy={inUseBy} onCustomServerSaved={() => refresh(['custom-openai'])} />
      </Section>
      <Section title="Voice transcript model" description="Turns speech into text while you record.">
        <VoiceModelPicker catalog={catalog} onSetUp={() => showProvider('parakeet')} />
      </Section>
      <Section title="AI model" description="Writes meeting summaries and answers your questions during and after a call.">
        <div className="space-y-4">
          <AiModelPicker catalog={catalog} onSetUp={() => showProvider('builtin-ai')} />
          <LiveAssistantSettings {...assistant} />
        </div>
      </Section>
    </div>
  );
}
