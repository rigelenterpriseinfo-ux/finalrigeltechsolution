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
import { Plus, Search, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';

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

interface SalesOrder {
  id: string;
  order_number: string;
  customer: {
    name: string;
  };
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier: {
    name: string;
  };
}

export function PaymentsModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess('payments');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [accountPayable, setAccountPayable] = useState<any[]>([]);
  const [accountReceivable, setAccountReceivable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchSalesOrders();
    fetchPurchaseOrders();
    fetchAccountPayable();
    fetchAccountReceivable();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          sales_order:sales_orders(
            order_number,
            customer:customers(name)
          ),
          purchase_order:purchase_orders(
            po_number,
            supplier:suppliers(name)
          )
        `)
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('Error fetching payments:', error);
        return;
      }

      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id,
          order_number,
          customer:customers(name)
        `)
        .eq('status', 'confirmed')
        .order('order_number');

      if (error) {
        console.error('Error fetching sales orders:', error);
        return;
      }

      setSalesOrders(data || []);
    } catch (error) {
      console.error('Error fetching sales orders:', error);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          supplier:suppliers(name)
        `)
        .eq('status', 'confirmed')
        .order('po_number');

      if (error) {
        console.error('Error fetching purchase orders:', error);
        return;
      }

      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  const fetchAccountPayable = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          order_date,
          total_amount,
          status,
          supplier:suppliers(name)
        `)
        .in('status', ['confirmed', 'pending'])
        .order('order_date', { ascending: false });

      if (error) {
        console.error('Error fetching account payable:', error);
        return;
      }

      // Calculate due date and ageing for each order
      const processedData = (data || []).map(order => {
        const orderDate = new Date(order.order_date);
        const dueDate = new Date(orderDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days payment terms
        const today = new Date();
        const ageingDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          ...order,
          due_date: dueDate,
          ageing_days: ageingDays
        };
      });

      setAccountPayable(processedData);
    } catch (error) {
      console.error('Error fetching account payable:', error);
    }
  };

  const fetchAccountReceivable = async () => {
    try {
      const { data, error } = await supabase
        .from('performa_invoices')
        .select(`
          id,
          performa_invoice_number,
          performa_invoice_date,
          total_amount,
          status,
          customer:customers(name)
        `)
        .in('status', ['invoiced', 'sent'])
        .order('performa_invoice_date', { ascending: false });

      if (error) {
        console.error('Error fetching account receivable:', error);
        return;
      }

      // Calculate due date and ageing for each invoice
      const processedData = (data || []).map(invoice => {
        const invoiceDate = new Date(invoice.performa_invoice_date);
        const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days payment terms
        const today = new Date();
        const ageingDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          ...invoice,
          due_date: dueDate,
          ageing_days: ageingDays
        };
      });

      setAccountReceivable(processedData);
    } catch (error) {
      console.error('Error fetching account receivable:', error);
    }
  };

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!canEdit) {
      toast({ title: 'Permission denied', description: "You don't have edit access to Payments.", variant: 'destructive' });
      return;
    }
    const formData = new FormData(e.currentTarget);
    const paymentType = formData.get('payment_type') as string;
    
    const paymentData = {
      amount: parseFloat(formData.get('amount') as string),
      payment_method: formData.get('payment_method') as string,
      payment_date: formData.get('payment_date') as string,
      reference_number: formData.get('reference_number') as string || null,
      notes: formData.get('notes') as string || null,
      sales_order_id: paymentType === 'sales' ? formData.get('order_id') as string : null,
      purchase_order_id: paymentType === 'purchase' ? formData.get('order_id') as string : null,
      company_id: profile?.company_id,
      created_by: profile?.id,
    };

    try {
      const { error } = await supabase
        .from('payments')
        .insert([paymentData]);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });

      setShowAddDialog(false);
      fetchPayments();
      e.currentTarget.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
    }
  };

  // Calculate payment statistics
  const totalReceived = payments
    .filter(p => p.sales_order_id)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPaid = payments
    .filter(p => p.purchase_order_id)
    .reduce((sum, p) => sum + p.amount, 0);

  // Calculate pending amounts (this would need order total amounts - placeholder for now)
  const pendingAP = 50000; // Placeholder - would calculate from unpaid purchase orders
  const pendingAR = 35000; // Placeholder - would calculate from unpaid sales orders

  // Calculate payments in time ranges
  const now = new Date();
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const paymentsLast15Days = payments
    .filter(p => p.sales_order_id && new Date(p.payment_date) >= fifteenDaysAgo)
    .reduce((sum, p) => sum + p.amount, 0);

  // For future payments, we'd need due dates from orders - using placeholder
  const paymentsDueNext15Days = 25000; // Placeholder
  const paymentsDueNext30Days = 45000; // Placeholder

  const filteredPayments = payments.filter(payment =>
    payment.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.sales_order?.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.purchase_order?.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.sales_order?.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.purchase_order?.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

    </div>
  );
}