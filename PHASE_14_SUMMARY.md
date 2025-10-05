# Phase 14: Command Palette, Global Search & Power User Features

## Overview
Phase 14 implements a powerful command palette and global search system that provides keyboard-driven navigation, fuzzy search capabilities, and quick actions. This phase transforms the dashboard into a power-user-friendly application with advanced search and command execution features.

## Features Implemented

### 1. Command Palette Hook
**File**: `src/hooks/useCommandPalette.ts`

A comprehensive hook managing the command palette system with fuzzy search.

**Key Features**:
- **Fuzzy search**: Uses Fuse.js for intelligent command matching
- **Command history**: Tracks recently used commands
- **Keyboard shortcuts**: Cmd+K / Ctrl+K to open
- **Command categories**: Navigation, Actions, Search, Recent
- **Local storage**: Persists command history
- **Smart filtering**: Shows relevant commands based on context

**Command Interface**:
```typescript
{
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType;
  keywords?: string[];
  category: 'navigation' | 'action' | 'search' | 'recent';
  action: () => void;
  shortcut?: string;
}
```

**Built-in Commands**:

#### Navigation (7 commands)
- Go to Dashboard (Ctrl+D)
- Go to Inventory (Ctrl+I)
- Go to Sales (Ctrl+S)
- Go to Purchase (Ctrl+P)
- Go to Reports (Ctrl+R)
- Go to Settings
- Plus keywords for each

#### Actions (8 commands)
- Create New Order
- Create New Invoice
- Add New Product
- Export Dashboard Data
- Toggle Compact View
- Refresh Dashboard
- Customize Dashboard
- View Notifications

**Usage**:
```typescript
const {
  isOpen,
  setIsOpen,
  search,
  setSearch,
  filteredCommands,
  groupedCommands,
  executeCommand,
  history,
  clearHistory,
} = useCommandPalette();
```

### 2. Command Palette Component
**File**: `src/components/command/CommandPalette.tsx`

Beautiful command palette UI with keyboard navigation.

**Features**:
- **Modal dialog**: Full-screen overlay
- **Keyboard navigation**: Arrow keys + Enter
- **Visual feedback**: Highlighted selection
- **Category grouping**: Commands grouped by type
- **Keyboard shortcuts display**: Shows shortcuts inline
- **Result count**: Shows number of matches
- **Help footer**: Quick reference for keys
- **Auto-focus**: Input focused on open
- **Smooth scrolling**: Selected item auto-scrolls

**Keyboard Controls**:
- `⌘K` / `Ctrl+K`: Open/close palette
- `↑` / `↓`: Navigate commands
- `↵`: Execute selected command
- `Esc`: Close palette

**Visual Elements**:
- Category icons (Home, Zap, Search, Clock)
- Command icons
- Keyboard shortcut badges
- Hover states
- Selection highlighting
- Right chevron indicators

### 3. Command Palette Trigger
**File**: `src/components/command/CommandPaletteTrigger.tsx`

Customizable trigger buttons for opening the palette.

**Variants**:

#### Button Variant
```tsx
<CommandPaletteTrigger variant="button" />
```
- Compact button with icon
- Shows ⌘K badge
- Responsive text (hidden on small screens)

#### Search Bar Variant
```tsx
<CommandPaletteTrigger variant="search-bar" />
```
- Full-width search input appearance
- Placeholder text
- Hover effects
- ⌘K indicator

### 4. Global Search Hook
**File**: `src/hooks/useGlobalSearch.ts`

Powerful search across all data types.

**Searchable Data Types**:
1. **Orders**: Order number, customer, amount
2. **Invoices**: Invoice number, customer, amount
3. **Products**: Name, SKU, stock level
4. **Customers**: Name, email, phone
5. **Suppliers**: Name, email, phone

**Features**:
- Fuzzy search with Fuse.js
- Real-time search results
- Type-specific grouping
- Direct navigation to results
- Metadata preservation
- URL generation

**Search Result Interface**:
```typescript
{
  id: string;
  type: 'order' | 'invoice' | 'product' | 'customer' | 'supplier';
  title: string;
  subtitle?: string;
  metadata?: Record<string, any>;
  url: string;
}
```

**Usage**:
```typescript
const {
  query,
  setQuery,
  results,
  groupedResults,
  clearSearch,
  isSearching,
} = useGlobalSearch({
  orders,
  invoices,
  products,
  customers,
  suppliers,
});
```

### 5. Global Search Dialog
**File**: `src/components/search/GlobalSearchDialog.tsx`

Beautiful search interface for finding records.

