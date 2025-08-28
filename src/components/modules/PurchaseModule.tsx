import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, ShoppingCart, Truck, Edit, Trash2, Eye, Calendar, Package, FileDown, MapPin } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  total_amount: number;
  notes: string | null;
  external_po_ref: string | null;
  delivery_address_line1?: string | null;
  delivery_address_line2?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_country?: string | null;
  delivery_postal_code?: string | null;
  created_at: string;
  updated_at: string;
  supplier: {
    name: string;
    email: string | null;
    supplier_ref: string | null;
  };
  purchase_order_items?: {
    id: string;
    quantity: number;
    item_description: string;
    unit_price: number;
    total_price: number;
  }[];
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

interface LineItem {
  id: number;
  sku_number: string;
  item_description: string;
  hsn_sac_code: string;
  quantity: number;
  unit_of_measure: string;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  value_before_discount: number;
  value_after_discount: number;
  taxable_value: number;
  non_taxable_value: number;
  is_taxable: boolean;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_gst_amount: number;
  line_total: number;
}

// Validation schemas
const lineItemSchema = z.object({
  item_description: z.string().min(1, "Item description is required"),
  hsn_sac_code: z.string().optional(),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unit_price: z.number().min(0, "Unit price cannot be negative"),
  discount_percentage: z.number().min(0).max(100, "Discount percentage must be between 0-100"),
  gst_rate: z.number().min(0).max(30, "GST rate must be between 0-30%"),
});

const purchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, "Please select a supplier"),
  order_date: z.string().min(1, "Order date is required"),
  expected_date: z.string().optional(),
  external_po_ref: z.string().optional(),
  notes: z.string().optional(),
  delivery_address_line1: z.string().optional(),
  delivery_address_line2: z.string().optional(),
  delivery_city: z.string().optional(),
  delivery_state: z.string().optional(),
  delivery_country: z.string().optional(),
  delivery_postal_code: z.string().optional(),
});

