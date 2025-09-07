import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  FileText, 
  RotateCcw, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface NavigationItem {
  id: string;
  title: string;
  description: string;
  count?: number;
  amount?: number;
  status?: 'success' | 'warning' | 'error';
  href?: string;
  onClick?: () => void;
}

interface CrossModuleNavigationProps {
  title: string;
  description?: string;
  items: NavigationItem[];
  onNavigate?: (href: string) => void;
}

export function CrossModuleNavigation({ 
  title, 
  description, 
  items, 
  onNavigate 
}: CrossModuleNavigationProps) {
  const handleNavigation = (item: NavigationItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href && onNavigate) {
      onNavigate(item.href);
    } else if (item.href) {
      // Default navigation behavior
      window.location.hash = item.href;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success': return <FileText className="h-4 w-4 text-green-600" />;
      case 'warning': return <RotateCcw className="h-4 w-4 text-yellow-600" />;
      case 'error': return <FileText className="h-4 w-4 text-red-600" />;
      default: return <FileText className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <Card className="border-dashed border-blue-200 bg-blue-50/30">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900">{title}</h3>
              {description && (
                <p className="text-sm text-blue-700 mt-1">{description}</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-blue-600" />
          </div>

          {/* Navigation Items */}
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => handleNavigation(item)}
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(item.status)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{item.title}</span>
                      {item.count !== undefined && (
                        <Badge variant="outline" className={getStatusColor(item.status)}>
                          {item.count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{item.description}</p>
                    {item.amount !== undefined && (
                      <p className="text-sm font-medium text-gray-800">
                        ₹{item.amount.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-blue-100"
                  >
                    <ExternalLink className="h-4 w-4 text-blue-600" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {items.length === 0 && (
            <div className="text-center py-6">
              <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No related items found</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Specific navigation components for different modules
export function APToCreditNotesNavigation({ 
  debitNoteId, 
  linkedCreditNotes = [], 
  onNavigate 
}: {
  debitNoteId: string;
  linkedCreditNotes: any[];
  onNavigate?: (href: string) => void;
}) {
  const navigationItems: NavigationItem[] = linkedCreditNotes.map(cn => ({
    id: cn.id,
    title: cn.supplier_credit_note_number,
    description: `Credit Note • ${cn.status} • ${new Date(cn.created_at).toLocaleDateString()}`,
    amount: cn.total_amount,
    status: cn.status === 'confirmed' ? 'success' : 'warning',
    href: `#purchase/credit-notes/${cn.id}`
  }));

  if (navigationItems.length === 0) {
    navigationItems.push({
      id: 'create-cn',
      title: 'Create Credit Note',
      description: 'No credit notes found for this debit note',
      status: 'error',
      href: `#purchase/credit-notes/create?debit_note_id=${debitNoteId}`
    });
  }

  return (
    <CrossModuleNavigation
      title="Related Credit Notes (AP)"
      description="Supplier credit notes linked to this debit note"
      items={navigationItems}
      onNavigate={onNavigate}
    />
  );
}

export function ARToRSONavigation({ 
  creditNoteId, 
  linkedRSO, 
  onNavigate 
}: {
  creditNoteId: string;
  linkedRSO?: any;
  onNavigate?: (href: string) => void;
}) {
  const navigationItems: NavigationItem[] = linkedRSO ? [{
    id: linkedRSO.id,
    title: linkedRSO.rso_number,
    description: `Return Sales Order • ${linkedRSO.status} • ${new Date(linkedRSO.rso_date).toLocaleDateString()}`,
    amount: linkedRSO.total_amount,
    status: linkedRSO.status === 'Confirmed' ? 'success' : 'warning',
    href: `#returns/rso/${linkedRSO.id}`
  }] : [{
    id: 'no-rso',
    title: 'No Linked RSO',
    description: 'This credit note is not linked to any RSO',
    status: 'error',
    href: `#returns`
  }];

  return (
    <CrossModuleNavigation
      title="Related RSO (AR)"
      description="Return Sales Order that generated this credit note"
      items={navigationItems}
      onNavigate={onNavigate}
    />
  );
}

export function QuickActionsNavigation({ 
  actions,
  onNavigate 
}: {
  actions: NavigationItem[];
  onNavigate?: (href: string) => void;
}) {
  return (
    <CrossModuleNavigation
      title="Quick Actions"
      description="Navigate to related modules and functions"
      items={actions}
      onNavigate={onNavigate}
    />
  );
}