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
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
}

export function SupplierCreditNoteForm({ supplierCreditNote, onSubmit, onCancel, mode }: SupplierCreditNoteFormProps) {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
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
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      tax_amount: 0,
      line_total: 0
    }]
  );

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    fetchPurchaseOrders();
  }, []);

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

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find((s: any) => s.id === supplierId);
    setFormData(prev => ({
      ...prev,
      supplier_id: supplierId,
      supplier_name: supplier?.name || ""
    }));
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
    const subtotal = item.quantity * item.unit_price;
    const discountAmount = (subtotal * item.discount_percentage) / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * 0.18; // Assuming 18% tax
    const lineTotal = taxableAmount + taxAmount;

    itemsList[index] = {
      ...item,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      line_total: lineTotal
    };
  };

  const handleItemChange = (index: number, field: keyof SupplierCreditNoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (['quantity', 'unit_price', 'discount_percentage'].includes(field)) {
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
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      tax_amount: 0,
      line_total: 0
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
    
    if (!formData.supplier_id || !formData.supplier_credit_note_number || !formData.reason) {
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
          <Label htmlFor="purchase_order">Purchase Order</Label>
          <Select 
            value={formData.purchase_order_id} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, purchase_order_id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select purchase order" />
            </SelectTrigger>
            <SelectContent>
              {purchaseOrders.map((po: any) => (
                <SelectItem key={po.id} value={po.id}>
                  {po.po_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 border rounded-lg">
                <div className="col-span-3">
                  <Select
                    value={item.product_id}
                    onValueChange={(value) => handleProductChange(index, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product: any) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                    placeholder="Qty"
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    placeholder="Unit Price"
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.discount_percentage}
                    onChange={(e) => handleItemChange(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                    placeholder="Discount %"
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    type="text"
                    value={`₹${item.line_total.toFixed(2)}`}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>

                <div className="col-span-1 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
          {loading ? "Saving..." : mode === "add" ? "Create Credit Note" : "Update Credit Note"}
        </Button>
      </div>
    </form>
  );
}