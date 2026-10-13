'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useModelCatalog } from '@/hooks/useModelCatalog';
import { TEXT_PROVIDERS } from '@/lib/model-catalog';
import { SummaryModelPicker } from './SummaryModelPicker';

export function SummaryModelDialogBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { catalog } = useModelCatalog(TEXT_PROVIDERS);
  const openModels = () => {
    onClose();
    router.push('/settings?tab=models');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Summary model</h3>
        <p className="text-sm text-gray-600">Applies to all meetings.</p>
      </div>
      <SummaryModelPicker catalog={catalog} onSetUp={openModels} />
      <p className="text-xs text-gray-600">
        <button type="button" className="text-blue-600 underline" onClick={openModels}>Add keys or download models in Settings &gt; Models</button>
      </p>
      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
