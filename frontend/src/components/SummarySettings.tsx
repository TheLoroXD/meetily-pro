'use client';

import { SummaryLanguageSettings } from '@/components/SummaryLanguageSettings';
import { Switch } from './ui/switch';
import { useConfig } from '@/contexts/ConfigContext';

export function SummarySettings() {
  const { isAutoSummary, toggleIsAutoSummary } = useConfig();

  return (
    <div className='flex flex-col gap-4'>
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Auto Summary</h3>
            <p className="text-sm text-gray-600">Auto Generating summary after meeting completion(Stopping)</p>
          </div>
          <Switch checked={isAutoSummary} onCheckedChange={toggleIsAutoSummary} />
        </div>
      </div>

      <SummaryLanguageSettings />
    </div>
  );
}