**Features**:
- **Type-specific icons**: Different colors per type
- **Result grouping**: Grouped by type with counts
- **Keyboard navigation**: Arrow keys + Enter
- **Direct linking**: Click or Enter to navigate
- **Empty states**: Beautiful placeholders
- **Result counts**: Shows matches per type
- **Truncated text**: Handles long names gracefully
- **Type badges**: Visual type indicators

**Type Colors**:
- Orders: Blue
- Invoices: Green
- Products: Purple
- Customers: Orange
- Suppliers: Pink

**Icons Per Type**:
- Orders: ShoppingCart
- Invoices: FileText
- Products: Package
- Customers: Users
- Suppliers: Building

## Command System Architecture

### Command Flow
```
1. User presses ⌘K
   ↓
2. Command Palette opens
   ↓
3. User types query
   ↓
4. Fuzzy search filters commands
   ↓
5. User selects command (keyboard or mouse)
   ↓
6. Command action executes
   ↓
7. Command added to history
   ↓
8. Palette closes
```

### Search Flow
```
1. User opens search dialog
   ↓
2. Types search query
   ↓
3. Fuzzy search across all data
   ↓
4. Results grouped by type
   ↓
5. User selects result
   ↓
6. Navigates to detail view
   ↓
7. Dialog closes
```

## Integration Points

### Dashboard Integration
```tsx
<RedesignedDashboard>
  {/* Command Palette - Global */}
  <CommandPalette />
  
  {/* Trigger Button in Header */}
  <CommandPaletteTrigger variant="button" />
</RedesignedDashboard>
```

### Adding Custom Commands
```typescript
// In useCommandPalette.ts
const commands: Command[] = useMemo(() => [
  {
    id: 'custom-action',
    label: 'Custom Action',
    description: 'Performs custom action',
    category: 'action',
    keywords: ['custom', 'special'],
    action: () => {
      // Your custom logic
      customFunction();
    },
    shortcut: 'Ctrl+Alt+C',
  },
  // ... other commands
], [dependencies]);
```

### Using Global Search
```tsx
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog';
import { useState } from 'react';

const [isSearchOpen, setIsSearchOpen] = useState(false);

// Keyboard shortcut (Ctrl+/)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      setIsSearchOpen(true);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

<GlobalSearchDialog
  isOpen={isSearchOpen}
  onOpenChange={setIsSearchOpen}
  data={{
    orders: ordersData,
    invoices: invoicesData,
    products: productsData,
    customers: customersData,
    suppliers: suppliersData,
  }}
/>
```

## Fuzzy Search Configuration

### Fuse.js Settings
```typescript
{
  keys: ['label', 'description', 'keywords'],
  threshold: 0.3,  // 0.0 = perfect match, 1.0 = match anything
  includeScore: true,
}
```

### Search Quality
- **Threshold 0.3**: Balanced between precision and recall
- **Multiple keys**: Searches label, description, and keywords
- **Score included**: For potential ranking improvements

## Keyboard Shortcuts Summary

### Global Shortcuts
- `⌘K` / `Ctrl+K`: Open command palette
- `⌘/` / `Ctrl+/`: Open global search (future)
- `Esc`: Close any open dialog

### Navigation Shortcuts (via commands)
- `Ctrl+D`: Go to Dashboard
- `Ctrl+I`: Go to Inventory
- `Ctrl+S`: Go to Sales
- `Ctrl+P`: Go to Purchase
- `Ctrl+R`: Go to Reports

### Within Palette/Search
- `↑` / `↓`: Navigate items
- `↵`: Select/Execute
- `Esc`: Close

## Performance Optimizations

### Fuzzy Search
- Memoized Fuse instance
- Efficient re-computation on data change
- Lazy evaluation of search results

### Command Filtering
- Memoized filtered commands
- Efficient grouping algorithm
- Minimal re-renders

### History Management
- Local storage persistence
- Maximum 10 recent commands
- Cleanup on unmount

### Keyboard Event Handling
- Single global listener
- Event cleanup on component unmount
- Prevented default behaviors

## Accessibility Features

### Keyboard Navigation
- Full keyboard control
- Focus management
- Tab order optimization
- Escape key support

### Screen Readers
- Proper ARIA labels
- Role attributes
- Descriptive text
- Keyboard shortcut indicators

### Visual Indicators
- Clear selection state
- High contrast modes
- Icon + text labels
- Badge indicators

## Use Cases

### 1. Quick Navigation
**Problem**: Clicking through multiple menus to reach a page
**Solution**: Press ⌘K, type "inventory", press Enter

### 2. Creating Records
**Problem**: Finding the "New Order" button
**Solution**: ⌘K → "new order" → Enter

