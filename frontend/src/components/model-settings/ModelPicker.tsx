'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { availability, catalogLabel, choiceKey, readyGroups, type Catalog, type CatalogProvider, type ModelChoice } from '@/lib/model-catalog';

interface PickerExtra {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

interface ModelPickerProps {
  catalog: Catalog;
  providers: CatalogProvider[];
  value: ModelChoice | null;
  extra?: PickerExtra;
  onChange: (choice: ModelChoice) => void;
  emptyText: string;
  setUpText: string;
  onSetUp: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function ModelPicker({ catalog, providers, value, extra, onChange, emptyText, setUpText, onSetUp, disabled, disabledReason }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const groups = readyGroups(catalog, providers);
  const total = groups.reduce((sum, group) => sum + group.models.length, 0);
  const loading = providers.some((provider) => !catalog[provider] || catalog[provider]?.status === 'loading');
  const extraSelected = !!extra?.selected;
  const state = extraSelected ? { kind: 'ready' as const } : availability(catalog, value);
  const selectedKey = value ? choiceKey(value) : '';
  const empty = total === 0 && !extra;

  const triggerText = extraSelected && extra
    ? extra.label
    : value?.model
      ? `${catalogLabel(value.provider)} - ${value.model}`
      : empty && !loading ? emptyText : 'Pick a model';

  return (
    <div className="space-y-1.5">
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            disabled={disabled || (empty && !value?.model)}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 text-sm text-left disabled:cursor-not-allowed disabled:opacity-60',
              state.kind === 'gone' ? 'border-amber-400 text-amber-900' : 'border-gray-300 text-gray-900'
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {state.kind === 'gone' && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}
              <span className="truncate">{triggerText}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search models..." />
            <CommandList className="max-h-72">
              <CommandEmpty>No model found.</CommandEmpty>
              {extra && (
                <>
                  <CommandGroup>
                    <CommandItem value={extra.label} onSelect={() => { extra.onSelect(); setOpen(false); }}>
                      <Check className={cn('mr-2 h-4 w-4', extraSelected ? 'opacity-100' : 'opacity-0')} />
                      {extra.label}
                    </CommandItem>
                  </CommandGroup>
                  {groups.length > 0 && <CommandSeparator />}
                </>
              )}
              {groups.map((group) => (
                <CommandGroup key={group.provider} heading={catalogLabel(group.provider)}>
                  {group.models.map((model) => {
                    const choice = { provider: group.provider, model };
                    const selected = !extraSelected && choiceKey(choice) === selectedKey;
                    return (
                      <CommandItem key={choiceKey(choice)} value={`${catalogLabel(group.provider)} ${model}`} onSelect={() => { onChange(choice); setOpen(false); }}>
                        <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                        {model}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {disabled && disabledReason && <p className="text-xs text-gray-500">{disabledReason}</p>}
      {!disabled && state.kind === 'gone' && (
        <p className="text-xs text-amber-700">
          {state.reason} Pick another or <button type="button" className="underline" onClick={onSetUp}>fix it in Providers</button>.
        </p>
      )}
      {!disabled && state.kind === 'unknown' && <p className="text-xs text-gray-500">{state.reason}</p>}
      {!disabled && empty && !loading && (
        <p className="text-xs text-gray-600">
          <button type="button" className="text-blue-600 underline" onClick={onSetUp}>{setUpText}</button>
        </p>
      )}
    </div>
  );
}
