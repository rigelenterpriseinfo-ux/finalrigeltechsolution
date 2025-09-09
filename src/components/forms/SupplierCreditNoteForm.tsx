import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
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
      // First, get all debit notes with confirmed or draft status
      const { data: debitNotesData, error: debitNotesError } = await supabase
        .from('debit_notes')
        .select('*')
        .in('status', ['confirmed', 'draft'])
        .order('created_at', { ascending: false });
      
      if (debitNotesError) throw debitNotesError;
      
      if (!debitNotesData || debitNotesData.length === 0) {
        setDebitNotes([]);
        return;
      }

      // Get all credit note items for these debit notes to check settlement status
      const debitNoteIds = debitNotesData.map(dn => dn.id);
      const { data: creditNoteItems, error: creditError } = await supabase
        .from('supplier_credit_notes')
        .select(`
          debit_note_id,
          total_amount
        `)
        .in('debit_note_id', debitNoteIds);
      
      if (creditError) {
        console.error('Error fetching credit notes:', creditError);
        // If credit note fetch fails, show all debit notes (conservative approach)
        setDebitNotes(debitNotesData);
        return;
      }

      // Calculate settlement status for each debit note
      const unsettledDebitNotes = debitNotesData.filter(debitNote => {
        // Find all credit notes for this debit note
        const relatedCreditNotes = creditNoteItems?.filter(cn => cn.debit_note_id === debitNote.id) || [];
        
        // Calculate total credit note amount
        const totalCreditAmount = relatedCreditNotes.reduce((sum, cn) => sum + (cn.total_amount || 0), 0);
        
        // Only include debit notes that are not fully settled
        return totalCreditAmount < debitNote.total_amount;
      });
      
      setDebitNotes(unsettledDebitNotes);
    } catch (error) {
      console.error('Error fetching debit notes:', error);
      setDebitNotes([]);
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
    
    // Validate credit_note_quantity doesn't exceed original quantity
    if (field === 'credit_note_quantity') {
      const maxAllowed = newItems[index].quantity;
      if (value > maxAllowed) {
        toast({
          title: "Invalid Quantity",
          description: `Credit note quantity cannot exceed original quantity (${maxAllowed})`,
          variant: "destructive"
        });
        return; // Don't update if validation fails
      }
      if (value < 0) {
        toast({
          title: "Invalid Quantity", 
          description: "Credit note quantity cannot be negative",
          variant: "destructive"
        });
        return;
      }
    }
    
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate when relevant fields change
    if (['credit_note_quantity', 'unit_price', 'discount_percentage', 'cgst_rate', 'sgst_rate', 'igst_rate'].includes(field)) {
      calculateLineTotal(index, newItems);
    }
    
    setItems(newItems);
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
    <form onSubmit={handleSubmit} className="w-full space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="space-y-2">
          <Label htmlFor="debit_note" className="text-sm font-medium">Debit Note *</Label>
          <Select value={formData.debit_note_id} onValueChange={handleDebitNoteChange}>
            <SelectTrigger className="h-11 md:h-10 text-base md:text-sm">
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
          <Label htmlFor="supplier_credit_note_number" className="text-sm font-medium">Credit Note Number *</Label>
          <Input
            id="supplier_credit_note_number"
            className="h-11 md:h-10 text-base md:text-sm"
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

      <div className="bg-background border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-primary/20 rounded flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded"></div>
            </div>
            <h3 className="font-medium text-foreground">Supplier Credit Note Items</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Tax Type Toggle */}
            <div className="flex rounded-md border overflow-hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1 text-xs rounded-none"
              >
                Intra-State (CGST+SGST)
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="bg-muted hover:bg-muted/80 px-3 py-1 text-xs rounded-none"
              >
                Inter-State (IGST)
              </Button>
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div className="bg-muted/30 border-b">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-2">Product</div>
            <div className="text-center">Ord Qty</div>
            <div className="text-center">Total Debit</div>
            <div className="text-center">Pending</div>
            <div className="text-center">CN Qty</div>
            <div className="text-center">Unit Price</div>
            <div className="text-center">Disc%</div>
            <div className="text-center">Disc Value</div>
            <div className="text-center">IGST%</div>
            <div className="text-center">GST Value</div>
            <div className="text-center">Line Total</div>
            <div className="text-center">Action</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-muted/20">
              {/* Product */}
              <div className="col-span-2">
                <div className="text-sm font-medium">{item.product_name || "Auto-filled from debit note"}</div>
                <div className="text-xs text-muted-foreground">{item.product_sku}</div>
              </div>

              {/* Ord Qty (Original quantity from debit note) */}
              <div className="text-center">
                <div className="text-sm py-2 text-muted-foreground bg-muted/20 rounded">
                  {item.quantity}
                </div>
              </div>

              {/* Total Debit (Same as original quantity) */}
              <div className="text-center">
                <div className="text-sm py-2 text-muted-foreground bg-blue-50 rounded">
                  {item.quantity}
                </div>
              </div>

              {/* Pending */}
              <div className="text-center">
                <div className="text-sm py-2 text-orange-600 bg-orange-50 rounded font-medium">
                  {item.pending_quantity}
                </div>
              </div>

              {/* CN Qty */}
              <div className="text-center">
                <Input
                  type="number"
                  min="0"
                  max={item.quantity}
                  value={item.credit_note_quantity}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    handleItemChange(index, 'credit_note_quantity', value);
                  }}
                  className="text-center text-sm h-8 border-primary/30 focus:border-primary"
                  placeholder="0"
                />
              </div>

              {/* Unit Price */}
              <div className="text-center">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.unit_price}
                  onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  className="text-center text-sm h-8"
                  placeholder="0"
                />
              </div>

              {/* Disc% */}
              <div className="text-center">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.discount_percentage}
                  onChange={(e) => handleItemChange(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                  className="text-center text-sm h-8"
                  placeholder="0"
                />
              </div>

              {/* Disc Value */}
              <div className="text-center">
                <div className="text-sm py-2 text-muted-foreground">
                  ₹{(item.discount_amount || 0).toFixed(2)}
                </div>
              </div>

              {/* IGST% */}
              <div className="text-center">
                <Input
                  type="number"
                  min="0"
                  max="50"
                  step="0.01"
                  value={item.igst_rate}
                  onChange={(e) => handleItemChange(index, 'igst_rate', parseFloat(e.target.value) || 0)}
                  className="text-center text-sm h-8"
                  placeholder="0"
                />
              </div>

              {/* GST Value */}
              <div className="text-center">
                <div className="text-sm py-2 text-muted-foreground">
                  ₹{(item.tax_amount || 0).toFixed(2)}
                </div>
              </div>

              {/* Line Total */}
              <div className="text-center">
                <div className="text-sm py-2 font-medium text-foreground">
                  ₹{(item.line_total || 0).toFixed(2)}
                </div>
              </div>

              {/* Action */}
              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals Section */}
        <div className="bg-muted/20 border-t px-4 py-3">
          <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>₹{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount:</span>
              <span className="text-destructive">-₹{totals.totalDiscount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax:</span>
              <span>₹{totals.totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base border-t pt-2">
              <span>Total:</span>
              <span className="text-primary">₹{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes..."
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          className="h-11 md:h-10 text-base md:text-sm"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={loading}
          className="h-11 md:h-10 text-base md:text-sm"
        >
          {loading ? "Saving..." : mode === "add" ? "Create Credit Note" : "Update Credit Note"}
        </Button>
      </div>
    </form>
  );
}