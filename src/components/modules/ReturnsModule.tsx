import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PermissionWrapper, PermissionButton, PermissionInput, PermissionTextarea, PermissionSelect } from '@/components/ui/permission-wrapper';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';
import { 
  RotateCcw, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Eye, 
  Download,
  ArrowLeft,
  Calendar,
  User,
  Package,
  Save,
  Check,
  Trash2,
  ChevronDown
} from 'lucide-react';

interface ReturnOrder {
  id: string;
  rso_number: string;
  rso_date: string;
  customer_name: string;
  invoice_number: string;
  status: 'Draft' | 'Confirmed';
  reason_for_credit: string;
  total_amount: number;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  customer_ref: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
}

interface InvoiceLineItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  hsn_sac_code?: string;
  unit_of_measure: string;
  quantity_invoiced: number;
  unit_price: number;
  discount_percentage?: number;
  discount_amount: number;
  cgst_rate?: number;
  cgst_amount?: number;
  sgst_rate?: number;
  sgst_amount?: number;
  igst_rate?: number;
  igst_amount?: number;
  line_subtotal: number;
  tax_amount: number;
  line_total: number;
  return_qty: number;
  pending_return_qty: number;
}

interface CreditNote {
  id: string;
  credit_number: string;
  customer_name: string;
  issue_date: string;
  status: 'draft' | 'issued' | 'applied';
  amount: number;
  reason: string;
  reference_type: 'return' | 'manual';
}

