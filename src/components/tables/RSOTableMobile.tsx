import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SwipeActions } from '@/components/ui/swipe-actions';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useHaptics } from '@/hooks/useHaptics';
import { 
  Eye, 
  Edit, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Search,
  Calendar,
  DollarSign,
  User,
  FileText,
  Download
} from 'lucide-react';

interface ReturnOrder {
  id: string;
  rso_number: string;
  rso_date: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;
  status: 'Draft' | 'Confirmed';
  reason_for_credit: string;
  total_amount: number;
}

interface CreditNote {
  id: string;
  cn_number: string;
  rso_id: string;
  status: 'Draft' | 'Confirmed';
}

interface RSOTableMobileProps {
  returnOrders: ReturnOrder[];
  creditNotes: CreditNote[];
  onView: (rsoId: string) => void;
  onEdit: (rsoId: string) => void;
  onDelete: (rsoId: string) => void;
  onViewCreditNotes: (rso: ReturnOrder) => void;
  onExport?: (rso: ReturnOrder) => void;
  onExportPDF?: (rso: ReturnOrder) => void;
  loading?: boolean;
}

export function RSOTableMobile({
  returnOrders,
  creditNotes,
  onView,
  onEdit,
  onDelete,
  onViewCreditNotes,
  onExport,
  onExportPDF,
  loading = false
}: RSOTableMobileProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const { triggerHaptic } = useHaptics();
  
  const itemsPerPage = 10;

  // Filter return orders based on search term
  const filteredOrders = returnOrders.filter(order =>
    (order.rso_number?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
    (order.customer_name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
    (order.invoice_number?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  const toggleCard = (orderId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedCards(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-muted text-muted-foreground';
      case 'Confirmed':
        return 'bg-primary/10 text-primary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getCNStatus = (rsoId: string) => {
    const cns = creditNotes.filter(cn => cn.rso_id === rsoId);
    
    if (cns.length === 0) {
      return { color: 'bg-destructive/10 text-destructive', text: 'CN Pending' };
    }
    
    const hasConfirmed = cns.some(cn => cn.status === 'Confirmed');
    if (hasConfirmed) {
      return { color: 'bg-success/10 text-success', text: 'CN Processed' };
    }
    
    return { color: 'bg-warning/10 text-warning', text: 'CN Draft' };
  };

  const hasCreditNotes = (rsoId: string) => {
    return creditNotes.some(cn => cn.rso_id === rsoId);
  };

  const canDelete = (rsoId: string) => {
    return !hasCreditNotes(rsoId);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-3 bg-muted rounded w-32"></div>
                  </div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="h-3 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-24"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by RSO, Customer, or Invoice..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-10"
        />
      </div>

      {/* Results Info */}
      <div className="flex justify-between items-center text-sm text-muted-foreground px-1">
        <span>{currentOrders.length} of {filteredOrders.length} orders</span>
        {totalPages > 1 && (
          <span>Page {currentPage} of {totalPages}</span>
        )}
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {currentOrders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground">
                {searchTerm ? 'No return orders found matching your search.' : 'No return orders found.'}
              </div>
            </CardContent>
          </Card>
        ) : (
          currentOrders.map((order) => {
            const isExpanded = expandedCards.has(order.id);
            const cnStatus = getCNStatus(order.id);
            const canDeleteOrder = canDelete(order.id);
            
            const swipeActions = [
              {
                id: 'view',
                label: 'View',
                onClick: () => {
                  triggerHaptic('light');
                  onView(order.id);
                },
                icon: Eye,
                variant: 'secondary' as const
              },
              ...(order.status === 'Draft' ? [{
                id: 'edit',
                label: 'Edit',
                onClick: () => {
                  triggerHaptic('light');
                  onEdit(order.id);
                },
                icon: Edit,
                variant: 'default' as const
              }] : []),
              ...(onExport ? [{
                id: 'export',
                label: 'Export',
                onClick: () => {
                  triggerHaptic('light');
                  onExport(order);
                },
                icon: Download,
                variant: 'secondary' as const
              }] : []),
              ...(onExportPDF ? [{
                id: 'exportPDF',
                label: 'PDF',
                onClick: () => {
                  triggerHaptic('light');
                  onExportPDF(order);
                },
                icon: FileText,
                variant: 'secondary' as const
              }] : []),
              ...(order.status === 'Draft' && canDeleteOrder ? [{
                id: 'delete',
                label: 'Delete',
                onClick: () => {
                  triggerHaptic('medium');
                  if (confirm('Are you sure you want to delete this return order?')) {
                    onDelete(order.id);
                  }
                },
                icon: Trash2,
                variant: 'destructive' as const
              }] : [])
            ];
            
            return (
              <SwipeActions key={order.id} actions={swipeActions}>
                <Card className="card-interactive">
                  <Collapsible>
                    <CollapsibleTrigger
                      onClick={() => {
                        triggerHaptic('light');
                        toggleCard(order.id);
                      }}
                      className="w-full"
                    >
                    <CardHeader className="pb-3">
                      <div className="mobile-card-header">
                        <div className="mobile-card-content">
                          <div className="mobile-card-title">
                            {order.rso_number}
                          </div>
                          <div className="mobile-card-subtitle flex items-center gap-1">
                            <User className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{order.customer_name}</span>
                          </div>
                        </div>
                        <div className="mobile-card-actions">
                          <Badge className={`${getStatusColor(order.status)} text-xs`}>
                            {order.status}
                          </Badge>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(order.rso_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1 font-medium">
                          <DollarSign className="h-3 w-3" />
                          <span>{formatCurrency(order.total_amount)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={`${cnStatus.color} text-xs`}>
                          {cnStatus.text}
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-sm">Invoice:</span>
                          <span className="text-sm">{order.invoice_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-sm">Reason:</span>
                          <span className="text-sm text-right">{order.reason_for_credit}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('light');
                            onView(order.id);
                          }}
                          className="flex-1 min-h-[44px]"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {order.status === 'Draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              onEdit(order.id);
                            }}
                            className="flex-1 min-h-[44px]"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                        {hasCreditNotes(order.id) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              onViewCreditNotes(order);
                            }}
                            className="min-h-[44px]"
                            title="View Credit Notes"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {onExport && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              onExport(order);
                            }}
                            className="min-h-[44px]"
                            title="Export to Excel"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {onExportPDF && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              onExportPDF(order);
                            }}
                            className="min-h-[44px] border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            title="Export to PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {order.status === 'Draft' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('medium');
                              if (canDeleteOrder) {
                                if (confirm('Are you sure you want to delete this return order?')) {
                                  onDelete(order.id);
                                }
                              } else {
                                alert('Cannot delete - this RSO has linked credit notes');
                              }
                            }}
                            disabled={!canDeleteOrder}
                            className="min-h-[44px]"
                            title={canDeleteOrder ? 'Delete return order' : 'Cannot delete - has credit notes'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
              </SwipeActions>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <Button
                  key={pageNumber}
                  variant={currentPage === pageNumber ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNumber)}
                  className="min-w-[40px]"
                >
                  {pageNumber}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
