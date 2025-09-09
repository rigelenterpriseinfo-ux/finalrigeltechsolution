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
import { Search, Filter, Eye, ChevronDown, ChevronUp, Package, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { InventoryTransactionViewDialog } from '@/components/dialogs/InventoryTransactionViewDialog';

interface InventoryTransaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  reference_number: string;
  product_name: string;
  product_sku: string;
  warehouse_name: string;
  bin_name: string;
  quantity_change: number;
  unit_cost: number;
  total_value: number;
  notes: string;
  created_by_name: string;
}

interface InventoryTransactionTableMobileProps {
  refreshTrigger?: number;
}

export const InventoryTransactionTableMobile = ({ refreshTrigger }: InventoryTransactionTableMobileProps) => {
  const { company } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState<InventoryTransaction | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTransactions();
  }, [company?.id, refreshTrigger]);

  useEffect(() => {
    const handleInventoryUpdate = (event: CustomEvent) => {
      fetchTransactions();
    };

    window.addEventListener('inventoryUpdated', handleInventoryUpdate as EventListener);
    window.addEventListener('refreshInventoryTransactions', handleInventoryUpdate as EventListener);
    
    return () => {
      window.removeEventListener('inventoryUpdated', handleInventoryUpdate as EventListener);
      window.removeEventListener('refreshInventoryTransactions', handleInventoryUpdate as EventListener);
    };
  }, []);

  const fetchTransactions = async () => {
    if (!company?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          products!fk_inventory_transactions_product_id(name, sku),
          warehouse_bins!fk_inventory_transactions_warehouse_id(warehouse_name, bin_name),
          bin_info:warehouse_bins!fk_inventory_transactions_bin_id(warehouse_name, bin_name),
          profiles!fk_inventory_transactions_created_by(first_name, last_name)
        `)
        .eq('company_id', company.id)
        .order('transaction_date', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedTransactions: InventoryTransaction[] = data?.map((transaction: any) => ({
        id: transaction.id,
        transaction_date: transaction.transaction_date,
        transaction_type: transaction.transaction_type,
        reference_number: transaction.reference_number || 'N/A',
        product_name: transaction.products?.name || 'Unknown Product',
        product_sku: transaction.products?.sku || 'N/A',
        warehouse_name: transaction.warehouse_bins?.warehouse_name || transaction.bin_info?.warehouse_name || 'N/A',
        bin_name: transaction.warehouse_bins?.bin_name || transaction.bin_info?.bin_name || 'N/A',
        quantity_change: transaction.quantity_change || 0,
        unit_cost: transaction.unit_cost || 0,
        total_value: transaction.total_value || 0,
        notes: transaction.notes || '',
        created_by_name: transaction.profiles 
          ? `${transaction.profiles.first_name || ''} ${transaction.profiles.last_name || ''}`.trim() || 'System'
          : 'System'
      })) || [];

      setTransactions(formattedTransactions);
    } catch (error) {
      console.error('Error fetching inventory transactions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    const typeConfig = {
      'purchase_receipt': { label: 'Purchase Receipt', color: 'bg-green-500 text-white' },
      'sales_issue': { label: 'Sales Issue', color: 'bg-blue-500 text-white' },
      'sales_return': { label: 'Sales Return', color: 'bg-purple-500 text-white' },
      'sales_invoice': { label: 'Sales Invoice', color: 'bg-orange-500 text-white' },
      'adjustment_positive': { label: 'Adjustment +', color: 'bg-green-500 text-white' },
      'adjustment_negative': { label: 'Adjustment -', color: 'bg-red-500 text-white' },
      'transfer_out': { label: 'Transfer Out', color: 'bg-yellow-500 text-white' },
      'transfer_in': { label: 'Transfer In', color: 'bg-indigo-500 text-white' },
    };

    const config = typeConfig[type as keyof typeof typeConfig] || { label: type, color: 'bg-gray-500 text-white' };
    
    return (
      <Badge className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const toggleExpanded = (transactionId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(transactionId)) {
      newExpanded.delete(transactionId);
    } else {
      newExpanded.add(transactionId);
    }
    setExpandedCards(newExpanded);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesSearch = 
        transaction.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.product_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.bin_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.created_by_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.transaction_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === 'all' || transaction.transaction_type === typeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, typeFilter]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-muted-foreground">Loading transactions...</div>
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
              placeholder="Search transactions, product, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="purchase_receipt">Purchase Receipt</SelectItem>
              <SelectItem value="sales_issue">Sales Issue</SelectItem>
              <SelectItem value="sales_return">Sales Return</SelectItem>
              <SelectItem value="sales_invoice">Sales Invoice</SelectItem>
              <SelectItem value="adjustment_positive">Adjustment +</SelectItem>
              <SelectItem value="adjustment_negative">Adjustment -</SelectItem>
              <SelectItem value="transfer_out">Transfer Out</SelectItem>
              <SelectItem value="transfer_in">Transfer In</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Transaction Items */}
      {paginatedTransactions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No transactions found</p>
          </CardContent>
        </Card>
      ) : (
        paginatedTransactions.map((transaction) => {
          const isExpanded = expandedCards.has(transaction.id);
          
          return (
            <Card key={transaction.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-medium truncate">
                      {transaction.product_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      SKU: {transaction.product_sku}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(transaction.transaction_date), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 ml-4">
                    {getTransactionTypeBadge(transaction.transaction_type)}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Quantity Change</p>
                    <p className={`text-lg font-semibold flex items-center ${
                      transaction.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <ArrowUpDown className={`h-4 w-4 mr-1 ${
                        transaction.quantity_change > 0 ? 'rotate-0' : 'rotate-180'
                      }`} />
                      {transaction.quantity_change > 0 ? '+' : ''}{transaction.quantity_change}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                    <p className={`text-lg font-semibold ${
                      transaction.total_value > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ₹{Math.abs(transaction.total_value).toFixed(2)}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference:</span>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {transaction.reference_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">
                      {transaction.warehouse_name} - {transaction.bin_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit Cost:</span>
                    <span>₹{transaction.unit_cost.toFixed(2)}</span>
                  </div>
                </div>
                
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(transaction.id)}>
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
                        <span className="text-muted-foreground">Created By:</span>
                        <span>{transaction.created_by_name}</span>
                      </div>
                      {transaction.notes && (
                        <div className="mt-3">
                          <p className="text-muted-foreground text-xs mb-1">Notes:</p>
                          <p className="text-sm bg-muted/50 p-2 rounded">{transaction.notes}</p>
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
                      setViewingTransaction(transaction);
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
      <InventoryTransactionViewDialog 
        transaction={viewingTransaction}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
      />
    </div>
  );
};