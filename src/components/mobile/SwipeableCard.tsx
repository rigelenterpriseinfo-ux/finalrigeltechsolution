import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

interface SwipeAction {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  color?: 'destructive' | 'primary' | 'secondary';
}

interface SwipeableCardProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  threshold?: number;
  className?: string;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 80,
  className,
}) => {
  const [isRevealed, setIsRevealed] = useState<'left' | 'right' | null>(null);

  const { handlers, swipeState } = useSwipeGesture({
    threshold,
    onSwipedLeft: () => {
      if (rightActions.length > 0) {
        setIsRevealed('right');
      }
    },
    onSwipedRight: () => {
      if (leftActions.length > 0) {
        setIsRevealed('left');
      }
    },
  });

  const getTranslateX = () => {
    if (isRevealed === 'left') return 80;
    if (isRevealed === 'right') return -80;
    if (swipeState.isSwiping) {
      const maxSwipe = 100;
      return Math.max(-maxSwipe, Math.min(maxSwipe, swipeState.deltaX));
    }
    return 0;
  };

  const handleActionClick = (action: SwipeAction) => {
    action.onClick();
    setIsRevealed(null);
  };

  const getColorClass = (color?: SwipeAction['color']) => {
    switch (color) {
      case 'destructive':
        return 'bg-destructive text-destructive-foreground';
      case 'primary':
        return 'bg-primary text-primary-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Left Actions */}
      {leftActions.length > 0 && (
        <div className="absolute left-0 top-0 bottom-0 flex items-center gap-2 pl-2">
          {leftActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => handleActionClick(action)}
                className={cn(
                  'w-16 h-full flex flex-col items-center justify-center gap-1',
                  'rounded-lg transition-opacity',
                  getColorClass(action.color),
                  isRevealed === 'left' ? 'opacity-100' : 'opacity-0'
                )}
                aria-label={action.label}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Right Actions */}
      {rightActions.length > 0 && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center gap-2 pr-2">
          {rightActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => handleActionClick(action)}
                className={cn(
                  'w-16 h-full flex flex-col items-center justify-center gap-1',
                  'rounded-lg transition-opacity',
                  getColorClass(action.color),
                  isRevealed === 'right' ? 'opacity-100' : 'opacity-0'
                )}
                aria-label={action.label}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Card Content */}
      <div
        {...handlers}
        className="relative z-10"
        style={{
          transform: `translateX(${getTranslateX()}px)`,
          transition: swipeState.isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        <Card
          className={cn('cursor-grab active:cursor-grabbing', className)}
        >
          {children}
        </Card>
      </div>
    </div>
  );
};
