import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDashboardCustomization } from '@/hooks/useDashboardCustomization';

export const DateRangeFilter: React.FC = () => {
  const { customization, setDateRange } = useDashboardCustomization();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range.from, range.to);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setDateRange(null, null);
  };

  const hasDateRange = customization.dateRange.start && customization.dateRange.end;

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'gap-2',
              hasDateRange && 'border-primary'
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {hasDateRange ? (
              <span className="hidden sm:inline">
                {format(customization.dateRange.start!, 'MMM d')} -{' '}
                {format(customization.dateRange.end!, 'MMM d, yyyy')}
              </span>
            ) : (
              <span className="hidden sm:inline">Date Range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={{
              from: customization.dateRange.start || undefined,
              to: customization.dateRange.end || undefined,
            }}
            onSelect={handleSelect}
            numberOfMonths={2}
            className="rounded-md"
          />
        </PopoverContent>
      </Popover>

      {hasDateRange && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-9 px-2"
          aria-label="Clear date range"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
