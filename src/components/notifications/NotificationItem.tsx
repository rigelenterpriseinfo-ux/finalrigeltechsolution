import React from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItemProps {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRead,
  onDelete,
}) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <Info className="h-5 w-5 text-info" />;
    }
  };

  const getPriorityColor = () => {
    switch (notification.priority) {
      case 'urgent':
        return 'border-l-destructive';
      case 'high':
        return 'border-l-warning';
      case 'medium':
        return 'border-l-info';
      default:
        return 'border-l-muted';
    }
  };

  return (
    <div
      className={cn(
        'group relative p-4 rounded-lg border-l-4 transition-all',
        'hover:bg-muted/50 cursor-pointer',
        getPriorityColor(),
        notification.read ? 'bg-background' : 'bg-primary/5'
      )}
      onClick={() => {
        if (!notification.read) onRead();
        notification.action?.onClick();
      }}
    >
      {/* Unread Indicator */}
      {!notification.read && (
        <div className="absolute top-4 right-4 h-2 w-2 bg-primary rounded-full" />
      )}

      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-sm leading-tight">{notification.title}</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {notification.message}
          </p>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
            </span>

            {notification.action && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  notification.action?.onClick();
                }}
              >
                {notification.action.label}
              </Button>
            )}
          </div>

          {notification.category && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
              {notification.category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
