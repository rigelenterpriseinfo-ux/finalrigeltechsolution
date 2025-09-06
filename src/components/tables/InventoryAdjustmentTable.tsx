import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { Eye, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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

interface InventoryAdjustmentTableProps {
  refreshTrigger?: number;
}

export const InventoryAdjustmentTable: React.FC<InventoryAdjustmentTableProps> = ({
  refreshTrigger = 0,
}) => {
  const { company } = useAuth();
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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
      
      // Fetch user profiles separately for created_by
      const adjustmentsWithProfiles = await Promise.all(
        (data || []).map(async (adj) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', adj.created_by)
            .single();
          
          return {
            ...adj,
            created_by: profile
          };
        })
      );
      
      setAdjustments(adjustmentsWithProfiles as InventoryAdjustment[]);
    } catch (error) {
      console.error('Error fetching inventory adjustments:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch inventory adjustments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getAdjustmentTypeBadge = (type: 'positive' | 'negative') => {
    return (
      <Badge variant={type === 'positive' ? 'default' : 'destructive'}>
        {type === 'positive' ? 'Add Stock' : 'Reduce Stock'}
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

  // Filter and sort adjustments
  const sortedAdjustments = useMemo(() => {
    let sorted = [...adjustments];

    if (sortConfig) {
      sorted.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'created_at':
            aValue = new Date(a.created_at);
            bValue = new Date(b.created_at);
            break;
          case 'product_name':
            aValue = a.products.name;
            bValue = b.products.name;
            break;
          case 'adjustment_quantity':
            aValue = a.adjustment_quantity;
            bValue = b.adjustment_quantity;
            break;
          case 'adjustment_amount':
            aValue = a.adjustment_amount;
            bValue = b.adjustment_amount;
            break;
          default:
            aValue = a[sortConfig.key as keyof InventoryAdjustment];
            bValue = b[sortConfig.key as keyof InventoryAdjustment];
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

    return sorted;
  }, [adjustments, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedAdjustments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAdjustments = sortedAdjustments.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-muted-foreground">Loading adjustments...</div>
      </div>
    );
  }

  if (adjustments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No inventory adjustments found
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('created_at')}>
                <div className="flex items-center space-x-2">
                  <span>Date</span>
                  {getSortIcon('created_at')}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('product_name')}>
                <div className="flex items-center space-x-2">
                  <span>Product</span>
                  {getSortIcon('product_name')}
                </div>
              </TableHead>
              <TableHead>Warehouse & Bin</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('adjustment_quantity')}>
                <div className="flex items-center justify-end space-x-2">
                  <span>Quantity</span>
                  {getSortIcon('adjustment_quantity')}
                </div>
              </TableHead>
              <TableHead className="text-right">Stock Before</TableHead>
              <TableHead className="text-right">Stock After</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('adjustment_amount')}>
                <div className="flex items-center justify-end space-x-2">
                  <span>Amount</span>
                  {getSortIcon('adjustment_amount')}
                </div>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentAdjustments.map((adjustment) => (
              <TableRow key={adjustment.id}>
                <TableCell>
                  {format(new Date(adjustment.created_at), 'MMM dd, yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{adjustment.products.name}</div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {adjustment.products.sku}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {adjustment.warehouse_bins.warehouse_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {adjustment.warehouse_bins.warehouse_code} - {adjustment.warehouse_bins.bin_name} ({adjustment.warehouse_bins.wh_bin_code})
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {getAdjustmentTypeBadge(adjustment.adjustment_type)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {getReasonLabel(adjustment.reason)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  <span className={adjustment.adjustment_type === 'positive' ? 'text-green-600' : 'text-red-600'}>
                    {adjustment.adjustment_type === 'positive' ? '+' : '-'}{adjustment.adjustment_quantity}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {adjustment.current_stock_before}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {adjustment.current_stock_after}
                </TableCell>
                <TableCell>
                  {getUserName(adjustment.created_by)}
                </TableCell>
                <TableCell className="text-right">
                  {adjustment.adjustment_amount > 0 ? `₹${adjustment.adjustment_amount.toFixed(2)}` : '-'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, sortedAdjustments.length)} of {sortedAdjustments.length} adjustments
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
    </div>
  );
};