### 3. Finding Specific Order
**Problem**: Searching through long list of orders
**Solution**: Use global search → type order number → navigate

### 4. Keyboard-Only Workflow
**Problem**: Mouse-based navigation is slow
**Solution**: Use all keyboard shortcuts for navigation

### 5. Power User Actions
**Problem**: Performing common actions quickly
**Solution**: Memorize command shortcuts, use history

## Testing the System

### Manual Testing

#### Test Command Palette
```
1. Press Ctrl+K (or ⌘K on Mac)
2. Type "dashboard"
3. Press Enter
4. Verify navigation to dashboard
5. Press Ctrl+K again
6. Arrow down to select different command
7. Press Enter
8. Verify command executed
```

#### Test Fuzzy Search
```
1. Open command palette
2. Type "invntry" (misspelled)
3. Verify "Go to Inventory" appears
4. Type "ord"
5. Verify order-related commands appear
```

#### Test History
```
1. Execute several commands
2. Close and reopen palette
3. Verify recent commands shown first
4. Type new search
5. Verify history commands appear again when cleared
```

### Automated Testing
```typescript
describe('useCommandPalette', () => {
  it('filters commands by search', () => {
    const { result } = renderHook(() => useCommandPalette());
    
    act(() => {
      result.current.setSearch('inventory');
    });
    
    expect(result.current.filteredCommands).toContainEqual(
      expect.objectContaining({ label: 'Go to Inventory' })
    );
  });
  
  it('tracks command history', () => {
    const { result } = renderHook(() => useCommandPalette());
    const command = result.current.commands[0];
    
    act(() => {
      result.current.executeCommand(command);
    });
    
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].commandId).toBe(command.id);
  });
});
```

## Future Enhancements

### Potential Features
1. **Custom Command Groups**: User-defined command categories
2. **Command Aliases**: Multiple names for same command
3. **Parametrized Commands**: Commands that accept arguments
4. **Command Chains**: Execute multiple commands in sequence
5. **Conditional Commands**: Show commands based on context
6. **Recent Searches**: Track and show recent search queries
7. **Search Suggestions**: Autocomplete suggestions
8. **Voice Commands**: Voice-activated command execution
9. **Command Macros**: Record and replay command sequences
10. **External Integrations**: Search external systems

### Advanced Features
1. **AI-Powered Search**: Natural language command interpretation
2. **Smart Suggestions**: Context-aware command suggestions
3. **Command Learning**: Learn user patterns and prioritize
4. **Multi-step Wizards**: Guided workflows via commands
5. **Collaborative Commands**: Team-shared custom commands
6. **Command Analytics**: Track popular commands
7. **Command Marketplace**: Share/download command packs
8. **Cross-App Search**: Search across multiple applications

## Best Practices

### Command Design
1. **Clear Labels**: Use action verbs (Go, Create, Toggle)
2. **Good Keywords**: Include synonyms and abbreviations
3. **Helpful Descriptions**: Explain what command does
4. **Logical Grouping**: Use appropriate categories
5. **Consistent Shortcuts**: Follow platform conventions

### Search Optimization
1. **Index Important Fields**: Title, subtitle, key metadata
2. **Reasonable Threshold**: Balance precision and recall
3. **Type Indicators**: Clear visual distinction
4. **Quick Navigation**: Minimize clicks to destination
5. **Relevant Results**: Show most useful matches first

### User Experience
1. **Fast Response**: Immediate search results
2. **Clear Feedback**: Visual indication of selection
3. **Help Text**: Show keyboard shortcuts
4. **Empty States**: Helpful messages when no results
5. **Error Recovery**: Graceful handling of failures

## Conclusion

Phase 14 successfully implements a powerful command palette and global search system that significantly enhances productivity for power users. The keyboard-driven interface, fuzzy search, and quick actions provide a modern, efficient way to navigate and interact with the dashboard.

**Key Achievements**:
- ✅ Command palette with ⌘K shortcut
- ✅ Fuzzy search for commands
- ✅ Command history tracking
- ✅ Keyboard navigation
- ✅ Category grouping
- ✅ Global search across all data types
- ✅ Type-specific result grouping
- ✅ Direct navigation to records
- ✅ Beautiful, accessible UI
- ✅ Performance optimized
- ✅ Fully keyboard-driven
- ✅ Extensible architecture
- ✅ Local storage persistence
- ✅ Smart filtering

The system provides a professional, power-user-friendly interface that makes navigation and actions incredibly fast and efficient, similar to modern applications like VS Code, Linear, and Notion.
