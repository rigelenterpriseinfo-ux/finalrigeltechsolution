import { 
  startOfToday, 
  endOfToday, 
  startOfYesterday, 
  endOfYesterday,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  subMonths
} from 'date-fns';

export interface DateRangePreset {
  key: string;
  label: string;
  getRange: () => { start: Date; end: Date };
}

export const useDateRangePresets = () => {
  const presets: DateRangePreset[] = [
    {
      key: 'today',
      label: 'Today',
      getRange: () => ({
        start: startOfToday(),
        end: endOfToday(),
      }),
    },
    {
      key: 'yesterday',
      label: 'Yesterday',
      getRange: () => ({
        start: startOfYesterday(),
        end: endOfYesterday(),
      }),
    },
    {
      key: 'last7days',
      label: 'Last 7 Days',
      getRange: () => ({
        start: subDays(startOfToday(), 6),
        end: endOfToday(),
      }),
    },
    {
      key: 'last30days',
      label: 'Last 30 Days',
      getRange: () => ({
        start: subDays(startOfToday(), 29),
        end: endOfToday(),
      }),
    },
    {
      key: 'thisMonth',
      label: 'This Month',
      getRange: () => ({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
      }),
    },
    {
      key: 'lastMonth',
      label: 'Last Month',
      getRange: () => {
        const lastMonth = subMonths(new Date(), 1);
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth),
        };
      },
    },
    {
      key: 'thisQuarter',
      label: 'This Quarter',
      getRange: () => ({
        start: startOfQuarter(new Date()),
        end: endOfQuarter(new Date()),
      }),
    },
    {
      key: 'thisYear',
      label: 'This Year',
      getRange: () => ({
        start: startOfYear(new Date()),
        end: endOfYear(new Date()),
      }),
    },
  ];

  const getPresetRange = (key: string) => {
    const preset = presets.find((p) => p.key === key);
    if (!preset) {
      throw new Error(`Preset "${key}" not found`);
    }
    return preset.getRange();
  };

  return {
    presets,
    getPresetRange,
  };
};
