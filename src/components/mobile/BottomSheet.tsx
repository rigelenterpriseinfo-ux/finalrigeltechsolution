import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: number[]; // Percentage heights: [50, 90]
  defaultSnap?: number;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [90],
  defaultSnap = 0,
}) => {
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);

  const { handlers, swipeState } = useSwipeGesture({
    threshold: 50,
    onSwipedDown: () => {
      if (currentSnap === snapPoints.length - 1 || snapPoints.length === 1) {
        onClose();
      } else {
        setCurrentSnap((prev) => Math.min(prev + 1, snapPoints.length - 1));
      }
    },
    onSwipedUp: () => {
      setCurrentSnap((prev) => Math.max(prev - 1, 0));
    },
    onSwiping: () => {
      setIsDragging(true);
    },
  });

  useEffect(() => {
    if (!swipeState.isSwiping) {
      setIsDragging(false);
    }
  }, [swipeState.isSwiping]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const height = snapPoints[currentSnap];
  const translateY = isDragging ? Math.max(swipeState.deltaY, 0) : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-background/80 backdrop-blur-sm z-50',
          'animate-fade-in'
        )}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-background rounded-t-2xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          !isDragging && 'transform'
        )}
        style={{
          height: `${height}vh`,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {/* Drag Handle */}
        <div
          {...handlers}
          className="flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
        >
          <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mb-2" />
          {title && (
            <div className="flex items-center justify-between w-full px-4 py-2">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-full px-4 pb-8">
          {children}
        </div>
      </div>
    </>
  );
};
