# Phase 13: Real-time Notifications, Toast System & Alert Management

## Overview
Phase 13 implements a comprehensive notification system with real-time alerts, smart notification management, user preferences, and a centralized notification center. This phase adds critical user engagement features that keep users informed about important events and updates in their dashboard.

## Features Implemented

### 1. Notifications Hook
**File**: `src/hooks/useNotifications.ts`

A comprehensive hook that manages the entire notification system.

**Features**:
- **In-memory + localStorage persistence**: Notifications stored locally
- **Type-based notifications**: Success, Error, Warning, Info
- **Priority levels**: Low, Medium, High, Urgent
- **Toast integration**: Auto-shows toasts via Sonner
- **Sound notifications**: Plays sound for high-priority alerts
- **Vibration support**: Haptic feedback on mobile
- **Desktop notifications**: Browser notifications for urgent alerts
- **Read/unread tracking**: Mark notifications as read
- **Notification history**: Keeps last 100 notifications
- **Quiet hours**: Mute notifications during specified times
- **Category filtering**: Filter by notification category
- **Action buttons**: Add actionable buttons to notifications

**Key Functions**:
```typescript
{
  addNotification(notification),    // Add new notification
  markAsRead(id),                   // Mark single as read
  markAllAsRead(),                  // Mark all as read
  deleteNotification(id),           // Delete notification
  clearAll(),                       // Clear all notifications
  updatePreferences(prefs),         // Update user preferences
  unreadCount,                      // Number of unread
  urgentCount,                      // Number of urgent unread
}
```

**Notification Interface**:
```typescript
{
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: { label: string; onClick: () => void };
  category?: string;
  metadata?: Record<string, any>;
}
```

### 2. Notification Center
**File**: `src/components/notifications/NotificationCenter.tsx`

A slide-out panel that displays all notifications.

**Features**:
- **Badge indicator**: Shows unread count on bell icon
- **Pulse animation**: Urgent notifications pulse
- **Three tabs**: All, Unread, Urgent
- **Grouped by date**: Today, Yesterday, or date
- **Mark all as read**: Batch action
- **Clear all**: Remove all notifications
- **Settings access**: Quick access to preferences
- **Responsive**: Full-width on mobile
- **Smooth animations**: Stagger animation for list
- **Empty states**: Beautiful empty state messages

**Usage**:
```tsx
<NotificationCenter />
```

### 3. Notification Item
**File**: `src/components/notifications/NotificationItem.tsx`

Individual notification display with rich features.

**Features**:
- **Type indicators**: Different icons per type (✓, ⚠, ℹ, ✕)
- **Priority colors**: Border color based on priority
- **Unread indicator**: Blue dot for unread
- **Relative timestamps**: "2 minutes ago" format
- **Action buttons**: Inline action buttons
- **Delete on hover**: X button appears on hover
- **Category badges**: Shows notification category
- **Click to read**: Marks as read on click
- **Compact layout**: Optimized for mobile

### 4. Notification Preferences
**File**: `src/components/notifications/NotificationPreferences.tsx`

Comprehensive settings for notification behavior.

**Preference Options**:

#### Master Toggle
- Enable/disable all notifications

#### Sound & Haptics
- **Sound**: Play sound for high-priority alerts
- **Vibration**: Vibrate device for important notifications

#### Desktop Notifications
- **Desktop notifications**: System notifications for urgent alerts
- Requests browser permission automatically

#### Quiet Hours
- **Enable quiet hours**: Mute during specified times
- **Start time**: When to start (HH:mm format)
- **End time**: When to end (HH:mm format)
- Supports overnight hours (e.g., 22:00 to 08:00)

#### Categories
- **Orders**: Order-related notifications
- **Inventory**: Stock and inventory alerts
- **Payments**: Payment and financial notifications
- **System**: System messages

**Features**:
- Back button to return to notifications
- Visual icons for each setting
- Disabled state when master toggle is off
- Time inputs for quiet hours
- Individual category toggles

