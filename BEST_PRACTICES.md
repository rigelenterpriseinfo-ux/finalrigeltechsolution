# Dashboard Best Practices Guide

## Code Organization

### Component Structure

**✅ DO:**
```tsx
// Separate concerns - one component per file
export const PurchaseSection = memo(({ companyId }) => {
  const { data, isLoading } = usePurchaseData(companyId);
  
  if (isLoading) return <LoadingState />;
  
  return <PurchaseContent data={data} />;
});
```

**❌ DON'T:**
```tsx
// Multiple unrelated components in one file
export const Dashboard = () => {
  // 500 lines of mixed logic...
};
```

### Data Hooks

**✅ DO:**
```tsx
// Separate data fetching logic into hooks
export const usePurchaseData = (companyId?: string) => {
  return useQuery({
    queryKey: ['purchase-data', companyId],
    queryFn: () => fetchPurchaseData(companyId),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
};
```

**❌ DON'T:**
```tsx
// Fetch data directly in components
const MyComponent = () => {
  const [data, setData] = useState();
  useEffect(() => {
    fetch('/api/data').then(r => r.json()).then(setData);
  }, []);
};
```

## Performance Optimization

### Memoization

**✅ DO:**
```tsx
// Memoize expensive calculations
const expensiveValue = useMemo(
  () => data?.items.reduce((sum, item) => sum + item.value, 0),
  [data]
);

// Memoize callbacks
const handleClick = useCallback(() => {
  navigate('/sales');
}, [navigate]);

// Memoize components
export const Section = memo(SectionComponent);
```

**❌ DON'T:**
```tsx
// Recalculate on every render
const total = data?.items.reduce((sum, item) => sum + item.value, 0);

// Create new functions on every render
<Button onClick={() => navigate('/sales')} />
```

### React Query Configuration

**✅ DO:**
```tsx
// Configure appropriate stale times
useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000, // 5 minutes for dashboard data
  gcTime: 10 * 60 * 1000,   // 10 minutes cache
});
```

**❌ DON'T:**
```tsx
// Refetch too frequently
useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 0, // Refetches constantly
  refetchInterval: 1000, // Every second!
});
```

## Accessibility

### ARIA Labels

**✅ DO:**
```tsx
<button aria-label="Refresh dashboard data">
  <RefreshIcon />
</button>

<section aria-labelledby="sales-title">
  <h2 id="sales-title">Sales Overview</h2>
  {/* content */}
</section>
```

**❌ DON'T:**
```tsx
<button>
  <RefreshIcon /> {/* No label for screen readers */}
</button>

<div> {/* No semantic meaning */}
  <h2>Sales Overview</h2>
</div>
```

### Keyboard Navigation

**✅ DO:**
```tsx
// Support keyboard events
<div 
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Action
</div>
```

**❌ DON'T:**
```tsx
// Mouse-only interactions
<div onClick={handleClick}>
  Action {/* Not keyboard accessible */}
</div>
```

## Mobile Optimization

### Touch Targets

**✅ DO:**
```tsx
// Minimum 44x44px touch targets
<Button className="min-h-[44px] min-w-[44px]">
  <Icon />
</Button>
```

**❌ DON'T:**
```tsx
// Too small for touch
<Button className="h-6 w-6 p-0">
  <Icon />
</Button>
```

### Responsive Design

**✅ DO:**
```tsx
// Mobile-first approach
<div className={cn(
  'grid gap-4',
  'grid-cols-1',           // Mobile
  'md:grid-cols-2',        // Tablet
  'lg:grid-cols-3'         // Desktop
)}>
```

**❌ DON'T:**
```tsx
// Fixed layouts
<div className="grid grid-cols-3 gap-4">
  {/* Breaks on mobile */}
</div>
```

## Error Handling

### Error Boundaries

**✅ DO:**
```tsx
// Granular error boundaries per section
<DashboardSectionWrapper>
  <PurchaseSection />
</DashboardSectionWrapper>

<DashboardSectionWrapper>
  <InventorySection />
</DashboardSectionWrapper>
```

**❌ DON'T:**
```tsx
// Single error boundary for everything
<ErrorBoundary>
  <PurchaseSection />
  <InventorySection />
  {/* One error breaks everything */}
</ErrorBoundary>
```

### Loading States

**✅ DO:**
```tsx
// Show meaningful loading states
if (isLoading) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32" />
      <Skeleton className="h-24" />
    </div>
  );
}
```

**❌ DON'T:**
```tsx
// Generic or no loading state
if (isLoading) return <div>Loading...</div>;
```

## Real-time Updates

### Selective Subscriptions

**✅ DO:**
```tsx
// Subscribe only to relevant tables
useEffect(() => {
  const channel = supabase
    .channel('dashboard-updates')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'sales_orders',
      filter: `company_id=eq.${companyId}`,
    }, handleChange)
    .subscribe();
    
  return () => supabase.removeChannel(channel);
}, [companyId]);
```

