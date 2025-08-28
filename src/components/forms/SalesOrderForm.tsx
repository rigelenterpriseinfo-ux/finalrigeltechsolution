
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  name: string;
  customer_ref: string;
  email: string;
  phone: string;
  gstin: string;
  payment_terms: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  country: string;
  pin_code: string;
  contact_person: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  hsn_code: string;
  unit_price: number;
  unit: string;
}

interface LineItem {
  id?: string;
  product_id: string;
  sku: string;
  item_description: string;
  hsn_sac_code: string;
  quantity: number;
  unit_of_measure: string;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_price: number;
}

interface SalesOrderFormProps {
  salesOrder?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export const SalesOrderForm: React.FC<SalesOrderFormProps> = ({
  salesOrder,
  onSubmit,
  onCancel
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sameAsRegistered, setSameAsRegistered] = useState(false);
  
  const [formData, setFormData] = useState({
    order_date: new Date().toISOString().split('T')[0],
    customer_id: '',
    customer_reference_no: '',
    customer_po_number: '',
    status: 'draft',
    delivery_address_line1: '',
    delivery_address_line2: '',
    delivery_city: '',
    delivery_state: '',
    delivery_pin_code: '',
    delivery_country: '',
    expected_delivery_date: '',
    mode_of_transport: 'courier',
    shipping_instructions: '',
    currency: 'INR',
    payment_terms: '',
    notes: ''
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([{
    product_id: '',
    sku: '',
    item_description: '',
    hsn_sac_code: '',
    quantity: 1,
    unit_of_measure: 'pcs',
    unit_price: 0,
    discount_percentage: 0,
    discount_amount: 0,
    cgst_rate: 9,
    sgst_rate: 9,
    igst_rate: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 0,
    total_price: 0
  }]);

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    if (salesOrder) {
      loadSalesOrder();
    }
  }, [salesOrder]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive"
      });
    } else {
      setCustomers(data || []);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive"
      });
    } else {
      setProducts(data || []);
    }
  };

  const loadSalesOrder = async () => {
    if (!salesOrder) return;
    
    // Load sales order items
    const { data: items, error } = await supabase
      .from('sales_order_items')
      .select('*')
      .eq('sales_order_id', salesOrder.id);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load sales order items",
        variant: "destructive"
      });
      return;
    }

    // Set form data
    setFormData({
      order_date: salesOrder.order_date,
      customer_id: salesOrder.customer_id,
      customer_reference_no: salesOrder.customer_reference_no || '',
      customer_po_number: salesOrder.customer_po_number || '',
      status: salesOrder.status,
      delivery_address_line1: salesOrder.delivery_address_line1 || '',
      delivery_address_line2: salesOrder.delivery_address_line2 || '',
      delivery_city: salesOrder.delivery_city || '',
      delivery_state: salesOrder.delivery_state || '',
      delivery_pin_code: salesOrder.delivery_pin_code || '',
      delivery_country: salesOrder.delivery_country || '',
      expected_delivery_date: salesOrder.expected_delivery_date || '',
      mode_of_transport: salesOrder.mode_of_transport || 'courier',
      shipping_instructions: salesOrder.shipping_instructions || '',
      currency: salesOrder.currency || 'INR',
      payment_terms: salesOrder.payment_terms || '',
      notes: salesOrder.notes || ''
    });

    // Find and set selected customer
    const customer = customers.find(c => c.id === salesOrder.customer_id);
    if (customer) {
      setSelectedCustomer(customer);
    }

    // Set line items
    if (items && items.length > 0) {
      setLineItems(items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        sku: products.find(p => p.id === item.product_id)?.sku || '',
        item_description: item.item_description,
        hsn_sac_code: item.hsn_sac_code || '',
        quantity: item.quantity,
        unit_of_measure: item.unit_of_measure,
        unit_price: item.unit_price,
        discount_percentage: item.discount_percentage || 0,
        discount_amount: item.discount_amount,
        cgst_rate: item.cgst_rate || 0,
        sgst_rate: item.sgst_rate || 0,
        igst_rate: item.igst_rate || 0,
        cgst_amount: item.cgst_amount || 0,
        sgst_amount: item.sgst_amount || 0,
        igst_amount: item.igst_amount || 0,
        total_price: item.total_price
      })));
    }
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer || null);
    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      payment_terms: customer?.payment_terms || ''
    }));

    // Auto-fill delivery address if same as registered
    if (sameAsRegistered && customer) {
      setFormData(prev => ({
        ...prev,
        delivery_address_line1: customer.address_line1 || '',
        delivery_address_line2: customer.address_line2 || '',
        delivery_city: customer.city || '',
        delivery_state: customer.state || '',
        delivery_pin_code: customer.pin_code || '',
        delivery_country: customer.country || ''
      }));
    }
  };

  const handleSameAsRegisteredChange = (checked: boolean) => {
    setSameAsRegistered(checked);
    if (checked && selectedCustomer) {
      setFormData(prev => ({
        ...prev,
        delivery_address_line1: selectedCustomer.address_line1 || '',
        delivery_address_line2: selectedCustomer.address_line2 || '',
        delivery_city: selectedCustomer.city || '',
        delivery_state: selectedCustomer.state || '',
        delivery_pin_code: selectedCustomer.pin_code || '',
        delivery_country: selectedCustomer.country || ''
      }));
    } else if (!checked) {
      // Clear delivery address when unchecked
      setFormData(prev => ({
        ...prev,
        delivery_address_line1: '',
        delivery_address_line2: '',
        delivery_city: '',
        delivery_state: '',
        delivery_pin_code: '',
        delivery_country: ''
      }));
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const updatedItems = [...lineItems];
      updatedItems[index] = {
        ...updatedItems[index],
        product_id: productId,
        sku: product.sku,
        item_description: product.name,
        hsn_sac_code: product.hsn_code || '',
        unit_price: product.unit_price,
        unit_of_measure: product.unit || 'pcs'
      };
      setLineItems(updatedItems);
      calculateLineTotal(index, updatedItems);
    }
  };

  const calculateLineTotal = (index: number, items: LineItem[] = lineItems) => {
    const item = items[index];
    const baseAmount = item.quantity * item.unit_price;
    const discountAmount = item.discount_percentage > 0 
      ? (baseAmount * item.discount_percentage) / 100 
      : item.discount_amount;
    
    const taxableAmount = baseAmount - discountAmount;
    
    const cgstAmount = (taxableAmount * item.cgst_rate) / 100;
    const sgstAmount = (taxableAmount * item.sgst_rate) / 100;
    const igstAmount = (taxableAmount * item.igst_rate) / 100;
    
    const totalPrice = taxableAmount + cgstAmount + sgstAmount + igstAmount;

    const updatedItems = [...items];
    updatedItems[index] = {
      ...item,
      discount_amount: discountAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_price: totalPrice
    };
    
    setLineItems(updatedItems);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setLineItems(updatedItems);
    
    // Recalculate totals for quantity, unit_price, discount changes
    if (['quantity', 'unit_price', 'discount_percentage', 'discount_amount', 'cgst_rate', 'sgst_rate', 'igst_rate'].includes(field)) {
      calculateLineTotal(index, updatedItems);
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      product_id: '',
      sku: '',
      item_description: '',
      hsn_sac_code: '',
      quantity: 1,
      unit_of_measure: 'pcs',
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      cgst_rate: 9,
      sgst_rate: 9,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_price: 0
    }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => 
      sum + (item.quantity * item.unit_price - item.discount_amount), 0);
    const totalDiscount = lineItems.reduce((sum, item) => sum + item.discount_amount, 0);
    const totalTax = lineItems.reduce((sum, item) => 
      sum + item.cgst_amount + item.sgst_amount + item.igst_amount, 0);
    const grandTotal = lineItems.reduce((sum, item) => sum + item.total_price, 0);

    return { subtotal, totalDiscount, totalTax, grandTotal };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { subtotal, totalDiscount, totalTax, grandTotal } = calculateTotals();
      
      const salesOrderData = {
        ...formData,
        subtotal_amount: subtotal,
        discount_amount: totalDiscount,
        tax_amount: totalTax,
        total_amount: grandTotal,
        same_as_registered_address: sameAsRegistered
      };

      await onSubmit({ orderData: salesOrderData, lineItems });
    } catch (error) {
      console.error('Error submitting sales order:', error);
      toast({
        title: "Error",
        description: "Failed to save sales order",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Order Identification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Order Identification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {salesOrder && (
              <div>
                <Label>Sales Order ID</Label>
                <div className="mt-1">
                  <Badge variant="secondary" className="text-sm">
                    {salesOrder.order_number}
                  </Badge>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="order_date">Order Date *</Label>
              <Input
                id="order_date"
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({...formData, order_date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="status">Order Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_reference_no">Customer Reference No.</Label>
              <Input
                id="customer_reference_no"
                value={formData.customer_reference_no}
                onChange={(e) => setFormData({...formData, customer_reference_no: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="customer_po_number">Customer PO No.</Label>
              <Input
                id="customer_po_number"
                value={formData.customer_po_number}
                onChange={(e) => setFormData({...formData, customer_po_number: e.target.value})}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Customer Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="customer_id">Select Customer *</Label>
            <Select value={formData.customer_id} onValueChange={handleCustomerChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} ({customer.customer_ref})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCustomer && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-sm font-medium">Contact Person</Label>
                <p className="text-sm text-muted-foreground">{selectedCustomer.contact_person || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <p className="text-sm text-muted-foreground">{selectedCustomer.email || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Phone</Label>
                <p className="text-sm text-muted-foreground">{selectedCustomer.phone || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">GSTIN</Label>
                <p className="text-sm text-muted-foreground">{selectedCustomer.gstin || 'N/A'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Line Items */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold">Order Line Items</CardTitle>
            <Button type="button" onClick={addLineItem} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Item {index + 1}</h4>
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Product (SKU) *</Label>
                    <Select 
                      value={item.product_id} 
                      onValueChange={(value) => handleProductChange(index, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.sku} - {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Item Description</Label>
                    <Input
                      value={item.item_description}
                      onChange={(e) => updateLineItem(index, 'item_description', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>HSN/SAC Code</Label>
                    <Input
                      value={item.hsn_sac_code}
                      onChange={(e) => updateLineItem(index, 'hsn_sac_code', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>UOM</Label>
                    <Input
                      value={item.unit_of_measure}
                      onChange={(e) => updateLineItem(index, 'unit_of_measure', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div>
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div>
                    <Label>Unit Price *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <Label>Discount %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={item.discount_percentage}
                      onChange={(e) => updateLineItem(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <Label>CGST %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.cgst_rate}
                      onChange={(e) => updateLineItem(index, 'cgst_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <Label>SGST %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.sgst_rate}
                      onChange={(e) => updateLineItem(index, 'sgst_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <Label>IGST %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.igst_rate}
                      onChange={(e) => updateLineItem(index, 'igst_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="text-right">
                    <Label className="text-sm font-medium">Line Total</Label>
                    <p className="text-lg font-semibold">₹{item.total_price.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-4" />
          
          {/* Order Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-right">
            <div>
              <Label className="text-sm">Subtotal</Label>
              <p className="font-semibold">₹{totals.subtotal.toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-sm">Discount</Label>
              <p className="font-semibold text-red-600">-₹{totals.totalDiscount.toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-sm">Tax</Label>
              <p className="font-semibold">₹{totals.totalTax.toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-sm">Grand Total</Label>
              <p className="text-lg font-bold text-green-600">₹{totals.grandTotal.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping & Delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Shipping & Delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={sameAsRegistered}
              onCheckedChange={handleSameAsRegisteredChange}
            />
            <Label>Same as registered address</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="delivery_address_line1">Delivery Address Line 1</Label>
              <Input
                id="delivery_address_line1"
                value={formData.delivery_address_line1}
                onChange={(e) => setFormData({...formData, delivery_address_line1: e.target.value})}
                disabled={sameAsRegistered}
              />
            </div>
            <div>
              <Label htmlFor="delivery_address_line2">Delivery Address Line 2</Label>
              <Input
                id="delivery_address_line2"
                value={formData.delivery_address_line2}
                onChange={(e) => setFormData({...formData, delivery_address_line2: e.target.value})}
                disabled={sameAsRegistered}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="delivery_city">City</Label>
              <Input
                id="delivery_city"
                value={formData.delivery_city}
                onChange={(e) => setFormData({...formData, delivery_city: e.target.value})}
                disabled={sameAsRegistered}
              />
            </div>
            <div>
              <Label htmlFor="delivery_state">State</Label>
              <Input
                id="delivery_state"
                value={formData.delivery_state}
                onChange={(e) => setFormData({...formData, delivery_state: e.target.value})}
                disabled={sameAsRegistered}
              />
            </div>
            <div>
              <Label htmlFor="delivery_pin_code">Pin Code</Label>
              <Input
                id="delivery_pin_code"
                value={formData.delivery_pin_code}
                onChange={(e) => setFormData({...formData, delivery_pin_code: e.target.value})}
                disabled={sameAsRegistered}
              />
            </div>
            <div>
              <Label htmlFor="delivery_country">Country</Label>
              <Input
                id="delivery_country"
                value={formData.delivery_country}
                onChange={(e) => setFormData({...formData, delivery_country: e.target.value})}
                disabled={sameAsRegistered}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
              <Input
                id="expected_delivery_date"
                type="date"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData({...formData, expected_delivery_date: e.target.value})}
              />
            </div>
            <div>
              <Label>Mode of Transport</Label>
              <Select value={formData.mode_of_transport} onValueChange={(value) => setFormData({...formData, mode_of_transport: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="courier">Courier</SelectItem>
                  <SelectItem value="road">Road</SelectItem>
                  <SelectItem value="rail">Rail</SelectItem>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="sea">Sea</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="shipping_instructions">Shipping Instructions</Label>
            <Textarea
              id="shipping_instructions"
              value={formData.shipping_instructions}
              onChange={(e) => setFormData({...formData, shipping_instructions: e.target.value})}
              placeholder="Special notes, packaging requirements, etc."
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment & Commercials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Payment & Commercials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Currency</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({...formData, currency: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input
                id="payment_terms"
                value={formData.payment_terms}
                onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}
                placeholder="e.g., Net 30, Advance, COD"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Additional notes or terms"
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : salesOrder ? 'Update Sales Order' : 'Create Sales Order'}
        </Button>
      </div>
    </form>
  );
};
