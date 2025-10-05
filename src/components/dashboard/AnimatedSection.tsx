import React from 'react';
import { cn } from '@/lib/utils';
import { useIntersectionAnimation } from '@/hooks/useAnimations';

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  animation?: 'fade' | 'slide-up' | 'slide-left' | 'scale';
}

export const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  className,
  delay = 0,
  animation = 'fade',
}) => {
  const { ref, isVisible } = useIntersectionAnimation(0.1);

  const getAnimationClasses = () => {
    const base = 'transition-all duration-700 ease-out';
    
    if (!isVisible) {
      switch (animation) {
        case 'fade':
          return `${base} opacity-0`;
        case 'slide-up':
          return `${base} opacity-0 translate-y-8`;
        case 'slide-left':
          return `${base} opacity-0 translate-x-8`;
        case 'scale':
          return `${base} opacity-0 scale-95`;
        default:
          return `${base} opacity-0`;
      }
    }
    
    return `${base} opacity-100 translate-y-0 translate-x-0 scale-100`;
  };

  return (
    <div
      ref={ref}
      className={cn(getAnimationClasses(), className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};
