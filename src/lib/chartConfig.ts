// Enhanced chart configuration with better colors and styling

export const CHART_COLORS = {
  primary: 'hsl(221 83% 53%)',      // Blue
  success: 'hsl(142 76% 36%)',      // Green
  warning: 'hsl(38 92% 50%)',       // Amber
  danger: 'hsl(0 84% 60%)',         // Red
  info: 'hsl(199 89% 48%)',         // Cyan
  purple: 'hsl(262 83% 58%)',       // Purple
  pink: 'hsl(330 81% 60%)',         // Pink
  orange: 'hsl(25 95% 53%)',        // Orange
};

export const CHART_COLOR_ARRAY = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
  CHART_COLORS.info,
  CHART_COLORS.purple,
  CHART_COLORS.pink,
  CHART_COLORS.orange,
];

// Custom tooltip styling
export const customTooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  labelStyle: {
    color: 'hsl(var(--foreground))',
    fontWeight: 600,
    marginBottom: '8px',
  },
  itemStyle: {
    color: 'hsl(var(--muted-foreground))',
  },
};

// Custom tooltip formatter for currency
export const formatCurrencyTooltip = (value: number) => {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Custom tooltip formatter for percentage
export const formatPercentageTooltip = (value: number) => {
  return `${value.toFixed(1)}%`;
};

// Chart animation config
export const chartAnimationConfig = {
  animationDuration: 800,
  animationEasing: 'ease-out' as const,
};

// Grid styling
export const gridStyle = {
  stroke: 'hsl(var(--border))',
  strokeDasharray: '3 3',
  opacity: 0.3,
};

// Axis styling
export const axisStyle = {
  fontSize: 12,
  fill: 'hsl(var(--muted-foreground))',
};
