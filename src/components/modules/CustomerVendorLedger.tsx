import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, FileText, Receipt, CreditCard, DollarSign, Download, BookOpen, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Customer {
  id: string;
  name: string;
  customer_ref?: string;
}

interface Supplier {
  id: string;
  name: string;
  supplier_ref?: string;
}

interface LedgerTransaction {
  id: string;
  date: string;
  type: 'sales_invoice' | 'credit_note' | 'payment_received' | 'grn' | 'debit_note' | 'payment_made' | 'opening_balance';
  reference_no: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  status?: string;
}

interface CustomerVendorLedgerProps {
  onClose?: () => void;
  initialEntityType?: 'customer' | 'vendor';
  initialEntityId?: string;
  initialEntityName?: string;
}

export function CustomerVendorLedger({ 
  onClose, 
  initialEntityType, 
  initialEntityId, 
  initialEntityName 
}: CustomerVendorLedgerProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [entityType, setEntityType] = useState<'customer' | 'vendor'>(initialEntityType || 'customer');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(initialEntityId || '');
  const [selectedEntityName, setSelectedEntityName] = useState<string>(initialEntityName || '');
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [ledgerGenerated, setLedgerGenerated] = useState(false);

  // Fetch customers and suppliers
  useEffect(() => {
    fetchCustomers();
    fetchSuppliers();
  }, [profile]);

  // Set initial values when provided
  useEffect(() => {
    if (initialEntityType) setEntityType(initialEntityType);
    if (initialEntityId) setSelectedEntityId(initialEntityId);
    if (initialEntityName) setSelectedEntityName(initialEntityName);
  }, [initialEntityType, initialEntityId, initialEntityName]);

  const fetchCustomers = async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, customer_ref')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
    }
  };

  const fetchSuppliers = async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, supplier_ref')
        .eq('company_id', profile.company_id)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch suppliers",
        variant: "destructive",
      });
    }
  };

  const generateLedger = async () => {
    if (!selectedEntityId || !dateRange.from || !dateRange.to || !profile?.company_id) {
      toast({
        title: "Missing Information",
        description: "Please select entity and date range",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let ledgerTransactions: LedgerTransaction[] = [];
      let openingBalance = 0;

      if (entityType === 'customer') {
        const { transactions, opening } = await fetchCustomerLedger(selectedEntityId);
        ledgerTransactions = transactions;
        openingBalance = opening;
      } else {
        const { transactions, opening } = await fetchVendorLedger(selectedEntityId);
        ledgerTransactions = transactions;
        openingBalance = opening;
      }

      // Add opening balance as first transaction if it's not zero
      if (openingBalance !== 0) {
        ledgerTransactions.unshift({
          id: 'opening-balance',
          date: format(dateRange.from!, 'yyyy-MM-dd'),
          type: 'opening_balance' as any,
          reference_no: 'OPENING',
          description: 'Opening Balance',
          debit: openingBalance > 0 ? openingBalance : 0,
          credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
          balance: 0
        });
      }

      // Sort by date and calculate running balance
      ledgerTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let runningBalance = 0;
      ledgerTransactions.forEach(transaction => {
        runningBalance += transaction.debit - transaction.credit;
        transaction.balance = runningBalance;
      });

      setTransactions(ledgerTransactions);
      setLedgerGenerated(true);
    } catch (error) {
      console.error('Error generating ledger:', error);
      toast({
        title: "Error",
        description: "Failed to generate ledger",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerLedger = async (customerId: string): Promise<{ transactions: LedgerTransaction[], opening: number }> => {
    const transactions: LedgerTransaction[] = [];
    let openingBalance = 0;

    // Calculate opening balance (transactions before the date range)
    const { data: openingData } = await supabase
      .from('sales_invoices')
      .select('total_amount')
      .eq('customer_id', customerId)
      .eq('company_id', profile!.company_id)
      .lt('invoice_date', format(dateRange.from!, 'yyyy-MM-dd'));

    openingBalance += openingData?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0;

    const { data: openingCreditData } = await supabase
      .from('credit_notes')
      .select('total_amount')
      .eq('customer_id', customerId)
      .eq('company_id', profile!.company_id)
      .lt('cn_date', format(dateRange.from!, 'yyyy-MM-dd'));

    openingBalance -= openingCreditData?.reduce((sum, cn) => sum + cn.total_amount, 0) || 0;

    const { data: openingPaymentData } = await supabase
      .from('payments')
      .select('amount, sales_invoice_id, sales_invoices(customer_id)')
      .eq('company_id', profile!.company_id)
      .not('sales_invoice_id', 'is', null)
      .lt('payment_date', format(dateRange.from!, 'yyyy-MM-dd'));

    const customerOpeningPayments = openingPaymentData?.filter(payment => 
      payment.sales_invoices?.customer_id === customerId
    ) || [];

    openingBalance -= customerOpeningPayments.reduce((sum, payment) => sum + payment.amount, 0);

    // Fetch sales invoices
    const { data: invoices } = await supabase
      .from('sales_invoices')
      .select('id, invoice_number, invoice_date, total_amount, status')
      .eq('customer_id', customerId)
      .eq('company_id', profile!.company_id)
      .gte('invoice_date', format(dateRange.from!, 'yyyy-MM-dd'))
      .lte('invoice_date', format(dateRange.to!, 'yyyy-MM-dd'));

    invoices?.forEach(invoice => {
      transactions.push({
        id: invoice.id,
        date: invoice.invoice_date,
        type: 'sales_invoice',
        reference_no: invoice.invoice_number || '',
        description: `Sales Invoice - ${invoice.invoice_number}`,
        debit: invoice.total_amount,
        credit: 0,
        balance: 0,
        status: invoice.status
      });
    });

    // Fetch credit notes
    const { data: creditNotes } = await supabase
      .from('credit_notes')
      .select('id, cn_number, cn_date, total_amount, status')
      .eq('customer_id', customerId)
      .eq('company_id', profile!.company_id)
      .gte('cn_date', format(dateRange.from!, 'yyyy-MM-dd'))
      .lte('cn_date', format(dateRange.to!, 'yyyy-MM-dd'));

    creditNotes?.forEach(cn => {
      transactions.push({
        id: cn.id,
        date: cn.cn_date,
        type: 'credit_note',
        reference_no: cn.cn_number || '',
        description: `Credit Note - ${cn.cn_number}`,
        debit: 0,
        credit: cn.total_amount,
        balance: 0,
        status: cn.status
      });
    });

    // Fetch payments received
    const { data: payments } = await supabase
      .from('payments')
      .select('id, payment_date, amount, payment_method, reference_number, sales_invoice_id, sales_invoices(invoice_number)')
      .eq('company_id', profile!.company_id)
      .not('sales_invoice_id', 'is', null)
      .gte('payment_date', format(dateRange.from!, 'yyyy-MM-dd'))
      .lte('payment_date', format(dateRange.to!, 'yyyy-MM-dd'));

    // Filter payments for this customer through their invoices
    const customerInvoiceIds = invoices?.map(inv => inv.id) || [];
    const customerPayments = payments?.filter(payment => 
      customerInvoiceIds.includes(payment.sales_invoice_id)
    ) || [];

    customerPayments.forEach(payment => {
      transactions.push({
        id: payment.id,
        date: payment.payment_date,
        type: 'payment_received',
        reference_no: payment.reference_number || '',
        description: `Payment Received - ${payment.payment_method} (${payment.sales_invoices?.invoice_number})`,
        debit: 0,
        credit: payment.amount,
        balance: 0
      });
    });

    return { transactions, opening: openingBalance };
  };

  const fetchVendorLedger = async (supplierId: string): Promise<{ transactions: LedgerTransaction[], opening: number }> => {
    const transactions: LedgerTransaction[] = [];
    let openingBalance = 0;

    // Calculate opening balance (transactions before the date range)
    const { data: openingGrnData } = await supabase
      .from('grn_header')
      .select('total_amount')
      .eq('supplier_id', supplierId)
      .eq('company_id', profile!.company_id)
      .lt('grn_date', format(dateRange.from!, 'yyyy-MM-dd'));

    openingBalance -= openingGrnData?.reduce((sum, grn) => sum + grn.total_amount, 0) || 0;

    const { data: openingDebitData } = await supabase
      .from('debit_notes')
      .select('total_amount')
      .eq('supplier_id', supplierId)
      .eq('company_id', profile!.company_id)
      .lt('debit_note_date', format(dateRange.from!, 'yyyy-MM-dd'));

    openingBalance += openingDebitData?.reduce((sum, dn) => sum + dn.total_amount, 0) || 0;

    const { data: openingPaymentData } = await supabase
      .from('payments')
      .select('amount, grn_id, grn_header(supplier_id)')
      .eq('company_id', profile!.company_id)
      .not('grn_id', 'is', null)
      .lt('payment_date', format(dateRange.from!, 'yyyy-MM-dd'));

    const supplierOpeningPayments = openingPaymentData?.filter(payment => 
      payment.grn_header?.supplier_id === supplierId
    ) || [];

    openingBalance += supplierOpeningPayments.reduce((sum, payment) => sum + payment.amount, 0);

    // Fetch GRNs (Purchase Invoices)
    const { data: grns } = await supabase
      .from('grn_header')
      .select('id, grn_number, grn_date, total_amount, status')
      .eq('supplier_id', supplierId)
      .eq('company_id', profile!.company_id)
      .gte('grn_date', format(dateRange.from!, 'yyyy-MM-dd'))
      .lte('grn_date', format(dateRange.to!, 'yyyy-MM-dd'));

    grns?.forEach(grn => {
      transactions.push({
        id: grn.id,
        date: grn.grn_date,
        type: 'grn',
        reference_no: grn.grn_number,
        description: `Purchase Invoice - ${grn.grn_number}`,
        debit: 0,
        credit: grn.total_amount,
        balance: 0,
        status: grn.status
      });
    });

    // Fetch debit notes
    const { data: debitNotes } = await supabase
      .from('debit_notes')
      .select('id, debit_note_number, debit_note_date, total_amount, status')
      .eq('supplier_id', supplierId)
      .eq('company_id', profile!.company_id)
      .gte('debit_note_date', format(dateRange.from!, 'yyyy-MM-dd'))
      .lte('debit_note_date', format(dateRange.to!, 'yyyy-MM-dd'));

    debitNotes?.forEach(dn => {
      transactions.push({
        id: dn.id,
        date: dn.debit_note_date,
        type: 'debit_note',
        reference_no: dn.debit_note_number || '',
        description: `Debit Note - ${dn.debit_note_number}`,
        debit: dn.total_amount,
        credit: 0,
        balance: 0,
        status: dn.status
      });
    });

    // Fetch payments made
    const { data: payments } = await supabase
      .from('payments')
      .select('id, payment_date, amount, payment_method, reference_number, grn_id, grn_header(grn_number)')
      .eq('company_id', profile!.company_id)
      .not('grn_id', 'is', null)
      .gte('payment_date', format(dateRange.from!, 'yyyy-MM-dd'))
      .lte('payment_date', format(dateRange.to!, 'yyyy-MM-dd'));

    // Filter payments for this supplier through their GRNs
    const supplierGrnIds = grns?.map(grn => grn.id) || [];
    const supplierPayments = payments?.filter(payment => 
      supplierGrnIds.includes(payment.grn_id)
    ) || [];

    supplierPayments.forEach(payment => {
      transactions.push({
        id: payment.id,
        date: payment.payment_date,
        type: 'payment_made',
        reference_no: payment.reference_number || '',
        description: `Payment Made - ${payment.payment_method} (${payment.grn_header?.grn_number})`,
        debit: payment.amount,
        credit: 0,
        balance: 0
      });
    });

    return { transactions, opening: openingBalance };
  };

  const getTransactionIcon = (type: LedgerTransaction['type']) => {
    switch (type) {
      case 'sales_invoice': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'credit_note': return <Receipt className="h-4 w-4 text-green-500" />;
      case 'payment_received': return <DollarSign className="h-4 w-4 text-green-600" />;
      case 'grn': return <FileText className="h-4 w-4 text-orange-500" />;
      case 'debit_note': return <Receipt className="h-4 w-4 text-red-500" />;
      case 'payment_made': return <CreditCard className="h-4 w-4 text-red-600" />;
      case 'opening_balance': return <BookOpen className="h-4 w-4 text-purple-600" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: LedgerTransaction['type']) => {
    switch (type) {
      case 'sales_invoice': return 'Sales Invoice';
      case 'credit_note': return 'Credit Note';
      case 'payment_received': return 'Payment Received';
      case 'grn': return 'Purchase Invoice';
      case 'debit_note': return 'Debit Note';
      case 'payment_made': return 'Payment Made';
      case 'opening_balance': return 'Opening Balance';
      default: return type;
    }
  };

  const calculateOutstanding = () => {
    return transactions.reduce((sum, t) => sum + (t.debit - t.credit), 0);
  };

  const handleEntityChange = (entityId: string) => {
    setSelectedEntityId(entityId);
    const entity = entityType === 'customer' 
      ? customers.find(c => c.id === entityId)
      : suppliers.find(s => s.id === entityId);
    setSelectedEntityName(entity?.name || '');
    setLedgerGenerated(false);
    setTransactions([]);
  };

  const exportToCSV = () => {
    if (transactions.length === 0) {
      toast({
        title: "No Data",
        description: "No transactions to export",
        variant: "destructive",
      });
      return;
    }

    const csvData = transactions.map(transaction => ({
      Date: format(new Date(transaction.date), 'dd-MM-yyyy'),
      Type: getTypeLabel(transaction.type),
      Reference: transaction.reference_no,
      Description: transaction.description,
      Debit: transaction.debit > 0 ? transaction.debit : '',
      Credit: transaction.credit > 0 ? transaction.credit : '',
      Balance: transaction.balance
    }));

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => 
      Object.values(row).map(value => 
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      ).join(',')
    ).join('\n');

    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedEntityName}_Ledger_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: "Ledger exported to CSV successfully",
    });
  };

  const exportToPDF = () => {
    if (transactions.length === 0) {
      toast({
        title: "No Data",
        description: "No transactions to export",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text(`${entityType === 'customer' ? 'Customer' : 'Vendor'} Ledger - ${selectedEntityName}`, 14, 20);
    
    // Add date range
    doc.setFontSize(10);
    doc.text(`Period: ${format(dateRange.from!, 'dd-MM-yyyy')} to ${format(dateRange.to!, 'dd-MM-yyyy')}`, 14, 28);
    
    // Add outstanding amount
    const outstanding = calculateOutstanding();
    doc.text(`Outstanding: ₹${Math.abs(outstanding).toLocaleString()} ${outstanding > 0 ? '(Due)' : '(Credit)'}`, 14, 34);

    // Prepare table data
    const tableData = transactions.map(transaction => [
      format(new Date(transaction.date), 'dd-MM-yyyy'),
      getTypeLabel(transaction.type),
      transaction.reference_no,
      transaction.description.length > 30 ? transaction.description.substring(0, 30) + '...' : transaction.description,
      transaction.debit > 0 ? `₹${transaction.debit.toLocaleString()}` : '',
      transaction.credit > 0 ? `₹${transaction.credit.toLocaleString()}` : '',
      `₹${Math.abs(transaction.balance).toLocaleString()}`
    ]);

    // Add table
    autoTable(doc, {
      head: [['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      columnStyles: {
        4: { halign: 'right' }, // Debit
        5: { halign: 'right' }, // Credit
        6: { halign: 'right' }  // Balance
      }
    });

    // Save the PDF
    doc.save(`${selectedEntityName}_Ledger_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

    toast({
      title: "Export Successful",
      description: "Ledger exported to PDF successfully",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Customer/Vendor Ledger
        </CardTitle>
        <CardDescription>
          Generate detailed ledger for customers or vendors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Entity Type Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Entity Type</Label>
            <Select value={entityType} onValueChange={(value) => {
              setEntityType(value as 'customer' | 'vendor');
              setSelectedEntityId('');
              setSelectedEntityName('');
              setLedgerGenerated(false);
              setTransactions([]);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entity Selection */}
          <div className="space-y-2">
            <Label>{entityType === 'customer' ? 'Customer' : 'Vendor'}</Label>
            <SearchableCombobox
              value={selectedEntityId}
              onSelect={handleEntityChange}
              placeholder={`Select ${entityType}`}
              searchPlaceholder={`Search ${entityType}s...`}
              options={(entityType === 'customer' ? customers : suppliers).map((entity) => ({
                id: entity.id,
                name: entity.name,
                subtitle: (entity as any).customer_ref || (entity as any).supplier_ref
              }))}
              emptyMessage={`No ${entityType}s found`}
            />
          </div>
        </div>

        {/* Date Range Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? format(dateRange.from, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>To Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("justify-start text-left font-normal", !dateRange.to && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.to ? format(dateRange.to, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.to}
                  onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Button onClick={generateLedger} disabled={loading || !selectedEntityId}>
          {loading ? "Generating..." : "Generate Ledger"}
        </Button>

        {/* Ledger Results */}
        {ledgerGenerated && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {entityType === 'customer' ? 'Customer' : 'Vendor'} Ledger - {selectedEntityName}
              </h3>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-medium">Outstanding: </span>
                  <span className={cn("font-bold", calculateOutstanding() > 0 ? "text-red-600" : "text-green-600")}>
                    ₹{Math.abs(calculateOutstanding()).toLocaleString()}
                    {calculateOutstanding() > 0 ? " (Due)" : " (Credit)"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={exportToCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToPDF}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{format(new Date(transaction.date), 'dd-MM-yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.type)}
                          <span className="text-sm">{getTypeLabel(transaction.type)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{transaction.reference_no}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{transaction.description}</TableCell>
                      <TableCell className="text-right">
                        {transaction.debit > 0 && `₹${transaction.debit.toLocaleString()}`}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.credit > 0 && `₹${transaction.credit.toLocaleString()}`}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", 
                        transaction.balance > 0 ? "text-red-600" : "text-green-600")}>
                        ₹{Math.abs(transaction.balance).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}