### 5. Notification Context
**File**: `src/contexts/NotificationContext.tsx`

React Context for global notification access.

**Usage**:
```tsx
// In App.tsx
<NotificationProvider>
  <App />
</NotificationProvider>

// In any component
const { addNotification } = useNotificationContext();

addNotification({
  type: 'success',
  priority: 'high',
  title: 'Order Confirmed',
  message: 'Your order #12345 has been confirmed',
  category: 'orders',
  action: {
    label: 'View Order',
    onClick: () => navigate('/orders/12345')
  }
});
```

### 6. Smart Notification Manager
**File**: `src/components/notifications/SmartNotificationManager.tsx`

Automatically monitors data and triggers intelligent notifications.

**Smart Triggers**:

#### Low Stock Alerts
- Monitors inventory levels
- Alerts when items <= reorder point
- **Priority**: High
- **Category**: inventory
- **Action**: View inventory

#### Pending Orders
- Monitors order status
- Alerts when > 5 pending orders
- **Priority**: Medium
- **Category**: orders
- **Action**: View orders

#### Overdue Payments
- Monitors payment due dates
- Alerts for overdue payments
- **Priority**: Urgent
- **Category**: payments
- **Action**: View payments

**How It Works**:
1. Subscribes to React Query cache updates
2. Monitors specific query keys (inventory, orders, payments)
3. Applies business logic to detect issues
4. Automatically triggers notifications
5. Respects user preferences

## Integration Points

### Dashboard Integration
```tsx
<RedesignedDashboard companyId={companyId} />
// Now includes:
// - NotificationCenter in header
// - SmartNotificationManager for auto-alerts
```

### Manual Notifications
```tsx
import { useNotificationContext } from '@/contexts/NotificationContext';

const { addNotification } = useNotificationContext();

// Success notification
addNotification({
  type: 'success',
  priority: 'medium',
  title: 'Changes Saved',
  message: 'Your profile has been updated successfully',
});

// Error with action
addNotification({
  type: 'error',
  priority: 'high',
  title: 'Payment Failed',
  message: 'Unable to process payment. Please try again.',
  action: {
    label: 'Retry',
    onClick: () => retryPayment(),
  },
});

// Urgent system alert
addNotification({
  type: 'warning',
  priority: 'urgent',
  title: 'System Maintenance',
  message: 'Scheduled maintenance in 5 minutes',
  category: 'system',
});
```

## Notification Types & Priorities

### Types
1. **Success** (✓): Confirmations, completions
2. **Error** (✕): Failures, critical issues
3. **Warning** (⚠): Alerts, cautions
4. **Info** (ℹ): General information, updates

### Priorities
1. **Low**: Minor updates, non-actionable
2. **Medium**: Standard notifications
3. **High**: Important, needs attention (sound + vibration)
4. **Urgent**: Critical, immediate action needed (desktop + sound + vibration)

## Notification Flow

```
1. Event occurs → 2. addNotification() → 3. Check preferences
                                                ↓
                                          4. Show toast
                                                ↓
                                          5. Play sound (high/urgent)
                                                ↓
                                          6. Vibrate (high/urgent)
                                                ↓
                                          7. Desktop notification (urgent)
                                                ↓
                                          8. Store in history
```

## Best Practices

### 1. Priority Selection
- **Urgent**: System outages, critical errors, urgent deadlines
- **High**: Low stock, failed payments, important updates
- **Medium**: Order confirmations, standard updates
- **Low**: Informational messages, tips

### 2. Message Writing
- **Title**: Clear, concise (< 50 chars)
- **Message**: Specific, actionable (< 150 chars)
- **Action**: Clear verb ("View Order", "Retry Payment")

### 3. Frequency
- Avoid notification spam
- Batch similar notifications
- Respect quiet hours
- Use appropriate priorities

### 4. Categories
- Consistent categorization
- Enable filtering
- Allow user control
- Group related notifications

## Performance Considerations

