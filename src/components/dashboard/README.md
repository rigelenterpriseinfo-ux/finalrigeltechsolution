# Redesigned Dashboard Documentation

## Overview

The redesigned dashboard provides a comprehensive, real-time view of business operations with modern UI/UX patterns, mobile optimization, and advanced features.

## Architecture

### Component Structure

```
RedesignedDashboard (Main Container)
├── HeroKPISection (Revenue, Orders, Stock, Cash Flow)
├── UrgentActionsPanel (Critical Actions)
├── PurchaseSection (Pending Receipts, Open POs, Top Vendors)
├── InventorySection (Warehouse Stock, Top Items, Damaged Stock)
├── SalesSection (Sales Trends, Open Orders, Top Customers)
├── FinanceSection (AP/AR Reconciliation, Aging Analysis)
├── ShipmentStatusBoard (Shipment Tracking)
├── RecentActivitiesTimeline (Recent Transactions)
└── QuickActionsSidebar (Quick Access Actions)
```

### Data Flow

1. **Data Hooks**: Each section has its own custom hook for data fetching
   - `useDashboardData` - KPIs and urgent actions
   - `usePurchaseData` - Purchase metrics
   - `useInventoryData` - Inventory metrics
   - `useSalesData` - Sales metrics
   - `useFinanceData` - Finance metrics
   - `useOperationsData` - Operations and activities

2. **Real-time Updates**: `useRealtimeDashboard` hook subscribes to Supabase changes

3. **Performance**: React Query with 5-minute stale time, memoized components

## Features

### Core Features

- **Real-time Updates**: Automatic data refresh via Supabase subscriptions
- **Responsive Design**: Optimized for mobile, tablet, and desktop
- **Error Handling**: Granular error boundaries per section
- **Loading States**: Skeleton loaders and progressive loading
- **Data Export**: JSON, CSV, and print functionality
- **Keyboard Shortcuts**: Quick navigation (Ctrl+D/I/P/S/R)

### Mobile Optimizations

- Touch-optimized UI with 44px minimum touch targets
- Floating Action Button (FAB) for quick actions
- Collapsible sections for better mobile experience
- Swipe gestures support
- Responsive grid layouts

### Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Focus management

## Usage

### Basic Implementation

```tsx
import { RedesignedDashboard } from '@/components/dashboard/RedesignedDashboard';

function App() {
  const { profile } = useAuth();
  
  return <RedesignedDashboard companyId={profile?.company_id} />;
}
```

### Toggle Between Views

```tsx
import { DashboardViewToggle } from '@/components/dashboard/DashboardViewToggle';

function Dashboard() {
  const [isNewDashboard, setIsNewDashboard] = useState(true);
  
  return (
    <>
      <DashboardViewToggle 
        isNewDashboard={isNewDashboard}
        onToggle={() => setIsNewDashboard(!isNewDashboard)}
      />
      {isNewDashboard ? <RedesignedDashboard /> : <ClassicDashboard />}
    </>
  );
}
```

## Customization

### Section Visibility

Control which sections appear on the dashboard by modifying the `RedesignedDashboard` component.

### Styling

All styles use semantic tokens from `index.css`. Customize the theme by updating CSS variables:

```css
:root {
  --primary: 217 91% 35%;
  --accent: 188 94% 35%;
  /* ... */
}
```

### Data Refresh Intervals

Modify `staleTime` in data hooks (default: 5 minutes):

```tsx
const { data } = useQuery({
  queryKey: ['dashboard-kpi'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000, // Change this value
});
```

## Performance Considerations

- **Memoization**: All sections use `React.memo` to prevent unnecessary re-renders
- **Code Splitting**: Sections can be lazy-loaded via `DashboardSectionWrapper`
- **Query Optimization**: React Query with intelligent caching
- **Real-time Efficiency**: Selective subscriptions to only relevant tables

## Testing

### Component Testing

```tsx
import { render, screen } from '@testing-library/react';
import { RedesignedDashboard } from './RedesignedDashboard';

test('renders dashboard sections', () => {
  render(<RedesignedDashboard companyId="test-id" />);
  expect(screen.getByText('Dashboard')).toBeInTheDocument();
});
```

### Data Hook Testing

```tsx
import { renderHook } from '@testing-library/react-hooks';
import { useDashboardData } from '@/hooks/useDashboardData';

test('fetches dashboard data', async () => {
  const { result, waitFor } = renderHook(() => useDashboardData('test-id'));
  await waitFor(() => !result.current.kpiLoading);
  expect(result.current.kpiData).toBeDefined();
});
```

## Troubleshooting

### Data Not Loading

1. Check Supabase connection
2. Verify RLS policies for tables
3. Ensure `companyId` is valid
4. Check browser console for errors

### Real-time Updates Not Working

1. Verify Supabase realtime is enabled
2. Check `useRealtimeDashboard` hook is called
3. Ensure tables have REPLICA IDENTITY FULL
4. Check browser console for WebSocket errors

### Performance Issues

1. Check React DevTools for unnecessary re-renders
2. Verify memoization is working
3. Consider increasing `staleTime` for less frequent updates
4. Check network tab for duplicate requests

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari 14+, Chrome Mobile

## Dependencies

- React 18+
- React Query (TanStack Query)
- Supabase JS Client
- Recharts (for visualizations)
- Lucide React (icons)
- Tailwind CSS

## Contributing

When adding new sections:

1. Create a new component in `src/components/dashboard/`
2. Create a corresponding data hook in `src/hooks/`
3. Add the section to `RedesignedDashboard`
4. Wrap it in `DashboardSectionWrapper` for error handling
5. Ensure mobile responsiveness
6. Add proper TypeScript types
7. Update this documentation

## License

Proprietary - Internal use only
