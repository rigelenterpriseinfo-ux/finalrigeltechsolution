import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { keys: ['Ctrl', 'D'], description: 'Go to Dashboard' },
  { keys: ['Ctrl', 'I'], description: 'Go to Inventory' },
  { keys: ['Ctrl', 'P'], description: 'Go to Purchase' },
  { keys: ['Ctrl', 'S'], description: 'Go to Sales' },
  { keys: ['Ctrl', 'R'], description: 'Go to Reports' },
  { keys: ['Ctrl', '/'], description: 'Show this dialog' },
];

export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>
            Use these shortcuts to navigate quickly
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
            >
              <span className="text-sm">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
                    <Badge variant="outline" className="font-mono text-xs">
                      {key}
                    </Badge>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
