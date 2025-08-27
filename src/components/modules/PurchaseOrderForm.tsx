import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

interface PurchaseOrderFormProps {
  suppliers: any[];
  onSuccess: () => void;
  onCancel: () => void;
}

interface LineItem {
  id: number;
  item_code: string;
  item_description: string;
  hsn_sac_code: string;
  quantity: number;
  unit_of_measure: string;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  taxable_value: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
  remarks: string;
}

export function PurchaseOrderForm({ suppliers, onSuccess, onCancel }: PurchaseOrderFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: 1,
      item_code: '',
      item_description: '',
      hsn_sac_code: '',
      quantity: 1,
      unit_of_measure: 'pcs',
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      taxable_value: 0,
      gst_rate: 18,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      line_total: 0,
      remarks: ''
    }
  ]);

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile?.company_id)
        .single();

      if (error) {
        console.error('Error fetching company data:', error);
        return;
      }

      setCompanyData(data);
    } catch (error) {
      console.error('Error fetching company data:', error);
    }
  };

  const generatePONumber = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_po_number', {
        comp_id: profile?.company_id
      });
      
      if (error) {
        console.error('Error generating PO number:', error);
        const timestamp = Date.now().toString().slice(-6);
        return `PO-${timestamp}`;
      }
      
      return data;
    } catch (error) {
      console.error('Error generating PO number:', error);
      const timestamp = Date.now().toString().slice(-6);
      return `PO-${timestamp}`;
    }
  };

  const addLineItem = () => {
    const newId = Math.max(...lineItems.map(item => item.id)) + 1;
    setLineItems([...lineItems, {
      id: newId,
      item_code: '',
      item_description: '',
      hsn_sac_code: '',
      quantity: 1,
      unit_of_measure: 'pcs',
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      taxable_value: 0,
      gst_rate: 18,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      line_total: 0,
      remarks: ''
    }]);
  };

  const removeLineItem = (id: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: number, field: string, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Calculate line totals when relevant fields change
        if (['quantity', 'unit_price', 'discount_percentage', 'discount_amount', 'gst_rate'].includes(field)) {
          const quantity = parseFloat(updatedItem.quantity.toString()) || 0;
          const unitPrice = parseFloat(updatedItem.unit_price.toString()) || 0;
          const discountPercentage = parseFloat(updatedItem.discount_percentage.toString()) || 0;
          const discountAmount = parseFloat(updatedItem.discount_amount.toString()) || 0;
          
          const subtotal = quantity * unitPrice;
          const calculatedDiscountAmount = discountPercentage > 0 ? (subtotal * discountPercentage / 100) : discountAmount;
          const taxableValue = subtotal - calculatedDiscountAmount;
          const gstRate = parseFloat(updatedItem.gst_rate.toString()) || 0;
          
          // Determine if inter-state or intra-state based on company and supplier place of supply
          const isInterState = companyData?.state !== selectedSupplier?.state;
          
          if (isInterState) {
            // Inter-state: IGST
            updatedItem.igst_amount = (taxableValue * gstRate) / 100;
            updatedItem.cgst_amount = 0;
            updatedItem.sgst_amount = 0;
          } else {
            // Intra-state: CGST + SGST
            updatedItem.cgst_amount = (taxableValue * gstRate) / 200; // Half of GST rate
            updatedItem.sgst_amount = (taxableValue * gstRate) / 200; // Half of GST rate
            updatedItem.igst_amount = 0;
          }
          
          updatedItem.discount_amount = calculatedDiscountAmount;
          updatedItem.taxable_value = taxableValue;
          updatedItem.line_total = taxableValue + updatedItem.cgst_amount + updatedItem.sgst_amount + updatedItem.igst_amount;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedSupplier) {
      toast({
        title: "Error",
        description: "Please select a supplier",
        variant: "destructive",
      });
      return;
    }
    
    if (lineItems.length === 0 || !lineItems.some(item => item.item_description.trim())) {
      toast({
        title: "Error", 
        description: "Please add at least one line item",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const formData = new FormData(e.currentTarget);
      const poNumber = await generatePONumber();
      
      // Calculate totals
      const subtotalAmount = lineItems.reduce((sum, item) => sum + (item.taxable_value || 0), 0);
      const totalDiscountAmount = lineItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
      const totalTaxAmount = lineItems.reduce((sum, item) => sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0);
      const totalAmount = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
      
      const poData = {
        po_number: poNumber,
        supplier_id: selectedSupplier.id,
        supplier_code: selectedSupplier.supplier_ref,
        supplier_contact_person: selectedSupplier.contact_person,
        supplier_contact_email: selectedSupplier.email,
        supplier_contact_phone: selectedSupplier.phone,
        supplier_gstin: selectedSupplier.gst_number,
        order_date: formData.get('order_date') as string,
        expected_date: formData.get('expected_date') as string || null,
        external_po_ref: formData.get('external_po_ref') as string || null,
        notes: formData.get('notes') as string || null,
        company_id: profile?.company_id,
        created_by: profile?.id,
        status: 'draft',
        subtotal_amount: subtotalAmount,
        total_discount_amount: totalDiscountAmount,
        total_tax_amount: totalTaxAmount,
        total_amount: totalAmount,
        company_place_of_supply: companyData?.state || null,
      };

      // Insert purchase order
      const { data: poInsertData, error: poError } = await supabase
        .from('purchase_orders')
        .insert([poData])
        .select()
        .single();

      if (poError) {
        toast({
          title: "Error",
          description: poError.message,
          variant: "destructive",
        });
        return;
      }

      // Insert line items
      const lineItemsData = lineItems
        .filter(item => item.item_description.trim())
        .map(item => ({
          purchase_order_id: poInsertData.id,
          item_code: item.item_code || null,
          item_description: item.item_description,
          hsn_sac_code: item.hsn_sac_code || null,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          discount_amount: item.discount_amount,
          taxable_value: item.taxable_value,
          gst_rate: item.gst_rate,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_price: item.line_total,
          remarks: item.remarks || null,
        }));

      if (lineItemsData.length > 0) {
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(lineItemsData);

        if (itemsError) {
          console.error('Error inserting line items:', itemsError);
          // Don't fail the whole operation, just log the error
        }
      }

      toast({
        title: "Success",
        description: `Purchase order ${poNumber} created successfully`,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Purchase order creation error:', error);
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Details Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-semibold border-b pb-2 text-primary">1. Basic Details</h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">PO Number (Auto-generated)</Label>
              <div className="mt-2 p-3 bg-primary/5 rounded border text-center text-lg font-mono text-primary">
                Will be generated: PO-{companyData?.name ? companyData.name.substring(0, 4).toUpperCase() : 'COMP'}###
              </div>
            </div>
            
            <div>
              <Label htmlFor="order_date">PO Date *</Label>
              <Input 
                id="order_date" 
                name="order_date" 
                type="date" 
                defaultValue={new Date().toISOString().split('T')[0]}
                required 
              />
            </div>
            
            <div>
              <Label htmlFor="external_po_ref">Reference No. / External PO Ref</Label>
              <Input 
                id="external_po_ref" 
                name="external_po_ref" 
                placeholder="Customer order/project reference"
              />
            </div>
            
            <div>
              <Label htmlFor="expected_date">Expected Delivery Date</Label>
              <Input id="expected_date" name="expected_date" type="date" />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium mb-3">Company Details</h4>
              <div className="space-y-2 text-sm">
                <div><strong>Company:</strong> {companyData?.name || 'Not available'}</div>
                <div><strong>Address:</strong> {companyData?.address || 'Not available'}</div>
                <div><strong>Email:</strong> {companyData?.email || 'Not available'}</div>
                <div><strong>Phone:</strong> {companyData?.phone || 'Not available'}</div>
                <div><strong>GSTIN:</strong> {companyData?.gstn || 'Not available'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supplier Details Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-semibold border-b pb-2 text-primary">2. Supplier Details</h3>
        
        <div>
          <Label htmlFor="supplier_select">Select Supplier *</Label>
          <Select 
            value={selectedSupplier?.id || ''} 
            onValueChange={(value) => {
              const supplier = suppliers.find(s => s.id === value);
              setSelectedSupplier(supplier || null);
            }}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose supplier from master data" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name} ({supplier.supplier_ref})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {selectedSupplier && (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div><strong>Supplier Code:</strong> {selectedSupplier.supplier_ref}</div>
              <div><strong>Contact Person:</strong> {selectedSupplier.contact_person || 'N/A'}</div>
              <div><strong>Email:</strong> {selectedSupplier.email || 'N/A'}</div>
              <div><strong>Phone:</strong> {selectedSupplier.phone || 'N/A'}</div>
            </div>
            <div className="space-y-3">
              <div><strong>GSTIN:</strong> {selectedSupplier.gst_number || 'N/A'}</div>
              <div><strong>Address:</strong> {selectedSupplier.address_line1 || 'N/A'}</div>
              <div><strong>City:</strong> {selectedSupplier.city || 'N/A'}</div>
              <div><strong>Credit Days:</strong> {selectedSupplier.credit_time ? `${selectedSupplier.credit_time} days` : 'N/A'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Order Details - Line Items Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold border-b pb-2 text-primary">3. Order Details (Line Items)</h3>
          <Button type="button" onClick={addLineItem} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Item Code</TableHead>
                <TableHead className="min-w-[200px]">Description *</TableHead>
                <TableHead className="min-w-[100px]">HSN/SAC</TableHead>
                <TableHead className="min-w-[80px]">Qty *</TableHead>
                <TableHead className="min-w-[80px]">UOM</TableHead>
                <TableHead className="min-w-[100px]">Rate *</TableHead>
                <TableHead className="min-w-[80px]">Disc%</TableHead>
                <TableHead className="min-w-[100px]">Taxable</TableHead>
                <TableHead className="min-w-[80px]">GST%</TableHead>
                <TableHead className="min-w-[100px]">Tax Amt</TableHead>
                <TableHead className="min-w-[100px]">Total</TableHead>
                <TableHead className="min-w-[150px]">Remarks</TableHead>
                <TableHead className="min-w-[50px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Input
                      value={item.item_code}
                      onChange={(e) => updateLineItem(item.id, 'item_code', e.target.value)}
                      placeholder="Item code"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.item_description}
                      onChange={(e) => updateLineItem(item.id, 'item_description', e.target.value)}
                      placeholder="Item description"
                      required
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.hsn_sac_code}
                      onChange={(e) => updateLineItem(item.id, 'hsn_sac_code', e.target.value)}
                      placeholder="HSN/SAC"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      required
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={item.unit_of_measure} 
                      onValueChange={(value) => updateLineItem(item.id, 'unit_of_measure', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pcs">Pcs</SelectItem>
                        <SelectItem value="kg">Kg</SelectItem>
                        <SelectItem value="ltr">Ltr</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="mtr">Mtr</SelectItem>
                        <SelectItem value="sq.ft">Sq.Ft</SelectItem>
                        <SelectItem value="set">Set</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      required
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.discount_percentage}
                      onChange={(e) => updateLineItem(item.id, 'discount_percentage', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">
                      ₹{item.taxable_value.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.gst_rate}
                      onChange={(e) => updateLineItem(item.id, 'gst_rate', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="28"
                      step="0.01"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {companyData?.state !== selectedSupplier?.state ? (
                        <div>IGST: ₹{item.igst_amount.toFixed(2)}</div>
                      ) : (
                        <div>
                          <div>CGST: ₹{item.cgst_amount.toFixed(2)}</div>
                          <div>SGST: ₹{item.sgst_amount.toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-bold">
                      ₹{item.line_total.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.remarks}
                      onChange={(e) => updateLineItem(item.id, 'remarks', e.target.value)}
                      placeholder="Remarks"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Total Summary */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <strong>Subtotal:</strong> ₹{lineItems.reduce((sum, item) => sum + (item.taxable_value || 0), 0).toFixed(2)}
            </div>
            <div>
              <strong>Total Discount:</strong> ₹{lineItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0).toFixed(2)}
            </div>
            <div>
              <strong>Total Tax:</strong> ₹{lineItems.reduce((sum, item) => sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0).toFixed(2)}
            </div>
            <div className="text-lg font-bold">
              <strong>Grand Total:</strong> ₹{lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Notes */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold border-b pb-2 text-primary">4. Additional Information</h3>
        <div>
          <Label htmlFor="notes">Special Instructions / Notes</Label>
          <Textarea 
            id="notes" 
            name="notes" 
            placeholder="Any special instructions, terms & conditions, or additional notes"
            rows={4}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" className="flex-1">
          Create Purchase Order
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}