### Storage
- Maximum 100 notifications stored
- Automatic cleanup of old notifications
- LocalStorage for persistence
- Efficient JSON serialization

### Memory
- React Context for global access
- Memoized callbacks
- Optimized re-renders
- Cleanup on unmount

### Battery & Resources
- Debounced sound/vibration
- Efficient desktop notifications
- Quiet hours support
- Conditional rendering

## Accessibility

### Screen Readers
- Proper ARIA labels on bell icon
- Notification count announced
- Readable notification content
- Action button labels

### Keyboard Navigation
- Tab-able interactive elements
- Enter/Space to activate
- Escape to close
- Focus management

### Visual Indicators
- Color-coded priorities
- Icons for types
- Unread indicators
- High contrast support

## Browser Compatibility

### Desktop Notifications
- Chrome 22+
- Firefox 22+
- Safari 6+
- Edge 14+

### Vibration API
- Chrome Mobile 32+
- Firefox Mobile 16+
- Safari Mobile 13+

### Web Audio API (Sound)
- All modern browsers
- Fallback: Silent notifications

## Testing Notifications

### Manual Testing
```tsx
// Test all types
addNotification({ type: 'success', priority: 'medium', title: 'Test', message: 'Success' });
addNotification({ type: 'error', priority: 'high', title: 'Test', message: 'Error' });
addNotification({ type: 'warning', priority: 'urgent', title: 'Test', message: 'Warning' });
addNotification({ type: 'info', priority: 'low', title: 'Test', message: 'Info' });

// Test actions
addNotification({
  type: 'info',
  priority: 'medium',
  title: 'Test Action',
  message: 'Click the action button',
  action: { label: 'Test', onClick: () => console.log('Action clicked') }
});

// Test categories
addNotification({
  type: 'warning',
  priority: 'high',
  title: 'Test Category',
  message: 'Check category badge',
  category: 'orders'
});
```

### Automated Testing
```typescript
describe('useNotifications', () => {
  it('adds notification', () => {
    const { result } = renderHook(() => useNotifications());
    
    act(() => {
      result.current.addNotification({
        type: 'success',
        priority: 'medium',
        title: 'Test',
        message: 'Test message',
      });
    });
    
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });
  
  it('marks as read', () => {
    // ... test implementation
  });
});
```

## Future Enhancements

### Potential Features
1. **Notification Grouping**: Group similar notifications
2. **Smart Batching**: Delay and batch similar alerts
3. **Rich Media**: Images, videos in notifications
4. **Templates**: Pre-defined notification templates
5. **Scheduled Notifications**: Schedule for later
6. **Push Notifications**: Server-side push
7. **Email/SMS**: Multi-channel notifications
8. **Analytics**: Track notification engagement
9. **A/B Testing**: Test different notification styles
10. **Machine Learning**: Learn user preferences

### Advanced Features
1. **Priority Learning**: Auto-adjust based on user behavior
2. **Context Awareness**: Time-based, location-based
3. **Smart Muting**: Auto-mute low-engagement notifications
4. **Notification Digest**: Daily/weekly summaries
5. **Custom Sounds**: User-selectable notification sounds

## Conclusion

Phase 13 successfully implements a comprehensive notification system that keeps users informed and engaged with their dashboard. The system is intelligent, customizable, and respectful of user preferences while providing critical real-time alerts.

**Key Achievements**:
- ✅ Comprehensive notification hook
- ✅ Beautiful notification center
- ✅ Rich notification items
- ✅ Detailed user preferences
- ✅ Smart automatic notifications
- ✅ Toast integration
- ✅ Sound & vibration support
- ✅ Desktop notifications
- ✅ Quiet hours
- ✅ Category filtering
- ✅ Action buttons
- ✅ Read/unread tracking
- ✅ Notification history
- ✅ Performance optimized
- ✅ Fully accessible

The notification system provides a professional, user-friendly way to keep users informed about important events, changes, and actions needed in their dashboard, significantly enhancing user engagement and experience.
