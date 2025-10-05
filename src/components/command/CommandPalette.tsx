import React, { useEffect, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Clock, 
  ChevronRight, 
  Home,
  Package,
  ShoppingCart,
  FileText,
  BarChart3,
  Settings,
  Plus,
  Download,
  RefreshCw,
  Palette,
  Bell,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCommandPalette } from '@/hooks/useCommandPalette';

const categoryIcons = {
  navigation: Home,
  action: Zap,
  search: Search,
  recent: Clock,
};

const categoryLabels = {
  navigation: 'Navigation',
  action: 'Actions',
  search: 'Search',
  recent: 'Recent',
};

export const CommandPalette: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    search,
    setSearch,
    groupedCommands,
    executeCommand,
  } = useCommandPalette();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const commandRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Flatten commands for keyboard navigation
  const allCommands = Object.values(groupedCommands).flat();

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < allCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : allCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (allCommands[selectedIndex]) {
            executeCommand(allCommands[selectedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, allCommands, executeCommand]);

  // Scroll to selected item
  useEffect(() => {
    commandRefs.current[selectedIndex]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [selectedIndex]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="p-0 gap-0 max-w-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <Input
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
            autoFocus
          />
          <Badge variant="outline" className="ml-2 text-xs">
            ⌘K
          </Badge>
        </div>

        {/* Commands List */}
        <ScrollArea className="max-h-[400px]">
          <Command className="bg-transparent">
            <Command.List>
              {Object.entries(groupedCommands).length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No results found
                </div>
              ) : (
                Object.entries(groupedCommands).map(([category, commands]) => {
                  const CategoryIcon = categoryIcons[category as keyof typeof categoryIcons];
                  const startIndex = allCommands.findIndex(c => c.id === commands[0].id);

                  return (
                    <Command.Group
                      key={category}
                      heading={
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          <CategoryIcon className="h-3 w-3" />
                          {categoryLabels[category as keyof typeof categoryLabels]}
                        </div>
                      }
                    >
                      {commands.map((command, index) => {
                        const globalIndex = startIndex + index;
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <Command.Item
                            key={command.id}
                            value={command.id}
                            onSelect={() => executeCommand(command)}
                            className={cn(
                              'flex items-center justify-between gap-3 px-3 py-3 cursor-pointer',
                              'border-l-2 border-transparent',
                              'hover:bg-accent hover:border-l-primary',
                              'transition-colors duration-150',
                              isSelected && 'bg-accent border-l-primary'
                            )}
                            ref={(el) => {
                              commandRefs.current[globalIndex] = el;
                            }}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {command.icon && (
                                <command.icon className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">
                                  {command.label}
                                </div>
                                {command.description && (
                                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {command.description}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {command.shortcut && (
                                <Badge variant="secondary" className="text-xs">
                                  {command.shortcut}
                                </Badge>
                              )}
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  );
                })
              )}
            </Command.List>
          </Command>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd>
              Close
            </span>
          </div>
          <div>
            {allCommands.length} {allCommands.length === 1 ? 'result' : 'results'}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
