import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

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

interface InventoryTransactionTableProps {
  refreshTrigger?: number;
}

export const InventoryTransactionTable = ({ refreshTrigger }: InventoryTransactionTableProps) => {
  const { company } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchTransactions();
  }, [company?.id, refreshTrigger]);

  useEffect(() => {
    const handleInventoryUpdate = (event: CustomEvent) => {
      console.log('Inventory updated:', event.detail);
      fetchTransactions(); // Refresh the table
    };

    // Listen for both custom events
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
        quantity_change: transaction.quantity_change,
        unit_cost: transaction.unit_cost,
        total_value: transaction.total_value,
        notes: transaction.notes || '',
        created_by_name: `${transaction.profiles?.first_name || ''} ${transaction.profiles?.last_name || ''}`.trim() || 'Unknown'
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
      purchase_receipt: { label: 'Purchase Receipt', variant: 'default' as const },
      sales_issue: { label: 'Sales Issue', variant: 'secondary' as const },
      sales_return: { label: 'Sales Return', variant: 'default' as const },
      sales_invoice: { label: 'Sales Invoice', variant: 'secondary' as const },
      adjustment_positive: { label: 'Adjustment +', variant: 'default' as const },
      adjustment_negative: { label: 'Adjustment -', variant: 'destructive' as const },
      transfer_out: { label: 'Transfer Out', variant: 'outline' as const },
      transfer_in: { label: 'Transfer In', variant: 'outline' as const },
    };

    const config = typeConfig[type as keyof typeof typeConfig] || { label: type, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get sort icon
  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter((transaction) => {
    const matchesSearch = 
      transaction.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.product_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.reference_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.bin_name.toLowerCase().includes(searchTerm.toLowerCase());
    
      const matchesType = typeFilter === 'all' || transaction.transaction_type === typeFilter;
      
      return matchesSearch && matchesType;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'transaction_date':
            aValue = new Date(a.transaction_date);
            bValue = new Date(b.transaction_date);
            break;
          case 'product_name':
            aValue = a.product_name;
            bValue = b.product_name;
            break;
          case 'quantity_change':
            aValue = a.quantity_change;
            bValue = b.quantity_change;
            break;
          case 'total_value':
            aValue = a.total_value;
            bValue = b.total_value;
            break;
          default:
            aValue = a[sortConfig.key as keyof InventoryTransaction];
            bValue = b[sortConfig.key as keyof InventoryTransaction];
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [transactions, searchTerm, typeFilter, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = filteredAndSortedTransactions.slice(startIndex, endIndex);

  if (loading) {
    return <div className="flex justify-center items-center p-8">Loading inventory transactions...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by product, SKU, reference, warehouse..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
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
      </div>

      {/* Transaction Table */}
      {filteredAndSortedTransactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm || typeFilter !== 'all' ? 'No transactions match your filters.' : 'No inventory transactions found.'}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('transaction_date')}>
                  <div className="flex items-center space-x-2">
                    <span>Date</span>
                    {getSortIcon('transaction_date')}
                  </div>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('product_name')}>
                  <div className="flex items-center space-x-2">
                    <span>Product</span>
                    {getSortIcon('product_name')}
                  </div>
                </TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('quantity_change')}>
                  <div className="flex items-center justify-end space-x-2">
                    <span>Qty Change</span>
                    {getSortIcon('quantity_change')}
                  </div>
                </TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('total_value')}>
                  <div className="flex items-center justify-end space-x-2">
                    <span>Total Value</span>
                    {getSortIcon('total_value')}
                  </div>
                </TableHead>
                <TableHead>Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  {format(new Date(transaction.transaction_date), 'MMM dd, yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  {getTransactionTypeBadge(transaction.transaction_type)}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {transaction.reference_number}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{transaction.product_name}</div>
                    <div className="text-sm text-muted-foreground">{transaction.product_sku}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{transaction.warehouse_name}</div>
                    <div className="text-sm text-muted-foreground">{transaction.bin_name}</div>
                  </div>
                </TableCell>
                <TableCell className={`text-right font-mono ${
                  transaction.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.quantity_change > 0 ? '+' : ''}{transaction.quantity_change}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ₹{transaction.unit_cost.toFixed(2)}
                </TableCell>
                <TableCell className={`text-right font-mono ${
                  transaction.total_value > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ₹{transaction.total_value.toFixed(2)}
                </TableCell>
                <TableCell>{transaction.created_by_name}</TableCell>
              </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredAndSortedTransactions.length)} of {filteredAndSortedTransactions.length} transactions
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};