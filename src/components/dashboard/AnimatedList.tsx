import React from 'react';
import { cn } from '@/lib/utils';
import { useStaggerAnimation } from '@/hooks/useAnimations';

interface AnimatedListProps {
  children: React.ReactNode[];
  stagger?: number;
  className?: string;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  stagger = 50,
  className,
}) => {
  const { getItemStyle } = useStaggerAnimation(children.length, { stagger });

  return (
    <div className={cn('space-y-3', className)}>
      {React.Children.map(children, (child, index) => (
        <div style={getItemStyle(index)}>
          {child}
        </div>
      ))}
    </div>
  );
};
