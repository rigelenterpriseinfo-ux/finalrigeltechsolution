import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface TouchFeedbackProps {
  children: React.ReactNode;
  onTap?: () => void;
  className?: string;
  feedbackColor?: string;
  disabled?: boolean;
}

export const TouchFeedback: React.FC<TouchFeedbackProps> = ({
  children,
  onTap,
  className,
  feedbackColor = 'bg-primary/10',
  disabled = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleTouchStart = () => {
    if (!disabled) {
      setIsPressed(true);
    }
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
    if (!disabled && onTap) {
      onTap();
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => setIsPressed(false)}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={() => setIsPressed(false)}
      className={cn(
        'relative overflow-hidden cursor-pointer select-none',
        'transition-transform duration-100',
        isPressed && 'scale-95',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Ripple overlay */}
      {isPressed && !disabled && (
        <div
          className={cn(
            'absolute inset-0 animate-[fade-in_0.2s_ease-out]',
            feedbackColor
          )}
        />
      )}
      
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
