import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Filter, Eye, ChevronDown, ChevronUp, Package, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { InventoryAdjustmentViewDialog } from '@/components/dialogs/InventoryAdjustmentViewDialog';

interface InventoryAdjustment {
  id: string;
  adjustment_type: 'positive' | 'negative';
  reason: string;
  adjustment_quantity: number;
  adjustment_amount: number;
  remarks: string | null;
  current_stock_before: number;
  current_stock_after: number;
  created_at: string;
  products: {
    name: string;
    sku: string;
  };
  warehouse_bins: {
    warehouse_name: string;
    warehouse_code: string;
    bin_name: string;
    wh_bin_code: string;
  };
  created_by: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface InventoryAdjustmentTableMobileProps {
  refreshTrigger?: number;
}

export const InventoryAdjustmentTableMobile = ({ refreshTrigger }: InventoryAdjustmentTableMobileProps) => {
  const { company } = useAuth();
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingAdjustment, setViewingAdjustment] = useState<InventoryAdjustment | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    if (company) {
      fetchAdjustments();
    }
  }, [company, refreshTrigger]);

  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_adjustments')
        .select(`
          *,
          products (
            name,
            sku
          ),
          warehouse_bins (
            warehouse_name,
            warehouse_code,
            bin_name,
            wh_bin_code
          )
        `)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const adjustmentsWithProfiles = await Promise.all(
        data?.map(async (adjustment) => {
          let createdByProfile = null;
          if (adjustment.created_by) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('user_id', adjustment.created_by)
              .single();
            createdByProfile = profile;
          }
          
          return {
            ...adjustment,
            created_by: createdByProfile
          };
        }) || []
      );

      setAdjustments(adjustmentsWithProfiles as InventoryAdjustment[]);
    } catch (error) {
      console.error('Error fetching inventory adjustments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory adjustments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAdjustmentTypeBadge = (type: 'positive' | 'negative') => {
    return (
      <Badge variant={type === 'positive' ? 'default' : 'destructive'} className="text-xs">
        {type === 'positive' ? (
          <>
            <Plus className="h-3 w-3 mr-1" />
            Add Stock
          </>
        ) : (
          <>
            <Minus className="h-3 w-3 mr-1" />
            Reduce Stock
          </>
        )}
      </Badge>
    );
  };

  const getReasonLabel = (reason: string) => {
    const reasonMap: Record<string, string> = {
      opening_balance: 'Opening Balance',
      damage: 'Damage',
      audit: 'Audit',
      scrap: 'Scrap',
      transfer: 'Transfer',
      other: 'Other',
    };
    return reasonMap[reason] || reason;
  };

  const getUserName = (profile: { first_name: string | null; last_name: string | null } | null) => {
    if (!profile) return 'Unknown User';
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User';
  };

  const toggleExpanded = (adjustmentId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(adjustmentId)) {
      newExpanded.delete(adjustmentId);
    } else {
      newExpanded.add(adjustmentId);
    }
    setExpandedCards(newExpanded);
  };

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adjustment) => {
      const matchesSearch = 
        adjustment.products.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adjustment.products.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adjustment.warehouse_bins.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adjustment.warehouse_bins.bin_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getReasonLabel(adjustment.reason).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (adjustment.remarks && adjustment.remarks.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = typeFilter === 'all' || adjustment.adjustment_type === typeFilter;
      const matchesReason = reasonFilter === 'all' || adjustment.reason === reasonFilter;
      
      return matchesSearch && matchesType && matchesReason;
    });
  }, [adjustments, searchTerm, typeFilter, reasonFilter]);

  const totalPages = Math.ceil(filteredAdjustments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAdjustments = filteredAdjustments.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-muted-foreground">Loading adjustments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search adjustments, product, warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="flex-1">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="positive">Add Stock</SelectItem>
                <SelectItem value="negative">Reduce Stock</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="found">Found</SelectItem>
                <SelectItem value="recount">Recount</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Adjustment Items */}
      {paginatedAdjustments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No adjustments found</p>
          </CardContent>
        </Card>
      ) : (
        paginatedAdjustments.map((adjustment) => {
          const isExpanded = expandedCards.has(adjustment.id);
          
          return (
            <Card key={adjustment.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-medium truncate">
                      {adjustment.products.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      SKU: {adjustment.products.sku}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(adjustment.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 ml-4">
                    {getAdjustmentTypeBadge(adjustment.adjustment_type)}
                    <Badge variant="outline" className="text-xs">
                      {getReasonLabel(adjustment.reason)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Quantity Change</p>
                    <p className={`text-lg font-semibold ${
                      adjustment.adjustment_type === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {adjustment.adjustment_type === 'positive' ? '+' : '-'}{adjustment.adjustment_quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Stock After</p>
                    <p className="text-lg font-semibold">{adjustment.current_stock_after}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">
                      {adjustment.warehouse_bins.warehouse_name} - {adjustment.warehouse_bins.bin_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock Before:</span>
                    <span>{adjustment.current_stock_before}</span>
                  </div>
                  {adjustment.adjustment_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span>₹{adjustment.adjustment_amount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(adjustment.id)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full mt-3 p-2 h-auto">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-medium">More Details</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 mt-3 pt-3 border-t">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Warehouse Code:</span>
                        <span className="font-mono">{adjustment.warehouse_bins.warehouse_code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bin Code:</span>
                        <span className="font-mono">{adjustment.warehouse_bins.wh_bin_code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created By:</span>
                        <span>{getUserName(adjustment.created_by)}</span>
                      </div>
                      {adjustment.remarks && (
                        <div className="mt-3">
                          <p className="text-muted-foreground text-xs mb-1">Remarks:</p>
                          <p className="text-sm bg-muted/50 p-2 rounded">{adjustment.remarks}</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewingAdjustment(adjustment);
                      setShowViewDialog(true);
                    }}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
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

      {/* View Dialog */}
      <InventoryAdjustmentViewDialog 
        adjustment={viewingAdjustment}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
      />
    </div>
  );
};