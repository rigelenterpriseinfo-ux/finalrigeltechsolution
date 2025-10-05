import React from 'react';
import { Button } from '@/components/ui/button';
import { Search, Command } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCommandPalette } from '@/hooks/useCommandPalette';

interface CommandPaletteTriggerProps {
  variant?: 'button' | 'search-bar';
  className?: string;
}

export const CommandPaletteTrigger: React.FC<CommandPaletteTriggerProps> = ({
  variant = 'button',
  className,
}) => {
  const { setIsOpen } = useCommandPalette();

  if (variant === 'search-bar') {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex items-center justify-between w-full max-w-md',
          'px-3 py-2 rounded-lg border bg-background',
          'hover:bg-accent transition-colors',
          'text-sm text-muted-foreground',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span>Search or type a command...</span>
        </div>
        <Badge variant="outline" className="text-xs">
          ⌘K
        </Badge>
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsOpen(true)}
      className={cn('gap-2', className)}
    >
      <Command className="h-4 w-4" />
      <span className="hidden sm:inline">Command</span>
      <Badge variant="secondary" className="text-xs">
        ⌘K
      </Badge>
    </Button>
  );
};
