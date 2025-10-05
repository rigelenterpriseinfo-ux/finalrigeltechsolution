import { useEffect, useRef, useState } from 'react';

/**
 * Animation Utilities Hook
 * 
 * Provides utilities for managing animations and transitions in the dashboard.
 */

interface StaggerConfig {
  delay: number;
  duration: number;
  stagger: number;
}

export const useStaggerAnimation = (itemCount: number, config?: Partial<StaggerConfig>) => {
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const defaultConfig: StaggerConfig = {
    delay: 0,
    duration: 300,
    stagger: 50,
    ...config,
  };

  useEffect(() => {
    // Clear existing timeouts
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setVisibleItems([]);

    // Stagger the appearance of items
    for (let i = 0; i < itemCount; i++) {
      const timeout = setTimeout(() => {
        setVisibleItems((prev) => [...prev, i]);
      }, defaultConfig.delay + i * defaultConfig.stagger);
      
      timeoutsRef.current.push(timeout);
    }

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, [itemCount, defaultConfig.delay, defaultConfig.stagger]);

  return {
    visibleItems,
    isItemVisible: (index: number) => visibleItems.includes(index),
    getItemStyle: (index: number) => ({
      opacity: visibleItems.includes(index) ? 1 : 0,
      transform: visibleItems.includes(index) ? 'translateY(0)' : 'translateY(10px)',
      transition: `opacity ${defaultConfig.duration}ms ease-out, transform ${defaultConfig.duration}ms ease-out`,
    }),
  };
};

export const useIntersectionAnimation = (threshold = 0.1) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Once visible, stop observing
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold]);

  return { ref, isVisible };
};

export const useHoverScale = (scale = 1.05) => {
  const [isHovered, setIsHovered] = useState(false);

  return {
    isHovered,
    hoverProps: {
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      style: {
        transform: isHovered ? `scale(${scale})` : 'scale(1)',
        transition: 'transform 0.2s ease-out',
      },
    },
  };
};

export const useCountUp = (end: number, duration = 1000, start = 0) => {
  const [count, setCount] = useState(start);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    startTimeRef.current = Date.now();
    const startValue = start;
    const endValue = end;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - (startTimeRef.current || now);
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (endValue - startValue) * easeOut;

      setCount(Math.floor(currentValue));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [end, duration, start]);

  return count;
};

export const usePulseAnimation = (active: boolean) => {
  return {
    className: active ? 'animate-pulse' : '',
    style: active ? {} : undefined,
  };
};

export const useSlideIn = (direction: 'left' | 'right' | 'up' | 'down' = 'up') => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const getTransform = () => {
    if (isVisible) return 'translate(0, 0)';
    
    switch (direction) {
      case 'left':
        return 'translateX(-100%)';
      case 'right':
        return 'translateX(100%)';
      case 'up':
        return 'translateY(100%)';
      case 'down':
        return 'translateY(-100%)';
      default:
        return 'translateY(100%)';
    }
  };

  return {
    style: {
      transform: getTransform(),
      opacity: isVisible ? 1 : 0,
      transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease-out',
    },
  };
};

export const useRippleEffect = () => {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; size: number; id: number }>>([]);

  const addRipple = (event: React.MouseEvent<HTMLElement>) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, size, id }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
    }, 600);
  };

  return {
    ripples,
    addRipple,
  };
};
