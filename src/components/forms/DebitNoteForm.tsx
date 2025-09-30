import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
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
  gst_type: 'intra' | 'inter';
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
  const [globalGstType, setGlobalGstType] = useState<'intra' | 'inter'>('intra');

  const [formData, setFormData] = useState({
    supplier_id: debitNote?.supplier_id || "",
    supplier_name: debitNote?.supplier_name || "",
    grn_id: debitNote?.grn_id || "",
    supplier_invoice_number: debitNote?.supplier_invoice_number || "",
    supplier_invoice_date: debitNote?.supplier_invoice_date || "",
    reason: debitNote?.reason || "",
    notes: debitNote?.notes || "",
    debit_note_date: debitNote?.debit_note_date || new Date().toISOString().split('T')[0],
    default_warehouse_id: debitNote?.default_warehouse_id || "",
    default_bin_id: debitNote?.default_bin_id || "",
  });

  const [bins, setBins] = useState([]);

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
      unit_of_measure: "pcs",
      gst_type: 'intra'
    }]
  );

  useEffect(() => {
    fetchSuppliers();
    fetchBins();
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

  const fetchBins = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('is_active', true)
        .order('bin_name');
      
      if (error) throw error;
      setBins(data || []);
    } catch (error) {
      console.error('Error fetching bins:', error);
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
        .neq('supplier_invoice_number', '')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const invoices = data?.filter(grn => 
        grn.supplier_invoice_number && 
        grn.supplier_invoice_number.trim() !== ''
      ).map(grn => ({
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
      unit_of_measure: "pcs",
      gst_type: globalGstType
    }]);
  };

  const handleSupplierInvoiceChange = async (invoiceNumber: string) => {
    const invoice = supplierInvoices.find(inv => inv.supplier_invoice_number === invoiceNumber);
    if (!invoice) return;

    setSelectedInvoice(invoice);
    
    // Fetch GRN line items and populate with warehouse/bin and discount
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
          discount_percentage,
          discount_amount,
          cgst_rate,
          sgst_rate,
          igst_rate,
          unit_of_measure,
          warehouse_id,
          bin_id
        `)
        .eq('grn_header_id', invoice.grn_id);

      if (error) throw error;

      // Set warehouse and bin from first line item
      if (data && data.length > 0) {
        setFormData(prev => ({
          ...prev,
          supplier_name: invoice.supplier_name,
          grn_id: invoice.grn_id,
          supplier_invoice_number: invoice.supplier_invoice_number,
          supplier_invoice_date: invoice.supplier_invoice_date,
          default_warehouse_id: data[0].warehouse_id || "",
          default_bin_id: data[0].bin_id || ""
        }));
      }

      const newItems = data?.map(lineItem => ({
        product_id: lineItem.product_id,
        product_name: lineItem.product_name,
        product_sku: lineItem.product_sku,
        hsn_sac_code: lineItem.hsn_sac_code || "",
        quantity: lineItem.accepted_quantity,
        received_quantity: lineItem.accepted_quantity,
        unit_price: lineItem.unit_price,
        discount_percentage: lineItem.discount_percentage || 0,
        discount_amount: lineItem.discount_amount || 0,
        cgst_rate: lineItem.cgst_rate || 0,
        sgst_rate: lineItem.sgst_rate || 0,
        igst_rate: lineItem.igst_rate || 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        tax_amount: 0,
        line_subtotal: 0,
        line_total: 0,
        unit_of_measure: lineItem.unit_of_measure || "pcs",
        gst_type: (lineItem.igst_rate && lineItem.igst_rate > 0 ? 'inter' : 'intra') as 'inter' | 'intra'
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
      line_total: lineTotal,
      gst_type: item.gst_type || 'intra'
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

  const handleGlobalGstTypeChange = (newGstType: 'intra' | 'inter') => {
    setGlobalGstType(newGstType);
    
    // Update all existing items to the new GST type
    setItems(prev => prev.map(item => {
      const masterGST = (item.cgst_rate + item.sgst_rate + item.igst_rate) || 0;
      const updatedItem = {
        ...item,
        gst_type: newGstType
      };
      
      if (newGstType === 'intra') {
        // Intra-state: Clear IGST, set CGST+SGST
        updatedItem.igst_rate = 0;
        updatedItem.cgst_rate = masterGST / 2;
        updatedItem.sgst_rate = masterGST / 2;
      } else {
        // Inter-state: Clear CGST+SGST, set IGST
        updatedItem.cgst_rate = 0;
        updatedItem.sgst_rate = 0;
        updatedItem.igst_rate = masterGST;
      }
      
      return updatedItem;
    }));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
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
      unit_of_measure: "pcs",
      gst_type: globalGstType
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

    // Validate that debit quantities don't exceed pending quantities
    const invalidItems = items.filter(item => item.quantity > item.received_quantity);
    if (invalidItems.length > 0) {
      toast({
        title: "Error",
        description: "Debit quantity cannot exceed received quantity for any item",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const totals = calculateTotals();

    // Sanitize items data to only include database fields
    const sanitizedItems = items.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      quantity: parseInt(String(item.quantity)) || 0,
      received_quantity: parseInt(String(item.received_quantity)) || 0,
      pending_quantity: Math.max(0, (parseInt(String(item.received_quantity)) || 0) - (parseInt(String(item.quantity)) || 0)),
      unit_price: parseFloat(String(item.unit_price)) || 0,
      unit_of_measure: item.unit_of_measure || 'pcs',
      hsn_sac_code: item.hsn_sac_code || '',
      discount_percentage: parseFloat(String(item.discount_percentage)) || 0,
      discount_amount: parseFloat(String(item.discount_amount)) || 0,
      cgst_rate: parseFloat(String(item.cgst_rate)) || 0,
      cgst_amount: parseFloat(String(item.cgst_amount)) || 0,
      sgst_rate: parseFloat(String(item.sgst_rate)) || 0,
      sgst_amount: parseFloat(String(item.sgst_amount)) || 0,
      igst_rate: parseFloat(String(item.igst_rate)) || 0,
      igst_amount: parseFloat(String(item.igst_amount)) || 0,
      tax_amount: parseFloat(String(item.tax_amount)) || 0,
      line_subtotal: parseFloat(String(item.line_subtotal)) || 0,
      line_total: parseFloat(String(item.line_total)) || 0
    }));

    const debitNoteData = {
      supplier_id: formData.supplier_id,
      supplier_name: formData.supplier_name,
      grn_id: formData.grn_id,
      supplier_invoice_number: formData.supplier_invoice_number,
      supplier_invoice_date: formData.supplier_invoice_date || null,
      debit_note_date: formData.debit_note_date,
      reason: formData.reason,
      notes: formData.notes || '',
      default_warehouse_id: formData.default_warehouse_id || null,
      default_bin_id: formData.default_bin_id || null,
      subtotal_amount: parseFloat(totals.subtotal.toFixed(2)),
      discount_amount: parseFloat(totals.totalDiscount.toFixed(2)),
      tax_amount: parseFloat(totals.totalTax.toFixed(2)),
      total_amount: parseFloat(totals.total.toFixed(2)),
      items: sanitizedItems
    };

    await onSubmit(debitNoteData);
    setLoading(false);
  };

  const totals = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="space-y-2">
          <Label htmlFor="supplier" className="text-sm font-medium">Supplier *</Label>
          <SearchableCombobox
            value={formData.supplier_id}
            onSelect={handleSupplierChange}
            placeholder="Select supplier"
            searchPlaceholder="Search suppliers..."
            options={suppliers.map((supplier: any) => ({
              id: supplier.id,
              name: supplier.name,
              subtitle: supplier.supplier_ref || supplier.email
            }))}
            emptyMessage="No suppliers found"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier_invoice" className="text-sm font-medium">Supplier Invoice *</Label>
          <Select 
            value={formData.supplier_invoice_number} 
            onValueChange={handleSupplierInvoiceChange}
            disabled={!formData.supplier_id}
          >
            <SelectTrigger className="h-11 md:h-10 text-base md:text-sm">
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
          <Label htmlFor="debit_note_date" className="text-sm font-medium">Debit Note Date</Label>
          <Input
            id="debit_note_date"
            type="date"
            className="h-11 md:h-10 text-base md:text-sm"
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

      {/* Warehouse and Bin Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="space-y-2">
          <Label htmlFor="warehouse" className="text-sm font-medium">Default Warehouse ID</Label>
          <Input
            id="warehouse"
            value={formData.default_warehouse_id}
            onChange={(e) => setFormData(prev => ({ ...prev, default_warehouse_id: e.target.value }))}
            placeholder="Warehouse ID (optional)"
            disabled={!!selectedInvoice}
            className="h-11 md:h-10 text-base md:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bin" className="text-sm font-medium">Default Bin</Label>
          <Select
            value={formData.default_bin_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, default_bin_id: value }))}
            disabled={!!selectedInvoice}
          >
            <SelectTrigger className="h-11 md:h-10 text-base md:text-sm">
              <SelectValue placeholder="Select bin (optional)" />
            </SelectTrigger>
            <SelectContent>
              {bins.map((bin: any) => (
                <SelectItem key={bin.id} value={bin.id}>
                  {bin.bin_name} ({bin.wh_bin_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Debit Note Items
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={globalGstType === 'intra' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleGlobalGstTypeChange('intra')}
                    className="h-8 text-xs"
                  >
                    Intra-State (CGST+SGST)
                  </Button>
                  <Button
                    type="button"
                    variant={globalGstType === 'inter' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleGlobalGstTypeChange('inter')}
                    className="h-8 text-xs"
                  >
                    Inter-State (IGST)
                  </Button>
                </div>
                <Button 
                  type="button" 
                  onClick={addItem} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Table Header */}
              <div className="bg-gray-50 dark:bg-gray-900/50 border-b grid grid-cols-12 gap-4 px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                <div className="col-span-3">Product</div>
                {selectedInvoice && <div className="col-span-1 text-center">Received</div>}
                <div className={selectedInvoice ? "col-span-1 text-center" : "col-span-2 text-center"}>Quantity</div>
                {selectedInvoice && <div className="col-span-1 text-center">Pending</div>}
                <div className="col-span-1 text-center">Unit Price</div>
                {globalGstType === 'intra' ? (
                  <>
                    <div className="col-span-1 text-center">CGST%</div>
                    <div className="col-span-1 text-center">SGST%</div>
                  </>
                ) : (
                  <div className="col-span-2 text-center">IGST%</div>
                )}
                <div className="col-span-1 text-center">Disc%</div>
                <div className="col-span-1 text-center">Line Total</div>
                <div className="col-span-1 text-center">Action</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-900/25 transition-colors">
                    {/* Product Column */}
                    <div className="col-span-3">
                      {!selectedInvoice ? (
                        <div className="space-y-1">
                           <ProductSearch
                             value={item.product_id}
                             onSelect={(product) => {
                               handleItemChange(index, 'product_id', product.id);
                               handleItemChange(index, 'product_name', product.name);
                               handleItemChange(index, 'product_sku', product.sku);
                               handleItemChange(index, 'unit_price', product.cost_price || 0);
                               const gst = product.gst_percentage ?? 0;
                               handleItemChange(index, 'gst_type', globalGstType);
                               
                               if (globalGstType === 'intra') {
                                 handleItemChange(index, 'cgst_rate', gst ? gst / 2 : 0);
                                 handleItemChange(index, 'sgst_rate', gst ? gst / 2 : 0);
                                 handleItemChange(index, 'igst_rate', 0);
                               } else {
                                 handleItemChange(index, 'cgst_rate', 0);
                                 handleItemChange(index, 'sgst_rate', 0);
                                 handleItemChange(index, 'igst_rate', gst);
                               }
                             }}
                             placeholder="Select product"
                           />
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{item.product_name || "Product"}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{item.product_sku}</div>
                        </div>
                      )}
                    </div>

                    {/* Received Quantity (only for selected invoice) */}
                    {selectedInvoice && (
                      <div className="col-span-1">
                        <div className="text-center py-2 px-3 bg-gray-50 dark:bg-gray-900 rounded-md border">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {item.received_quantity}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Quantity */}
                    <div className={selectedInvoice ? "col-span-1" : "col-span-2"}>
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          max={selectedInvoice ? item.received_quantity : undefined}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                          className={`text-center font-medium border-blue-200 focus:border-blue-500 focus:ring-blue-500/20 ${
                            selectedInvoice && item.quantity > item.received_quantity ? 'border-red-500 focus:border-red-500' : ''
                          }`}
                        />
                        {selectedInvoice && item.quantity > item.received_quantity && (
                          <div className="text-xs text-red-500 mt-1 text-center">Exceeds received</div>
                        )}
                      </div>
                    </div>

                    {/* Pending Quantity (only for selected invoice) */}
                    {selectedInvoice && (
                      <div className="col-span-1">
                        <div className="text-center py-2 px-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border">
                          <span className="font-medium text-amber-900 dark:text-amber-100">
                            {Math.max(0, item.received_quantity - item.quantity)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Unit Price */}
                    <div className="col-span-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="text-center"
                      />
                    </div>

                    {/* GST Fields - Conditional based on global GST type */}
                    {globalGstType === 'intra' ? (
                      <>
                        {/* CGST % */}
                        <div className="col-span-1">
                          <Input
                            type="number"
                            min="0"
                            max="50"
                            step="0.01"
                            value={item.cgst_rate}
                            onChange={(e) => handleItemChange(index, 'cgst_rate', parseFloat(e.target.value) || 0)}
                            className="text-center"
                          />
                        </div>

                        {/* SGST % */}
                        <div className="col-span-1">
                          <Input
                            type="number"
                            min="0"
                            max="50"
                            step="0.01"
                            value={item.sgst_rate}
                            onChange={(e) => handleItemChange(index, 'sgst_rate', parseFloat(e.target.value) || 0)}
                            className="text-center"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="0"
                          max="50"
                          step="0.01"
                          value={item.igst_rate}
                          onChange={(e) => handleItemChange(index, 'igst_rate', parseFloat(e.target.value) || 0)}
                          className="text-center"
                        />
                      </div>
                    )}

                    {/* Discount % */}
                    <div className="col-span-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.discount_percentage}
                        onChange={(e) => handleItemChange(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                        className="text-center"
                      />
                    </div>

                    {/* Line Total */}
                    <div className="col-span-1">
                      <div className="text-center py-2 px-3 bg-green-50 dark:bg-green-950/20 rounded-md border">
                        <span className="font-semibold text-green-900 dark:text-green-100">
                          ₹{item.line_total.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="col-span-1 flex justify-center">
                      {(!selectedInvoice || item.product_id === "") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 p-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Row */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 border-t-2 border-blue-200 px-6 py-4">
                <div className="grid grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Subtotal</div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">₹{totals.subtotal.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Discount</div>
                    <div className="font-semibold text-orange-600 dark:text-orange-400">-₹{totals.totalDiscount.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Tax</div>
                    <div className="font-semibold text-blue-600 dark:text-blue-400">₹{totals.totalTax.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Grand Total</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-400">₹{totals.total.toFixed(2)}</div>
                  </div>
                </div>
              </div>
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
          {loading ? "Saving..." : mode === "add" ? "Create Debit Note" : "Update Debit Note"}
        </Button>
      </div>
    </form>
  );
}