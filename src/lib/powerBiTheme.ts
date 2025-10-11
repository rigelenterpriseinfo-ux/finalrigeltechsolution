export const POWER_BI_THEME = {
  colors: {
    background: 'hsl(var(--muted))',
    card: 'hsl(var(--card))',
    border: 'hsl(var(--border))',
    textPrimary: 'hsl(var(--foreground))',
    textSecondary: 'hsl(var(--muted-foreground))',
    accent: '#2B88D8',
    success: '#107C41',
    warning: '#FFC000',
    danger: '#D83B01',
  },
  typography: {
    kpiValue: 'text-4xl font-semibold tracking-tight',
    kpiLabel: 'text-sm font-normal text-muted-foreground',
    sectionTitle: 'text-lg font-medium',
    cardTitle: 'text-base font-medium',
    body: 'text-sm',
    caption: 'text-xs text-muted-foreground',
  },
  spacing: {
    cardPadding: 'p-6',
    gridGap: 'gap-4',
    sectionGap: 'gap-6',
  },
  effects: {
    cardShadow: 'shadow-sm hover:shadow-md transition-shadow duration-200',
    cardBorder: 'border border-border',
  },
} as const;
