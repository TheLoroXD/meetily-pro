'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { providerLabel } from '@/lib/live-assistant';

interface AssistantConsentDialogProps {
  provider: string | null;
  onConfirm: (provider: string) => void;
  onCancel: () => void;
}

export function AssistantConsentDialog({ provider, onConfirm, onCancel }: AssistantConsentDialogProps) {
  const label = provider ? providerLabel(provider) : '';
  return (
    <Dialog open={provider !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send the live transcript to {label}?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-gray-600">
              <p>While you record, the assistant sends recent transcript text to {label} about once a minute. Other participants&apos; words are included. Tell them.</p>
              <p>The text is kept under {label}&apos;s retention policy, outside this computer. Summaries already use this provider only when you ask for one; the live assistant sends automatically.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Keep local only</Button>
          <Button onClick={() => provider && onConfirm(provider)}>Enable for {label}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
