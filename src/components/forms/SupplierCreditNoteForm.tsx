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

interface SupplierCreditNoteFormProps {
  supplierCreditNote?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  mode: "add" | "edit";
}

interface SupplierCreditNoteItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number; // Original quantity from debit note
  credit_note_quantity: number; // New editable field
  pending_quantity: number; // Calculated: quantity - credit_note_quantity
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
  hsn_sac_code: string;
  warehouse_id?: string;
  bin_id?: string;
}

export function SupplierCreditNoteForm({ supplierCreditNote, onSubmit, onCancel, mode }: SupplierCreditNoteFormProps) {
  const { toast } = useToast();
  const [debitNotes, setDebitNotes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    debit_note_id: supplierCreditNote?.debit_note_id || "",
    supplier_id: supplierCreditNote?.supplier_id || "",
    supplier_name: supplierCreditNote?.supplier_name || "",
    purchase_order_id: supplierCreditNote?.purchase_order_id || "",
    supplier_credit_note_number: supplierCreditNote?.supplier_credit_note_number || "",
    reason: supplierCreditNote?.reason || "",
    notes: supplierCreditNote?.notes || "",
    supplier_credit_note_date: supplierCreditNote?.supplier_credit_note_date || new Date().toISOString().split('T')[0],
  });

  const [items, setItems] = useState<SupplierCreditNoteItem[]>(
    supplierCreditNote?.items || [{
      product_id: "",
      product_name: "",
      product_sku: "",
      quantity: 1,
      credit_note_quantity: 0,
      pending_quantity: 1,
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
      unit_of_measure: "pcs",
      hsn_sac_code: ""
    }]
  );

  useEffect(() => {
    fetchDebitNotes();
    fetchProducts();
  }, []);

  const fetchDebitNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('debit_notes')
        .select('*')
        .in('status', ['confirmed', 'draft'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDebitNotes(data || []);
    } catch (error) {
      console.error('Error fetching debit notes:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchDebitNoteItems = async (debitNoteId: string) => {
    try {
      const { data, error } = await supabase
        .from('debit_note_items')
        .select('*')
        .eq('debit_note_id', debitNoteId);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching debit note items:', error);
      return [];
    }
  };

  const handleDebitNoteChange = async (debitNoteId: string) => {
    const debitNote = debitNotes.find((dn: any) => dn.id === debitNoteId);
    
    if (!debitNote) return;

    // Fetch debit note line items
    const debitNoteItems = await fetchDebitNoteItems(debitNoteId);
    
    // Update form data
    setFormData(prev => ({
      ...prev,
      debit_note_id: debitNoteId,
      supplier_id: debitNote.supplier_id,
      supplier_name: debitNote.supplier_name,
      purchase_order_id: debitNote.purchase_order_id,
      reason: `Credit note for debit note ${debitNote.debit_note_number}`
    }));

    // Auto-populate items from debit note
    if (debitNoteItems.length > 0) {
      const mappedItems = debitNoteItems.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: item.quantity,
        credit_note_quantity: 0, // Start with 0, user will input
        pending_quantity: item.quantity, // Initially all quantity is pending
        unit_price: item.unit_price,
        discount_percentage: item.discount_percentage || 0,
        discount_amount: item.discount_amount || 0,
        cgst_rate: item.cgst_rate || 0,
        sgst_rate: item.sgst_rate || 0,
        igst_rate: item.igst_rate || 0,
        cgst_amount: item.cgst_amount || 0,
        sgst_amount: item.sgst_amount || 0,
        igst_amount: item.igst_amount || 0,
        tax_amount: item.tax_amount || 0,
        line_subtotal: item.line_subtotal || 0,
        line_total: item.line_total || 0,
        unit_of_measure: item.unit_of_measure || 'pcs',
        hsn_sac_code: item.hsn_sac_code || ''
      }));
      setItems(mappedItems);
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p: any) => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        product_name: product.name,
        product_sku: product.sku,
        unit_price: product.cost_price || 0
      };
      calculateLineTotal(index, newItems);
      setItems(newItems);
    }
  };

  const calculateLineTotal = (index: number, itemsList = items) => {
    const item = itemsList[index];
    const subtotal = item.credit_note_quantity * item.unit_price;
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
      pending_quantity: item.quantity - item.credit_note_quantity,
      discount_amount: discountAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      tax_amount: totalTax,
      line_subtotal: taxableAmount,
      line_total: lineTotal
    };
  };

  const handleItemChange = (index: number, field: keyof SupplierCreditNoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate when relevant fields change
    if (['credit_note_quantity', 'unit_price', 'discount_percentage', 'cgst_rate', 'sgst_rate', 'igst_rate'].includes(field)) {
      calculateLineTotal(index, newItems);
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      product_id: "",
      product_name: "",
      product_sku: "",
      quantity: 1,
      credit_note_quantity: 0,
      pending_quantity: 1,
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
      unit_of_measure: "pcs",
      hsn_sac_code: ""
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.credit_note_quantity * item.unit_price), 0);
    const totalDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0);
    const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
    const total = items.reduce((sum, item) => sum + item.line_total, 0);

    return { subtotal, totalDiscount, totalTax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.debit_note_id || !formData.supplier_credit_note_number || !formData.reason) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (items.some(item => !item.product_id || item.credit_note_quantity <= 0 || item.credit_note_quantity > item.quantity)) {
      toast({
        title: "Error",
        description: "Please ensure all items have valid products and credit note quantities not exceeding original quantities",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const totals = calculateTotals();

    const creditNoteData = {
      ...formData,
      subtotal_amount: totals.subtotal,
      discount_amount: totals.totalDiscount,
      tax_amount: totals.totalTax,
      total_amount: totals.total,
      items: items
    };

    await onSubmit(creditNoteData);
    setLoading(false);
  };

  const totals = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="debit_note">Debit Note *</Label>
          <Select value={formData.debit_note_id} onValueChange={handleDebitNoteChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select debit note" />
            </SelectTrigger>
            <SelectContent>
              {debitNotes.map((debitNote: any) => (
                <SelectItem key={debitNote.id} value={debitNote.id}>
                  {debitNote.debit_note_number} - {debitNote.supplier_name} (₹{debitNote.total_amount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier_credit_note_number">Credit Note Number *</Label>
          <Input
            id="supplier_credit_note_number"
            value={formData.supplier_credit_note_number}
            onChange={(e) => setFormData(prev => ({ ...prev, supplier_credit_note_number: e.target.value }))}
            placeholder="Supplier's credit note number"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier_name">Supplier</Label>
          <Input
            id="supplier_name"
            value={formData.supplier_name}
            readOnly
            placeholder="Auto-filled from debit note"
            className="bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier_credit_note_date">Credit Note Date</Label>
          <Input
            id="supplier_credit_note_date"
            type="date"
            value={formData.supplier_credit_note_date}
            onChange={(e) => setFormData(prev => ({ ...prev, supplier_credit_note_date: e.target.value }))}
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="reason">Reason *</Label>
          <Input
            id="reason"
            value={formData.reason}
            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
            placeholder="Reason for credit note"
            required
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Items</h3>
            <Button type="button" onClick={addItem} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="p-3 border rounded-lg space-y-3">
                 <div className="grid grid-cols-12 gap-2 items-center">
                   <div className="col-span-3">
                     <Label className="text-xs">Product *</Label>
                     <Input
                       type="text"
                       value={item.product_name || ""}
                       readOnly
                       className="bg-muted text-xs"
                       placeholder="Auto-filled from debit note"
                     />
                   </div>

                   <div className="col-span-2">
                     <Label className="text-xs">Original Qty</Label>
                     <Input
                       type="number"
                       value={item.quantity}
                       readOnly
                       className="bg-muted text-xs"
                     />
                   </div>

                   <div className="col-span-2">
                     <Label className="text-xs">Credit Note Qty *</Label>
                     <Input
                       type="number"
                       min="1"
                       max={item.quantity}
                       value={item.credit_note_quantity}
                       onChange={(e) => handleItemChange(index, 'credit_note_quantity', parseInt(e.target.value) || 0)}
                       placeholder="Qty"
                       className="text-xs"
                     />
                   </div>

                   <div className="col-span-2">
                     <Label className="text-xs">Pending Qty</Label>
                     <Input
                       type="number"
                       value={item.pending_quantity}
                       readOnly
                       className="bg-muted text-xs"
                     />
                   </div>

                   <div className="col-span-2">
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

                   <div className="col-span-1">
                     <Label className="text-xs">Disc %</Label>
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
                 </div>

                 <div className="grid grid-cols-12 gap-2 items-center">
                   <div className="col-span-2">
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

                   <div className="col-span-2">
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

                   <div className="col-span-2">
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

                   <div className="col-span-2">
                     <Label className="text-xs">HSN Code</Label>
                     <Input
                       type="text"
                       value={item.hsn_sac_code}
                       onChange={(e) => handleItemChange(index, 'hsn_sac_code', e.target.value)}
                       placeholder="HSN"
                       className="text-xs"
                     />
                   </div>

                   <div className="col-span-2">
                     <Label className="text-xs">UOM</Label>
                     <Input
                       type="text"
                       value={item.unit_of_measure}
                       onChange={(e) => handleItemChange(index, 'unit_of_measure', e.target.value)}
                       placeholder="pcs"
                       className="text-xs"
                     />
                   </div>

                   <div className="col-span-2">
                     <Label className="text-xs">Line Total</Label>
                     <Input
                       type="text"
                       value={`₹${(item.line_total || 0).toFixed(2)}`}
                       readOnly
                       className="bg-muted text-xs"
                     />
                   </div>
                 </div>

                 <div className="text-right">
                   <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     onClick={() => removeItem(index)}
                     disabled={items.length === 1}
                     className="mt-4"
                   >
                     <Trash2 className="h-4 w-4" />
                   </Button>
                 </div>

                 <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                   <div>Subtotal: ₹{(item.line_subtotal || 0).toFixed(2)}</div>
                   <div>Tax: ₹{(item.tax_amount || 0).toFixed(2)}</div>
                   <div>Total: ₹{(item.line_total || 0).toFixed(2)}</div>
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
              <span>Tax:</span>
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
          {loading ? "Saving..." : mode === "add" ? "Create Credit Note" : "Update Credit Note"}
        </Button>
      </div>
    </form>
  );
}