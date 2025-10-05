import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export const useKeyboardShortcuts = (onNavigate?: (module: string) => void) => {
  const navigate = useNavigate();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'd',
      ctrl: true,
      description: 'Go to Dashboard',
      action: () => onNavigate?.('dashboard'),
    },
    {
      key: 'i',
      ctrl: true,
      description: 'Go to Inventory',
      action: () => onNavigate?.('inventory'),
    },
    {
      key: 'p',
      ctrl: true,
      description: 'Go to Purchase',
      action: () => onNavigate?.('purchase'),
    },
    {
      key: 's',
      ctrl: true,
      description: 'Go to Sales',
      action: () => onNavigate?.('sales'),
    },
    {
      key: 'r',
      ctrl: true,
      description: 'Go to Reports',
      action: () => onNavigate?.('reports'),
    },
    {
      key: '/',
      ctrl: true,
      description: 'Show shortcuts',
      action: () => {
        // Will be handled by parent component
      },
    },
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcuts.find(
        (s) =>
          s.key.toLowerCase() === event.key.toLowerCase() &&
          s.ctrl === event.ctrlKey &&
          (!s.shift || s.shift === event.shiftKey) &&
          (!s.alt || s.alt === event.altKey)
      );

      if (shortcut) {
        event.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  return { shortcuts };
};
