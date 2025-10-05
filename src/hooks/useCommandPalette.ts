import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  category: 'navigation' | 'action' | 'search' | 'recent';
  action: () => void;
  shortcut?: string;
}

interface CommandHistory {
  commandId: string;
  timestamp: Date;
}

const HISTORY_KEY = 'command-palette-history';
const MAX_HISTORY = 10;

export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<CommandHistory[]>(() => {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const navigate = useNavigate();

  // Define available commands
  const commands: Command[] = useMemo(() => [
    // Navigation commands
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      description: 'View dashboard overview',
      category: 'navigation',
      keywords: ['home', 'overview', 'main'],
      action: () => navigate('/dashboard'),
      shortcut: 'Ctrl+D',
    },
    {
      id: 'nav-inventory',
      label: 'Go to Inventory',
      description: 'Manage inventory and stock',
      category: 'navigation',
      keywords: ['stock', 'products', 'items'],
      action: () => navigate('/dashboard?module=inventory'),
      shortcut: 'Ctrl+I',
    },
    {
      id: 'nav-sales',
      label: 'Go to Sales',
      description: 'View sales orders and invoices',
      category: 'navigation',
      keywords: ['orders', 'invoices', 'customers'],
      action: () => navigate('/dashboard?module=sales'),
      shortcut: 'Ctrl+S',
    },
    {
      id: 'nav-purchase',
      label: 'Go to Purchase',
      description: 'Manage purchase orders',
      category: 'navigation',
      keywords: ['procurement', 'suppliers', 'po'],
      action: () => navigate('/dashboard?module=purchase'),
      shortcut: 'Ctrl+P',
    },
    {
      id: 'nav-reports',
      label: 'Go to Reports',
      description: 'View analytics and reports',
      category: 'navigation',
      keywords: ['analytics', 'insights', 'data'],
      action: () => navigate('/dashboard?module=reports'),
      shortcut: 'Ctrl+R',
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      description: 'Configure application settings',
      category: 'navigation',
      keywords: ['preferences', 'configuration'],
      action: () => navigate('/dashboard?module=settings'),
    },
    
    // Action commands
    {
      id: 'action-new-order',
      label: 'Create New Order',
      description: 'Create a new sales order',
      category: 'action',
      keywords: ['add', 'create', 'new', 'so'],
      action: () => {
        navigate('/dashboard?module=sales');
        // Trigger new order modal
        setTimeout(() => {
          const btn = document.querySelector('[data-action="new-order"]') as HTMLElement;
          btn?.click();
        }, 500);
      },
    },
    {
      id: 'action-new-invoice',
      label: 'Create New Invoice',
      description: 'Create a new sales invoice',
      category: 'action',
      keywords: ['add', 'create', 'new', 'bill'],
      action: () => {
        navigate('/dashboard?module=sales');
        setTimeout(() => {
          const btn = document.querySelector('[data-action="new-invoice"]') as HTMLElement;
          btn?.click();
        }, 500);
      },
    },
    {
      id: 'action-new-product',
      label: 'Add New Product',
      description: 'Add a new product to inventory',
      category: 'action',
      keywords: ['add', 'create', 'new', 'item'],
      action: () => {
        navigate('/dashboard?module=inventory');
      },
    },
    {
      id: 'action-export-data',
      label: 'Export Dashboard Data',
      description: 'Export current dashboard data',
      category: 'action',
      keywords: ['download', 'save', 'csv', 'json'],
      action: () => {
        const exportBtn = document.querySelector('[data-action="export"]') as HTMLElement;
        exportBtn?.click();
      },
    },
    {
      id: 'action-toggle-compact',
      label: 'Toggle Compact View',
      description: 'Switch between normal and compact layout',
      category: 'action',
      keywords: ['view', 'layout', 'dense'],
      action: () => {
        const toggleBtn = document.querySelector('[data-action="toggle-compact"]') as HTMLElement;
        toggleBtn?.click();
      },
    },
    {
      id: 'action-refresh',
      label: 'Refresh Dashboard',
      description: 'Reload all dashboard data',
      category: 'action',
      keywords: ['reload', 'update', 'sync'],
      action: () => {
        const refreshBtn = document.querySelector('[data-action="refresh"]') as HTMLElement;
        refreshBtn?.click();
      },
    },
    {
      id: 'action-customize',
      label: 'Customize Dashboard',
      description: 'Open dashboard customization settings',
      category: 'action',
      keywords: ['settings', 'preferences', 'configure'],
      action: () => {
        const customizeBtn = document.querySelector('[data-action="customize"]') as HTMLElement;
        customizeBtn?.click();
      },
    },
    {
      id: 'action-notifications',
      label: 'View Notifications',
      description: 'Open notification center',
      category: 'action',
      keywords: ['alerts', 'messages', 'updates'],
      action: () => {
        const notifBtn = document.querySelector('[data-action="notifications"]') as HTMLElement;
        notifBtn?.click();
      },
    },
  ], [navigate]);

  // Setup fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(commands, {
      keys: ['label', 'description', 'keywords'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [commands]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) {
      // Show recent commands when no search
      const recentIds = history.map(h => h.commandId);
      const recentCommands = commands
        .filter(c => recentIds.includes(c.id))
        .map(c => ({
          ...c,
          category: 'recent' as const,
        }))
        .sort((a, b) => {
          const aIndex = recentIds.indexOf(a.id);
          const bIndex = recentIds.indexOf(b.id);
          return aIndex - bIndex;
        });

      return recentCommands.length > 0 ? recentCommands : commands.slice(0, 8);
    }

    const results = fuse.search(search);
    return results.map(result => result.item);
  }, [search, commands, fuse, history]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Execute command
  const executeCommand = useCallback((command: Command) => {
    command.action();
    
    // Add to history
    setHistory(prev => {
      const filtered = prev.filter(h => h.commandId !== command.id);
      const updated = [
        { commandId: command.id, timestamp: new Date() },
        ...filtered,
      ].slice(0, MAX_HISTORY);
      
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });

    // Close palette
    setIsOpen(false);
    setSearch('');
  }, []);

  // Keyboard shortcut to open palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  return {
    isOpen,
    setIsOpen,
    search,
    setSearch,
    commands,
    filteredCommands,
    groupedCommands,
    executeCommand,
    history,
    clearHistory,
  };
};
