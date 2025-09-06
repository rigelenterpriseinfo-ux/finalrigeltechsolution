import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { Plus, Search, CreditCard, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  sales_order_id: string | null;
  purchase_order_id: string | null;
  sales_order?: {
    order_number: string;
    customer: {
      name: string;
    };
  };
  purchase_order?: {
    po_number: string;
    supplier: {
      name: string;
    };
  };
}

interface GRNPayable {
  id: string;
  grn_number: string;
  grn_date: string;
  total_amount: number;
  supplier_name: string;
  status: string;
  advance_payment: number;
  amount_received: number;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference_no: string | null;
  pending_payment: number;
  invoice_status: string;
}

interface SalesInvoiceReceivable {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  payment_terms: string | null;
  customer: {
    name: string;
  };
  advance_payment: number;
  amount_received: number;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference_no: string | null;
  pending_payment: number;
  invoice_status: string;
}

export function PaymentsModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess('payments');
  const [accountPayable, setAccountPayable] = useState<GRNPayable[]>([]);
  const [accountReceivable, setAccountReceivable] = useState<SalesInvoiceReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAPDetails, setShowAPDetails] = useState(false);
  const [showARDetails, setShowARDetails] = useState(false);
  const [apSearchTerm, setApSearchTerm] = useState('');
  const [arSearchTerm, setArSearchTerm] = useState('');
  
  // Pagination states
  const [apCurrentPage, setApCurrentPage] = useState(1);
  const [arCurrentPage, setArCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Sorting states
  const [apSortField, setApSortField] = useState<keyof GRNPayable>('grn_date');
  const [apSortDirection, setApSortDirection] = useState<'asc' | 'desc'>('desc');
  const [arSortField, setArSortField] = useState<keyof SalesInvoiceReceivable | 'customer_name'>('invoice_date');
  const [arSortDirection, setArSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchAccountPayable();
    fetchAccountReceivable();
  }, []);

  const fetchAccountPayable = async () => {
    try {
      setLoading(true);
      
      // First get GRN data
      const { data: grnData, error: grnError } = await supabase
        .from('grn_header')
        .select(`
          id,
          grn_number,
          grn_date,
          total_amount,
          supplier_name,
          status,
          purchase_order_id
        `)
        .in('status', ['accepted', 'received', 'partially_received'])
        .order('grn_date', { ascending: false });

      if (grnError) {
        console.error('Error fetching GRN data:', grnError);
        return;
      }

      // Get payment data for all purchase orders
      const purchaseOrderIds = grnData?.map(grn => grn.purchase_order_id).filter(Boolean) || [];
      let paymentsData: any[] = [];
      
      if (purchaseOrderIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .in('purchase_order_id', purchaseOrderIds);
          
        if (!paymentsError) {
          paymentsData = payments || [];
        }
      }

      // Transform data to include payment information
      const transformedData = (grnData || []).map(grn => {
        const relatedPayments = paymentsData.filter(payment => payment.purchase_order_id === grn.purchase_order_id);
        const totalAdvancePayment = 0; // Advance payments not implemented yet
        const totalAmountReceived = relatedPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const pendingPayment = grn.total_amount - totalAdvancePayment - totalAmountReceived;
        const latestPayment = relatedPayments.sort((a, b) => 
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        )[0];

        let invoiceStatus = 'Outstanding';
        if (pendingPayment <= 0) {
          invoiceStatus = 'Fully Paid';
        } else if (totalAmountReceived > 0) {
          invoiceStatus = 'Partially Paid';
        }

        return {
          id: grn.id,
          grn_number: grn.grn_number,
          grn_date: grn.grn_date,
          total_amount: grn.total_amount,
          supplier_name: grn.supplier_name,
          status: grn.status,
          advance_payment: totalAdvancePayment,
          amount_received: totalAmountReceived,
          payment_date: latestPayment?.payment_date || null,
          payment_method: latestPayment?.payment_method || null,
          payment_reference_no: latestPayment?.reference_number || null,
          pending_payment: Math.max(0, pendingPayment),
          invoice_status: invoiceStatus
        };
      });

      setAccountPayable(transformedData);
    } catch (error) {
      console.error('Error fetching account payable:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountReceivable = async () => {
    try {
      // First get sales invoice data
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('sales_invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          total_amount,
          payment_terms,
          customer_id,
          customer_name,
          sales_order_id
        `)
        .eq('status', 'finalized')
        .order('invoice_date', { ascending: false });

      if (invoiceError) {
        console.error('Error fetching sales invoice data:', invoiceError);
        return;
      }

      // Get payment data for all sales orders
      const salesOrderIds = invoiceData?.map(invoice => invoice.sales_order_id).filter(Boolean) || [];
      let paymentsData: any[] = [];
      
      if (salesOrderIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .in('sales_order_id', salesOrderIds);
          
        if (!paymentsError) {
          paymentsData = payments || [];
        }
      }

      // Transform data to include payment information and status logic
      const transformedData = (invoiceData || []).map(invoice => {
        const relatedPayments = paymentsData.filter(payment => payment.sales_order_id === invoice.sales_order_id);
        const totalAdvancePayment = 0; // Advance payments not implemented yet
        const totalAmountReceived = relatedPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const pendingPayment = invoice.total_amount - totalAdvancePayment - totalAmountReceived;
        const latestPayment = relatedPayments.sort((a, b) => 
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        )[0];

        // Calculate invoice status including overdue logic
        let invoiceStatus = 'Outstanding';
        if (pendingPayment <= 0) {
          invoiceStatus = 'Fully Paid';
        } else if (totalAmountReceived > 0) {
          invoiceStatus = 'Partially Paid';
        }

        // Check for overdue status
        if (pendingPayment > 0) {
          const invoiceDate = new Date(invoice.invoice_date);
          const paymentTermDays = parseInt(invoice.payment_terms?.replace(/\D/g, '') || '30');
          const dueDate = new Date(invoiceDate.getTime() + (paymentTermDays * 24 * 60 * 60 * 1000));
          const currentDate = new Date();
          
          if (currentDate > dueDate) {
            invoiceStatus = 'Overdue';
          }
        }

        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          total_amount: invoice.total_amount,
          payment_terms: invoice.payment_terms,
          customer: { name: invoice.customer_name },
          advance_payment: totalAdvancePayment,
          amount_received: totalAmountReceived,
          payment_date: latestPayment?.payment_date || null,
          payment_method: latestPayment?.payment_method || null,
          payment_reference_no: latestPayment?.reference_number || null,
          pending_payment: Math.max(0, pendingPayment),
          invoice_status: invoiceStatus
        };
      });

      setAccountReceivable(transformedData);
    } catch (error) {
      console.error('Error fetching account receivable:', error);
    }
  };


  // Sorting functions
  const handleApSort = (field: keyof GRNPayable) => {
    if (apSortField === field) {
      setApSortDirection(apSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setApSortField(field);
      setApSortDirection('asc');
    }
    setApCurrentPage(1);
  };

  const handleArSort = (field: keyof SalesInvoiceReceivable | 'customer_name') => {
    if (arSortField === field) {
      setArSortDirection(arSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setArSortField(field);
      setArSortDirection('asc');
    }
    setArCurrentPage(1);
  };

  // Filter and sort functions
  const filteredAndSortedAP = accountPayable
    .filter(item =>
      item.supplier_name.toLowerCase().includes(apSearchTerm.toLowerCase()) ||
      item.grn_number.toLowerCase().includes(apSearchTerm.toLowerCase()) ||
      (item.payment_reference_no && item.payment_reference_no.toLowerCase().includes(apSearchTerm.toLowerCase())) ||
      item.invoice_status.toLowerCase().includes(apSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[apSortField];
      const bValue = b[apSortField];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return apSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return apSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

  const filteredAndSortedAR = accountReceivable
    .filter(item =>
      item.customer?.name.toLowerCase().includes(arSearchTerm.toLowerCase()) ||
      item.invoice_number?.toLowerCase().includes(arSearchTerm.toLowerCase()) ||
      (item.payment_reference_no && item.payment_reference_no.toLowerCase().includes(arSearchTerm.toLowerCase())) ||
      item.invoice_status.toLowerCase().includes(arSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      // Special handling for customer name
      if (arSortField === 'customer_name') {
        aValue = a.customer?.name || '';
        bValue = b.customer?.name || '';
      } else {
        aValue = a[arSortField];
        bValue = b[arSortField];
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return arSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return arSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

  // Pagination
  const paginatedAP = filteredAndSortedAP.slice(
    (apCurrentPage - 1) * itemsPerPage,
    apCurrentPage * itemsPerPage
  );

  const paginatedAR = filteredAndSortedAR.slice(
    (arCurrentPage - 1) * itemsPerPage,
    arCurrentPage * itemsPerPage
  );

  const totalAPPages = Math.ceil(filteredAndSortedAP.length / itemsPerPage);
  const totalARPages = Math.ceil(filteredAndSortedAR.length / itemsPerPage);

  // Export functions
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => 
      Object.values(item).map(value => 
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      ).join(',')
    ).join('\n');
    
    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleAPExport = () => {
    const exportData = filteredAndSortedAP.map(item => ({
      'Vendor Name': item.supplier_name,
      'GRN Number': item.grn_number,
      'GRN Date': new Date(item.grn_date).toLocaleDateString(),
      'Total Amount': item.total_amount,
      'Advance Payment': item.advance_payment,
      'Amount Received': item.amount_received,
      'Payment Date': item.payment_date ? new Date(item.payment_date).toLocaleDateString() : '',
      'Payment Method': item.payment_method || '',
      'Payment Reference': item.payment_reference_no || '',
      'Pending Payment': item.pending_payment,
      'Invoice Status': item.invoice_status,
      'GRN Status': item.status
    }));
    exportToCSV(exportData, 'account_payable');
    toast({ title: "Export successful", description: "Account Payable data exported to CSV" });
  };

  const handleARExport = () => {
    const exportData = filteredAndSortedAR.map(item => ({
      'Customer Name': item.customer?.name || 'N/A',
      'Invoice Number': item.invoice_number || 'N/A',
      'Invoice Date': new Date(item.invoice_date).toLocaleDateString(),
      'Total Amount': item.total_amount,
      'Advance Payment': item.advance_payment,
      'Amount Received': item.amount_received,
      'Payment Date': item.payment_date ? new Date(item.payment_date).toLocaleDateString() : '',
      'Payment Method': item.payment_method || '',
      'Payment Reference': item.payment_reference_no || '',
      'Pending Payment': item.pending_payment,
      'Invoice Status': item.invoice_status,
      'Payment Terms': item.payment_terms || 'Net 30'
    }));
    exportToCSV(exportData, 'account_receivable');
    toast({ title: "Export successful", description: "Account Receivable data exported to CSV" });
  };

  // Calculate totals
  const totalAP = accountPayable.reduce((sum, item) => sum + item.total_amount, 0);
  const totalAR = accountReceivable.reduce((sum, item) => sum + item.total_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Payment Management</h1>
        <p className="text-muted-foreground">Track payments received and made</p>
      </div>

      {/* AP and AR Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
        {/* Account Payable Section */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { setShowAPDetails(!showAPDetails); setShowARDetails(false); }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                Account Payable (AP)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">₹{totalAP.toLocaleString()}</span>
                {showAPDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              {accountPayable.length} received GRN records
            </p>
          </CardContent>
        </Card>

        {/* Account Receivable Section */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { setShowARDetails(!showARDetails); setShowAPDetails(false); }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Account Receivable (AR)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">₹{totalAR.toLocaleString()}</span>
                {showARDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              {accountReceivable.length} outstanding invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account Payable Details */}
      {showAPDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Account Payable Details</CardTitle>
            <div className="flex gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search vendors or GRN numbers..."
                  value={apSearchTerm}
                  onChange={(e) => { setApSearchTerm(e.target.value); setApCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleAPExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('supplier_name')}>
                        Vendor Name
                        {apSortField === 'supplier_name' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('grn_number')}>
                        GRN Number
                        {apSortField === 'grn_number' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('grn_date')}>
                        GRN Date
                        {apSortField === 'grn_date' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('total_amount')}>
                        Total Amount
                        {apSortField === 'total_amount' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('advance_payment')}>
                        Advance Payment
                        {apSortField === 'advance_payment' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('amount_received')}>
                        Amount Received
                        {apSortField === 'amount_received' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('payment_date')}>
                        Payment Date
                        {apSortField === 'payment_date' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('payment_method')}>
                        Payment Method
                        {apSortField === 'payment_method' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('payment_reference_no')}>
                        Payment Ref
                        {apSortField === 'payment_reference_no' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('pending_payment')}>
                        Pending Payment
                        {apSortField === 'pending_payment' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleApSort('invoice_status')}>
                        Payment Status
                        {apSortField === 'invoice_status' ? (
                          apSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAP.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground">
                        No GRN records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAP.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.supplier_name || 'N/A'}</TableCell>
                        <TableCell>{item.grn_number}</TableCell>
                        <TableCell>{new Date(item.grn_date).toLocaleDateString()}</TableCell>
                        <TableCell>₹{item.total_amount.toLocaleString()}</TableCell>
                        <TableCell>₹{item.advance_payment.toLocaleString()}</TableCell>
                        <TableCell>₹{item.amount_received.toLocaleString()}</TableCell>
                        <TableCell>{item.payment_date ? new Date(item.payment_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{item.payment_method || '-'}</TableCell>
                        <TableCell>{item.payment_reference_no || '-'}</TableCell>
                        <TableCell>₹{item.pending_payment.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={
                            item.invoice_status === 'Fully Paid' ? 'default' :
                            item.invoice_status === 'Partially Paid' ? 'secondary' :
                            item.invoice_status === 'Overdue' ? 'destructive' : 'outline'
                          }>
                            {item.invoice_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {totalAPPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((apCurrentPage - 1) * itemsPerPage) + 1} to {Math.min(apCurrentPage * itemsPerPage, filteredAndSortedAP.length)} of {filteredAndSortedAP.length} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApCurrentPage(apCurrentPage - 1)}
                    disabled={apCurrentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm font-medium">
                    Page {apCurrentPage} of {totalAPPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApCurrentPage(apCurrentPage + 1)}
                    disabled={apCurrentPage === totalAPPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Receivable Details */}
      {showARDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Account Receivable Details</CardTitle>
            <div className="flex gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search customers or invoice numbers..."
                  value={arSearchTerm}
                  onChange={(e) => { setArSearchTerm(e.target.value); setArCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleARExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('customer_name')}>
                        Customer Name
                        {arSortField === 'customer_name' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('invoice_number')}>
                        Invoice Number
                        {arSortField === 'invoice_number' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('invoice_date')}>
                        Invoice Date
                        {arSortField === 'invoice_date' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('total_amount')}>
                        Total Amount
                        {arSortField === 'total_amount' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('advance_payment')}>
                        Advance Payment
                        {arSortField === 'advance_payment' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('amount_received')}>
                        Amount Received
                        {arSortField === 'amount_received' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('payment_date')}>
                        Payment Date
                        {arSortField === 'payment_date' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('payment_method')}>
                        Payment Method
                        {arSortField === 'payment_method' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('payment_reference_no')}>
                        Payment Ref
                        {arSortField === 'payment_reference_no' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('pending_payment')}>
                        Pending Payment
                        {arSortField === 'pending_payment' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('invoice_status')}>
                        Payment Status
                        {arSortField === 'invoice_status' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-semibold hover:bg-transparent" onClick={() => handleArSort('payment_terms')}>
                        Payment Terms
                        {arSortField === 'payment_terms' ? (
                          arSortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAR.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground">
                        No invoices found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAR.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.customer?.name || 'N/A'}</TableCell>
                        <TableCell>{item.invoice_number || 'N/A'}</TableCell>
                        <TableCell>{new Date(item.invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell>₹{item.total_amount.toLocaleString()}</TableCell>
                        <TableCell>₹{item.advance_payment.toLocaleString()}</TableCell>
                        <TableCell>₹{item.amount_received.toLocaleString()}</TableCell>
                        <TableCell>{item.payment_date ? new Date(item.payment_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{item.payment_method || '-'}</TableCell>
                        <TableCell>{item.payment_reference_no || '-'}</TableCell>
                        <TableCell>₹{item.pending_payment.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={
                            item.invoice_status === 'Fully Paid' ? 'default' :
                            item.invoice_status === 'Partially Paid' ? 'secondary' :
                            item.invoice_status === 'Overdue' ? 'destructive' : 'outline'
                          }>
                            {item.invoice_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.payment_terms || 'Net 30'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {totalARPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((arCurrentPage - 1) * itemsPerPage) + 1} to {Math.min(arCurrentPage * itemsPerPage, filteredAndSortedAR.length)} of {filteredAndSortedAR.length} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setArCurrentPage(arCurrentPage - 1)}
                    disabled={arCurrentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm font-medium">
                    Page {arCurrentPage} of {totalARPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setArCurrentPage(arCurrentPage + 1)}
                    disabled={arCurrentPage === totalARPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}