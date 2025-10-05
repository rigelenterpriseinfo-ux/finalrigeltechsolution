import { useRef, useState, useCallback } from 'react';

interface SwipeConfig {
  threshold?: number;
  preventDefaultTouchmoveEvent?: boolean;
  trackMouse?: boolean;
  onSwipedLeft?: () => void;
  onSwipedRight?: () => void;
  onSwipedUp?: () => void;
  onSwipedDown?: () => void;
  onSwiping?: (deltaX: number, deltaY: number) => void;
}

interface SwipeState {
  isSwiping: boolean;
  direction: 'left' | 'right' | 'up' | 'down' | null;
  deltaX: number;
  deltaY: number;
}

export const useSwipeGesture = (config: SwipeConfig = {}) => {
  const {
    threshold = 50,
    preventDefaultTouchmoveEvent = true,
    trackMouse = false,
    onSwipedLeft,
    onSwipedRight,
    onSwipedUp,
    onSwipedDown,
    onSwiping,
  } = config;

  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    deltaX: 0,
    deltaY: 0,
  });

  const startPos = useRef<{ x: number; y: number } | null>(null);
  const currentPos = useRef<{ x: number; y: number } | null>(null);

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      startPos.current = { x: clientX, y: clientY };
      currentPos.current = { x: clientX, y: clientY };
      setSwipeState({
        isSwiping: true,
        direction: null,
        deltaX: 0,
        deltaY: 0,
      });
    },
    []
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPos.current) return;

      currentPos.current = { x: clientX, y: clientY };
      const deltaX = clientX - startPos.current.x;
      const deltaY = clientY - startPos.current.y;

      setSwipeState((prev) => ({
        ...prev,
        deltaX,
        deltaY,
      }));

      onSwiping?.(deltaX, deltaY);
    },
    [onSwiping]
  );

  const handleEnd = useCallback(() => {
    if (!startPos.current || !currentPos.current) return;

    const deltaX = currentPos.current.x - startPos.current.x;
    const deltaY = currentPos.current.y - startPos.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    let direction: SwipeState['direction'] = null;

    if (absDeltaX > threshold || absDeltaY > threshold) {
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (deltaX > 0) {
          direction = 'right';
          onSwipedRight?.();
        } else {
          direction = 'left';
          onSwipedLeft?.();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          direction = 'down';
          onSwipedDown?.();
        } else {
          direction = 'up';
          onSwipedUp?.();
        }
      }
    }

    setSwipeState({
      isSwiping: false,
      direction,
      deltaX: 0,
      deltaY: 0,
    });

    startPos.current = null;
    currentPos.current = null;
  }, [threshold, onSwipedLeft, onSwipedRight, onSwipedUp, onSwipedDown]);

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (preventDefaultTouchmoveEvent) {
        e.preventDefault();
      }
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    },
    onTouchEnd: handleEnd,
    ...(trackMouse && {
      onMouseDown: (e: React.MouseEvent) => {
        handleStart(e.clientX, e.clientY);
      },
      onMouseMove: (e: React.MouseEvent) => {
        if (swipeState.isSwiping) {
          handleMove(e.clientX, e.clientY);
        }
      },
      onMouseUp: handleEnd,
      onMouseLeave: handleEnd,
    }),
  };

  return {
    handlers,
    swipeState,
  };
};
