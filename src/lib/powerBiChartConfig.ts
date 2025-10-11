export const POWER_BI_CHART_CONFIG = {
  colors: {
    primary: '#2B88D8',
    secondary: '#A4A4A4',
    tertiary: '#E5E5E5',
    grid: '#F0F0F0',
    success: '#107C41',
    warning: '#FFC000',
    danger: '#D83B01',
  },
  chartDefaults: {
    margin: { top: 10, right: 10, left: 0, bottom: 0 },
    barSize: 32,
    barGap: 4,
    barCategoryGap: '20%',
  },
  gridStyle: {
    strokeDasharray: '3 3',
    stroke: '#F0F0F0',
    strokeWidth: 0.5,
  },
  axisStyle: {
    tick: { fill: '#666666', fontSize: 12 },
    axisLine: { stroke: '#E5E5E5' },
  },
  tooltipStyle: {
    contentStyle: {
      backgroundColor: 'white',
      border: '1px solid #E5E5E5',
      borderRadius: '6px',
      padding: '8px 12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    labelStyle: {
      color: '#1F1F1F',
      fontWeight: 500,
    },
    itemStyle: {
      color: '#666666',
    },
  },
} as const;

export const getPowerBIChartColor = (index: number) => {
  const colors = [
    POWER_BI_CHART_CONFIG.colors.primary,
    POWER_BI_CHART_CONFIG.colors.secondary,
    POWER_BI_CHART_CONFIG.colors.tertiary,
  ];
  return colors[index % colors.length];
};
