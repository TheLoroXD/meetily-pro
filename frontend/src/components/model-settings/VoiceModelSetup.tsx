'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useModelCatalog } from '@/hooks/useModelCatalog';
import { SPEECH_PROVIDERS } from '@/lib/model-catalog';
import { VoiceModelPicker } from './VoiceModelPicker';

export function VoiceModelSetup({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { catalog } = useModelCatalog(SPEECH_PROVIDERS);
  const openModels = () => {
    onClose();
    router.push('/settings?tab=models');
  };

  return (
    <div className="space-y-4">
      <VoiceModelPicker catalog={catalog} onSetUp={openModels} />
      <Button variant="outline" onClick={openModels}>Open Models settings</Button>
    </div>
  );
}
