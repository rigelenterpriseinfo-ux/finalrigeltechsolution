import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDashboardCustomization } from '@/hooks/useDashboardCustomization';
import { useDateRangePresets } from '@/hooks/useDateRangePresets';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export const EnhancedDateRangeFilter: React.FC = () => {
  const { customization, setDateRange } = useDashboardCustomization();
  const { presets, getPresetRange } = useDateRangePresets();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'presets' | 'custom'>('presets');
  const [startDate, setStartDate] = useState<Date | undefined>(customization.dateRange.start || undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(customization.dateRange.end || undefined);

  const handlePresetClick = (presetKey: string) => {
    const range = getPresetRange(presetKey);
    setDateRange(range.start, range.end);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      setDateRange(startDate, endDate);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setDateRange(null, null);
    setStartDate(undefined);
    setEndDate(undefined);
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
          <div className="p-4 space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2 border-b pb-3">
              <Button
                variant={mode === 'presets' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMode('presets')}
                className="flex-1"
              >
                Quick Ranges
              </Button>
              <Button
                variant={mode === 'custom' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMode('custom')}
                className="flex-1"
              >
                Custom Range
              </Button>
            </div>

            {/* Presets Mode */}
            {mode === 'presets' && (
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.key}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetClick(preset.key)}
                    className="justify-start"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Custom Range Mode */}
            {mode === 'custom' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !startDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !endDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                          className="pointer-events-auto"
                          disabled={(date) => startDate ? date < startDate : false}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button
                  onClick={handleApplyCustom}
                  disabled={!startDate || !endDate}
                  className="w-full"
                >
                  Apply Range
                </Button>
              </div>
            )}
          </div>
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
