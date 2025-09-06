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
import { Plus, Search, CreditCard, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';

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

interface PurchaseOrderPayable {
  id: string;
  po_number: string;
  order_date: string;
  total_amount: number;
  payment_terms: string | null;
  supplier: {
    name: string;
  };
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
}

export function PaymentsModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess('payments');
  const [accountPayable, setAccountPayable] = useState<PurchaseOrderPayable[]>([]);
  const [accountReceivable, setAccountReceivable] = useState<SalesInvoiceReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAPDetails, setShowAPDetails] = useState(false);
  const [showARDetails, setShowARDetails] = useState(false);
  const [apSearchTerm, setApSearchTerm] = useState('');
  const [arSearchTerm, setArSearchTerm] = useState('');

  useEffect(() => {
    fetchAccountPayable();
    fetchAccountReceivable();
  }, []);

  const fetchAccountPayable = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          order_date,
          total_amount,
          payment_terms,
          supplier:suppliers(name)
        `)
        .eq('status', 'confirmed')
        .order('order_date', { ascending: false });

      if (error) {
        console.error('Error fetching account payable:', error);
        return;
      }

      setAccountPayable(data || []);
    } catch (error) {
      console.error('Error fetching account payable:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountReceivable = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          total_amount,
          payment_terms,
          customer_id,
          customer_name
        `)
        .eq('status', 'finalized')
        .order('invoice_date', { ascending: false });

      if (error) {
        console.error('Error fetching account receivable:', error);
        return;
      }

      // Transform data to match interface
      const transformedData = (data || []).map(invoice => ({
        ...invoice,
        customer: { name: invoice.customer_name }
      }));

      setAccountReceivable(transformedData);
    } catch (error) {
      console.error('Error fetching account receivable:', error);
    }
  };


  // Filter functions for search
  const filteredAccountPayable = accountPayable.filter(item =>
    item.supplier?.name.toLowerCase().includes(apSearchTerm.toLowerCase()) ||
    item.po_number.toLowerCase().includes(apSearchTerm.toLowerCase())
  );

  const filteredAccountReceivable = accountReceivable.filter(item =>
    item.customer?.name.toLowerCase().includes(arSearchTerm.toLowerCase()) ||
    item.invoice_number?.toLowerCase().includes(arSearchTerm.toLowerCase())
  );

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
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setShowAPDetails(!showAPDetails)}>
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
              {accountPayable.length} outstanding purchase orders
            </p>
          </CardContent>
        </Card>

        {/* Account Receivable Section */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setShowARDetails(!showARDetails)}>
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
                  placeholder="Search vendors or PO numbers..."
                  value={apSearchTerm}
                  onChange={(e) => setApSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Terms</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccountPayable.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No purchase orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccountPayable.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.supplier?.name || 'N/A'}</TableCell>
                        <TableCell>{item.po_number}</TableCell>
                        <TableCell>{new Date(item.order_date).toLocaleDateString()}</TableCell>
                        <TableCell>₹{item.total_amount.toLocaleString()}</TableCell>
                        <TableCell>{item.payment_terms || 'Net 30'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                  onChange={(e) => setArSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Terms</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccountReceivable.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No invoices found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccountReceivable.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.customer?.name || 'N/A'}</TableCell>
                        <TableCell>{item.invoice_number || 'N/A'}</TableCell>
                        <TableCell>{new Date(item.invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell>₹{item.total_amount.toLocaleString()}</TableCell>
                        <TableCell>{item.payment_terms || 'Net 30'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}