export function PurchaseModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPODialog, setShowAddPODialog] = useState(false);
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);
  const [showEditSupplierDialog, setShowEditSupplierDialog] = useState(false);
  const [showEditPODialog, setShowEditPODialog] = useState(false);
  const [showViewPODialog, setShowViewPODialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: 1,
      sku_number: '',
      item_description: '',
      hsn_sac_code: '',
      quantity: 1,
      unit_of_measure: 'pcs',
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      value_before_discount: 0,
      value_after_discount: 0,
      taxable_value: 0,
      non_taxable_value: 0,
      is_taxable: true,
      gst_rate: 18,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_gst_amount: 0,
      line_total: 0,
    }
  ]);

  const form = useForm<z.infer<typeof purchaseOrderSchema>>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplier_id: '',
      order_date: new Date().toISOString().split('T')[0],
      expected_date: '',
      external_po_ref: '',
      notes: '',
    },
  });

  useEffect(() => {
    fetchPurchaseOrders();
    fetchSuppliers();
    fetchCompanyData();
    fetchPurchaseOrderItems();
  }, []);

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name, email, supplier_ref),
          purchase_order_items(
            id,
            quantity,
            item_description,
            unit_price,
            total_price
          )
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

  const fetchPurchaseOrderItems = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          *,
          purchase_order:purchase_orders(po_number)
        `);

      if (error) {
        console.error('Error fetching purchase order items:', error);
        return;
      }

      setPurchaseOrderItems(data || []);
    } catch (error) {
      console.error('Error fetching purchase order items:', error);
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

  // Line Items Management Functions
  const addLineItem = () => {
    const newId = Math.max(...lineItems.map(item => item.id)) + 1;
    setLineItems([...lineItems, {
      id: newId,
      sku_number: '',
      item_description: '',
      hsn_sac_code: '',
      quantity: 1,
      unit_of_measure: 'pcs',
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      value_before_discount: 0,
      value_after_discount: 0,
      taxable_value: 0,
      non_taxable_value: 0,
      is_taxable: true,
      gst_rate: 18,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_gst_amount: 0,
      line_total: 0,
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
        if (['quantity', 'unit_price', 'discount_percentage', 'discount_amount', 'cgst_rate', 'sgst_rate', 'igst_rate', 'is_taxable'].includes(field)) {
          const quantity = parseFloat(updatedItem.quantity.toString()) || 0;
          const unitPrice = parseFloat(updatedItem.unit_price.toString()) || 0;
          const discountPercentage = parseFloat(updatedItem.discount_percentage.toString()) || 0;
          const discountAmount = parseFloat(updatedItem.discount_amount.toString()) || 0;
          const cgstRate = parseFloat(updatedItem.cgst_rate.toString()) || 0;
          const sgstRate = parseFloat(updatedItem.sgst_rate.toString()) || 0;
          const igstRate = parseFloat(updatedItem.igst_rate.toString()) || 0;
          
          // Calculate value before discount
          updatedItem.value_before_discount = quantity * unitPrice;
          
          // Calculate discount amount (use percentage if provided, otherwise use flat amount)
          const calculatedDiscountAmount = discountPercentage > 0 
            ? (updatedItem.value_before_discount * discountPercentage / 100) 
            : discountAmount;
          
          // Calculate value after discount
          updatedItem.value_after_discount = updatedItem.value_before_discount - calculatedDiscountAmount;
          
          // Set discount amount
          updatedItem.discount_amount = calculatedDiscountAmount;
          
          // Determine taxable vs non-taxable values
          if (updatedItem.is_taxable) {
            updatedItem.taxable_value = updatedItem.value_after_discount;
            updatedItem.non_taxable_value = 0;
          } else {
            updatedItem.taxable_value = 0;
            updatedItem.non_taxable_value = updatedItem.value_after_discount;
          }
          
          // Calculate GST amounts based on manually entered rates
          if (updatedItem.is_taxable) {
            updatedItem.cgst_amount = (updatedItem.taxable_value * cgstRate) / 100;
            updatedItem.sgst_amount = (updatedItem.taxable_value * sgstRate) / 100;
            updatedItem.igst_amount = (updatedItem.taxable_value * igstRate) / 100;
          } else {
            updatedItem.cgst_amount = 0;
            updatedItem.sgst_amount = 0;
            updatedItem.igst_amount = 0;
          }
          
          // Calculate total GST amount
          updatedItem.total_gst_amount = updatedItem.cgst_amount + updatedItem.sgst_amount + updatedItem.igst_amount;
          
          // Calculate total GST rate for display
          updatedItem.gst_rate = cgstRate + sgstRate + igstRate;
          
          // Calculate final line total
          updatedItem.line_total = updatedItem.value_after_discount + updatedItem.total_gst_amount;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  // CREATE - Add Purchase Order
  const handleAddPurchaseOrder = async (data: any) => {
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
        order_date: data.order_date,
        expected_date: data.expected_date || null,
        external_po_ref: data.external_po_ref || null,
        notes: data.notes || null,
        delivery_address_line1: data.delivery_address_line1 || null,
        delivery_address_line2: data.delivery_address_line2 || null,
        delivery_city: data.delivery_city || null,
        delivery_state: data.delivery_state || null,
        delivery_country: data.delivery_country || null,
        delivery_postal_code: data.delivery_postal_code || null,
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

      // Insert line items if any
      const lineItemsData = lineItems
        .filter(item => item.item_description.trim())
        .map(item => ({
          purchase_order_id: poInsertData.id,
          product_id: null, // Optional - for free text items
          item_code: null,
          item_description: item.item_description,
          hsn_sac_code: item.hsn_sac_code || null,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          discount_amount: item.discount_amount,
          taxable_value: item.taxable_value,
          gst_rate: item.gst_rate,
          cgst_rate: item.cgst_rate,
          sgst_rate: item.sgst_rate,
          igst_rate: item.igst_rate,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_price: item.line_total,
          is_taxable: item.is_taxable,
          remarks: null,
        }));

      if (lineItemsData.length > 0) {
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(lineItemsData);

        if (itemsError) {
          console.error('Error inserting line items:', itemsError);
        }
      }

      toast({
        title: "Success",
        description: `Purchase order ${poNumber} created successfully`,
      });

      // Reset form
      setShowAddPODialog(false);
      setSelectedSupplier(null);
      form.reset();
      setLineItems([{
        id: 1,
        sku_number: '',
        item_description: '',
        hsn_sac_code: '',
        quantity: 1,
        unit_of_measure: 'pcs',
        unit_price: 0,
        discount_percentage: 0,
        discount_amount: 0,
        value_before_discount: 0,
        value_after_discount: 0,
        taxable_value: 0,
        non_taxable_value: 0,
        is_taxable: true,
        gst_rate: 18,
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_gst_amount: 0,
        line_total: 0,
      }]);
      fetchPurchaseOrders();
      fetchPurchaseOrderItems(); // Refresh items to ensure they show up in the table and PDF
    } catch (error: any) {
      console.error('Purchase order creation error:', error);
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    }
  };

  // UPDATE - Edit Purchase Order
  const handleEditPurchaseOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!editingPO) return;
    
    try {
      const formData = new FormData(e.currentTarget);
      const updateData = {
        order_date: formData.get('order_date') as string,
        expected_date: formData.get('expected_date') as string || null,
        external_po_ref: formData.get('external_po_ref') as string || null,
        notes: formData.get('notes') as string || null,
        status: formData.get('status') as string,
      };

      const { error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', editingPO.id);

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
        description: "Purchase order updated successfully",
      });

      setShowEditPODialog(false);
      setEditingPO(null);
      fetchPurchaseOrders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update purchase order",
        variant: "destructive",
      });
    }
  };

  // DELETE - Delete Purchase Order
  const handleDeletePurchaseOrder = async (poId: string) => {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', poId);

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
        description: "Purchase order deleted successfully",
      });

      fetchPurchaseOrders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete purchase order",
        variant: "destructive",
      });
    }
  };

  // Supplier CRUD operations (simplified for space)
  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      const formData = new FormData(e.currentTarget);
      const supplierData = {
        name: formData.get('name') as string,
        email: formData.get('email') as string || null,
        phone: formData.get('phone') as string || null,
        contact_person: formData.get('contact_person') as string || null,
        company_id: profile?.company_id,
      };

      const { error } = await supabase
        .from('suppliers')
        .insert([supplierData]);

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
        description: "Supplier added successfully",
      });

      setShowAddSupplierDialog(false);
      fetchSuppliers();
      e.currentTarget.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add supplier",
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

  const filteredPOs = purchaseOrders.filter(po => {
    const searchLower = searchTerm.toLowerCase();
    
    // Search in basic PO fields
    const basicMatch = po.po_number.toLowerCase().includes(searchLower) ||
                      po.supplier.name.toLowerCase().includes(searchLower) ||
                      (po.external_po_ref && po.external_po_ref.toLowerCase().includes(searchLower));
    
    // Search in purchase order items
    const poItems = purchaseOrderItems.filter(item => item.purchase_order_id === po.id);
    const itemsMatch = poItems.some(item => (
      (item.item_description && item.item_description.toLowerCase().includes(searchLower)) ||
      (item.item_code && item.item_code.toLowerCase().includes(searchLower)) ||
      (item.hsn_sac_code && item.hsn_sac_code.toLowerCase().includes(searchLower))
    ));
    
    return basicMatch || itemsMatch;
  });

  // Export to Excel function
  const exportToExcel = () => {
    import('xlsx').then((XLSX) => {
      const exportData = filteredPOs.map(po => ({
        'PO Number': po.po_number,
        'Supplier': po.supplier.name,
        'Order Date': new Date(po.order_date).toLocaleDateString(),
        'Expected Date': po.expected_date ? new Date(po.expected_date).toLocaleDateString() : 'Not specified',
        'Total Amount': po.total_amount,
        'Status': po.status,
        'External Reference': po.external_po_ref || '',
        'Notes': po.notes || '',
        'Created At': new Date(po.created_at).toLocaleDateString(),
      }));

      // Create a new workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Orders');

      // Generate Excel file and download
      const fileName = `purchase_orders_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Success",
        description: "Purchase orders exported to Excel successfully",
      });
    }).catch(error => {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Error",
        description: "Failed to export to Excel",
        variant: "destructive",
      });
    });
  };

  // Generate PDF for Purchase Order
  const generatePOPDF = async (po: PurchaseOrder) => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();
      
      // Fetch fresh items for this PO to ensure we have the latest data
      const { data: items, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', po.id);
        
      if (itemsError) {
        console.error('Error fetching purchase order items:', itemsError);
        toast({
          title: "Error",
          description: "Failed to fetch purchase order items for PDF generation",
          variant: "destructive",
        });
        return;
      }
      
      // Colors and styling
      const primaryColor = [59, 130, 246] as [number, number, number]; // Blue
      const secondaryColor = [107, 114, 128] as [number, number, number]; // Gray
      const textColor = [17, 24, 39] as [number, number, number]; // Dark gray
      
      // Header - Company Information
      doc.setFontSize(20);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('PURCHASE ORDER', 20, 25);
      
      // Company details (if available)
      if (companyData) {
        doc.setFontSize(12);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(companyData.name, 20, 40);
        if (companyData.address_line1) {
          doc.text(`${companyData.address_line1}, ${companyData.city}`, 20, 48);
        }
        if (companyData.state && companyData.postal_code) {
          doc.text(`${companyData.state} - ${companyData.postal_code}`, 20, 56);
        }
        if (companyData.phone) {
          doc.text(`Phone: ${companyData.phone}`, 20, 64);
        }
        if (companyData.email) {
          doc.text(`Email: ${companyData.email}`, 20, 72);
        }
        if (companyData.gstn) {
          doc.text(`GSTN: ${companyData.gstn}`, 20, 80);
        }
      }
      
      // PO Details Box
      doc.setFillColor(245, 247, 250);
      doc.rect(120, 35, 70, 45, 'F');
      doc.setFontSize(10);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('PO Number:', 125, 45);
      doc.text('Order Date:', 125, 53);
      doc.text('Expected Date:', 125, 61);
      doc.text('Status:', 125, 69);
      
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFontSize(10);
      doc.text(po.po_number, 155, 45);
      doc.text(new Date(po.order_date).toLocaleDateString(), 155, 53);
      doc.text(po.expected_date ? new Date(po.expected_date).toLocaleDateString() : 'Not specified', 155, 61);
      doc.text(po.status.toUpperCase(), 155, 69);
      
      // Supplier Information
      let yPosition = 95;
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('SUPPLIER INFORMATION', 20, yPosition);
      
      yPosition += 10;
      doc.setFontSize(11);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(`Name: ${po.supplier.name}`, 20, yPosition);
      
      if (po.supplier.email) {
        yPosition += 8;
        doc.text(`Email: ${po.supplier.email}`, 20, yPosition);
      }
      
      // Delivery Address Information
      yPosition += 15;
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('DELIVERY ADDRESS', 20, yPosition);
      
      yPosition += 10;
      doc.setFontSize(11);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      if (po.delivery_address_line1) {
        doc.text(po.delivery_address_line1, 20, yPosition);
        yPosition += 8;
      }
      
      if (po.delivery_address_line2) {
        doc.text(po.delivery_address_line2, 20, yPosition);
        yPosition += 8;
      }
      
      if (po.delivery_city || po.delivery_state || po.delivery_postal_code) {
        const cityStateZip = [po.delivery_city, po.delivery_state, po.delivery_postal_code]
          .filter(Boolean)
          .join(', ');
        doc.text(cityStateZip, 20, yPosition);
        yPosition += 8;
      }
      
      if (po.delivery_country) {
        doc.text(po.delivery_country, 20, yPosition);
        yPosition += 8;
      }
      
      // Line Items Table
      yPosition += 10;
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('LINE ITEMS', 20, yPosition);
      
      // Table headers
      yPosition += 15;
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(20, yPosition - 5, 170, 8, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('S.No', 25, yPosition);
      doc.text('Description', 40, yPosition);
      doc.text('HSN/SAC', 100, yPosition);
      doc.text('Qty', 125, yPosition);
      doc.text('UOM', 140, yPosition);
      doc.text('Rate', 155, yPosition);
      doc.text('Amount', 175, yPosition);
      
      // Table data
      let totalAmount = 0;
      let totalQuantity = 0;
      
      items.forEach((item, index) => {
        yPosition += 10;
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 30;
        }
        
        const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
        totalAmount += lineTotal;
        totalQuantity += item.quantity || 0;
        
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFontSize(8);
        doc.text((index + 1).toString(), 25, yPosition);
        doc.text(item.item_description || '', 40, yPosition, { maxWidth: 55 });
        doc.text(item.hsn_sac_code || '', 100, yPosition);
        doc.text((item.quantity || 0).toString(), 125, yPosition);
        doc.text(item.unit_of_measure || 'pcs', 140, yPosition);
        doc.text(`₹${(item.unit_price || 0).toFixed(2)}`, 155, yPosition);
        doc.text(`₹${lineTotal.toFixed(2)}`, 175, yPosition);
      });
      
      // Summary Section
      yPosition += 20;
      doc.setFillColor(248, 250, 252);
      doc.rect(120, yPosition, 70, 30, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Total Quantity:', 125, yPosition + 8);
      doc.text('Subtotal:', 125, yPosition + 16);
      doc.text('Total Amount:', 125, yPosition + 24);
      
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(totalQuantity.toString(), 165, yPosition + 8);
      doc.text(`₹${po.total_amount.toFixed(2)}`, 165, yPosition + 16);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`₹${po.total_amount.toFixed(2)}`, 165, yPosition + 24);
      
      // Notes section
      if (po.notes) {
        yPosition += 40;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('NOTES', 20, yPosition);
        
        yPosition += 10;
        doc.setFontSize(10);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(po.notes, 20, yPosition, { maxWidth: 170 });
      }
      
      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, pageHeight - 20);
      doc.text('This is a computer generated document.', 20, pageHeight - 15);
      
      // Save the PDF
      const fileName = `PO_${po.po_number}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "Success",
        description: `Purchase Order ${po.po_number} downloaded successfully`,
      });
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Purchase Management
          </h1>
          <p className="text-muted-foreground">Manage purchase orders and suppliers with comprehensive features</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={showAddSupplierDialog} onOpenChange={setShowAddSupplierDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shadow-sm">
                <Truck className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
                <DialogDescription>Add a new supplier to your system</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSupplier} className="space-y-4">
                <div>
                  <Label htmlFor="sup-name">Supplier Name *</Label>
                  <Input id="sup-name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="sup-email">Email</Label>
                  <Input id="sup-email" name="email" type="email" />
                </div>
                <div>
                  <Label htmlFor="sup-phone">Phone</Label>
                  <Input id="sup-phone" name="phone" />
                </div>
                <div>
                  <Label htmlFor="sup-contact">Contact Person</Label>
                  <Input id="sup-contact" name="contact_person" />
                </div>
                <Button type="submit" className="w-full">Add Supplier</Button>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showAddPODialog} onOpenChange={setShowAddPODialog}>
            <DialogTrigger asChild>
              <Button className="shadow-sm bg-gradient-to-r from-primary to-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Create Purchase Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
              <DialogHeader className="border-b pb-4">
                <DialogTitle className="text-xl text-primary">Create Purchase Order</DialogTitle>
                <DialogDescription>Create a comprehensive purchase order with line items and GST calculations</DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddPurchaseOrder)} className="space-y-8">
                  
                  {/* Header Section */}
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 rounded-xl border border-primary/20">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        <ShoppingCart className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-primary">Purchase Order Details</h3>
                        <p className="text-sm text-muted-foreground">Enter the basic purchase order information</p>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <Label className="text-sm font-medium text-muted-foreground">PO Number (Auto-generated)</Label>
                      <div className="mt-2 p-4 bg-background rounded-lg border shadow-sm text-center">
                        <span className="text-2xl font-mono font-bold text-primary">
                          PO-{companyData?.name ? companyData.name.substring(0, 4).toUpperCase() : 'COMP'}###
                        </span>
                      </div>
                    </div>

                    {/* Basic Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="order_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              PO Date *
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="expected_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Expected Date
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <FormField
                        control={form.control}
                        name="external_po_ref"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>External PO Reference</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Customer order/project reference"
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="supplier_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              Select Supplier *
                            </FormLabel>
                            <Select onValueChange={(value) => {
                              field.onChange(value);
                              const supplier = suppliers.find(s => s.id === value);
                              setSelectedSupplier(supplier || null);
                            }} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20">
                                  <SelectValue placeholder="Choose supplier" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-popover border shadow-lg max-h-60">
                                {suppliers.map((supplier) => (
                                  <SelectItem key={supplier.id} value={supplier.id} className="hover:bg-muted/50">
                                    <div className="flex flex-col">
                                      <span className="font-medium">{supplier.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {supplier.supplier_ref || 'No reference'} • {supplier.email || 'No email'}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Delivery Address Section */}
                  <div className="bg-gradient-to-r from-blue/5 to-blue/10 p-6 rounded-xl border border-blue/20">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-blue/10 rounded-xl">
                        <MapPin className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-blue-700">Delivery Address</h3>
                        <p className="text-sm text-muted-foreground">Where should this order be delivered?</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="delivery_address_line1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 1</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Street address, building number"
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="delivery_address_line2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 2</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Apartment, suite, unit, etc. (optional)"
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                      <FormField
                        control={form.control}
                        name="delivery_city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="City"
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="delivery_state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="State/Province"
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="delivery_postal_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Postal/ZIP code"
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-6">
                      <FormField
                        control={form.control}
                        name="delivery_country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Country"
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Line Items Section */}
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-secondary/20 to-secondary/10 p-6 rounded-xl border">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-secondary/10 rounded-xl">
                            <Package className="h-6 w-6 text-secondary-foreground" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold">Line Items</h3>
                            <p className="text-sm text-muted-foreground">Add products/services to your purchase order</p>
                          </div>
                        </div>
                        <Button 
                          type="button" 
                          onClick={addLineItem} 
                          variant="outline" 
                          size="sm"
                          className="bg-background hover:bg-muted shadow-sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>
                      
                      <div className="overflow-x-auto rounded-lg border bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="min-w-[200px] font-semibold">Description *</TableHead>
                              <TableHead className="min-w-[100px] font-semibold">HSN/SAC Code</TableHead>
                              <TableHead className="min-w-[80px] font-semibold">Qty *</TableHead>
                              <TableHead className="min-w-[80px] font-semibold">UOM</TableHead>
                              <TableHead className="min-w-[100px] font-semibold">Rate *</TableHead>
                              <TableHead className="min-w-[80px] font-semibold">Disc%</TableHead>
                              <TableHead className="min-w-[100px] font-semibold">After Disc</TableHead>
                              <TableHead className="min-w-[60px] font-semibold">Taxable</TableHead>
                              <TableHead className="min-w-[80px] font-semibold">GST%</TableHead>
                                <TableHead className="min-w-[80px] font-semibold">CGST</TableHead>
                                <TableHead className="min-w-[80px] font-semibold">SGST</TableHead>
                                <TableHead className="min-w-[80px] font-semibold">IGST</TableHead>
                              <TableHead className="min-w-[100px] font-semibold">Line Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item) => (
                              <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                                <TableCell>
                                  <Input
                                    value={item.item_description}
                                    onChange={(e) => updateLineItem(item.id, 'item_description', e.target.value)}
                                    placeholder="Item description"
                                    required
                                    className="w-full min-w-[200px] border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20"
                                  />
                                  {!item.item_description.trim() && (
                                    <div className="text-xs text-destructive mt-1">Required field</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={item.hsn_sac_code}
                                    onChange={(e) => updateLineItem(item.id, 'hsn_sac_code', e.target.value)}
                                    placeholder="HSN/SAC code"
                                    className="w-full min-w-[100px] border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    min="0.01"
                                    step="0.01"
                                    required
                                    className="w-full min-w-[80px] border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20"
                                  />
                                  {item.quantity <= 0 && (
                                    <div className="text-xs text-destructive mt-1">Must be &gt; 0</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Select 
                                    value={item.unit_of_measure} 
                                    onValueChange={(value) => updateLineItem(item.id, 'unit_of_measure', value)}
                                  >
                                    <SelectTrigger className="w-full min-w-[80px] border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border shadow-lg">
                                      <SelectItem value="pcs">Pieces</SelectItem>
                                      <SelectItem value="kg">Kilogram</SelectItem>
                                      <SelectItem value="ltr">Liter</SelectItem>
                                      <SelectItem value="box">Box</SelectItem>
                                      <SelectItem value="mtr">Meter</SelectItem>
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
                                    className="w-full min-w-[100px] border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20"
                                  />
                                  {item.unit_price < 0 && (
                                    <div className="text-xs text-destructive mt-1">Must be ≥ 0</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={item.discount_percentage}
                                    onChange={(e) => updateLineItem(item.id, 'discount_percentage', parseFloat(e.target.value) || 0)}
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    className="w-full min-w-[80px] border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20"
                                  />
                                  {(item.discount_percentage < 0 || item.discount_percentage > 100) && (
                                    <div className="text-xs text-destructive mt-1">0-100%</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-medium min-w-[100px] p-2 bg-muted/30 rounded text-center">
                                    ₹{item.value_after_discount.toFixed(2)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-center">
                                    <input
                                      type="checkbox"
                                      checked={item.is_taxable}
                                      onChange={(e) => updateLineItem(item.id, 'is_taxable', e.target.checked)}
                                      className="w-5 h-5 accent-primary cursor-pointer"
                                    />
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
                                    disabled={!item.is_taxable}
                                    className="w-full min-w-[80px] border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                                  />
                                  {item.is_taxable && (item.gst_rate < 0 || item.gst_rate > 28) && (
                                    <div className="text-xs text-destructive mt-1">0-28%</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="min-w-[80px] space-y-1">
                                    <Input
                                      type="number"
                                      value={item.cgst_rate}
                                      onChange={(e) => updateLineItem(item.id, 'cgst_rate', parseFloat(e.target.value) || 0)}
                                      placeholder="0"
                                      className="text-center h-8"
                                      min="0"
                                      max="30"
                                      step="0.01"
                                      disabled={!item.is_taxable}
                                    />
                                    <div className="text-xs text-muted-foreground text-center">
                                      ₹{item.cgst_amount.toFixed(2)}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="min-w-[80px] space-y-1">
                                    <Input
                                      type="number"
                                      value={item.sgst_rate}
                                      onChange={(e) => updateLineItem(item.id, 'sgst_rate', parseFloat(e.target.value) || 0)}
                                      placeholder="0"
                                      className="text-center h-8"
                                      min="0"
                                      max="30"
                                      step="0.01"
                                      disabled={!item.is_taxable}
                                    />
                                    <div className="text-xs text-muted-foreground text-center">
                                      ₹{item.sgst_amount.toFixed(2)}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="min-w-[80px] space-y-1">
                                    <Input
                                      type="number"
                                      value={item.igst_rate}
                                      onChange={(e) => updateLineItem(item.id, 'igst_rate', parseFloat(e.target.value) || 0)}
                                      placeholder="0"
                                      className="text-center h-8"
                                      min="0"
                                      max="30"
                                      step="0.01"
                                      disabled={!item.is_taxable}
                                    />
                                    <div className="text-xs text-muted-foreground text-center">
                                      ₹{item.igst_amount.toFixed(2)}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-bold min-w-[100px] p-2 bg-primary/10 text-primary rounded text-center">
                                    ₹{item.line_total.toFixed(2)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-center">
                                    {lineItems.length > 1 && (
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => removeLineItem(item.id)}
                                        className="h-8 w-8 p-0 hover:bg-destructive/90"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Enhanced Total Summary with Cards */}
                      <div className="bg-gradient-to-br from-muted/30 to-muted/50 p-6 rounded-xl border shadow-sm space-y-6 mt-6">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-primary" />
                          <h4 className="text-lg font-semibold text-primary">Purchase Order Summary</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card className="p-4 bg-background/80 backdrop-blur-sm">
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Quantity Details</div>
                              <div className="text-2xl font-bold text-primary">
                                {lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0).toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">Total Units</div>
                            </div>
                          </Card>
                          
                          <Card className="p-4 bg-background/80 backdrop-blur-sm">
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Value Analysis</div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span>Before Discount:</span>
                                  <span className="font-medium">₹{lineItems.reduce((sum, item) => sum + (item.value_before_discount || 0), 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-destructive">
                                  <span>Total Discount:</span>
                                  <span className="font-medium">-₹{lineItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0).toFixed(2)}</span>
                                </div>
                                <Separator className="my-1" />
                                <div className="flex justify-between font-semibold">
                                  <span>After Discount:</span>
                                  <span>₹{lineItems.reduce((sum, item) => sum + (item.value_after_discount || 0), 0).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                          
                          <Card className="p-4 bg-background/80 backdrop-blur-sm">
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Tax Breakdown</div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span>Taxable Value:</span>
                                  <span className="font-medium">₹{lineItems.reduce((sum, item) => sum + (item.taxable_value || 0), 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>CGST:</span>
                                  <span className="font-medium">₹{lineItems.reduce((sum, item) => sum + (item.cgst_amount || 0), 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>SGST:</span>
                                  <span className="font-medium">₹{lineItems.reduce((sum, item) => sum + (item.sgst_amount || 0), 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>IGST:</span>
                                  <span className="font-medium">₹{lineItems.reduce((sum, item) => sum + (item.igst_amount || 0), 0).toFixed(2)}</span>
                                </div>
                                <Separator className="my-1" />
                                <div className="flex justify-between font-semibold text-primary">
                                  <span>Total GST:</span>
                                  <span>₹{lineItems.reduce((sum, item) => sum + (item.total_gst_amount || 0), 0).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                          
                          <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-primary">Grand Total</div>
                              <div className="text-3xl font-bold text-primary">
                                ₹{lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0).toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">Final Amount</div>
                            </div>
                          </Card>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="bg-muted/20 p-6 rounded-xl border">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-semibold">Additional Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Special instructions, terms, or additional information..."
                              rows={4}
                              {...field}
                              className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Submit Actions */}
                  <div className="flex gap-4 pt-6 border-t">
                    <Button 
                      type="submit" 
                      className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg"
                      disabled={!selectedSupplier || lineItems.length === 0 || !lineItems.some(item => item.item_description.trim())}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Create Purchase Order
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setShowAddPODialog(false);
                        form.reset();
                        setSelectedSupplier(null);
                      }} 
                      className="flex-1 h-12"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total POs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{purchaseOrders.length}</div>
            <p className="text-xs text-blue-600">All purchase orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">Pending POs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-800">
              {purchaseOrders.filter(po => ['draft', 'sent', 'confirmed'].includes(po.status)).length}
            </div>
            <p className="text-xs text-amber-600">Awaiting completion</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Active Suppliers</CardTitle>
            <Truck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{suppliers.length}</div>
            <p className="text-xs text-green-600">Registered suppliers</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Total Value</CardTitle>
            <ShoppingCart className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-800">
              ₹{purchaseOrders.reduce((sum, po) => sum + po.total_amount, 0).toFixed(2)}
            </div>
            <p className="text-xs text-purple-600">All purchase orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Search with Export */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by supplier, PO number, item description, or item code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button
          onClick={exportToExcel}
          variant="outline"
          className="flex items-center gap-2 hover:bg-green-50 hover:border-green-200"
          disabled={filteredPOs.length === 0}
        >
          <Package className="h-4 w-4 text-green-600" />
          Export Excel
        </Button>
      </div>

      {/* Purchase Orders Table with CRUD Operations */}
      <Card className="bg-background border shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-xl">Purchase Orders</CardTitle>
          <CardDescription>Complete CRUD operations for purchase orders</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">PO Number</TableHead>
                <TableHead className="font-semibold">Supplier</TableHead>
                <TableHead className="font-semibold">quantity</TableHead>
                <TableHead className="font-semibold">item_description</TableHead>
                <TableHead className="font-semibold">Order Date</TableHead>
                <TableHead className="font-semibold">Expected Date</TableHead>
                <TableHead className="font-semibold">Total Amount</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPOs.map((po) => {
                // Resolve items from separate state by purchase_order_id
                const items = purchaseOrderItems.filter((it) => it.purchase_order_id === po.id);
                
                // Calculate total quantity - ensure we have valid numbers
                const totalQuantity = items.reduce((sum, item) => {
                  const qty = Number(item.quantity) || 0;
                  return sum + qty;
                }, 0);
                
                // Get item descriptions - ensure we have valid strings
                const validDescriptions = items
                  .map(item => item.item_description)
                  .filter(desc => desc && desc.trim().length > 0);
                
                const itemDescDisplay = validDescriptions.length > 0 
                  ? validDescriptions.slice(0, 3).join(', ') + (validDescriptions.length > 3 ? ' + more...' : '')
                  : 'No items found';

                return (
                  <TableRow key={po.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{po.po_number}</TableCell>
                    <TableCell>{po.supplier.name}</TableCell>
                    <TableCell className="font-medium text-center">
                      <Badge variant="outline" className="font-mono">
                        {totalQuantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={itemDescDisplay}>
                        {itemDescDisplay}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(po.order_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="font-medium">₹{po.total_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(po.status)} className="shadow-sm">
                        {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                      </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingPO(po);
                          setShowEditPODialog(true);
                        }}
                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:border-blue-200"
                        title="Edit Purchase Order"
                      >
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setViewingPO(po);
                          setShowViewPODialog(true);
                        }}
                        className="h-8 w-8 p-0 hover:bg-green-50 hover:border-green-200"
                        title="View Purchase Order"
                      >
                        <Eye className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generatePOPDF(po)}
                        className="h-8 w-8 p-0 hover:bg-purple-50 hover:border-purple-200"
                        title="Download PDF"
                      >
                        <FileDown className="h-4 w-4 text-purple-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePurchaseOrder(po.id)}
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200"
                        title="Delete Purchase Order"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
              {filteredPOs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No purchase orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Purchase Order Dialog */}
      <Dialog open={showViewPODialog} onOpenChange={setShowViewPODialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>View purchase order information</DialogDescription>
          </DialogHeader>
          {viewingPO && (
            <div className="space-y-4">
              <div><strong>PO Number:</strong> {viewingPO.po_number}</div>
              <div><strong>Supplier:</strong> {viewingPO.supplier.name}</div>
              <div><strong>Order Date:</strong> {new Date(viewingPO.order_date).toLocaleDateString()}</div>
              <div><strong>Expected Date:</strong> {viewingPO.expected_date ? new Date(viewingPO.expected_date).toLocaleDateString() : 'Not specified'}</div>
              <div><strong>Total Amount:</strong> ₹{viewingPO.total_amount.toFixed(2)}</div>
              <div><strong>Status:</strong> <Badge variant={getStatusColor(viewingPO.status)}>{viewingPO.status}</Badge></div>
              {viewingPO.external_po_ref && <div><strong>External Reference:</strong> {viewingPO.external_po_ref}</div>}
              {viewingPO.notes && <div><strong>Notes:</strong> {viewingPO.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Order Dialog */}
      <Dialog open={showEditPODialog} onOpenChange={setShowEditPODialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
            <DialogDescription>Update purchase order details</DialogDescription>
          </DialogHeader>
          {editingPO && (
            <form onSubmit={handleEditPurchaseOrder} className="space-y-4">
              <div>
                <Label htmlFor="edit-order-date">Order Date</Label>
                <Input 
                  id="edit-order-date" 
                  name="order_date" 
                  type="date" 
                  defaultValue={editingPO.order_date}
                  required 
                />
              </div>
              <div>
                <Label htmlFor="edit-expected-date">Expected Date</Label>
                <Input 
                  id="edit-expected-date" 
                  name="expected_date" 
                  type="date" 
                  defaultValue={editingPO.expected_date || ''}
                />
              </div>
              <div>
                <Label htmlFor="edit-external-ref">External Reference</Label>
                <Input 
                  id="edit-external-ref" 
                  name="external_po_ref" 
                  defaultValue={editingPO.external_po_ref || ''}
                />
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select name="status" defaultValue={editingPO.status}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea 
                  id="edit-notes" 
                  name="notes" 
                  defaultValue={editingPO.notes || ''}
                />
              </div>
              <div className="flex gap-4">
                <Button type="submit" className="flex-1">Update Purchase Order</Button>
                <Button type="button" variant="outline" onClick={() => setShowEditPODialog(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