**❌ DON'T:**
```tsx
// Subscribe to everything
supabase
  .channel('all-changes')
  .on('postgres_changes', { event: '*', schema: 'public' }, handleChange)
  .subscribe();
```

### Optimistic Updates

**✅ DO:**
```tsx
// Update UI immediately, then sync
const { mutate } = useMutation({
  mutationFn: updateData,
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['data']);
    const previous = queryClient.getQueryData(['data']);
    queryClient.setQueryData(['data'], newData);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['data'], context.previous);
  },
});
```

**❌ DON'T:**
```tsx
// Wait for server response
const handleUpdate = async () => {
  setLoading(true);
  await updateData();
  await refetch();
  setLoading(false);
};
```

## TypeScript Best Practices

### Type Definitions

**✅ DO:**
```tsx
// Define clear interfaces
interface DashboardKPIs {
  totalRevenue: number;
  activeOrders: number;
  lowStockAlerts: number;
  cashFlow: number;
}

// Use proper typing
const Section: React.FC<{ data: DashboardKPIs }> = ({ data }) => {
  // TypeScript catches errors
};
```

**❌ DON'T:**
```tsx
// Use 'any'
const Section = ({ data }: any) => {
  // No type safety
};
```

## Testing

### Unit Tests

**✅ DO:**
```tsx
// Test components in isolation
test('displays purchase data', () => {
  render(
    <TestWrapper>
      <PurchaseSection companyId="test" />
    </TestWrapper>
  );
  expect(screen.getByText('Purchase & Procurement')).toBeInTheDocument();
});
```

**❌ DON'T:**
```tsx
// Test implementation details
test('calls useQuery with correct params', () => {
  // Testing internals, not behavior
});
```

### Integration Tests

**✅ DO:**
```tsx
// Test user workflows
test('refreshes data when button clicked', async () => {
  render(<Dashboard />);
  const refreshButton = screen.getByLabelText('Refresh dashboard');
  await userEvent.click(refreshButton);
  expect(await screen.findByText('Updated')).toBeInTheDocument();
});
```

## Security

### Data Access

**✅ DO:**
```tsx
// Use RLS policies
const { data } = await supabase
  .from('sales_orders')
  .select('*')
  .eq('company_id', companyId);
  // RLS ensures user can only see their data
```

**❌ DON'T:**
```tsx
// Fetch all data and filter client-side
const { data } = await supabase
  .from('sales_orders')
  .select('*');
const filtered = data.filter(o => o.company_id === companyId);
```

### Input Validation

**✅ DO:**
```tsx
// Validate and sanitize inputs
const schema = z.object({
  companyId: z.string().uuid(),
  date: z.date(),
});

const validated = schema.parse(input);
```

**❌ DON'T:**
```tsx
// Trust user input
const result = await fetch(`/api/data?id=${userInput}`);
```

## Documentation

### Component Documentation

**✅ DO:**
```tsx
/**
 * Purchase Section Component
 * 
 * Displays purchase-related metrics including:
 * - Pending receipts with progress
 * - Open PO count and value
 * - Top vendors by open PO value
 * 
 * @param {string} companyId - Company identifier
 * @example
 * ```tsx
 * <PurchaseSection companyId="123" />
 * ```
 */
export const PurchaseSection: React.FC<Props> = ({ companyId }) => {
  // ...
};
```

**❌ DON'T:**
```tsx
// No documentation
export const PurchaseSection = ({ companyId }) => {
  // What does this do?
};
```

## Deployment

### Build Optimization

**✅ DO:**
```tsx
// Code splitting
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Environment-specific configs
const API_URL = import.meta.env.VITE_API_URL;
```

**❌ DON'T:**
```tsx
// Bundle everything
import HeavyComponent from './HeavyComponent';

// Hardcode values
const API_URL = 'https://production.api.com';
```

### Monitoring

**✅ DO:**
```tsx
// Track performance
import { measurePerformance } from '@/utils/performanceMonitor';

const MyComponent = () => {
  useEffect(() => {
    measurePerformance('MyComponent.render');
  });
  // ...
};
```

## Summary Checklist

- ✅ Use semantic HTML and ARIA labels
- ✅ Implement keyboard navigation
- ✅ Optimize for mobile (44px touch targets)
- ✅ Memoize expensive operations
- ✅ Use React Query for data fetching
- ✅ Handle errors gracefully
- ✅ Show meaningful loading states
- ✅ Use TypeScript properly
- ✅ Write component tests
- ✅ Document components
- ✅ Implement real-time updates selectively
- ✅ Secure data access with RLS
- ✅ Monitor performance
- ✅ Code split heavy components

---

Following these best practices will ensure the dashboard remains performant, accessible, maintainable, and secure.