export function ReturnsModule() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('returns');
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [isCreditNoteDialogOpen, setIsCreditNoteDialogOpen] = useState(false);
  
  // Return form state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceLineItem[]>([]);
  const [reasonForCredit, setReasonForCredit] = useState('');
  const [deliverySameAsCompany, setDeliverySameAsCompany] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    country: '',
    pin_code: ''
  });
  const [notes, setNotes] = useState('');
  const [currentRSO, setCurrentRSO] = useState<ReturnOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Reference data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [returnOrders, setReturnOrders] = useState<ReturnOrder[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);

  // Load data
  useEffect(() => {
    loadCustomers();
    loadReturnOrders();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, customer_ref, address_line1, address_line2, city, state, country, pin_code')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadReturnOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('return_order_header')
        .select('id, rso_number, rso_date, customer_name, invoice_number, status, reason_for_credit, total_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      
      // Map database records to ReturnOrder interface
      const mappedData: ReturnOrder[] = (data || []).map(record => ({
        id: record.id,
        rso_number: record.rso_number || '',
        rso_date: record.rso_date || '',
        customer_name: record.customer_name || '',
        invoice_number: record.invoice_number || '',
        status: (record.status === 'Draft' || record.status === 'Confirmed') ? record.status : 'Draft',
        reason_for_credit: record.reason_for_credit || '',
        total_amount: record.total_amount || 0,
        created_at: record.created_at || ''
      }));
      
      setReturnOrders(mappedData);
    } catch (error) {
      console.error('Error loading return orders:', error);
    }
  };

  const loadInvoicesForCustomer = async (customerId: string) => {
    if (!customerId) return;
    
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, invoice_date, customer_id, customer_name, total_amount')
        .eq('customer_id', customerId)
        .eq('status', 'finalized')
        .gte('invoice_date', oneYearAgo.toISOString().split('T')[0])
        .order('invoice_date', { ascending: false });
      
      if (error) throw error;
      setInvoices(data || []);
      
      // Load recent invoices for reference
      setRecentInvoices(data?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const loadInvoiceItems = async (invoiceId: string) => {
    if (!invoiceId) return;
    
    try {
      const { data, error } = await supabase
        .from('sales_invoice_items')
        .select('id, product_id, item_description, item_code, hsn_sac_code, unit_of_measure, quantity_invoiced, unit_price, discount_percentage, discount_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, line_subtotal, tax_amount, line_total')
        .eq('sales_invoice_id', invoiceId);
      
      if (error) throw error;
      
      const processedItems: InvoiceLineItem[] = (data || []).map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.item_description || 'Unknown Product',
        product_sku: item.item_code || 'N/A',
        hsn_sac_code: item.hsn_sac_code,
        unit_of_measure: item.unit_of_measure,
        quantity_invoiced: item.quantity_invoiced,
        unit_price: item.unit_price,
        discount_percentage: item.discount_percentage,
        discount_amount: item.discount_amount,
        cgst_rate: item.cgst_rate,
        cgst_amount: item.cgst_amount,
        sgst_rate: item.sgst_rate,
        sgst_amount: item.sgst_amount,
        igst_rate: item.igst_rate,
        igst_amount: item.igst_amount,
        line_subtotal: item.line_subtotal,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
        return_qty: 0,
        pending_return_qty: item.quantity_invoiced
      }));
      
      setInvoiceItems(processedItems);
    } catch (error) {
      console.error('Error loading invoice items:', error);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer || null);
    setSelectedInvoice(null);
    setInvoiceItems([]);
    
    if (customer) {
      loadInvoicesForCustomer(customerId);
    }
  };

  const handleInvoiceSelect = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    setSelectedInvoice(invoice || null);
    
    if (invoice) {
      loadInvoiceItems(invoiceId);
    }
  };

  const handleReturnQtyChange = (itemIndex: number, returnQty: number) => {
    const updatedItems = [...invoiceItems];
    const item = updatedItems[itemIndex];
    
    // Validation: cannot exceed invoice quantity
    if (returnQty > item.quantity_invoiced) {
      toast({
        title: "Invalid Quantity",
        description: `Return quantity cannot exceed invoice quantity (${item.quantity_invoiced})`,
        variant: "destructive"
      });
      return;
    }
    
    item.return_qty = Math.max(0, returnQty);
    item.pending_return_qty = item.quantity_invoiced - item.return_qty;
    
    setInvoiceItems(updatedItems);
  };

  const calculateTotals = () => {
    return invoiceItems.reduce((totals, item) => {
      if (item.return_qty > 0) {
        const ratio = item.return_qty / item.quantity_invoiced;
        const lineSubtotal = item.line_subtotal * ratio;
        const taxAmount = item.tax_amount * ratio;
        const lineTotal = item.line_total * ratio;
        
        totals.subtotal += lineSubtotal;
        totals.tax += taxAmount;
        totals.total += lineTotal;
      }
      return totals;
    }, { subtotal: 0, tax: 0, total: 0 });
  };

  const validateForm = () => {
    if (!selectedCustomer) {
      toast({
        title: "Validation Error",
        description: "Please select a customer",
        variant: "destructive"
      });
      return false;
    }
    
    if (!selectedInvoice) {
      toast({
        title: "Validation Error", 
        description: "Please select an invoice",
        variant: "destructive"
      });
      return false;
    }
    
    if (!reasonForCredit) {
      toast({
        title: "Validation Error",
        description: "Please select a reason for credit",
        variant: "destructive"
      });
      return false;
    }
    
    const hasReturnItems = invoiceItems.some(item => item.return_qty > 0);
    if (!hasReturnItems) {
      toast({
        title: "Validation Error",
        description: "Please specify return quantities for at least one item",
        variant: "destructive"
      });
      return false;
    }
    
    if (!deliverySameAsCompany) {
      const { address_line1, city, country, pin_code } = deliveryAddress;
      if (!address_line1 || !city || !country || !pin_code) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required delivery address fields",
          variant: "destructive"
        });
        return false;
      }
    }
    
    return true;
  };

  const handleSaveReturn = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const returnLines = invoiceItems
        .filter(item => item.return_qty > 0)
        .map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          hsn_sac_code: item.hsn_sac_code,
          unit_of_measure: item.unit_of_measure,
          invoice_qty: item.quantity_invoiced,
          return_qty: item.return_qty,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage || 0,
          discount_amount: (item.discount_amount * item.return_qty) / item.quantity_invoiced,
          cgst_rate: item.cgst_rate || 0,
          cgst_amount: (item.cgst_amount || 0) * item.return_qty / item.quantity_invoiced,
          sgst_rate: item.sgst_rate || 0,
          sgst_amount: (item.sgst_amount || 0) * item.return_qty / item.quantity_invoiced,
          igst_rate: item.igst_rate || 0,
          igst_amount: (item.igst_amount || 0) * item.return_qty / item.quantity_invoiced,
          line_subtotal: item.line_subtotal * item.return_qty / item.quantity_invoiced,
          tax_amount: item.tax_amount * item.return_qty / item.quantity_invoiced,
          line_total: item.line_total * item.return_qty / item.quantity_invoiced
        }));

      const { data: companyData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data, error } = await supabase.rpc('create_return_order', {
        p_company_id: companyData?.company_id,
        p_customer_id: selectedCustomer!.id,
        p_invoice_id: selectedInvoice!.id,
        p_reason_for_credit: reasonForCredit,
        p_return_lines: JSON.stringify(returnLines),
        p_delivery_same_as_company: deliverySameAsCompany,
        p_delivery_address_line1: deliverySameAsCompany ? null : deliveryAddress.address_line1,
        p_delivery_address_line2: deliverySameAsCompany ? null : deliveryAddress.address_line2,
        p_delivery_city: deliverySameAsCompany ? null : deliveryAddress.city,
        p_delivery_country: deliverySameAsCompany ? null : deliveryAddress.country,
        p_delivery_pin_code: deliverySameAsCompany ? null : deliveryAddress.pin_code,
        p_notes: notes || null
      });

      if (error) throw error;

      const result = data as any;
      if (result.success) {
        toast({
          title: "Success",
          description: `Return order ${result.rso_number} created successfully`
        });
        
        // Create a return order object for display
        setCurrentRSO({
          id: result.return_order_id,
          rso_number: result.rso_number,
          rso_date: new Date().toISOString().split('T')[0],
          customer_name: selectedCustomer!.name,
          invoice_number: selectedInvoice!.invoice_number,
          status: 'Draft',
          reason_for_credit: reasonForCredit,
          total_amount: calculateTotals().total,
          created_at: new Date().toISOString()
        });
        
        loadReturnOrders();
      }
    } catch (error) {
      console.error('Error creating return order:', error);
      toast({
        title: "Error",
        description: "Failed to create return order",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!currentRSO) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('confirm_return_order', {
        p_return_order_id: currentRSO.id
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success",
          description: `Return order ${data.rso_number} confirmed and posted successfully`
        });
        
        setCurrentRSO({
          ...currentRSO,
          status: 'Confirmed'
        });
        
        loadReturnOrders();
      }
    } catch (error) {
      console.error('Error confirming return order:', error);
      toast({
        title: "Error",
        description: "Failed to confirm return order",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setSelectedInvoice(null);
    setInvoiceItems([]);
    setReasonForCredit('');
    setDeliverySameAsCompany(true);
    setDeliveryAddress({
      address_line1: '',
      address_line2: '',
      city: '',
      country: '',
      pin_code: ''
    });
    setNotes('');
    setCurrentRSO(null);
  };

  const totals = calculateTotals();

  // Sample data - replace with actual API calls
  const sampleReturnOrders: ReturnOrder[] = returnOrders.length > 0 ? returnOrders : [
    {
      id: '1',
      rso_number: 'ABCRSO1001',
      rso_date: '2024-01-15',
      customer_name: 'ABC Corp',
      invoice_number: 'ABCINV1001',
      status: 'Draft',
      reason_for_credit: 'Return',
      total_amount: 1500.00,
      created_at: '2024-01-15T10:00:00Z'
    }
  ];

  const sampleCreditNotes: CreditNote[] = [
    {
      id: '1',
      credit_number: 'CN-001',
      customer_name: 'ABC Corp',
      issue_date: '2024-01-16',
      status: 'issued',
      amount: 1500.00,
      reason: 'Product return - defective items',
      reference_type: 'return'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'Confirmed': return 'bg-green-500 hover:bg-green-600';
      case 'draft': return 'bg-gray-500 hover:bg-gray-600';
      case 'issued': return 'bg-blue-500 hover:bg-blue-600';
      case 'applied': return 'bg-green-500 hover:bg-green-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const handleCreateCreditNote = () => {
    toast({
      title: "Credit note created",
      description: "Credit note has been created successfully."
    });
    setIsCreditNoteDialogOpen(false);
  };

  return (
    <PermissionWrapper section="returns">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="returns" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Return Sales Orders
            </TabsTrigger>
            <TabsTrigger value="credit-notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Credit Notes
            </TabsTrigger>
          </TabsList>

          {/* Return Sales Orders Tab */}
          <TabsContent value="returns" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <RotateCcw className="h-6 w-6" />
                  Return Sales Orders
                </h2>
                <p className="text-muted-foreground">
                  Manage product returns from customers
                </p>
              </div>
              <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
                <DialogTrigger asChild>
                  <PermissionButton section="returns" className="btn-gradient">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Return
                  </PermissionButton>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Return Order</DialogTitle>
                    <DialogDescription>
                      Create a new return order for customer products
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sales-order">Sales Order Number</Label>
                      <PermissionInput 
                        section="returns"
                        id="sales-order" 
                        placeholder="Enter sales order number" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer">Customer</Label>
                      <PermissionInput 
                        section="returns"
                        id="customer" 
                        placeholder="Customer name will auto-populate" 
                        disabled 
                      />
                    </div>
                    <div>
                      <Label htmlFor="reason">Return Reason</Label>
                      <PermissionSelect section="returns">
                        <SelectTrigger>
                          <SelectValue placeholder="Select return reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="defective">Defective Product</SelectItem>
                          <SelectItem value="wrong-item">Wrong Item Shipped</SelectItem>
                          <SelectItem value="damaged">Damaged in Transit</SelectItem>
                          <SelectItem value="not-as-described">Not as Described</SelectItem>
                          <SelectItem value="customer-request">Customer Request</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </PermissionSelect>
                    </div>
                    <div>
                      <Label htmlFor="notes">Additional Notes</Label>
                      <PermissionTextarea 
                        section="returns"
                        id="notes" 
                        placeholder="Enter any additional details..." 
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsReturnDialogOpen(false)}>
                      Cancel
                    </Button>
                    <PermissionButton section="returns" onClick={handleCreateReturn}>
                      Create Return
                    </PermissionButton>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Return Orders</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <PermissionInput 
                        section="returns"
                        placeholder="Search returns..." 
                        className="pl-10 w-64" 
                      />
                    </div>
                    <PermissionButton section="returns" variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </PermissionButton>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RSO #</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleReturnOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="flex flex-col items-center gap-4">
                            <RotateCcw className="h-12 w-12 text-muted-foreground" />
                            <div>
                              <p className="text-lg font-semibold">No return orders yet</p>
                              <p className="text-muted-foreground">Return orders will appear here</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sampleReturnOrders.map((returnOrder) => (
                        <TableRow key={returnOrder.id}>
                          <TableCell className="font-medium">{returnOrder.rso_number}</TableCell>
                          <TableCell>{returnOrder.invoice_number}</TableCell>
                          <TableCell>{returnOrder.customer_name}</TableCell>
                          <TableCell>{returnOrder.rso_date}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(returnOrder.status)}>
                              {returnOrder.status}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{returnOrder.total_amount.toFixed(2)}</TableCell>
                          <TableCell>{returnOrder.reason_for_credit}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <PermissionButton section="returns" variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </PermissionButton>
                              <PermissionButton section="returns" variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </PermissionButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credit Notes Tab */}
          <TabsContent value="credit-notes" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Credit Notes
                </h2>
                <p className="text-muted-foreground">
                  Create and manage credit notes for customers
                </p>
              </div>
              <Dialog open={isCreditNoteDialogOpen} onOpenChange={setIsCreditNoteDialogOpen}>
                <DialogTrigger asChild>
                  <PermissionButton section="returns" className="btn-gradient">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Credit Note
                  </PermissionButton>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Credit Note</DialogTitle>
                    <DialogDescription>
                      Create a new credit note for a customer
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="customer-select">Customer</Label>
                      <PermissionSelect section="returns">
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="abc-corp">ABC Corp</SelectItem>
                          <SelectItem value="xyz-ltd">XYZ Ltd</SelectItem>
                        </SelectContent>
                      </PermissionSelect>
                    </div>
                    <div>
                      <Label htmlFor="reference-type">Reference Type</Label>
                      <PermissionSelect section="returns">
                        <SelectTrigger>
                          <SelectValue placeholder="Select reference type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="return">From Return Order</SelectItem>
                          <SelectItem value="manual">Manual Credit</SelectItem>
                        </SelectContent>
                      </PermissionSelect>
                    </div>
                    <div>
                      <Label htmlFor="amount">Credit Amount</Label>
                      <PermissionInput 
                        section="returns"
                        id="amount" 
                        type="number" 
                        placeholder="0.00" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="credit-reason">Reason</Label>
                      <PermissionTextarea 
                        section="returns"
                        id="credit-reason" 
                        placeholder="Enter reason for credit note..." 
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreditNoteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <PermissionButton section="returns" onClick={handleCreateCreditNote}>
                      Create Credit Note
                    </PermissionButton>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Credit Notes</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <PermissionInput 
                        section="returns"
                        placeholder="Search credit notes..." 
                        className="pl-10 w-64" 
                      />
                    </div>
                    <PermissionButton section="returns" variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </PermissionButton>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Credit Note #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleCreditNotes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center gap-4">
                            <FileText className="h-12 w-12 text-muted-foreground" />
                            <div>
                              <p className="text-lg font-semibold">No credit notes yet</p>
                              <p className="text-muted-foreground">Credit notes will appear here</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sampleCreditNotes.map((creditNote) => (
                        <TableRow key={creditNote.id}>
                          <TableCell className="font-medium">{creditNote.credit_number}</TableCell>
                          <TableCell>{creditNote.customer_name}</TableCell>
                          <TableCell>{creditNote.issue_date}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(creditNote.status)}>
                              {creditNote.status.charAt(0).toUpperCase() + creditNote.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{creditNote.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {creditNote.reference_type === 'return' ? 'Return' : 'Manual'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <PermissionButton section="returns" variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </PermissionButton>
                              <PermissionButton section="returns" variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </PermissionButton>
                              <PermissionButton section="returns" variant="outline" size="sm">
                                <Download className="h-4 w-4" />
                              </PermissionButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionWrapper>
  );
}