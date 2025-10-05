import { useEffect, useState } from 'react';
import { useIsMobile } from './use-mobile';

/**
 * Hook to provide mobile-specific optimizations
 */
export const useMobileOptimizations = () => {
  const isMobile = useIsMobile();
  const [isLandscape, setIsLandscape] = useState(false);
  const [hasTouch, setHasTouch] = useState(false);

  useEffect(() => {
    // Check for touch support
    setHasTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);

    // Check orientation
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return {
    isMobile,
    isLandscape,
    hasTouch,
    shouldShowFullCards: !isMobile || isLandscape,
    maxItemsToShow: isMobile ? 3 : 5,
    cardSpacing: isMobile ? 'space-y-3' : 'space-y-4',
    gridCols: isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  };
};
