import React from 'react';
import { Button, ButtonProps } from './button';
import { cn } from '@/lib/utils';
import { useRippleEffect } from '@/hooks/useAnimations';

interface AnimatedButtonProps extends ButtonProps {
  ripple?: boolean;
}

export const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ children, ripple = true, className, onClick, ...props }, ref) => {
    const { addRipple, ripples } = useRippleEffect();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (ripple) {
        addRipple(e);
      }
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        className={cn(
          'relative overflow-hidden',
          'transition-all duration-200',
          'hover:scale-105 active:scale-95',
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {ripple && (
          <span className="absolute inset-0 overflow-hidden pointer-events-none">
            {ripples.map((ripple) => (
              <span
                key={ripple.id}
                className="absolute rounded-full bg-current opacity-30 animate-[scale-in_0.6s_ease-out]"
                style={{
                  left: ripple.x,
                  top: ripple.y,
                  width: ripple.size,
                  height: ripple.size,
                }}
              />
            ))}
          </span>
        )}
        <span className="relative z-10">{children}</span>
      </Button>
    );
  }
);

AnimatedButton.displayName = 'AnimatedButton';
