import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  ShoppingCart, 
  FileText, 
  Package, 
  Users, 
  Building,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalSearch, SearchResult } from '@/hooks/useGlobalSearch';
import { useNavigate } from 'react-router-dom';

const typeIcons = {
  order: ShoppingCart,
  invoice: FileText,
  product: Package,
  customer: Users,
  supplier: Building,
};

const typeLabels = {
  order: 'Orders',
  invoice: 'Invoices',
  product: 'Products',
  customer: 'Customers',
  supplier: 'Suppliers',
};

const typeColors = {
  order: 'bg-blue-500/10 text-blue-500',
  invoice: 'bg-green-500/10 text-green-500',
  product: 'bg-purple-500/10 text-purple-500',
  customer: 'bg-orange-500/10 text-orange-500',
  supplier: 'bg-pink-500/10 text-pink-500',
};

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: any;
}

export const GlobalSearchDialog: React.FC<GlobalSearchDialogProps> = ({
  isOpen,
  onOpenChange,
  data,
}) => {
  const navigate = useNavigate();
  const { query, setQuery, groupedResults, clearSearch } = useGlobalSearch(data);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allResults = Object.values(groupedResults).flat();

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < allResults.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : allResults.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (allResults[selectedIndex]) {
            navigate(allResults[selectedIndex].url);
            onOpenChange(false);
            clearSearch();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, allResults, navigate, onOpenChange, clearSearch]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url);
    onOpenChange(false);
    clearSearch();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <Input
            placeholder="Search orders, invoices, products, customers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
            autoFocus
          />
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[400px]">
          {!query.trim() ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Start typing to search...</p>
            </div>
          ) : allResults.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No results found</p>
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedResults).map(([type, results]) => {
                const TypeIcon = typeIcons[type as keyof typeof typeIcons];
                const startIndex = allResults.findIndex(r => r.id === results[0].id);

                return (
                  <div key={type} className="mb-4">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      <TypeIcon className="h-3 w-3" />
                      {typeLabels[type as keyof typeof typeLabels]}
                      <Badge variant="secondary" className="ml-auto">
                        {results.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {results.map((result, index) => {
                        const globalIndex = startIndex + index;
                        const isSelected = globalIndex === selectedIndex;
                        const ResultIcon = typeIcons[result.type];

                        return (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                              'text-left transition-colors',
                              'hover:bg-accent',
                              isSelected && 'bg-accent'
                            )}
                          >
                            <div className={cn(
                              'p-2 rounded-lg',
                              typeColors[result.type]
                            )}>
                              <ResultIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {result.title}
                              </div>
                              {result.subtitle && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {result.subtitle}
                                </div>
                              )}
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {allResults.length > 0 && (
          <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↵</kbd>
                Open
              </span>
            </div>
            <div>
              {allResults.length} {allResults.length === 1 ? 'result' : 'results'}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
