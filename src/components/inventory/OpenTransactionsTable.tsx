import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  FileText, 
  ShoppingCart, 
  RotateCcw, 
  AlertCircle,
  Package,
  MapPin,
  FileSpreadsheet
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { exportToExcel, formatDate, ExportColumn } from '@/utils/excelExport';

interface OpenTransaction {
  id: string;
  transaction_type: 'sales_order' | 'return_order' | 'purchase_order' | 'debit_note' | 'backorder';
  reference_number: string;
  customer_supplier_name: string;
  date: string;
  sales_qty: number;
  return_qty: number;
  po_qty: number;
  debit_note_qty: number;
  backorder_qty: number;
  status: string;
  expected_date?: string;
}

interface OpenTransactionSummary {
  warehouse_name: string;
  bin_name: string;
  bin_code: string;
  total_stock_on_hand: number;
  available_to_pick: number;
  open_sales_order_qty: number;
  in_transit_qty: number;
  return_order_qty: number;
  debit_note_qty: number;
  backorder_qty: number;
}

interface OpenTransactionsTableProps {
  selectedProductId: string;
  selectedWarehouseId: string;
  selectedBinId: string;
  loading?: boolean;
}

export const OpenTransactionsTable = ({
  selectedProductId,
  selectedWarehouseId,
  selectedBinId,
  loading
}: OpenTransactionsTableProps) => {
  const { company } = useAuth();
  const { toast } = useToast();
  
  const [transactions, setTransactions] = useState<OpenTransaction[]>([]);
  const [summary, setSummary] = useState<OpenTransactionSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [productName, setProductName] = useState<string>('');

  // Only fetch data when all three selections are made
  const shouldFetchData = selectedProductId && selectedWarehouseId && selectedBinId;

  const fetchOpenTransactions = async () => {
    if (!company?.id || !shouldFetchData) return;

    try {
      setDataLoading(true);
      
      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('name')
        .eq('id', selectedProductId)
        .eq('company_id', company.id)
        .single();

      if (productError) throw productError;
      setProductName(productData?.name || 'Unknown Product');
      
      // Fetch warehouse and bin details
      const { data: binData, error: binError } = await supabase
        .from('warehouse_bins')
        .select('warehouse_name, bin_name, wh_bin_code')
        .eq('id', selectedBinId)
        .eq('company_id', company.id)
        .single();

      if (binError) throw binError;

      // Fetch open sales orders
      const { data: salesOrders, error: salesError } = await supabase
        .from('sales_order_items')
        .select(`
          quantity,
          back_order_quantity,
          sales_orders!inner(
            id,
            order_number,
            order_date,
            status,
            customer_id,
            company_id
          )
        `)
        .eq('product_id', selectedProductId)
        .eq('sales_orders.company_id', company.id)
        .in('sales_orders.status', ['confirmed', 'partially_delivered']);

      if (salesError) throw salesError;

      // Fetch open purchase orders
      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_order_items')
        .select(`
          pending_quantity,
          purchase_orders!inner(
            id,
            po_number,
            order_date,
            expected_date,
            status,
            company_id,
            suppliers!inner(name)
          )
        `)
        .eq('product_id', selectedProductId)
        .eq('purchase_orders.company_id', company.id)
        .in('purchase_orders.status', ['open', 'partially_received'])
        .gt('pending_quantity', 0);

      if (poError) throw poError;

      // Fetch open credit notes (return orders)
      const { data: creditNotes, error: cnError } = await supabase
        .from('credit_note_items')
        .select(`
          pending_return_qty,
          credit_notes!inner(
            id,
            cn_number,
            cn_date,
            status,
            customer_name,
            company_id
          )
        `)
        .eq('product_id', selectedProductId)
        .eq('warehouse_id', selectedWarehouseId)
        .eq('credit_notes.company_id', company.id)
        .eq('credit_notes.status', 'confirmed')
        .gt('pending_return_qty', 0);

      if (cnError) throw cnError;

      // Fetch debit notes using separate queries due to relationship issues
      const { data: debitNoteIds, error: dnIdsError } = await supabase
        .from('debit_note_items')
        .select('debit_note_id, pending_quantity')
        .eq('product_id', selectedProductId)
        .gt('pending_quantity', 0);

      if (dnIdsError) throw dnIdsError;

      let debitNotesData: any[] = [];
      if (debitNoteIds && debitNoteIds.length > 0) {
        const noteIds = debitNoteIds.map(item => item.debit_note_id);
        const { data: debitNotesHeaders, error: dnHeadersError } = await supabase
          .from('debit_notes')
          .select('id, debit_note_number, debit_note_date, status, supplier_name')
          .eq('company_id', company.id)
          .in('status', ['draft', 'confirmed'])
          .in('id', noteIds);

        if (dnHeadersError) throw dnHeadersError;

        // Combine debit note items with headers
        debitNotesData = (debitNoteIds || [])
          .map(item => {
            const header = (debitNotesHeaders || []).find(h => h.id === item.debit_note_id);
            return header ? { ...item, debit_notes: header } : null;
          })
          .filter(Boolean);
      }

      // Fetch backorder items
      const { data: backorderItems, error: backorderError } = await supabase
        .from('backorder_items')
        .select(`
          id,
          quantity_backordered,
          unit_price,
          created_at,
          status,
          customer_id
        `)
        .eq('product_id', selectedProductId)
        .eq('warehouse_id', selectedWarehouseId)
        .eq('company_id', company.id)
        .eq('status', 'pending')
        .gt('quantity_backordered', 0);

      if (backorderError) throw backorderError;

      // Get customer names for sales orders and backorders
      const allCustomerIds = [
        ...new Set([
          ...(salesOrders || []).map(so => so.sales_orders.customer_id),
          ...(backorderItems || []).map(bo => bo.customer_id)
        ])
      ];
      let customerMap = new Map();
      if (allCustomerIds.length > 0) {
        const { data: customers, error: customerError } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', allCustomerIds);

        if (customerError) throw customerError;
        customerMap = new Map((customers || []).map(c => [c.id, c.name]));
      }

      // Transform data into unified transaction format
      const allTransactions: OpenTransaction[] = [
        // Sales Orders
        ...(salesOrders || []).map(so => ({
          id: so.sales_orders.id,
          transaction_type: 'sales_order' as const,
          reference_number: so.sales_orders.order_number,
          customer_supplier_name: customerMap.get(so.sales_orders.customer_id) || 'Unknown Customer',
          date: so.sales_orders.order_date,
          sales_qty: so.quantity || 0,
          return_qty: 0,
          po_qty: 0,
          debit_note_qty: 0,
          backorder_qty: so.back_order_quantity || 0,
          status: so.sales_orders.status,
        })),
        
        // Purchase Orders  
        ...(purchaseOrders || []).map(po => ({
          id: po.purchase_orders.id,
          transaction_type: 'purchase_order' as const,
          reference_number: po.purchase_orders.po_number,
          customer_supplier_name: po.purchase_orders.suppliers?.name || 'Unknown Supplier',
          date: po.purchase_orders.order_date,
          sales_qty: 0,
          return_qty: 0,
          po_qty: po.pending_quantity || 0,
          debit_note_qty: 0,
          backorder_qty: 0,
          status: po.purchase_orders.status,
          expected_date: po.purchase_orders.expected_date,
        })),
        
        // Credit Notes (Returns)
        ...(creditNotes || []).map(cn => ({
          id: cn.credit_notes.id,
          transaction_type: 'return_order' as const,
          reference_number: cn.credit_notes.cn_number,
          customer_supplier_name: cn.credit_notes.customer_name,
          date: cn.credit_notes.cn_date,
          sales_qty: 0,
          return_qty: cn.pending_return_qty || 0,
          po_qty: 0,
          debit_note_qty: 0,
          backorder_qty: 0,
          status: cn.credit_notes.status,
        })),
        
        // Debit Notes
        ...(debitNotesData || []).map(dn => ({
          id: dn.debit_notes.id,
          transaction_type: 'debit_note' as const,
          reference_number: dn.debit_notes.debit_note_number,
          customer_supplier_name: dn.debit_notes.supplier_name,
          date: dn.debit_notes.debit_note_date,
          sales_qty: 0,
          return_qty: 0,
          po_qty: 0,
          debit_note_qty: dn.pending_quantity || 0,
          backorder_qty: 0,
          status: dn.debit_notes.status,
        })),

        // Backorder Items
        ...(backorderItems || []).map(bo => ({
          id: bo.id,
          transaction_type: 'backorder' as const,
          reference_number: `BO-${bo.id.slice(0, 8)}`,
          customer_supplier_name: customerMap.get(bo.customer_id) || 'Unknown Customer',
          date: bo.created_at,
          sales_qty: 0,
          return_qty: 0,
          po_qty: 0,
          debit_note_qty: 0,
          backorder_qty: bo.quantity_backordered || 0,
          status: bo.status,
        })),
      ];

      // Calculate summary totals
      const totalOpenSalesOrder = allTransactions.reduce((sum, t) => sum + t.sales_qty, 0);
      const totalInTransit = allTransactions.reduce((sum, t) => sum + t.po_qty, 0);
      const totalReturnOrder = allTransactions.reduce((sum, t) => sum + t.return_qty, 0);
      const totalDebitNote = allTransactions.reduce((sum, t) => sum + t.debit_note_qty, 0);
      const totalBackorder = allTransactions.reduce((sum, t) => sum + t.backorder_qty, 0);
      const totalAllocated = allTransactions.reduce((sum, t) => sum + t.sales_qty, 0);

      // Get current stock for available to pick calculation
      const { data: stockData, error: stockError } = await supabase
        .from('inventory_transactions')
        .select('quantity_change')
        .eq('product_id', selectedProductId)
        .eq('warehouse_id', selectedWarehouseId)
        .eq('bin_id', selectedBinId)
        .eq('company_id', company.id);

      if (stockError) throw stockError;

      const currentStock = (stockData || []).reduce((sum, t) => sum + (t.quantity_change || 0), 0);
      const availableToPick = Math.max(0, currentStock - totalAllocated);

      setSummary({
        warehouse_name: binData?.warehouse_name || 'Unknown Warehouse',
        bin_name: binData?.bin_name || 'Unknown Bin',
        bin_code: binData?.wh_bin_code || 'N/A',
        total_stock_on_hand: currentStock,
        available_to_pick: availableToPick,
        open_sales_order_qty: totalOpenSalesOrder,
        in_transit_qty: totalInTransit,
        return_order_qty: totalReturnOrder,
        debit_note_qty: totalDebitNote,
        backorder_qty: totalBackorder,
      });

      setTransactions(allTransactions);

    } catch (error) {
      console.error('Error fetching open transactions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch open transactions data",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (shouldFetchData) {
      fetchOpenTransactions();
    } else {
      setTransactions([]);
      setSummary(null);
    }
  }, [selectedProductId, selectedWarehouseId, selectedBinId, company?.id]);

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'sales_order':
        return <ShoppingCart className="h-4 w-4 text-primary" />;
      case 'return_order':
        return <RotateCcw className="h-4 w-4 text-warning" />;
      case 'purchase_order':
        return <Package className="h-4 w-4 text-success" />;
      case 'debit_note':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'backorder':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    switch (type) {
      case 'sales_order':
        return <Badge variant="default">Sales Order</Badge>;
      case 'return_order':
        return <Badge variant="outline" className="border-warning text-warning">Return Order</Badge>;
      case 'purchase_order':
        return <Badge variant="outline" className="border-success text-success">Purchase Order</Badge>;
      case 'debit_note':
        return <Badge variant="destructive">Debit Note</Badge>;
      case 'backorder':
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Backorder</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getTransactionTypeLabel = (type: string): string => {
    switch (type) {
      case 'sales_order':
        return 'Sales Order';
      case 'return_order':
        return 'Return Order';
      case 'purchase_order':
        return 'Purchase Order';
      case 'debit_note':
        return 'Debit Note';
      case 'backorder':
        return 'Backorder';
      default:
        return type;
    }
  };

  const handleExportExcel = () => {
    if (!transactions.length) {
      toast({
        title: "No Data",
        description: "There are no transactions to export",
        variant: "destructive",
      });
      return;
    }

    if (!summary) {
      toast({
        title: "Error",
        description: "Missing location information",
        variant: "destructive",
      });
      return;
    }

    const columns: ExportColumn[] = [
      { key: 'transaction_type', label: 'Transaction Type', format: (value) => getTransactionTypeLabel(value) },
      { key: 'customer_supplier_name', label: 'Customer/Supplier Name' },
      { key: 'reference_number', label: 'Reference No' },
      { key: 'sales_qty', label: 'Sales Qty', format: (value) => value > 0 ? value : '-' },
      { key: 'return_qty', label: 'Return Qty', format: (value) => value > 0 ? value : '-' },
      { key: 'po_qty', label: 'PO Qty', format: (value) => value > 0 ? value : '-' },
      { key: 'debit_note_qty', label: 'Debit Note Qty', format: (value) => value > 0 ? value : '-' },
      { key: 'backorder_qty', label: 'Back Order Qty', format: (value) => value > 0 ? value : '-' },
      { key: 'date', label: 'Date', format: formatDate },
      { key: 'status', label: 'Status' },
    ];

    // Build additional metadata with product and location details
    const additionalMetadata = [
      `Item: ${productName}`,
      `Warehouse: ${summary.warehouse_name}`,
      `Bin: ${summary.bin_name} (${summary.bin_code})`
    ];

    const success = exportToExcel({
      filename: `Open_Transactions_${summary.warehouse_name}_${summary.bin_name}`,
      sheetName: 'Open Transactions',
      columns,
      data: transactions,
      includeMetadata: true,
      companyName: company?.name,
      additionalMetadata,
    });

    if (success) {
      toast({
        title: "Export Successful",
        description: "Open transactions exported to Excel successfully",
      });
    } else {
      toast({
        title: "Export Failed",
        description: "Failed to export open transactions to Excel",
        variant: "destructive",
      });
    }
  };

  // Don't show anything if no selections are made
  if (!shouldFetchData) {
    return (
      <Card className="card-elevated">
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Open Transactions Details</h3>
          <p className="text-muted-foreground">
            Select a specific item, warehouse, and bin to view detailed open transactions
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading || dataLoading) {
    return (
      <Card className="card-elevated animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Open Transactions Details
            </CardTitle>
            {summary && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <MapPin className="h-4 w-4" />
                {summary.warehouse_name} - {summary.bin_name} ({summary.bin_code})
              </div>
            )}
          </div>
          {transactions.length > 0 && (
            <Button
              onClick={handleExportExcel}
              variant="outline"
              size="sm"
              className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 rounded-md h-9 px-4 gap-2 font-medium transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Section */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            <div className="text-center p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="text-2xl font-bold text-primary">{summary.total_stock_on_hand}</div>
              <div className="text-xs text-muted-foreground">Total Stock on Hand</div>
            </div>
            <div className="text-center p-4 bg-success/10 border border-success/20 rounded-lg">
              <div className="text-2xl font-bold text-success">{summary.available_to_pick}</div>
              <div className="text-xs text-muted-foreground">Available to Pick</div>
            </div>
            <div className="text-center p-4 bg-blue-100 border border-blue-300 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{summary.open_sales_order_qty}</div>
              <div className="text-xs text-muted-foreground">Open Sales Order Qty</div>
            </div>
            <div className="text-center p-4 bg-accent/10 border border-accent/20 rounded-lg">
              <div className="text-2xl font-bold text-accent">{summary.in_transit_qty}</div>
              <div className="text-xs text-muted-foreground">In Transit Qty</div>
            </div>
            <div className="text-center p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="text-2xl font-bold text-warning">{summary.return_order_qty}</div>
              <div className="text-xs text-muted-foreground">Return Order Qty</div>
            </div>
            <div className="text-center p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="text-2xl font-bold text-destructive">{summary.debit_note_qty}</div>
              <div className="text-xs text-muted-foreground">Debit Note Qty</div>
            </div>
            <div className="text-center p-4 bg-orange-100 border border-orange-300 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{summary.backorder_qty}</div>
              <div className="text-xs text-muted-foreground">Back Order Qty</div>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction Type</TableHead>
                <TableHead>Customer/Supplier Name</TableHead>
                <TableHead>Reference No</TableHead>
                <TableHead className="text-center">Sales Qty</TableHead>
                <TableHead className="text-center">Return Qty</TableHead>
                <TableHead className="text-center">PO Qty</TableHead>
                <TableHead className="text-center">Debit Note Qty</TableHead>
                <TableHead className="text-center">Back Order Qty</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No open transactions found for this item at the selected location
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow key={`${transaction.transaction_type}-${transaction.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionTypeIcon(transaction.transaction_type)}
                        {getTransactionTypeBadge(transaction.transaction_type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{transaction.customer_supplier_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Status: {transaction.status}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{transaction.reference_number}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={transaction.sales_qty > 0 ? "font-semibold text-primary" : "text-muted-foreground"}>
                        {transaction.sales_qty > 0 ? transaction.sales_qty : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={transaction.return_qty > 0 ? "font-semibold text-warning" : "text-muted-foreground"}>
                        {transaction.return_qty > 0 ? transaction.return_qty : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={transaction.po_qty > 0 ? "font-semibold text-success" : "text-muted-foreground"}>
                        {transaction.po_qty > 0 ? transaction.po_qty : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={transaction.debit_note_qty > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
                        {transaction.debit_note_qty > 0 ? transaction.debit_note_qty : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={transaction.backorder_qty > 0 ? "font-semibold text-orange-600" : "text-muted-foreground"}>
                        {transaction.backorder_qty > 0 ? transaction.backorder_qty : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{format(new Date(transaction.date), 'dd MMM yyyy')}</div>
                      {transaction.expected_date && (
                        <div className="text-xs text-muted-foreground">
                          Expected: {format(new Date(transaction.expected_date), 'dd MMM yyyy')}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};