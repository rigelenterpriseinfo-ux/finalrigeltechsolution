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
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
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
  Trash2
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

interface SalesInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
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
  discount_percentage: number;
  discount_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  line_subtotal: number;
  tax_amount: number;
  line_total: number;
  return_qty: number;
  pending_return_qty: number;
}

export function ReturnsModule() {
  const { toast } = useToast();
  const { company } = useCompany();
  const [activeTab, setActiveTab] = useState('returns');
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [isCreditNoteDialogOpen, setIsCreditNoteDialogOpen] = useState(false);
  const [isCreateReturnFormOpen, setIsCreateReturnFormOpen] = useState(false);

  // Form state for creating return orders
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [reasonForCredit, setReasonForCredit] = useState<string>('');
  const [deliverySameAsCompany, setDeliverySameAsCompany] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    country: '',
    pin_code: ''
  });
  const [notes, setNotes] = useState('');
  const [invoiceLineItems, setInvoiceLineItems] = useState<InvoiceLineItem[]>([]);
  const [returnOrderDate, setReturnOrderDate] = useState(new Date().toISOString().split('T')[0]);

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [returnOrders, setReturnOrders] = useState<ReturnOrder[]>([]);
  const [recentReturnOrders, setRecentReturnOrders] = useState<ReturnOrder[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    if (company?.id) {
      loadCustomers();
      loadReturnOrders();
    }
  }, [company?.id]);

  const loadCustomers = async () => {
    if (!company?.id) return;
    
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, customer_ref, address_line1, address_line2, city, state, country, pin_code')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      toast({ title: "Error", description: "Failed to load customers", variant: "destructive" });
      return;
    }
    
    setCustomers(data || []);
  };

  const loadInvoicesForCustomer = async (customerId: string) => {
    if (!company?.id) return;
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const { data, error } = await supabase
      .from('sales_invoices')
      .select('id, invoice_number, invoice_date, customer_name, total_amount')
      .eq('company_id', company.id)
      .eq('customer_id', customerId)
      .eq('status', 'finalized')
      .gte('invoice_date', oneYearAgo.toISOString().split('T')[0])
      .order('invoice_date', { ascending: false });
    
    if (error) {
      toast({ title: "Error", description: "Failed to load invoices", variant: "destructive" });
      return;
    }
    
    setInvoices(data || []);
    
    // Load recent invoices for side panel
    const recentInvoicesData = data?.slice(0, 5) || [];
    setRecentInvoices(recentInvoicesData);
  };

  const loadInvoiceLineItems = async (invoiceId: string) => {
    const { data, error } = await supabase
      .from('sales_invoice_items')
      .select('*')
      .eq('sales_invoice_id', invoiceId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to load invoice items", variant: "destructive" });
      return;
    }
    
    const lineItems: InvoiceLineItem[] = (data || []).map(item => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.item_description,
      product_sku: item.item_code,
      hsn_sac_code: item.hsn_sac_code,
      unit_of_measure: item.unit_of_measure,
      quantity_invoiced: item.quantity_invoiced,
      unit_price: item.unit_price,
      discount_percentage: item.discount_percentage || 0,
      discount_amount: item.discount_amount,
      cgst_rate: item.cgst_rate || 0,
      cgst_amount: item.cgst_amount || 0,
      sgst_rate: item.sgst_rate || 0,
      sgst_amount: item.sgst_amount || 0,
      igst_rate: item.igst_rate || 0,
      igst_amount: item.igst_amount || 0,
      line_subtotal: item.line_subtotal,
      tax_amount: item.tax_amount,
      line_total: item.line_total,
      return_qty: 0,
      pending_return_qty: item.quantity_invoiced
    }));
    
    setInvoiceLineItems(lineItems);
  };

  const loadReturnOrders = async () => {
    if (!company?.id) return;
    
    const { data, error } = await supabase
      .from('return_order_header')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: "Error", description: "Failed to load return orders", variant: "destructive" });
      return;
    }
    
    const returnOrdersData: ReturnOrder[] = (data || []).map(order => ({
      id: order.id,
      rso_number: order.rso_number || 'Pending',
      rso_date: order.rso_date,
      customer_name: order.customer_name,
      invoice_number: order.invoice_number,
      status: order.status as 'Draft' | 'Confirmed',
      reason_for_credit: order.reason_for_credit,
      total_amount: order.total_amount
    }));
    
    setReturnOrders(returnOrdersData);
    setRecentReturnOrders(returnOrdersData.slice(0, 5));
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      loadInvoicesForCustomer(customerId);
      setSelectedInvoice(null);
      setInvoiceLineItems([]);
    }
  };

  const handleInvoiceSelect = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      loadInvoiceLineItems(invoiceId);
    }
  };

  const updateReturnQty = (lineItemId: string, returnQty: number) => {
    setInvoiceLineItems(prev => prev.map(item => {
      if (item.id === lineItemId) {
        const validReturnQty = Math.max(0, Math.min(returnQty, item.quantity_invoiced));
        return {
          ...item,
          return_qty: validReturnQty,
          pending_return_qty: item.quantity_invoiced - validReturnQty
        };
      }
      return item;
    }));
  };

  const calculateTotals = () => {
    const returnItems = invoiceLineItems.filter(item => item.return_qty > 0);
    const subtotal = returnItems.reduce((sum, item) => sum + (item.line_subtotal * item.return_qty / item.quantity_invoiced), 0);
    const taxAmount = returnItems.reduce((sum, item) => sum + (item.tax_amount * item.return_qty / item.quantity_invoiced), 0);
    const total = returnItems.reduce((sum, item) => sum + (item.line_total * item.return_qty / item.quantity_invoiced), 0);
    
    return { subtotal, taxAmount, total };
  };

  const handleSaveReturn = async () => {
    if (!selectedCustomer || !selectedInvoice || !reasonForCredit || !company?.id) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const returnItems = invoiceLineItems.filter(item => item.return_qty > 0);
    if (returnItems.length === 0) {
      toast({ title: "Error", description: "Please select at least one item to return", variant: "destructive" });
      return;
    }

    if (!deliverySameAsCompany && (!deliveryAddress.address_line1 || !deliveryAddress.city)) {
      toast({ title: "Error", description: "Please provide complete delivery address", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const returnLinesData = returnItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        hsn_sac_code: item.hsn_sac_code,
        unit_of_measure: item.unit_of_measure,
        invoice_qty: item.quantity_invoiced,
        return_qty: item.return_qty,
        unit_price: item.unit_price,
        discount_percentage: item.discount_percentage,
        discount_amount: item.discount_amount * item.return_qty / item.quantity_invoiced,
        cgst_rate: item.cgst_rate,
        cgst_amount: item.cgst_amount * item.return_qty / item.quantity_invoiced,
        sgst_rate: item.sgst_rate,
        sgst_amount: item.sgst_amount * item.return_qty / item.quantity_invoiced,
        igst_rate: item.igst_rate,
        igst_amount: item.igst_amount * item.return_qty / item.quantity_invoiced,
        line_subtotal: item.line_subtotal * item.return_qty / item.quantity_invoiced,
        tax_amount: item.tax_amount * item.return_qty / item.quantity_invoiced,
        line_total: item.line_total * item.return_qty / item.quantity_invoiced
      }));

      const { data, error } = await supabase.rpc('create_return_order', {
        p_company_id: company.id,
        p_customer_id: selectedCustomer.id,
        p_invoice_id: selectedInvoice.id,
        p_reason_for_credit: reasonForCredit,
        p_return_lines: returnLinesData,
        p_delivery_same_as_company: deliverySameAsCompany,
        p_delivery_address_line1: deliverySameAsCompany ? null : deliveryAddress.address_line1,
        p_delivery_address_line2: deliverySameAsCompany ? null : deliveryAddress.address_line2,
        p_delivery_city: deliverySameAsCompany ? null : deliveryAddress.city,
        p_delivery_country: deliverySameAsCompany ? null : deliveryAddress.country,
        p_delivery_pin_code: deliverySameAsCompany ? null : deliveryAddress.pin_code,
        p_notes: notes || null
      });

      if (error) throw error;

      const result = data as { success: boolean; rso_number: string; return_order_id: string };
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Return order ${result.rso_number} created successfully`
        });
        
        // Reset form
        setSelectedCustomer(null);
        setSelectedInvoice(null);
        setReasonForCredit('');
        setDeliverySameAsCompany(true);
        setDeliveryAddress({ address_line1: '', address_line2: '', city: '', country: '', pin_code: '' });
        setNotes('');
        setInvoiceLineItems([]);
        setInvoices([]);
        setIsCreateReturnFormOpen(false);
        
        // Reload return orders
        loadReturnOrders();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create return order",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReturn = async (returnOrderId: string) => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('confirm_return_order', {
        p_return_order_id: returnOrderId
      });

      if (error) throw error;

      const result = data as { success: boolean; rso_number: string; items_processed: number };
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Return order ${result.rso_number} confirmed successfully. ${result.items_processed} items processed.`
        });
        
        loadReturnOrders();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm return order",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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

  const { subtotal, taxAmount, total } = calculateTotals();

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
              <PermissionButton 
                section="returns" 
                className="btn-gradient"
                onClick={() => setIsCreateReturnFormOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Return
              </PermissionButton>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-3">
                {isCreateReturnFormOpen ? (
                  /* Create Return Form */
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <RotateCcw className="h-5 w-5" />
                          Create Return Order
                        </CardTitle>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsCreateReturnFormOpen(false)}
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back to List
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Header Section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="rso-date">Return Sales Order Date</Label>
                          <Input
                            id="rso-date"
                            type="date"
                            value={returnOrderDate}
                            onChange={(e) => setReturnOrderDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="customer">Customer Name</Label>
                          <Select onValueChange={handleCustomerSelect}>
                            <SelectTrigger>
                              <SelectValue placeholder="Search and select customer" />
                            </SelectTrigger>
                            <SelectContent>
                              {customers.map(customer => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.name} ({customer.customer_ref})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {selectedCustomer && (
                        <div>
                          <Label>Customer Registered Address</Label>
                          <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm">
                            <p>{selectedCustomer.address_line1}</p>
                            {selectedCustomer.address_line2 && <p>{selectedCustomer.address_line2}</p>}
                            <p>{selectedCustomer.city}, {selectedCustomer.state} {selectedCustomer.pin_code}</p>
                            <p>{selectedCustomer.country}</p>
                          </div>
                        </div>
                      )}

                      {selectedCustomer && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="invoice">Invoice No</Label>
                            <Select onValueChange={handleInvoiceSelect}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select invoice (last 365 days)" />
                              </SelectTrigger>
                              <SelectContent>
                                {invoices.map(invoice => (
                                  <SelectItem key={invoice.id} value={invoice.id}>
                                    {invoice.invoice_number} - ₹{invoice.total_amount.toFixed(2)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedInvoice && (
                            <div>
                              <Label>Invoice Date</Label>
                              <Input
                                value={selectedInvoice.invoice_date}
                                disabled
                                className="bg-gray-50"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <Label>Reason for Credit</Label>
                        <RadioGroup value={reasonForCredit} onValueChange={setReasonForCredit} className="mt-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Return" id="return" />
                            <Label htmlFor="return">Return</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Price Correction" id="price-correction" />
                            <Label htmlFor="price-correction">Price Correction</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Discount" id="discount" />
                            <Label htmlFor="discount">Discount</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Others" id="others" />
                            <Label htmlFor="others">Others</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Delivery Address Section */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="same-address"
                            checked={deliverySameAsCompany}
                            onCheckedChange={(checked) => setDeliverySameAsCompany(checked as boolean)}
                          />
                          <Label htmlFor="same-address">Same as company registered address</Label>
                        </div>

                        {!deliverySameAsCompany && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="address1">Address Line 1</Label>
                              <Input
                                id="address1"
                                value={deliveryAddress.address_line1}
                                onChange={(e) => setDeliveryAddress(prev => ({ ...prev, address_line1: e.target.value }))}
                                placeholder="Enter address line 1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="address2">Address Line 2</Label>
                              <Input
                                id="address2"
                                value={deliveryAddress.address_line2}
                                onChange={(e) => setDeliveryAddress(prev => ({ ...prev, address_line2: e.target.value }))}
                                placeholder="Enter address line 2 (optional)"
                              />
                            </div>
                            <div>
                              <Label htmlFor="city">City</Label>
                              <Input
                                id="city"
                                value={deliveryAddress.city}
                                onChange={(e) => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))}
                                placeholder="City"
                              />
                            </div>
                            <div>
                              <Label htmlFor="country">Country</Label>
                              <Input
                                id="country"
                                value={deliveryAddress.country}
                                onChange={(e) => setDeliveryAddress(prev => ({ ...prev, country: e.target.value }))}
                                placeholder="Country"
                              />
                            </div>
                            <div>
                              <Label htmlFor="pincode">Pin Code</Label>
                              <Input
                                id="pincode"
                                value={deliveryAddress.pin_code}
                                onChange={(e) => setDeliveryAddress(prev => ({ ...prev, pin_code: e.target.value }))}
                                placeholder="Pin Code"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Line Section */}
                      {invoiceLineItems.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Invoice Line Items</h3>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Product</TableHead>
                                  <TableHead>SKU</TableHead>
                                  <TableHead>HSN/SAC</TableHead>
                                  <TableHead>UOM</TableHead>
                                  <TableHead>Invoice Qty</TableHead>
                                  <TableHead>Return Qty</TableHead>
                                  <TableHead>Pending Qty</TableHead>
                                  <TableHead>Unit Price</TableHead>
                                  <TableHead>CGST %</TableHead>
                                  <TableHead>SGST %</TableHead>
                                  <TableHead>IGST %</TableHead>
                                  <TableHead>Line Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {invoiceLineItems.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>{item.product_name}</TableCell>
                                    <TableCell>{item.product_sku}</TableCell>
                                    <TableCell>{item.hsn_sac_code}</TableCell>
                                    <TableCell>{item.unit_of_measure}</TableCell>
                                    <TableCell>{item.quantity_invoiced}</TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        max={item.quantity_invoiced}
                                        value={item.return_qty}
                                        onChange={(e) => updateReturnQty(item.id, parseInt(e.target.value) || 0)}
                                        className="w-20"
                                      />
                                    </TableCell>
                                    <TableCell>{item.pending_return_qty}</TableCell>
                                    <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                                    <TableCell>{item.cgst_rate}%</TableCell>
                                    <TableCell>{item.sgst_rate}%</TableCell>
                                    <TableCell>{item.igst_rate}%</TableCell>
                                    <TableCell>₹{(item.line_total * item.return_qty / item.quantity_invoiced).toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Totals */}
                          <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                              <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>₹{subtotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Tax Amount:</span>
                                <span>₹{taxAmount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold">
                                <span>Total:</span>
                                <span>₹{total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Enter any additional notes..."
                          rows={3}
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-4">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateReturnFormOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveReturn}
                          disabled={loading}
                          className="btn-gradient"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {loading ? 'Saving...' : 'Save (Draft)'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  /* Return Orders List */
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
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {returnOrders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8">
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
                            returnOrders.map((returnOrder) => (
                              <TableRow key={returnOrder.id}>
                                <TableCell className="font-medium">{returnOrder.rso_number}</TableCell>
                                <TableCell>{returnOrder.rso_date}</TableCell>
                                <TableCell>{returnOrder.customer_name}</TableCell>
                                <TableCell>{returnOrder.invoice_number}</TableCell>
                                <TableCell>
                                  <Badge className={getStatusColor(returnOrder.status)}>
                                    {returnOrder.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>₹{returnOrder.total_amount.toFixed(2)}</TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <PermissionButton section="returns" variant="outline" size="sm">
                                      <Eye className="h-4 w-4" />
                                    </PermissionButton>
                                    {returnOrder.status === 'Draft' && (
                                      <>
                                        <PermissionButton section="returns" variant="outline" size="sm">
                                          <Edit className="h-4 w-4" />
                                        </PermissionButton>
                                        <PermissionButton 
                                          section="returns" 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => handleConfirmReturn(returnOrder.id)}
                                          disabled={loading}
                                        >
                                          <Check className="h-4 w-4" />
                                        </PermissionButton>
                                        <PermissionButton section="returns" variant="outline" size="sm">
                                          <Trash2 className="h-4 w-4" />
                                        </PermissionButton>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Side Panel */}
              <div className="lg:col-span-1 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Last 5 Return Orders</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {recentReturnOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent returns</p>
                    ) : (
                      <div className="space-y-2">
                        {recentReturnOrders.map(order => (
                          <div key={order.id} className="text-xs border-b pb-2">
                            <div className="font-medium">{order.rso_number}</div>
                            <div className="text-muted-foreground">{order.customer_name}</div>
                            <div className="text-muted-foreground">{order.rso_date}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selectedCustomer && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Last 5 Invoices for {selectedCustomer.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      {recentInvoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No recent invoices</p>
                      ) : (
                        <div className="space-y-2">
                          {recentInvoices.map(invoice => (
                            <div key={invoice.id} className="text-xs border-b pb-2">
                              <div className="font-medium">{invoice.invoice_number}</div>
                              <div className="text-muted-foreground">{invoice.invoice_date}</div>
                              <div className="text-muted-foreground">₹{invoice.total_amount.toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
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
                          {customers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
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
                    <PermissionButton section="returns" onClick={() => {
                      toast({
                        title: "Credit note created",
                        description: "Credit note has been created successfully."
                      });
                      setIsCreditNoteDialogOpen(false);
                    }}>
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