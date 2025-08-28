import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Search, Check, ChevronsUpDown, FileText, Save, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InvoiceFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  invoice?: any;
}

export const InvoiceForm = ({ onSubmit, onCancel, invoice }: InvoiceFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [salesOrders, setSalesOrders] = useState([]);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState(null);
  const [salesOrderItems, setSalesOrderItems] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    invoice_date: new Date(),
    invoice_number: '',
    place_of_supply: '',
    notes: '',
    status: 'draft'
  });

  useEffect(() => {
    fetchSalesOrders();
    if (invoice) {
      // Load existing invoice data
      setFormData({
        invoice_date: new Date(invoice.performa_invoice_date),
        invoice_number: invoice.performa_invoice_number,
        place_of_supply: invoice.place_of_supply || '',
        notes: invoice.notes || '',
        status: invoice.status
      });
      if (invoice.sales_order_id) {
        loadSalesOrder(invoice.sales_order_id);
      }
    }
  }, [invoice]);

  const fetchSalesOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(name, customer_ref)
        `)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSalesOrders(data || []);
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales orders",
        variant: "destructive"
      });
    }
  };

  const loadSalesOrder = async (salesOrderId) => {
    try {
      // Fetch sales order details
      const { data: salesOrder, error: soError } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', salesOrderId)
        .single();

      if (soError) throw soError;

      // Fetch sales order items
      const { data: items, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', salesOrderId);

      if (itemsError) throw itemsError;

      setSelectedSalesOrder(salesOrder);
      setSalesOrderItems(items || []);
      setCustomer(salesOrder.customer);

      // Generate invoice number if creating new
      if (!invoice) {
        await generateInvoiceNumber();
      }
    } catch (error) {
      console.error('Error loading sales order:', error);
      toast({
        title: "Error",
        description: "Failed to load sales order details",
        variant: "destructive"
      });
    }
  };

  const generateInvoiceNumber = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', profile.company_id)
        .single();

      if (!company) return;

      // Extract first 4 letters from company name
      const firstFourLetters = company.name
        .replace(/[^A-Za-z]/g, '')
        .substring(0, 4)
        .toUpperCase()
        .padEnd(4, 'X');

      // Get next invoice number
      const { data: lastInvoice } = await supabase
        .from('performa_invoices')
        .select('performa_invoice_number')
        .eq('company_id', profile.company_id)
        .like('performa_invoice_number', `INV${firstFourLetters}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let nextNumber = '001';
      if (lastInvoice) {
        const lastNumber = parseInt(lastInvoice.performa_invoice_number.slice(-3));
        nextNumber = (lastNumber + 1).toString().padStart(3, '0');
      }

      const invoiceNumber = `INV${firstFourLetters}${nextNumber}`;
      setFormData(prev => ({ ...prev, invoice_number: invoiceNumber }));
    } catch (error) {
      console.error('Error generating invoice number:', error);
    }
  };

  const handleSalesOrderSelect = (salesOrderId) => {
    loadSalesOrder(salesOrderId);
    setSearchOpen(false);
  };

  const updateItemField = (index, field, value) => {
    const updatedItems = [...salesOrderItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate totals
    const item = updatedItems[index];
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const discountPercentage = parseFloat(item.discount_percentage) || 0;
    
    const lineTotal = quantity * unitPrice;
    const discountAmount = (lineTotal * discountPercentage) / 100;
    const taxableAmount = lineTotal - discountAmount;
    
    const cgstAmount = (taxableAmount * (parseFloat(item.cgst_rate) || 0)) / 100;
    const sgstAmount = (taxableAmount * (parseFloat(item.sgst_rate) || 0)) / 100;
    const igstAmount = (taxableAmount * (parseFloat(item.igst_rate) || 0)) / 100;
    
    updatedItems[index] = {
      ...item,
      discount_amount: discountAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_price: taxableAmount + cgstAmount + sgstAmount + igstAmount
    };
    
    setSalesOrderItems(updatedItems);
  };

  const handleSubmit = (status) => {
    if (!selectedSalesOrder) {
      toast({
        title: "Error",
        description: "Please select a sales order",
        variant: "destructive"
      });
      return;
    }

    const invoiceData = {
      ...formData,
      status,
      sales_order_id: selectedSalesOrder.id,
      customer_id: selectedSalesOrder.customer_id,
      customer_name: customer?.name,
      performa_invoice_date: formData.invoice_date,
      performa_invoice_number: formData.invoice_number,
      place_of_supply: formData.place_of_supply
    };

    onSubmit({
      invoiceData,
      lineItems: salesOrderItems
    });
  };

  const calculateTotals = () => {
    const subtotal = salesOrderItems.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseFloat(item.quantity)), 0);
    const discount = salesOrderItems.reduce((sum, item) => sum + parseFloat(item.discount_amount || 0), 0);
    const tax = salesOrderItems.reduce((sum, item) => sum + parseFloat(item.cgst_amount || 0) + parseFloat(item.sgst_amount || 0) + parseFloat(item.igst_amount || 0), 0);
    const total = salesOrderItems.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);

    return { subtotal, discount, tax, total };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-lg font-semibold">
        <FileText className="h-5 w-5" />
        {invoice ? 'Edit Invoice' : 'Create New Invoice'}
      </div>

      {/* Sales Order Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Sales Order</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sales Order</Label>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={searchOpen}
                    className="w-full justify-between"
                  >
                    {selectedSalesOrder
                      ? `${selectedSalesOrder.order_number} - ${selectedSalesOrder.customer?.name}`
                      : "Select sales order..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search sales orders..." />
                    <CommandEmpty>No sales orders found.</CommandEmpty>
                    <CommandGroup>
                      {salesOrders.map((so) => (
                        <CommandItem
                          key={so.id}
                          value={`${so.order_number} ${so.customer?.name}`}
                          onSelect={() => handleSalesOrderSelect(so.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSalesOrder?.id === so.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{so.order_number}</span>
                            <span className="text-sm text-muted-foreground">
                              {so.customer?.name} - ₹{so.total_amount?.toLocaleString()}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedSalesOrder && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Customer:</span> {customer?.name}
                  </div>
                  <div>
                    <span className="font-medium">Order Date:</span> {format(new Date(selectedSalesOrder.order_date), 'dd MMM yyyy')}
                  </div>
                  <div>
                    <span className="font-medium">Total Amount:</span> ₹{selectedSalesOrder.total_amount?.toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Details */}
      {selectedSalesOrder && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Invoice Date</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.invoice_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.invoice_date ? format(formData.invoice_date, "dd MMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.invoice_date}
                      onSelect={(date) => {
                        setFormData(prev => ({ ...prev, invoice_date: date }));
                        setCalendarOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                  placeholder="INV-COMP-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="place_of_supply">Place of Supply</Label>
                <Input
                  id="place_of_supply"
                  value={formData.place_of_supply}
                  onChange={(e) => setFormData(prev => ({ ...prev, place_of_supply: e.target.value }))}
                  placeholder="Enter place of supply"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Details */}
      {customer && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">{customer.name}</div>
                <div className="text-muted-foreground">{customer.customer_ref}</div>
                <div>{customer.email}</div>
                <div>{customer.phone}</div>
              </div>
              <div>
                <div>{customer.address_line1}</div>
                {customer.address_line2 && <div>{customer.address_line2}</div>}
                <div>{customer.city}, {customer.state} {customer.pin_code}</div>
                <div>{customer.country}</div>
                {customer.gstin && <div className="font-medium">GSTIN: {customer.gstin}</div>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      {salesOrderItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Item Description</th>
                      <th className="text-left p-2">HSN/SAC</th>
                      <th className="text-left p-2">Qty</th>
                      <th className="text-left p-2">UOM</th>
                      <th className="text-left p-2">Rate</th>
                      <th className="text-left p-2">Discount %</th>
                      <th className="text-left p-2">CGST %</th>
                      <th className="text-left p-2">SGST %</th>
                      <th className="text-left p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesOrderItems.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">
                          <Input
                            value={item.item_description}
                            onChange={(e) => updateItemField(index, 'item_description', e.target.value)}
                            className="min-w-[200px]"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={item.hsn_sac_code || ''}
                            onChange={(e) => updateItemField(index, 'hsn_sac_code', e.target.value)}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItemField(index, 'quantity', e.target.value)}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={item.unit_of_measure}
                            onChange={(e) => updateItemField(index, 'unit_of_measure', e.target.value)}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateItemField(index, 'unit_price', e.target.value)}
                            className="w-24"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.discount_percentage || 0}
                            onChange={(e) => updateItemField(index, 'discount_percentage', e.target.value)}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.cgst_rate || 0}
                            onChange={(e) => updateItemField(index, 'cgst_rate', e.target.value)}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.sgst_rate || 0}
                            onChange={(e) => updateItemField(index, 'sgst_rate', e.target.value)}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2 font-medium">
                          ₹{(item.total_price || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Separator />

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-80 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{totals.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>₹{totals.discount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>₹{totals.tax.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total:</span>
                    <span>₹{totals.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {selectedSalesOrder && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Enter any additional notes or terms..."
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSubmit('draft')}
          disabled={!selectedSalesOrder || loading}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save as Draft
        </Button>
        <Button
          onClick={() => handleSubmit('confirmed')}
          disabled={!selectedSalesOrder || loading}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Generate Invoice
        </Button>
      </div>
    </div>
  );
};