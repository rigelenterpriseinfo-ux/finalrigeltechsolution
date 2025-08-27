import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, ShoppingCart, Truck, Edit, Trash2 } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  total_amount: number;
  notes: string | null;
  supplier: {
    name: string;
    email: string | null;
  };
}

interface Supplier {
  id: string;
  supplier_ref: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pin_code: string | null;
  place_of_supply: string | null;
  credit_time: number | null;
  gst_number: string | null;
  pan_number: string | null;
  bank_name: string | null;
  bank_address: string | null;
  ifsc_code: string | null;
  account_number: string | null;
  account_type: string | null;
  same_as_registered_address: boolean;
  dispatch_address_line1: string | null;
  dispatch_address_line2: string | null;
  dispatch_city: string | null;
  dispatch_state: string | null;
  dispatch_country: string | null;
  dispatch_pin_code: string | null;
  is_active: boolean;
}

export function PurchaseModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPODialog, setShowAddPODialog] = useState(false);
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);
  const [showEditSupplierDialog, setShowEditSupplierDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([
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
    fetchPurchaseOrders();
    fetchSuppliers();
    fetchProducts();
    fetchCompanyData();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

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

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching purchase orders:', error);
        return;
      }

      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching suppliers:', error);
        return;
      }

      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  // Line Items Management Functions
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
          const quantity = parseFloat(updatedItem.quantity) || 0;
          const unitPrice = parseFloat(updatedItem.unit_price) || 0;
          const discountPercentage = parseFloat(updatedItem.discount_percentage) || 0;
          const discountAmount = parseFloat(updatedItem.discount_amount) || 0;
          
          const subtotal = quantity * unitPrice;
          const calculatedDiscountAmount = discountPercentage > 0 ? (subtotal * discountPercentage / 100) : discountAmount;
          const taxableValue = subtotal - calculatedDiscountAmount;
          const gstRate = parseFloat(updatedItem.gst_rate) || 0;
          
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

  const handleAddPurchaseOrder = async (e: React.FormEvent<HTMLFormElement>) => {
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

    try {
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

      // Reset form
      setShowAddPODialog(false);
      setSelectedSupplier(null);
      setLineItems([{
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
      }]);
      fetchPurchaseOrders();
      e.currentTarget.reset();
    } catch (error: any) {
      console.error('Purchase order creation error:', error);
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    }
  };

  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      const formData = new FormData(e.currentTarget);
      const sameAsRegistered = formData.get('same_as_registered_address') === 'on';
      
      const supplierData = {
        name: formData.get('name') as string,
        email: formData.get('email') as string || null,
        phone: formData.get('phone') as string || null,
        contact_person: formData.get('contact_person') as string || null,
        address_line1: formData.get('address_line1') as string || null,
        address_line2: formData.get('address_line2') as string || null,
        city: formData.get('city') as string || null,
        state: formData.get('state') as string || null,
        country: formData.get('country') as string || null,
        pin_code: formData.get('pin_code') as string || null,
        place_of_supply: formData.get('place_of_supply') as string || null,
        credit_time: formData.get('credit_time') ? parseInt(formData.get('credit_time') as string) : null,
        gst_number: formData.get('gst_number') as string || null,
        pan_number: formData.get('pan_number') as string || null,
        bank_name: formData.get('bank_name') as string || null,
        bank_address: formData.get('bank_address') as string || null,
        ifsc_code: formData.get('ifsc_code') as string || null,
        account_number: formData.get('account_number') as string || null,
        account_type: formData.get('account_type') as string || null,
        same_as_registered_address: sameAsRegistered,
        dispatch_address_line1: sameAsRegistered ? formData.get('address_line1') as string || null : formData.get('dispatch_address_line1') as string || null,
        dispatch_address_line2: sameAsRegistered ? formData.get('address_line2') as string || null : formData.get('dispatch_address_line2') as string || null,
        dispatch_city: sameAsRegistered ? formData.get('city') as string || null : formData.get('dispatch_city') as string || null,
        dispatch_state: sameAsRegistered ? formData.get('state') as string || null : formData.get('dispatch_state') as string || null,
        dispatch_country: sameAsRegistered ? formData.get('country') as string || null : formData.get('dispatch_country') as string || null,
        dispatch_pin_code: sameAsRegistered ? formData.get('pin_code') as string || null : formData.get('dispatch_pin_code') as string || null,
        company_id: profile?.company_id,
      };

      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplierData])
        .select();

      if (error) {
        console.error('Supplier creation error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to add supplier",
          variant: "destructive",
        });
        return;
      }

      if (data && data.length > 0) {
        toast({
          title: "Success",
          description: `Supplier "${supplierData.name}" added successfully with reference ${data[0].supplier_ref || 'pending'}`,
        });

        // Reset form and close dialog
        e.currentTarget.reset();
        setShowAddSupplierDialog(false);
        
        // Refresh suppliers list
        await fetchSuppliers();
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding the supplier",
        variant: "destructive",
      });
    }
  };

  const handleEditSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!editingSupplier) return;
    
    const formData = new FormData(e.currentTarget);
    const sameAsRegistered = formData.get('same_as_registered_address') === 'on';
    
    const supplierData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string || null,
      phone: formData.get('phone') as string || null,
      contact_person: formData.get('contact_person') as string || null,
      address_line1: formData.get('address_line1') as string || null,
      address_line2: formData.get('address_line2') as string || null,
      city: formData.get('city') as string || null,
      state: formData.get('state') as string || null,
      country: formData.get('country') as string || null,
      pin_code: formData.get('pin_code') as string || null,
      place_of_supply: formData.get('place_of_supply') as string || null,
      credit_time: formData.get('credit_time') ? parseInt(formData.get('credit_time') as string) : null,
      gst_number: formData.get('gst_number') as string || null,
      pan_number: formData.get('pan_number') as string || null,
      bank_name: formData.get('bank_name') as string || null,
      bank_address: formData.get('bank_address') as string || null,
      ifsc_code: formData.get('ifsc_code') as string || null,
      account_number: formData.get('account_number') as string || null,
      account_type: formData.get('account_type') as string || null,
      same_as_registered_address: sameAsRegistered,
      dispatch_address_line1: sameAsRegistered ? formData.get('address_line1') as string || null : formData.get('dispatch_address_line1') as string || null,
      dispatch_address_line2: sameAsRegistered ? formData.get('address_line2') as string || null : formData.get('dispatch_address_line2') as string || null,
      dispatch_city: sameAsRegistered ? formData.get('city') as string || null : formData.get('dispatch_city') as string || null,
      dispatch_state: sameAsRegistered ? formData.get('state') as string || null : formData.get('dispatch_state') as string || null,
      dispatch_country: sameAsRegistered ? formData.get('country') as string || null : formData.get('dispatch_country') as string || null,
      dispatch_pin_code: sameAsRegistered ? formData.get('pin_code') as string || null : formData.get('dispatch_pin_code') as string || null,
    };

    try {
      const { error } = await supabase
        .from('suppliers')
        .update(supplierData)
        .eq('id', editingSupplier.id);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Supplier updated successfully",
      });

      setShowEditSupplierDialog(false);
      setEditingSupplier(null);
      fetchSuppliers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update supplier",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: false })
        .eq('id', supplierId);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Supplier deactivated successfully",
      });

      fetchSuppliers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to deactivate supplier",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'sent': return 'default';
      case 'confirmed': return 'default';
      case 'received': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const filteredPOs = purchaseOrders.filter(po =>
    po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Purchase Management</h1>
          <p className="text-muted-foreground">Manage purchase orders and suppliers</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAddSupplierDialog} onOpenChange={setShowAddSupplierDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">Add Supplier</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
                <DialogDescription>Complete supplier information including contact details, tax info, and banking details</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSupplier} className="space-y-6">
                {/* Supplier Reference (Auto-generated) */}
                <div className="bg-primary/5 p-4 rounded-lg border">
                  <Label className="text-sm font-medium text-primary">Supplier Reference Number</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Auto-generated format: First 4 letters of vendor name + MMYYYY (e.g., ABCD-082025)
                  </p>
                  <div className="mt-2 p-2 bg-background rounded border text-center text-lg font-mono text-primary">
                    Will be generated automatically upon creation
                  </div>
                </div>

                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-name">Vendor Name *</Label>
                      <Input 
                        id="sup-name" 
                        name="name" 
                        required 
                        placeholder="Enter vendor/supplier name"
                        minLength={2}
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-contact">Contact Person *</Label>
                      <Input 
                        id="sup-contact" 
                        name="contact_person" 
                        required
                        placeholder="Primary contact person"
                        minLength={2}
                        maxLength={50}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-email">Email ID *</Label>
                      <Input 
                        id="sup-email" 
                        name="email" 
                        type="email" 
                        required
                        placeholder="contact@vendor.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-phone">Phone Number *</Label>
                      <Input 
                        id="sup-phone" 
                        name="phone" 
                        required
                        placeholder="+91 XXXXX XXXXX"
                        pattern="[\+\d\s\-\(\)]+"
                        title="Enter a valid phone number"
                      />
                    </div>
                  </div>
                </div>

                {/* Registered Address Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Registered Address</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-address-line1">Address Line 1 *</Label>
                      <Input 
                        id="sup-address-line1" 
                        name="address_line1" 
                        required
                        placeholder="Building name, street address"
                        minLength={5}
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-address-line2">Address Line 2</Label>
                      <Input 
                        id="sup-address-line2" 
                        name="address_line2" 
                        placeholder="Area, landmark (optional)"
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="sup-city">City *</Label>
                      <Input 
                        id="sup-city" 
                        name="city" 
                        required
                        placeholder="City name"
                        minLength={2}
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-state">State *</Label>
                      <Input 
                        id="sup-state" 
                        name="state" 
                        required
                        placeholder="State name"
                        minLength={2}
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-country">Country *</Label>
                      <Input 
                        id="sup-country" 
                        name="country" 
                        required
                        placeholder="Country name"
                        defaultValue="India"
                        minLength={2}
                        maxLength={50}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="sup-pin-code">PIN Code *</Label>
                      <Input 
                        id="sup-pin-code" 
                        name="pin_code" 
                        required
                        placeholder="6-digit PIN code"
                        pattern="[0-9]{6}"
                        title="Enter a valid 6-digit PIN code"
                        maxLength={6}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.replace(/[^0-9]/g, '');
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-place-of-supply">Place of Supply</Label>
                      <Input 
                        id="sup-place-of-supply" 
                        name="place_of_supply" 
                        placeholder="State/UT where goods/services are supplied"
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-credit-time">Credit Time (Days)</Label>
                      <Input 
                        id="sup-credit-time" 
                        name="credit_time" 
                        type="number"
                        min="0"
                        max="365"
                        placeholder="Payment credit days"
                        title="Number of days for payment credit"
                      />
                    </div>
                  </div>
                </div>

                {/* Dispatch Address */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Dispatch Address</h3>
                  <div className="flex items-center space-x-2 mb-4">
                    <input 
                      type="checkbox" 
                      id="same-as-registered" 
                      name="same_as_registered_address"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        const dispatchFields = ['dispatch_address_line1', 'dispatch_address_line2', 'dispatch_city', 'dispatch_state', 'dispatch_country', 'dispatch_pin_code'];
                        const registeredFields = ['address_line1', 'address_line2', 'city', 'state', 'country', 'pin_code'];
                        
                        dispatchFields.forEach((field, index) => {
                          const dispatchField = document.getElementsByName(field)[0] as HTMLInputElement;
                          const registeredField = document.getElementsByName(registeredFields[index])[0] as HTMLInputElement;
                          
                          if (dispatchField) {
                            dispatchField.disabled = isChecked;
                            if (isChecked && registeredField) {
                              dispatchField.value = registeredField.value;
                            } else if (!isChecked) {
                              dispatchField.value = '';
                            }
                          }
                        });
                      }}
                    />
                    <Label htmlFor="same-as-registered" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Same as registered address
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dispatch-address-line1">Dispatch Address Line 1</Label>
                      <Input 
                        id="dispatch-address-line1" 
                        name="dispatch_address_line1" 
                        placeholder="Building name, street address"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dispatch-address-line2">Dispatch Address Line 2</Label>
                      <Input 
                        id="dispatch-address-line2" 
                        name="dispatch_address_line2" 
                        placeholder="Area, landmark (optional)"
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="dispatch-city">Dispatch City</Label>
                      <Input 
                        id="dispatch-city" 
                        name="dispatch_city" 
                        placeholder="City name"
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dispatch-state">Dispatch State</Label>
                      <Input 
                        id="dispatch-state" 
                        name="dispatch_state" 
                        placeholder="State name"
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dispatch-country">Dispatch Country</Label>
                      <Input 
                        id="dispatch-country" 
                        name="dispatch_country" 
                        placeholder="Country name"
                        maxLength={50}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="dispatch-pin-code">Dispatch PIN Code</Label>
                    <Input 
                      id="dispatch-pin-code" 
                      name="dispatch_pin_code" 
                      placeholder="6-digit PIN code"
                      pattern="[0-9]{6}"
                      title="Enter a valid 6-digit PIN code"
                      maxLength={6}
                      onInput={(e) => {
                        const target = e.target as HTMLInputElement;
                        target.value = target.value.replace(/[^0-9]/g, '');
                      }}
                    />
                  </div>
                </div>

                {/* Tax Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Tax Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-gst">GST Number</Label>
                      <Input 
                        id="sup-gst" 
                        name="gst_number" 
                        placeholder="15-digit GST number"
                        pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}"
                        title="Enter a valid GST number (15 characters)"
                        maxLength={15}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.toUpperCase();
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-pan">PAN Number</Label>
                      <Input 
                        id="sup-pan" 
                        name="pan_number" 
                        placeholder="10-digit PAN number"
                        pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                        title="Enter a valid PAN number"
                        maxLength={10}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Banking Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Payment Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-bank-name">Bank Name</Label>
                      <Input 
                        id="sup-bank-name" 
                        name="bank_name" 
                        placeholder="Bank name"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-account-type">Account Type</Label>
                      <Select name="account_type">
                        <SelectTrigger>
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="saving">Saving</SelectItem>
                          <SelectItem value="current">Current</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sup-bank-address">Bank Address</Label>
                    <Textarea 
                      id="sup-bank-address" 
                      name="bank_address" 
                      placeholder="Bank branch address"
                      maxLength={300}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-ifsc">IFSC Code</Label>
                      <Input 
                        id="sup-ifsc" 
                        name="ifsc_code" 
                        placeholder="11-character IFSC code"
                        pattern="[A-Z]{4}0[A-Z0-9]{6}"
                        title="Enter a valid IFSC code"
                        maxLength={11}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sup-account-no">Account Number</Label>
                      <Input 
                        id="sup-account-no" 
                        name="account_number" 
                        placeholder="Bank account number"
                        pattern="[0-9]+"
                        title="Enter a valid account number (numbers only)"
                        maxLength={20}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.replace(/[^0-9]/g, '');
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Validation Guidelines */}
                <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                  <p className="font-medium mb-2">Validation Guidelines:</p>
                  <ul className="space-y-1 text-xs grid grid-cols-2 gap-2">
                    <li>• GST: 15 characters (format: NNAAAANNNNANN)</li>
                    <li>• PAN: 10 characters (format: AAAAANNNNNA)</li>
                    <li>• PIN Code: 6-digit number only</li>
                    <li>• IFSC: 11 characters (format: AAAA0NNNNNN)</li>
                    <li>• Phone: Include country code if international</li>
                    <li>• Account Number: Numbers only</li>
                  </ul>
                </div>

                <Button type="submit" className="w-full">Add Supplier</Button>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showAddPODialog} onOpenChange={setShowAddPODialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Purchase Order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>Create a comprehensive purchase order with line items</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddPurchaseOrder} className="space-y-4">
                <div>
                  <Label htmlFor="supplier_id">Supplier *</Label>
                  <Select 
                    value={selectedSupplier?.id || ''} 
                    onValueChange={(value) => {
                      const supplier = suppliers.find(s => s.id === value);
                      setSelectedSupplier(supplier || null);
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="order_date">Order Date</Label>
                    <Input 
                      id="order_date" 
                      name="order_date" 
                      type="date" 
                      defaultValue={new Date().toISOString().split('T')[0]}
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="expected_date">Expected Date</Label>
                    <Input id="expected_date" name="expected_date" type="date" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="external_po_ref">External PO Reference</Label>
                  <Input id="external_po_ref" name="external_po_ref" placeholder="Customer order/project reference" />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" />
                </div>
                <Button type="submit" className="w-full">Create Purchase Order</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total POs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseOrders.length}</div>
            <p className="text-xs text-muted-foreground">All purchase orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending POs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {purchaseOrders.filter(po => ['draft', 'sent', 'confirmed'].includes(po.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting completion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground">Registered suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${purchaseOrders.reduce((sum, po) => sum + po.total_amount, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">All purchase orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search purchase orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
          <CardDescription>Manage your purchase orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Date</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPOs.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>{po.supplier.name}</TableCell>
                  <TableCell>{new Date(po.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>${po.total_amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(po.status)}>
                      {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPOs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No purchase orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers Management</CardTitle>
          <CardDescription>View and manage your supplier database</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier Ref</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>GST Number</TableHead>
                <TableHead>Credit Days</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium text-primary">
                    {supplier.supplier_ref || 'N/A'}
                  </TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.contact_person || '-'}</TableCell>
                  <TableCell>{supplier.email || '-'}</TableCell>
                  <TableCell>{supplier.phone || '-'}</TableCell>
                  <TableCell>{supplier.gst_number || '-'}</TableCell>
                  <TableCell>{supplier.credit_time ? `${supplier.credit_time} days` : '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setShowEditSupplierDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSupplier(supplier.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {suppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No suppliers found. Add your first supplier to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Supplier Dialog */}
      <Dialog open={showEditSupplierDialog} onOpenChange={setShowEditSupplierDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier information</DialogDescription>
          </DialogHeader>
          {editingSupplier && (
            <form onSubmit={handleEditSupplier} className="space-y-6">
              {/* Supplier Reference (Read-only) */}
              <div className="bg-primary/5 p-4 rounded-lg border">
                <Label className="text-sm font-medium text-primary">Supplier Reference Number</Label>
                <div className="mt-2 p-2 bg-background rounded border text-center text-lg font-mono text-primary">
                  {editingSupplier.supplier_ref || 'Not assigned'}
                </div>
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-sup-name">Vendor Name *</Label>
                    <Input 
                      id="edit-sup-name" 
                      name="name" 
                      required 
                      placeholder="Enter vendor/supplier name"
                      defaultValue={editingSupplier.name}
                      minLength={2}
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-contact">Contact Person *</Label>
                    <Input 
                      id="edit-sup-contact" 
                      name="contact_person" 
                      required
                      placeholder="Primary contact person"
                      defaultValue={editingSupplier.contact_person || ''}
                      minLength={2}
                      maxLength={50}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-sup-email">Email ID *</Label>
                    <Input 
                      id="edit-sup-email" 
                      name="email" 
                      type="email" 
                      required
                      placeholder="contact@vendor.com"
                      defaultValue={editingSupplier.email || ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-phone">Phone Number *</Label>
                    <Input 
                      id="edit-sup-phone" 
                      name="phone" 
                      required
                      placeholder="+91 XXXXX XXXXX"
                      defaultValue={editingSupplier.phone || ''}
                      pattern="[\+\d\s\-\(\)]+"
                      title="Enter a valid phone number"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information - keeping the same structure as Add form */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Registered Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-sup-address-line1">Address Line 1 *</Label>
                    <Input 
                      id="edit-sup-address-line1" 
                      name="address_line1" 
                      required
                      placeholder="Building name, street address"
                      defaultValue={editingSupplier.address_line1 || ''}
                      minLength={5}
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-address-line2">Address Line 2</Label>
                    <Input 
                      id="edit-sup-address-line2" 
                      name="address_line2" 
                      placeholder="Area, landmark (optional)"
                      defaultValue={editingSupplier.address_line2 || ''}
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="edit-sup-city">City *</Label>
                    <Input 
                      id="edit-sup-city" 
                      name="city" 
                      required
                      placeholder="City name"
                      defaultValue={editingSupplier.city || ''}
                      minLength={2}
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-state">State *</Label>
                    <Input 
                      id="edit-sup-state" 
                      name="state" 
                      required
                      placeholder="State name"
                      defaultValue={editingSupplier.state || ''}
                      minLength={2}
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-country">Country *</Label>
                    <Input 
                      id="edit-sup-country" 
                      name="country" 
                      required
                      placeholder="Country name"
                      defaultValue={editingSupplier.country || 'India'}
                      minLength={2}
                      maxLength={50}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="edit-sup-pin-code">PIN Code *</Label>
                    <Input 
                      id="edit-sup-pin-code" 
                      name="pin_code" 
                      required
                      placeholder="6-digit PIN code"
                      defaultValue={editingSupplier.pin_code || ''}
                      pattern="[0-9]{6}"
                      title="Enter a valid 6-digit PIN code"
                      maxLength={6}
                      onInput={(e) => {
                        const target = e.target as HTMLInputElement;
                        target.value = target.value.replace(/[^0-9]/g, '');
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-place-of-supply">Place of Supply</Label>
                    <Input 
                      id="edit-sup-place-of-supply" 
                      name="place_of_supply" 
                      placeholder="State/UT where goods/services are supplied"
                      defaultValue={editingSupplier.place_of_supply || ''}
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-credit-time">Credit Time (Days)</Label>
                    <Input 
                      id="edit-sup-credit-time" 
                      name="credit_time" 
                      type="number"
                      min="0"
                      max="365"
                      placeholder="Payment credit days"
                      defaultValue={editingSupplier.credit_time || ''}
                      title="Number of days for payment credit"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full">Update Supplier</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}