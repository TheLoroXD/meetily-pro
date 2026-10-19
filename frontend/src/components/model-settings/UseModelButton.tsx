'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { ModelChoice } from '@/lib/model-catalog';

interface UseModelButtonProps {
  provider: string;
  models: string[];
  current: ModelChoice;
  onChoose: (choice: ModelChoice) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function UseModelButton({ provider, models, current, onChoose, disabled, disabledReason }: UseModelButtonProps) {
  const [open, setOpen] = useState(false);
  const inUse = current.provider === provider && models.includes(current.model);
  const single = models.length === 1;

  const choose = (model: string) => {
    setOpen(false);
    if (!inUse || model !== current.model) onChoose({ provider, model });
  };

  const onClick = single && !inUse ? () => choose(models[0]) : undefined;

  if (single && inUse) {
    return (
      <span title={current.model} className="flex h-8 max-w-[240px] items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 text-xs font-medium text-green-800">
        <Check className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{current.model}</span>
      </span>
    );
  }

  const trigger = inUse ? (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : current.model}
      className="flex h-8 max-w-[240px] items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 text-xs font-medium text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Check className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{current.model}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </button>
  ) : (
    <Button size="sm" variant="outline" className="h-8 px-3" disabled={disabled} title={disabled ? disabledReason : undefined} onClick={onClick}>
      Use{!single && <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />}
    </Button>
  );

  if (single) return trigger;

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder={`Search ${models.length} models...`} />
          <CommandList className="max-h-72">
            <CommandEmpty>No model found.</CommandEmpty>
            {models.map((model) => (
              <CommandItem key={model} value={model} onSelect={() => choose(model)}>
                <Check className={cn('mr-2 h-4 w-4 shrink-0', inUse && model === current.model ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{model}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
