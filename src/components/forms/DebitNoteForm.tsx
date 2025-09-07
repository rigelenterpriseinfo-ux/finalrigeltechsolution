import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProductSearch } from "@/components/ui/product-search";

interface DebitNoteFormProps {
  debitNote?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  mode: "add" | "edit";
}

interface DebitNoteItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  hsn_sac_code: string;
  quantity: number;
  received_quantity: number; // Original quantity from GRN
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  line_subtotal: number;
  line_total: number;
  unit_of_measure: string;
}

interface SupplierInvoice {
  grn_id: string;
  supplier_invoice_number: string;
  supplier_invoice_date: string;
  grn_number: string;
  supplier_name: string;
  total_amount: number;
}

export function DebitNoteForm({ debitNote, onSubmit, onCancel, mode }: DebitNoteFormProps) {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    supplier_id: debitNote?.supplier_id || "",
    supplier_name: debitNote?.supplier_name || "",
    grn_id: debitNote?.grn_id || "",
    supplier_invoice_number: debitNote?.supplier_invoice_number || "",
    supplier_invoice_date: debitNote?.supplier_invoice_date || "",
    reason: debitNote?.reason || "",
    notes: debitNote?.notes || "",
    debit_note_date: debitNote?.debit_note_date || new Date().toISOString().split('T')[0],
  });

  const [items, setItems] = useState<DebitNoteItem[]>(
    debitNote?.items || [{
      product_id: "",
      product_name: "",
      product_sku: "",
      hsn_sac_code: "",
      quantity: 1,
      received_quantity: 0,
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      tax_amount: 0,
      line_subtotal: 0,
      line_total: 0,
      unit_of_measure: "pcs"
    }]
  );

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (formData.supplier_id) {
      fetchSupplierInvoices(formData.supplier_id);
    }
  }, [formData.supplier_id]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchSupplierInvoices = async (supplierId: string) => {
    try {
      const { data, error } = await supabase
        .from('grn_header')
        .select(`
          id,
          grn_number,
          supplier_invoice_number,
          supplier_invoice_date,
          total_amount,
          supplier_name
        `)
        .eq('supplier_id', supplierId)
        .not('supplier_invoice_number', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const invoices = data?.map(grn => ({
        grn_id: grn.id,
        supplier_invoice_number: grn.supplier_invoice_number,
        supplier_invoice_date: grn.supplier_invoice_date,
        grn_number: grn.grn_number,
        supplier_name: grn.supplier_name,
        total_amount: grn.total_amount
      })) || [];
      
      setSupplierInvoices(invoices);
    } catch (error) {
      console.error('Error fetching supplier invoices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch supplier invoices",
        variant: "destructive"
      });
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find((s: any) => s.id === supplierId);
    setFormData(prev => ({
      ...prev,
      supplier_id: supplierId,
      supplier_name: supplier?.name || "",
      grn_id: "",
      supplier_invoice_number: "",
      supplier_invoice_date: ""
    }));
    setSelectedInvoice(null);
    setItems([{
      product_id: "",
      product_name: "",
      product_sku: "",
      hsn_sac_code: "",
      quantity: 1,
      received_quantity: 0,
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      tax_amount: 0,
      line_subtotal: 0,
      line_total: 0,
      unit_of_measure: "pcs"
    }]);
  };

  const handleSupplierInvoiceChange = async (invoiceNumber: string) => {
    const invoice = supplierInvoices.find(inv => inv.supplier_invoice_number === invoiceNumber);
    if (!invoice) return;

    setSelectedInvoice(invoice);
    setFormData(prev => ({
      ...prev,
      grn_id: invoice.grn_id,
      supplier_invoice_number: invoice.supplier_invoice_number,
      supplier_invoice_date: invoice.supplier_invoice_date
    }));

    // Fetch GRN line items and populate
    try {
      const { data, error } = await supabase
        .from('grn_line_items')
        .select(`
          product_id,
          product_name,
          product_sku,
          hsn_sac_code,
          accepted_quantity,
          unit_price,
          cgst_rate,
          sgst_rate,
          igst_rate,
          unit_of_measure
        `)
        .eq('grn_header_id', invoice.grn_id);

      if (error) throw error;

      const newItems = data?.map(lineItem => ({
        product_id: lineItem.product_id,
        product_name: lineItem.product_name,
        product_sku: lineItem.product_sku,
        hsn_sac_code: lineItem.hsn_sac_code || "",
        quantity: lineItem.accepted_quantity, // Start with received quantity
        received_quantity: lineItem.accepted_quantity,
        unit_price: lineItem.unit_price,
        discount_percentage: 0,
        discount_amount: 0,
        cgst_rate: lineItem.cgst_rate || 0,
        sgst_rate: lineItem.sgst_rate || 0,
        igst_rate: lineItem.igst_rate || 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        tax_amount: 0,
        line_subtotal: 0,
        line_total: 0,
        unit_of_measure: lineItem.unit_of_measure || "pcs"
      })) || [];

      // Calculate totals for each item
      newItems.forEach((_, index) => {
        calculateLineTotal(index, newItems);
      });

      setItems(newItems);
    } catch (error) {
      console.error('Error fetching GRN items:', error);
      toast({
        title: "Error",
        description: "Failed to load invoice items",
        variant: "destructive"
      });
    }
  };

  const calculateLineTotal = (index: number, itemsList = items) => {
    const item = itemsList[index];
    const subtotal = item.quantity * item.unit_price;
    const discountAmount = (subtotal * item.discount_percentage) / 100;
    const taxableAmount = subtotal - discountAmount;
    
    // Calculate GST amounts
    const cgstAmount = (taxableAmount * item.cgst_rate) / 100;
    const sgstAmount = (taxableAmount * item.sgst_rate) / 100;
    const igstAmount = (taxableAmount * item.igst_rate) / 100;
    const totalTax = cgstAmount + sgstAmount + igstAmount;
    
    const lineTotal = taxableAmount + totalTax;

    itemsList[index] = {
      ...item,
      discount_amount: discountAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      tax_amount: totalTax,
      line_subtotal: taxableAmount,
      line_total: lineTotal
    };
  };

  const handleItemChange = (index: number, field: keyof DebitNoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (['quantity', 'unit_price', 'discount_percentage', 'cgst_rate', 'sgst_rate', 'igst_rate'].includes(field)) {
      calculateLineTotal(index, newItems);
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      product_id: "",
      product_name: "",
      product_sku: "",
      hsn_sac_code: "",
      quantity: 1,
      received_quantity: 0,
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      tax_amount: 0,
      line_subtotal: 0,
      line_total: 0,
      unit_of_measure: "pcs"
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const totalDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0);
    const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
    const total = items.reduce((sum, item) => sum + item.line_total, 0);

    return { subtotal, totalDiscount, totalTax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier_id || !formData.supplier_invoice_number || !formData.reason) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (items.some(item => !item.product_id || item.quantity <= 0)) {
      toast({
        title: "Error",
        description: "Please ensure all items have valid products and quantities",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const totals = calculateTotals();

    const debitNoteData = {
      ...formData,
      subtotal_amount: totals.subtotal,
      discount_amount: totals.totalDiscount,
      tax_amount: totals.totalTax,
      total_amount: totals.total,
      items: items
    };

    await onSubmit(debitNoteData);
    setLoading(false);
  };

  const totals = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="supplier">Supplier *</Label>
          <Select value={formData.supplier_id} onValueChange={handleSupplierChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier: any) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier_invoice">Supplier Invoice *</Label>
          <Select 
            value={formData.supplier_invoice_number} 
            onValueChange={handleSupplierInvoiceChange}
            disabled={!formData.supplier_id}
          >
            <SelectTrigger>
              <SelectValue placeholder={!formData.supplier_id ? "Select supplier first" : "Select supplier invoice"} />
            </SelectTrigger>
            <SelectContent>
              {supplierInvoices.map((invoice) => (
                <SelectItem key={invoice.grn_id} value={invoice.supplier_invoice_number}>
                  {invoice.supplier_invoice_number} ({invoice.grn_number})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="debit_note_date">Debit Note Date</Label>
          <Input
            id="debit_note_date"
            type="date"
            value={formData.debit_note_date}
            onChange={(e) => setFormData(prev => ({ ...prev, debit_note_date: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason *</Label>
          <Input
            id="reason"
            value={formData.reason}
            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
            placeholder="Reason for debit note"
            required
          />
        </div>
      </div>

      {selectedInvoice && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <h3 className="text-lg font-medium mb-2">Invoice Details</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Invoice Number:</span>
                <p>{selectedInvoice.supplier_invoice_number}</p>
              </div>
              <div>
                <span className="font-medium">Invoice Date:</span>
                <p>{selectedInvoice.supplier_invoice_date}</p>
              </div>
              <div>
                <span className="font-medium">Total Amount:</span>
                <p>₹{(selectedInvoice.total_amount || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Items</h3>
            {!selectedInvoice && (
              <Button type="button" onClick={addItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="grid grid-cols-12 gap-2 items-center mb-2">
                  <div className="col-span-3">
                    {!selectedInvoice ? (
                      <div>
                        <Label className="text-xs">Product *</Label>
                        <ProductSearch
                          value={item.product_id}
                          onSelect={(product) => {
                            handleItemChange(index, 'product_id', product.id);
                            handleItemChange(index, 'product_name', product.name);
                            handleItemChange(index, 'product_sku', product.sku);
                            handleItemChange(index, 'unit_price', product.cost_price || 0);
                          }}
                          placeholder="Select product"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-medium">{item.product_name || "Product"}</div>
                        <div className="text-xs text-muted-foreground">{item.product_sku}</div>
                      </div>
                    )}
                  </div>

                  {selectedInvoice && (
                    <div className="col-span-2">
                      <Label className="text-xs">Received Qty</Label>
                      <Input
                        type="number"
                        value={item.received_quantity}
                        readOnly
                        className="bg-muted text-xs"
                      />
                    </div>
                  )}

                  <div className={selectedInvoice ? "col-span-2" : "col-span-3"}>
                    <Label className="text-xs">{selectedInvoice ? "Debit Qty *" : "Quantity *"}</Label>
                    <Input
                      type="number"
                      min="1"
                      max={selectedInvoice ? item.received_quantity : undefined}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                      placeholder="Qty"
                      className="text-xs"
                    />
                  </div>

                  <div className={selectedInvoice ? "col-span-2" : "col-span-2"}>
                    <Label className="text-xs">Unit Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      placeholder="Unit Price"
                      className="text-xs"
                    />
                  </div>

                  <div className={selectedInvoice ? "col-span-1" : "col-span-1"}>
                    <Label className="text-xs">Discount %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.discount_percentage}
                      onChange={(e) => handleItemChange(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="text-xs"
                    />
                  </div>

                  <div className={selectedInvoice ? "col-span-2" : "col-span-2"}>
                    <Label className="text-xs">CGST %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      step="0.01"
                      value={item.cgst_rate}
                      onChange={(e) => handleItemChange(index, 'cgst_rate', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="text-xs"
                    />
                  </div>

                  <div className="col-span-1 text-center">
                    {!selectedInvoice && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-center mb-2">
                  <div className="col-span-3"></div>
                  
                  <div className={selectedInvoice ? "col-span-2" : "col-span-3"}>
                    <Label className="text-xs">SGST %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      step="0.01"
                      value={item.sgst_rate}
                      onChange={(e) => handleItemChange(index, 'sgst_rate', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="text-xs"
                    />
                  </div>

                  <div className={selectedInvoice ? "col-span-2" : "col-span-2"}>
                    <Label className="text-xs">IGST %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      step="0.01"
                      value={item.igst_rate}
                      onChange={(e) => handleItemChange(index, 'igst_rate', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="text-xs"
                    />
                  </div>

                  <div className={selectedInvoice ? "col-span-1" : "col-span-1"}>
                    <Label className="text-xs">HSN</Label>
                    <Input
                      type="text"
                      value={item.hsn_sac_code}
                      onChange={(e) => handleItemChange(index, 'hsn_sac_code', e.target.value)}
                      placeholder="HSN"
                      className="text-xs"
                    />
                  </div>

                  <div className={selectedInvoice ? "col-span-2" : "col-span-2"}>
                    <Label className="text-xs">UOM</Label>
                    <Input
                      type="text"
                      value={item.unit_of_measure}
                      onChange={(e) => handleItemChange(index, 'unit_of_measure', e.target.value)}
                      placeholder="pcs"
                      className="text-xs"
                    />
                  </div>

                  <div className="col-span-1"></div>
                </div>
                
                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <div>Subtotal: ₹{item.line_subtotal.toFixed(2)}</div>
                  <div>Tax: ₹{item.tax_amount.toFixed(2)}</div>
                  <div>Total: ₹{item.line_total.toFixed(2)}</div>
                  <div>UOM: {item.unit_of_measure}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t pt-4">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-₹{totals.totalDiscount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (18%):</span>
              <span>₹{totals.totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Total:</span>
              <span>₹{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes..."
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : mode === "add" ? "Create Debit Note" : "Update Debit Note"}
        </Button>
      </div>
    </form>
  );
}