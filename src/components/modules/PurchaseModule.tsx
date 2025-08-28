import { useState, useEffect, useMemo } from 'react';
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
import { Plus, Search, ShoppingCart, Truck, Edit, Trash2, Eye, Calendar, Package, FileDown, MapPin, Save, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  total_amount: number;
  notes: string | null;
  external_po_ref: string | null;
  same_as_registered_address?: boolean | null;
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

interface PurchaseInvoice {
  id: string;
  purchase_invoice_number: string;
  purchase_invoice_date: string;
  status: string;
  subtotal_amount: number;
  total_discount_amount: number;
  total_tax_amount: number;
  total_amount: number;
  place_of_supply: string | null;
  notes: string | null;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    supplier_ref: string | null;
  };
  purchase_invoice_items?: PurchaseInvoiceItem[];
}

interface PurchaseInvoiceItem {
  id: string;
  sku: string | null;
  product_id: string | null;
  item_code: string | null;
  item_description: string;
  hsn_sac_code: string | null;
  unit_of_measure: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  taxable_value: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_price: number;
  is_taxable: boolean;
  remarks: string | null;
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
  same_as_registered_address: z.boolean().optional(),
  delivery_address_line1: z.string().optional(),
  delivery_address_line2: z.string().optional(),
  delivery_city: z.string().optional(),
  delivery_state: z.string().optional(),
  delivery_country: z.string().optional(),
  delivery_postal_code: z.string().optional(),
});

const purchaseInvoiceSchema = z.object({
  supplier_id: z.string().min(1, "Please select a supplier"),
  purchase_invoice_date: z.string().min(1, "Invoice date is required"),
  purchase_order_id: z.string().optional(),
  place_of_supply: z.string().optional(),
  notes: z.string().optional(),
});

export function PurchaseModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  
  // Pagination state
  const [currentPOPage, setCurrentPOPage] = useState(1);
  const [currentSupplierPage, setCurrentSupplierPage] = useState(1);
  const itemsPerPage = 5;
  
  // Purchase Invoice states
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoiceSortConfig, setInvoiceSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentInvoicePage, setCurrentInvoicePage] = useState(1);
  const invoiceItemsPerPage = 5;
  const [showAddPODialog, setShowAddPODialog] = useState(false);
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);
  const [showEditSupplierDialog, setShowEditSupplierDialog] = useState(false);
  const [showEditPODialog, setShowEditPODialog] = useState(false);
  const [showViewPODialog, setShowViewPODialog] = useState(false);
  const [showAddPIDialog, setShowAddPIDialog] = useState(false);
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

  const [invoiceItems, setInvoiceItems] = useState<PurchaseInvoiceItem[]>([
    {
      id: 'temp-1',
      sku: null,
      product_id: null,
      item_code: '',
      item_description: '',
      hsn_sac_code: '',
      unit_of_measure: 'pcs',
      quantity: 1,
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      taxable_value: 0,
      cgst_rate: 9,
      sgst_rate: 9,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_price: 0,
      is_taxable: true,
      remarks: null,
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

  const invoiceForm = useForm<z.infer<typeof purchaseInvoiceSchema>>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      supplier_id: '',
      purchase_invoice_date: new Date().toISOString().split('T')[0],
      purchase_order_id: '',
      place_of_supply: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (profile?.company_id) {
      fetchPurchaseOrders();
      fetchSuppliers();
      fetchCompanyData();
      fetchPurchaseOrderItems();
      fetchPurchaseInvoicesData();
    }
  }, [profile?.company_id]);

  // Sort function
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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

  const fetchPurchaseInvoicesData = async () => {
    try {
      if (!profile?.company_id) {
        console.error('No company_id found in profile');
        return;
      }

      const { data, error } = await supabase
        .from('purchase_invoices')
        .select(`
          *,
          purchase_invoice_items(
            id,
            item_description,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching purchase invoices:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch purchase invoices',
          variant: 'destructive',
        });
        return;
      }

      console.log('Fetched purchase invoices:', data?.length || 0);
      setPurchaseInvoices(data || []);
    } catch (error) {
      console.error('Error fetching purchase invoices:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch purchase invoices',
        variant: 'destructive',
      });
    }
  };

  // Invoice sort function
  const handleInvoiceSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (invoiceSortConfig && invoiceSortConfig.key === key && invoiceSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setInvoiceSortConfig({ key, direction });
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
        same_as_registered_address: data.same_as_registered_address || false,
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

  // Purchase Invoice Functions
  const handleAddPurchaseInvoice = async (data: z.infer<typeof purchaseInvoiceSchema>) => {
    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .insert({
          company_id: profile?.company_id!,
          supplier_id: data.supplier_id,
          purchase_invoice_date: data.purchase_invoice_date,
          place_of_supply: data.place_of_supply || null,
          notes: data.notes || null,
          subtotal_amount: invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0),
          total_discount_amount: invoiceItems.reduce((sum, item) => sum + item.discount_amount, 0),
          total_tax_amount: invoiceItems.reduce((sum, item) => sum + item.cgst_amount + item.sgst_amount + item.igst_amount, 0),
          total_amount: invoiceItems.reduce((sum, item) => sum + item.total_price, 0),
          created_by: profile?.id!,
          purchase_invoice_number: '', // Will be auto-generated by trigger
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert invoice items
      const itemsToInsert = invoiceItems.map(item => ({
        purchase_invoice_id: invoiceData.id,
        product_id: item.product_id === 'manual' ? null : item.product_id,
        item_description: item.item_description,
        hsn_sac_code: item.hsn_sac_code,
        unit_of_measure: item.unit_of_measure,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percentage: item.discount_percentage,
        discount_amount: item.discount_amount,
        taxable_value: item.taxable_value,
        cgst_rate: item.cgst_rate,
        sgst_rate: item.sgst_rate,
        igst_rate: item.igst_rate,
        cgst_amount: item.cgst_amount,
        sgst_amount: item.sgst_amount,
        igst_amount: item.igst_amount,
        total_price: item.total_price,
        is_taxable: item.is_taxable,
        remarks: item.remarks,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_invoice_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: "Purchase invoice created successfully!",
      });

      setShowAddPIDialog(false);
      invoiceForm.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to create purchase invoice",
        variant: "destructive",
      });
    }
  };

  const addInvoiceItem = () => {
    setInvoiceItems([...invoiceItems, {
      id: `temp-${Date.now()}`,
      sku: null,
      product_id: null,
      item_code: '',
      item_description: '',
      hsn_sac_code: '',
      unit_of_measure: 'pcs',
      quantity: 1,
      unit_price: 0,
      discount_percentage: 0,
      discount_amount: 0,
      taxable_value: 0,
      cgst_rate: 9,
      sgst_rate: 9,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_price: 0,
      is_taxable: true,
      remarks: null,
    }]);
  };

  const handleInvoiceItemChange = (index: number, field: string, value: any) => {
    const newItems = [...invoiceItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate totals
    const item = newItems[index];
    const subtotal = item.quantity * item.unit_price;
    item.discount_amount = (subtotal * item.discount_percentage) / 100;
    item.taxable_value = subtotal - item.discount_amount;
    item.cgst_amount = (item.taxable_value * item.cgst_rate) / 100;
    item.sgst_amount = (item.taxable_value * item.sgst_rate) / 100;
    item.igst_amount = (item.taxable_value * item.igst_rate) / 100;
    item.total_price = item.taxable_value + item.cgst_amount + item.sgst_amount + item.igst_amount;
    
    setInvoiceItems(newItems);
  };

  const removeInvoiceItem = (index: number) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
    }
  };

  // UPDATE - Edit Purchase Order
  const handleEditPurchaseOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!editingPO) return;
    
    try {
      const formData = new FormData(e.currentTarget);
      
      // Calculate totals from line items
      const totalQty = lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const subtotalAmount = lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
      const totalDiscountAmount = lineItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
      const totalTaxAmount = lineItems.reduce((sum, item) => 
        sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0);
      const grandTotal = subtotalAmount - totalDiscountAmount + totalTaxAmount;
      
      const updateData = {
        order_date: formData.get('order_date') as string,
        expected_date: formData.get('expected_date') as string || null,
        external_po_ref: formData.get('external_po_ref') as string || null,
        notes: formData.get('notes') as string || null,
        status: formData.get('status') as string,
        // Delivery address fields
        delivery_address_line1: formData.get('delivery_address_line1') as string || null,
        delivery_address_line2: formData.get('delivery_address_line2') as string || null,
        delivery_city: formData.get('delivery_city') as string || null,
        delivery_state: formData.get('delivery_state') as string || null,
        delivery_country: formData.get('delivery_country') as string || null,
        delivery_postal_code: formData.get('delivery_postal_code') as string || null,
        same_as_registered_address: formData.get('same_as_registered_address') === 'on',
        // Totals
        subtotal_amount: subtotalAmount,
        total_discount_amount: totalDiscountAmount,
        total_tax_amount: totalTaxAmount,
        total_amount: grandTotal,
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

      // Update line items
      if (lineItems.length > 0) {
        // Delete existing items first
        await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', editingPO.id);

        // Insert updated items
        const itemsToInsert = lineItems.map(item => ({
          purchase_order_id: editingPO.id,
          item_description: item.item_description,
          hsn_sac_code: item.hsn_sac_code,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          discount_amount: item.discount_amount,
          taxable_value: item.value_after_discount,
          is_taxable: item.is_taxable,
          gst_rate: item.gst_rate,
          cgst_rate: item.cgst_rate,
          sgst_rate: item.sgst_rate,
          igst_rate: item.igst_rate,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_price: item.line_total,
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Error updating purchase order items:', itemsError);
        }
      }

      toast({
        title: "Success",
        description: "Purchase order updated successfully",
      });

      setShowEditPODialog(false);
      setEditingPO(null);
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
          gst_rate: 0,
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

// Supplier CRUD operations
  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!profile?.company_id) {
      toast({
        title: "Error",
        description: "Company information not found. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const formData = new FormData(e.currentTarget);
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
        gst_number: formData.get('gst_number') as string || null,
        pan_number: formData.get('pan_number') as string || null,
        credit_time: formData.get('credit_time') ? parseInt(formData.get('credit_time') as string) : null,
        bank_name: formData.get('bank_name') as string || null,
        bank_address: formData.get('bank_address') as string || null,
        account_number: formData.get('account_number') as string || null,
        account_type: formData.get('account_type') as string || null,
        ifsc_code: formData.get('ifsc_code') as string || null,
        same_as_registered_address: formData.get('same_as_registered_address') === 'on',
        dispatch_address_line1: formData.get('dispatch_address_line1') as string || null,
        dispatch_address_line2: formData.get('dispatch_address_line2') as string || null,
        dispatch_city: formData.get('dispatch_city') as string || null,
        dispatch_state: formData.get('dispatch_state') as string || null,
        dispatch_country: formData.get('dispatch_country') as string || null,
        dispatch_pin_code: formData.get('dispatch_pin_code') as string || null,
        company_id: profile.company_id,
      };

      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplierData])
        .select();

      if (error) {
        console.error('Supplier insert error:', error);
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
      await fetchSuppliers(); // Wait for suppliers to be fetched
      
      // Reset form safely
      try {
        e.currentTarget.reset();
      } catch (formResetError) {
        console.warn('Form reset error:', formResetError);
      }
      
    } catch (error: any) {
      console.error('Unexpected error in handleAddSupplier:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add supplier",
        variant: "destructive",
      });
    }
  };

  const handleEditSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!editingSupplier) return;
    
    try {
      const formData = new FormData(e.currentTarget);
      const updateData = {
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
        gst_number: formData.get('gst_number') as string || null,
        pan_number: formData.get('pan_number') as string || null,
        credit_time: formData.get('credit_time') ? parseInt(formData.get('credit_time') as string) : null,
        bank_name: formData.get('bank_name') as string || null,
        bank_address: formData.get('bank_address') as string || null,
        account_number: formData.get('account_number') as string || null,
        account_type: formData.get('account_type') as string || null,
        ifsc_code: formData.get('ifsc_code') as string || null,
        same_as_registered_address: formData.get('same_as_registered_address') === 'on',
        dispatch_address_line1: formData.get('dispatch_address_line1') as string || null,
        dispatch_address_line2: formData.get('dispatch_address_line2') as string || null,
        dispatch_city: formData.get('dispatch_city') as string || null,
        dispatch_state: formData.get('dispatch_state') as string || null,
        dispatch_country: formData.get('dispatch_country') as string || null,
        dispatch_pin_code: formData.get('dispatch_pin_code') as string || null,
      };

      const { error } = await supabase
        .from('suppliers')
        .update(updateData)
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
        description: "Failed to delete supplier",
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

  const filteredPOs = useMemo(() => {
    let filtered = purchaseOrders.filter(po => {
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

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'po_number':
            aValue = a.po_number;
            bValue = b.po_number;
            break;
          case 'supplier':
            aValue = a.supplier?.name || '';
            bValue = b.supplier?.name || '';
            break;
          case 'order_date':
            aValue = new Date(a.order_date);
            bValue = new Date(b.order_date);
            break;
          case 'expected_date':
            aValue = a.expected_date ? new Date(a.expected_date) : new Date(0);
            bValue = b.expected_date ? new Date(b.expected_date) : new Date(0);
            break;
          case 'total_amount':
            aValue = a.total_amount;
            bValue = b.total_amount;
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'quantity':
            const aItems = purchaseOrderItems.filter(it => it.purchase_order_id === a.id);
            const bItems = purchaseOrderItems.filter(it => it.purchase_order_id === b.id);
            aValue = aItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            bValue = bItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [purchaseOrders, purchaseOrderItems, searchTerm, sortConfig]);

  // Reset to first page when search or sort changes for Purchase Orders
  useEffect(() => {
    setCurrentPOPage(1);
  }, [searchTerm, sortConfig]);

  // Purchase Orders Pagination
  const totalPOPages = Math.ceil(filteredPOs.length / itemsPerPage);
  const startPOIndex = (currentPOPage - 1) * itemsPerPage;
  const endPOIndex = startPOIndex + itemsPerPage;
  const currentPOs = filteredPOs.slice(startPOIndex, endPOIndex);

  // Map of supplier id to name for quick lookup
  const supplierNameById = useMemo(() => {
    const map: Record<string, string> = {};
    suppliers.forEach((s) => {
      if (s.id) map[s.id] = s.name;
    });
    return map;
  }, [suppliers]);

  // Purchase Invoices Filtering and Sorting
  const filteredInvoices = useMemo(() => {
    let filtered = purchaseInvoices.filter(invoice => {
      const supplierName = supplierNameById[invoice.supplier_id]?.toLowerCase() || '';
      const invoiceNumber = invoice.purchase_invoice_number?.toLowerCase() || '';
      const items = invoice.purchase_invoice_items || [];
      const itemDescriptions = items.map(item => item.item_description?.toLowerCase() || '').join(' ');
      
      const searchTermLower = invoiceSearchTerm.toLowerCase();
      
      return (
        supplierName.includes(searchTermLower) ||
        invoiceNumber.includes(searchTermLower) ||
        itemDescriptions.includes(searchTermLower)
      );
    });

    // Apply sorting
    if (invoiceSortConfig) {
      filtered.sort((a, b) => {
        let aValue = '';
        let bValue = '';
        
        switch (invoiceSortConfig.key) {
          case 'invoice_number':
            aValue = a.purchase_invoice_number || '';
            bValue = b.purchase_invoice_number || '';
            break;
          case 'supplier':
            aValue = supplierNameById[a.supplier_id] || '';
            bValue = supplierNameById[b.supplier_id] || '';
            break;
          case 'date':
            aValue = a.purchase_invoice_date || '';
            bValue = b.purchase_invoice_date || '';
            break;
          case 'amount':
            return invoiceSortConfig.direction === 'asc' 
              ? a.total_amount - b.total_amount 
              : b.total_amount - a.total_amount;
          default:
            return 0;
        }
        
        if (invoiceSortConfig.direction === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });
    }

    return filtered;
  }, [purchaseInvoices, invoiceSearchTerm, invoiceSortConfig, supplierNameById]);

  // Reset to first page when search or sort changes for Purchase Invoices
  useEffect(() => {
    setCurrentInvoicePage(1);
  }, [invoiceSearchTerm, invoiceSortConfig]);

  // Purchase Invoices Pagination
  const totalInvoicePages = Math.ceil(filteredInvoices.length / invoiceItemsPerPage);
  const startInvoiceIndex = (currentInvoicePage - 1) * invoiceItemsPerPage;
  const endInvoiceIndex = startInvoiceIndex + invoiceItemsPerPage;
  const currentInvoices = filteredInvoices.slice(startInvoiceIndex, endInvoiceIndex);

  // Suppliers Pagination (for the suppliers we need to filter them too)
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.supplier_ref && supplier.supplier_ref.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const totalSupplierPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const startSupplierIndex = (currentSupplierPage - 1) * itemsPerPage;
  const endSupplierIndex = startSupplierIndex + itemsPerPage;
  const currentSuppliers = filteredSuppliers.slice(startSupplierIndex, endSupplierIndex);

  // Pagination handlers for Purchase Orders
  const goToPOPage = (page: number) => {
    setCurrentPOPage(Math.max(1, Math.min(page, totalPOPages)));
  };

  const goToPOPrevious = () => {
    setCurrentPOPage(prev => Math.max(1, prev - 1));
  };

  const goToPONext = () => {
    setCurrentPOPage(prev => Math.min(totalPOPages, prev + 1));
  };

  // Pagination handlers for Suppliers
  const goToSupplierPage = (page: number) => {
    setCurrentSupplierPage(Math.max(1, Math.min(page, totalSupplierPages)));
  };

  const goToSupplierPrevious = () => {
    setCurrentSupplierPage(prev => Math.max(1, prev - 1));
  };

  const goToSupplierNext = () => {
    setCurrentSupplierPage(prev => Math.min(totalSupplierPages, prev + 1));
  };

  // Generate page numbers for pagination
  const getPageNumbers = (currentPage: number, totalPages: number) => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

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
      console.info('[PDF] Using PO template v2 for', po.po_number);
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      // Fetch fresh items for this PO to ensure we have the latest data
      const { data: items, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', po.id);

      if (itemsError) {
        console.error('Error fetching purchase order items:', itemsError);
        toast({
          title: 'Error',
          description: 'Failed to fetch purchase order items for PDF generation',
          variant: 'destructive',
        });
        return;
      }

      // Get supplier details
      const supplierDetails = suppliers.find((s) => s.name === po.supplier?.name);

      // Layout helpers
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2; // 180mm on A4
      let y = 15;

      // Header band
      doc.setFillColor(33, 37, 41); // dark header
      doc.rect(0, 0, pageWidth, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('PURCHASE ORDER', pageWidth / 2, 11.5, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      // Company (Buyer) box and PO info box
      y = 24;
      const colWidth = (contentWidth - 5) / 2; // two columns with small gap

      // Buyer box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Buyer', margin, y);
      y += 3.5;
      doc.setLineWidth(0.3);
      doc.rect(margin, y, colWidth, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      let lineY = y + 5;
      if (companyData) {
        doc.text(companyData.name || 'Company Name', margin + 3, lineY);
        lineY += 4;
        const address = [
          companyData.address_line1,
          companyData.address_line2,
          [companyData.city, companyData.state, companyData.postal_code].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join(', ');
        if (address) {
          const addrLines = doc.splitTextToSize(address, colWidth - 6);
          addrLines.forEach((ln: string) => {
            doc.text(ln, margin + 3, lineY);
            lineY += 4;
          });
        }
        if (companyData.gstn) {
          doc.text(`GSTIN: ${companyData.gstn}`, margin + 3, lineY);
          lineY += 4;
        }
        const contact = [companyData.email, companyData.phone].filter(Boolean).join(' | ');
        if (contact) doc.text(`Contact: ${contact}`, margin + 3, lineY);
      }

      // PO details box (right column)
      const rightX = margin + colWidth + 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Order Details', rightX, 24);
      doc.rect(rightX, 27.5, colWidth, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const orderLines = [
        `PO No.: ${po.po_number}`,
        `PO Date: ${new Date(po.order_date).toLocaleDateString('en-GB')}`,
        `Expected Date: ${po.expected_date ? new Date(po.expected_date).toLocaleDateString('en-GB') : '-'}`,
        `External Ref: ${po.external_po_ref || '-'}`,
      ];
      let oy = 27.5 + 5;
      orderLines.forEach((t) => {
        doc.text(t, rightX + 3, oy);
        oy += 6;
      });

      y = 27.5 + 28 + 6;

      // Supplier and Delivery in two columns
      doc.setFont('helvetica', 'bold');
      doc.text('Supplier', margin, y);
      doc.text('Delivery Details', rightX, y);
      y += 3.5;
      doc.setLineWidth(0.3);
      doc.rect(margin, y, colWidth, 26);
      doc.rect(rightX, y, colWidth, 26);

      // Supplier content
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      let sy = y + 5;
      const supplierName = po.supplier?.name || supplierDetails?.name || '-';
      doc.text(supplierName, margin + 3, sy);
      sy += 4;
      if (supplierDetails) {
        const supplierAddress = [
          supplierDetails.address_line1,
          supplierDetails.address_line2,
          [supplierDetails.city, supplierDetails.state, supplierDetails.pin_code].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join(', ');
        if (supplierAddress) {
          const sAddr = doc.splitTextToSize(supplierAddress, colWidth - 6);
          sAddr.forEach((ln: string) => {
            doc.text(ln, margin + 3, sy);
            sy += 4;
          });
        }
        if (supplierDetails.gst_number) {
          doc.text(`GSTIN: ${supplierDetails.gst_number}`, margin + 3, sy);
          sy += 4;
        }
        const sContact = [supplierDetails.contact_person, supplierDetails.phone].filter(Boolean).join(' | ');
        if (sContact) doc.text(`Contact: ${sContact}`, margin + 3, sy);
      }

      // Delivery content
      let dy = y + 5;
      let deliveryAddress = 'Same as Buyer';
      if (!po.same_as_registered_address && po.delivery_address_line1) {
        deliveryAddress = [
          po.delivery_address_line1,
          po.delivery_address_line2,
          [po.delivery_city, po.delivery_state, po.delivery_postal_code].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join(', ');
      } else if (companyData?.address_line1) {
        deliveryAddress = [
          companyData.address_line1,
          companyData.address_line2,
          [companyData.city, companyData.state, companyData.postal_code].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join(', ');
      }
      const dLines = [
        `Address: ${deliveryAddress}`,
        `Place of Supply: ${supplierDetails?.place_of_supply || '-'}`,
      ];
      dLines.forEach((t) => {
        const wrapped = doc.splitTextToSize(t, colWidth - 6);
        wrapped.forEach((ln: string) => {
          doc.text(ln, rightX + 3, dy);
          dy += 4;
        });
      });

      // Compute item totals for summary
      let totalQty = 0;
      let preDiscountTotal = 0;
      let totalDiscount = 0;
      let taxableSubtotal = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let grandTotal = 0;

      const preparedItems = (items || []).map((item, index) => {
        const qty = Number(item.quantity) || 0;
        const rate = Number(item.unit_price) || 0;
        const amount = qty * rate;
        const discountAmt = Number(item.discount_amount) || 0;
        const taxable = typeof item.taxable_value === 'number' ? Number(item.taxable_value) : Math.max(amount - discountAmt, 0);
        const cgstRate = Number(item.cgst_rate) || (Number(item.gst_rate) ? Number(item.gst_rate) / 2 : 0);
        const sgstRate = Number(item.sgst_rate) || (Number(item.gst_rate) ? Number(item.gst_rate) / 2 : 0);
        const cgstAmt = typeof item.cgst_amount === 'number' ? Number(item.cgst_amount) : (taxable * cgstRate) / 100;
        const sgstAmt = typeof item.sgst_amount === 'number' ? Number(item.sgst_amount) : (taxable * sgstRate) / 100;
        const lineTotal = typeof item.total_price === 'number' ? Number(item.total_price) : taxable + cgstAmt + sgstAmt;

        totalQty += qty;
        preDiscountTotal += amount;
        totalDiscount += discountAmt;
        taxableSubtotal += taxable;
        cgstTotal += cgstAmt;
        sgstTotal += sgstAmt;
        grandTotal += lineTotal;

        return {
          index: index + 1,
          code: item.item_code || '',
          desc: item.item_description || '',
          hsn: item.hsn_sac_code || '',
          qty,
          uom: item.unit_of_measure || 'pcs',
          rate,
          disc: discountAmt,
          taxable,
          cgstRate,
          sgstRate,
          cgstAmt,
          sgstAmt,
          amount: lineTotal,
        };
      });

      // Items table header
      y = y + 26 + 10; // after supplier/delivery boxes
      const tableX = margin;
      const tableW = contentWidth;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setFillColor(240, 240, 240);
      doc.rect(tableX, y, tableW, 8, 'F');
      const headers: string[] = [
        'S.No',
        'Item Code',
        'Description',
        'HSN/SAC',
        'Qty',
        'UOM',
        'Rate',
        'Disc',
        'Taxable',
        'CGST',
        'SGST',
        'Amount',
      ];
      // Column widths must sum to tableW (180mm)
      const colW = [10, 18, 42, 18, 12, 12, 16, 14, 18, 14, 14, 22];
      let xCursor = tableX + 2;
      headers.forEach((h, i) => {
        doc.text(h, xCursor, y + 5);
        xCursor += colW[i];
      });
      // Draw header border
      doc.setDrawColor(0, 0, 0);
      doc.rect(tableX, y, tableW, 8);
      y += 8;

      // Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      preparedItems.forEach((row, idx) => {
        // alternating background
        if (idx % 2 === 1) {
          doc.setFillColor(248, 248, 248);
          doc.rect(tableX, y, tableW, 8, 'F');
        }
        let cx = tableX + 2;
        const values = [
          String(row.index),
          row.code || '-',
          row.desc || '-',
          row.hsn || '-',
          String(row.qty),
          row.uom,
          row.rate.toFixed(2),
          row.disc.toFixed(2),
          row.taxable.toFixed(2),
          `${row.cgstRate}%\n${row.cgstAmt.toFixed(0)}`,
          `${row.sgstRate}%\n${row.sgstAmt.toFixed(0)}`,
          row.amount.toFixed(2),
        ];

        values.forEach((val, i) => {
          if (i === 2) {
            const wrapped = doc.splitTextToSize(val, colW[i] - 4);
            doc.text(wrapped[0], cx, y + 4.5);
          } else if (i === 9 || i === 10) {
            // show rate% on first line and amount below
            const [rateText, amtText] = val.split('\n');
            doc.text(rateText, cx, y + 3.2);
            doc.text(amtText, cx, y + 6.6);
          } else {
            doc.text(val, cx, y + 4.5);
          }
          cx += colW[i];
        });
        // row border bottom
        doc.line(tableX, y + 8, tableX + tableW, y + 8);
        y += 8;
      });
      // table outer border sides
      doc.line(tableX, y - 8 * preparedItems.length, tableX, y);
      doc.line(tableX + tableW, y - 8 * preparedItems.length, tableX + tableW, y);

      // Summary boxes: left small metrics, right amount recap
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', margin, y);
      y += 3.5;

      const leftBoxH = 20;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.rect(margin, y, colWidth, leftBoxH);
      const lns = [
        `Total Quantity: ${totalQty}`,
        `Pre-discount Total: ₹ ${preDiscountTotal.toFixed(2)}`,
        `Total Discount: ₹ ${totalDiscount.toFixed(2)}`,
      ];
      let ly = y + 6;
      lns.forEach((t) => {
        doc.text(t, margin + 3, ly);
        ly += 6;
      });

      // Amount recap (right)
      const recX = rightX;
      doc.rect(recX, y, colWidth, leftBoxH);
      const rows = [
        ['Taxable Subtotal', taxableSubtotal.toFixed(2)],
        ['CGST Total', cgstTotal.toFixed(2)],
        ['SGST Total', sgstTotal.toFixed(2)],
        ['Grand Total (INR)', grandTotal.toFixed(2)],
      ];
      let ry = y + 6;
      rows.forEach((r, i) => {
        if (i === rows.length - 1) {
          doc.setFillColor(220, 220, 220);
          doc.rect(recX, ry - 4, colWidth, 8, 'F');
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }
        doc.text(r[0], recX + 3, ry);
        doc.text(r[1], recX + colWidth - 3, ry, { align: 'right' });
        // underline row
        doc.line(recX, ry + 2, recX + colWidth, ry + 2);
        ry += 6;
      });

      y += leftBoxH + 10;

      // Terms & Authorization
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Terms & Conditions', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const terms = [
        '1. Materials must be as per specification. Any deviation requires written approval.',
        '2. Payment terms: 30% advance, balance within 30 days of delivery.',
        '3. Delivery challan and tax invoice are mandatory with shipment.',
      ];
      terms.forEach((t) => {
        const wrapped = doc.splitTextToSize(t, contentWidth);
        wrapped.forEach((ln: string) => {
          doc.text(ln, margin, y);
          y += 4;
        });
      });

      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Authorized Signatory', margin, y + 15);
      doc.line(margin, y + 14, margin + 50, y + 14);

      // Save the PDF
      const fileName = `Purchase_Order_${po.po_number}.pdf`;
      doc.save(fileName);

      toast({
        title: 'Success',
        description: `Purchase Order ${po.po_number} downloaded successfully`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF',
        variant: 'destructive',
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
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl text-primary">Add New Supplier</DialogTitle>
                <DialogDescription>Add a new supplier with complete details to your system</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSupplier} className="space-y-6">
                {/* Basic Information */}
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 rounded-xl border border-primary/20">
                  <h3 className="text-lg font-semibold text-primary mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-name">Supplier Name *</Label>
                      <Input id="sup-name" name="name" required className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-email">Email</Label>
                      <Input id="sup-email" name="email" type="email" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-phone">Phone</Label>
                      <Input id="sup-phone" name="phone" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-contact">Contact Person</Label>
                      <Input id="sup-contact" name="contact_person" className="mt-1" />
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="bg-gradient-to-r from-blue/5 to-blue/10 p-6 rounded-xl border border-blue/20">
                  <h3 className="text-lg font-semibold text-blue-700 mb-4">Address Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-address1">Address Line 1</Label>
                      <Input id="sup-address1" name="address_line1" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-address2">Address Line 2</Label>
                      <Input id="sup-address2" name="address_line2" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-city">City</Label>
                      <Input id="sup-city" name="city" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-state">State</Label>
                      <Input id="sup-state" name="state" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-country">Country</Label>
                      <Input id="sup-country" name="country" defaultValue="India" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-pin">Pin Code</Label>
                      <Input id="sup-pin" name="pin_code" className="mt-1" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label htmlFor="sup-pos">Place of Supply</Label>
                    <Input id="sup-pos" name="place_of_supply" className="mt-1" />
                  </div>
                </div>

                {/* Tax Information */}
                <div className="bg-gradient-to-r from-green/5 to-green/10 p-6 rounded-xl border border-green/20">
                  <h3 className="text-lg font-semibold text-green-700 mb-4">Tax Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="sup-gst">GST Number</Label>
                      <Input id="sup-gst" name="gst_number" className="mt-1" placeholder="e.g., 27AAAAA0000A1Z5" />
                    </div>
                    <div>
                      <Label htmlFor="sup-pan">PAN Number</Label>
                      <Input id="sup-pan" name="pan_number" className="mt-1" placeholder="e.g., AAAAA0000A" />
                    </div>
                    <div>
                      <Label htmlFor="sup-credit">Credit Period (Days)</Label>
                      <Input id="sup-credit" name="credit_time" type="number" className="mt-1" placeholder="30" />
                    </div>
                  </div>
                </div>

                {/* Banking Information */}
                <div className="bg-gradient-to-r from-orange/5 to-orange/10 p-6 rounded-xl border border-orange/20">
                  <h3 className="text-lg font-semibold text-orange-700 mb-4">Banking Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-bank">Bank Name</Label>
                      <Input id="sup-bank" name="bank_name" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-bank-address">Bank Address</Label>
                      <Input id="sup-bank-address" name="bank_address" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-account">Account Number</Label>
                      <Input id="sup-account" name="account_number" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-account-type">Account Type</Label>
                      <Select name="account_type">
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="savings">Savings</SelectItem>
                          <SelectItem value="current">Current</SelectItem>
                          <SelectItem value="od">Overdraft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1">
                      <Label htmlFor="sup-ifsc">IFSC Code</Label>
                      <Input id="sup-ifsc" name="ifsc_code" className="mt-1" placeholder="e.g., ICIC0001234" />
                    </div>
                  </div>
                </div>

                {/* Dispatch Address */}
                <div className="bg-gradient-to-r from-purple/5 to-purple/10 p-6 rounded-xl border border-purple/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-purple-700">Dispatch Address</h3>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="same-address"
                        name="same_as_registered_address"
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="same-address" className="text-sm">Same as registered address</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sup-dispatch1">Dispatch Address Line 1</Label>
                      <Input id="sup-dispatch1" name="dispatch_address_line1" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-dispatch2">Dispatch Address Line 2</Label>
                      <Input id="sup-dispatch2" name="dispatch_address_line2" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-dispatch-city">Dispatch City</Label>
                      <Input id="sup-dispatch-city" name="dispatch_city" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-dispatch-state">Dispatch State</Label>
                      <Input id="sup-dispatch-state" name="dispatch_state" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-dispatch-country">Dispatch Country</Label>
                      <Input id="sup-dispatch-country" name="dispatch_country" defaultValue="India" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="sup-dispatch-pin">Dispatch Pin Code</Label>
                      <Input id="sup-dispatch-pin" name="dispatch_pin_code" className="mt-1" />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white py-3">
                  Add Supplier
                </Button>
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
          </Dialog>

          <Dialog open={showAddPIDialog} onOpenChange={setShowAddPIDialog}>
            <DialogTrigger asChild>
              <Button className="shadow-sm bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white">
                <FileDown className="h-4 w-4 mr-2" />
                Purchase Invoice Entry
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

                  {/* Selected Supplier Details Display */}
                  {selectedSupplier && (
                    <div className="mt-6 p-6 bg-gradient-to-r from-green/5 to-green/10 rounded-xl border border-green/20">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green/10 rounded-lg">
                          <Truck className="h-5 w-5 text-green-600" />
                        </div>
                        <h4 className="text-lg font-semibold text-green-700">Selected Supplier Details</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Supplier Name</Label>
                            <p className="text-base font-semibold text-foreground">{selectedSupplier.name}</p>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Contact Person</Label>
                            <p className="text-base text-foreground">{selectedSupplier.contact_person || 'Not specified'}</p>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                            <p className="text-base text-foreground">{selectedSupplier.phone || 'Not specified'}</p>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">GST Number</Label>
                            <p className="text-base font-mono text-foreground">{selectedSupplier.gst_number || 'Not specified'}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Complete Address</Label>
                            <div className="text-base text-foreground">
                              {selectedSupplier.address_line1 && <p>{selectedSupplier.address_line1}</p>}
                              {selectedSupplier.address_line2 && <p>{selectedSupplier.address_line2}</p>}
                              <p>
                                {[selectedSupplier.city, selectedSupplier.state, selectedSupplier.pin_code]
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                              {selectedSupplier.country && <p>{selectedSupplier.country}</p>}
                              {!selectedSupplier.address_line1 && !selectedSupplier.city && (
                                <p className="text-muted-foreground">Address not specified</p>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                            <p className="text-base text-foreground">{selectedSupplier.email || 'Not specified'}</p>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Supplier Reference</Label>
                            <p className="text-base font-mono text-foreground">
                              <Badge variant="outline" className="text-xs">
                                {selectedSupplier.supplier_ref || 'Not assigned'}
                              </Badge>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                   )}

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
                    
                    {/* Same as Registered Address Checkbox */}
                    <FormField
                      control={form.control}
                      name="same_as_registered_address"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-6">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value || false}
                              onChange={(e) => {
                                field.onChange(e.target.checked);
                                if (e.target.checked && companyData) {
                                  // Auto-populate with company address
                                  form.setValue('delivery_address_line1', companyData.address_line1 || '');
                                  form.setValue('delivery_address_line2', companyData.address_line2 || '');
                                  form.setValue('delivery_city', companyData.city || '');
                                  form.setValue('delivery_state', companyData.state || '');
                                  form.setValue('delivery_country', companyData.country || '');
                                  form.setValue('delivery_postal_code', companyData.postal_code || '');
                                } else if (!e.target.checked) {
                                  // Clear fields when unchecked
                                  form.setValue('delivery_address_line1', '');
                                  form.setValue('delivery_address_line2', '');
                                  form.setValue('delivery_city', '');
                                  form.setValue('delivery_state', '');
                                  form.setValue('delivery_country', '');
                                  form.setValue('delivery_postal_code', '');
                                }
                              }}
                              className="w-5 h-5 accent-primary cursor-pointer"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-medium cursor-pointer">
                              Same as Registered Address
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Use company's registered address for delivery
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                    
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
                                disabled={form.watch('same_as_registered_address')}
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
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
                                disabled={form.watch('same_as_registered_address')}
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
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
                                disabled={form.watch('same_as_registered_address')}
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
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
                                disabled={form.watch('same_as_registered_address')}
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
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
                                disabled={form.watch('same_as_registered_address')}
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
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
                                disabled={form.watch('same_as_registered_address')}
                                {...field}
                                className="bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
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

          {/* Purchase Invoice Dialog */}
          <Dialog open={showAddPIDialog} onOpenChange={setShowAddPIDialog}>
            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl text-green-700">Purchase Invoice Entry</DialogTitle>
              <DialogDescription>Create a purchase invoice with multiple items and automatic inventory updates</DialogDescription>
            </DialogHeader>
            
            <Form {...invoiceForm}>
              <form onSubmit={invoiceForm.handleSubmit(handleAddPurchaseInvoice)} className="space-y-8">
                
                {/* Header Section */}
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
                  <div className="flex items-center gap-3 mb-6">
                    <FileDown className="h-6 w-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-green-800">Invoice Information</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField
                      control={invoiceForm.control}
                      name="purchase_invoice_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-green-700">Invoice Date *</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field}
                              className="border-green-200 focus:border-green-400"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="place_of_supply"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-green-700">Place of Supply</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter place of supply"
                              {...field}
                              className="border-green-200 focus:border-green-400"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-green-700">Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Additional notes..."
                              {...field}
                              rows={2}
                              className="border-green-200 focus:border-green-400"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Supplier Selection */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3 mb-6">
                    <Truck className="h-6 w-6 text-blue-600" />
                    <h3 className="text-lg font-semibold text-blue-800">Supplier Information</h3>
                  </div>
                  
                  <FormField
                    control={invoiceForm.control}
                    name="supplier_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-700">Select Supplier *</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            const supplier = suppliers.find(s => s.id === value);
                            setSelectedSupplier(supplier || null);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="border-blue-200 focus:border-blue-400">
                              <SelectValue placeholder="Choose a supplier for this invoice" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{supplier.name}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {supplier.supplier_ref} • {supplier.email}
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

                  {selectedSupplier && (
                    <Card className="mt-4 p-4 bg-blue-50/50 border-blue-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong className="text-blue-800">Contact:</strong> {selectedSupplier.contact_person || 'N/A'}
                        </div>
                        <div>
                          <strong className="text-blue-800">Phone:</strong> {selectedSupplier.phone || 'N/A'}
                        </div>
                        <div>
                          <strong className="text-blue-800">Email:</strong> {selectedSupplier.email || 'N/A'}
                        </div>
                        <div>
                          <strong className="text-blue-800">GST:</strong> {selectedSupplier.gst_number || 'N/A'}
                        </div>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Invoice Items Section */}
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Package className="h-6 w-6 text-purple-600" />
                      <h3 className="text-lg font-semibold text-purple-800">Invoice Items</h3>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addInvoiceItem}
                      className="border-purple-300 text-purple-700 hover:bg-purple-100"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {invoiceItems.map((item, index) => (
                      <Card key={item.id} className="p-4 bg-white/80 border-purple-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-purple-700">SKU</Label>
                            <Input
                              value={item.sku || ''}
                              onChange={(e) => handleInvoiceItemChange(index, 'sku', e.target.value)}
                              placeholder="Enter SKU"
                              className="border-purple-200"
                            />
                          </div>

                          <div>
                            <Label className="text-purple-700">Description *</Label>
                            <Input
                              value={item.item_description}
                              onChange={(e) => handleInvoiceItemChange(index, 'item_description', e.target.value)}
                              placeholder="Enter item description"
                              className="border-purple-200"
                            />
                          </div>

                          <div>
                            <Label className="text-purple-700">HSN Code</Label>
                            <Input
                              value={item.hsn_sac_code || ''}
                              onChange={(e) => handleInvoiceItemChange(index, 'hsn_sac_code', e.target.value)}
                              placeholder="HSN code"
                              className="border-purple-200"
                            />
                          </div>

                          <div>
                            <Label className="text-purple-700">Unit</Label>
                            <Select 
                              value={item.unit_of_measure}
                              onValueChange={(value) => handleInvoiceItemChange(index, 'unit_of_measure', value)}
                            >
                              <SelectTrigger className="border-purple-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pcs">Pieces</SelectItem>
                                <SelectItem value="kg">Kilograms</SelectItem>
                                <SelectItem value="gm">Grams</SelectItem>
                                <SelectItem value="ltr">Liters</SelectItem>
                                <SelectItem value="mtr">Meters</SelectItem>
                                <SelectItem value="box">Box</SelectItem>
                                <SelectItem value="set">Set</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                          <div>
                            <Label className="text-purple-700">Quantity *</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleInvoiceItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="border-purple-200"
                            />
                          </div>

                          <div>
                            <Label className="text-purple-700">Unit Price *</Label>
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => handleInvoiceItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="border-purple-200"
                            />
                          </div>

                          <div>
                            <Label className="text-purple-700">Discount %</Label>
                            <Input
                              type="number"
                              value={item.discount_percentage}
                              onChange={(e) => handleInvoiceItemChange(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              step="0.01"
                              className="border-purple-200"
                            />
                          </div>

                          <div>
                            <Label className="text-purple-700">CGST Rate %</Label>
                            <Input
                              type="number"
                              value={item.cgst_rate}
                              onChange={(e) => handleInvoiceItemChange(index, 'cgst_rate', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="30"
                              step="0.01"
                              className="border-purple-200"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                          <div>
                            <Label className="text-purple-700">SGST Rate %</Label>
                            <Input
                              type="number"
                              value={item.sgst_rate}
                              onChange={(e) => handleInvoiceItemChange(index, 'sgst_rate', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="30"
                              step="0.01"
                              className="border-purple-200"
                            />
                          </div>

                          <div>
                            <Label className="text-purple-700">IGST Rate %</Label>
                            <Input
                              type="number"
                              value={item.igst_rate}
                              onChange={(e) => handleInvoiceItemChange(index, 'igst_rate', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="30"
                              step="0.01"
                              className="border-purple-200"
                            />
                          </div>

                          <div>
                            <Label className="text-purple-700">Total Price</Label>
                            <Input
                              value={`₹${item.total_price.toFixed(2)}`}
                              disabled
                              className="border-purple-200 bg-purple-50"
                            />
                          </div>

                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeInvoiceItem(index)}
                              disabled={invoiceItems.length === 1}
                              className="w-full border-red-300 text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Invoice Summary */}
                <div className="bg-gradient-to-br from-muted/30 to-muted/50 p-6 rounded-xl border shadow-sm space-y-6">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h4 className="text-lg font-semibold text-primary">Invoice Summary</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 bg-background/80">
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">Total Quantity</div>
                        <div className="text-2xl font-bold text-primary">
                          {invoiceItems.reduce((sum, item) => sum + (item.quantity || 0), 0).toFixed(2)}
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-4 bg-background/80">
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">Subtotal</div>
                        <div className="text-2xl font-bold text-green-600">
                          ₹{invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-4 bg-background/80">
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">Total Tax</div>
                        <div className="text-2xl font-bold text-orange-600">
                          ₹{invoiceItems.reduce((sum, item) => sum + item.cgst_amount + item.sgst_amount + item.igst_amount, 0).toFixed(2)}
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-4 bg-background/80">
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">Grand Total</div>
                        <div className="text-3xl font-bold text-primary">
                          ₹{invoiceItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex gap-4 pt-6 border-t">
                  <Button 
                    type="submit" 
                    className="flex-1 h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg"
                    disabled={!selectedSupplier || invoiceItems.length === 0 || !invoiceItems.some(item => item.item_description.trim())}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Create Purchase Invoice
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowAddPIDialog(false);
                      invoiceForm.reset();
                      setSelectedSupplier(null);
                      setInvoiceItems([{
                        id: 'temp-1',
                        sku: null,
                        product_id: null,
                        item_code: '',
                        item_description: '',
                        hsn_sac_code: '',
                        unit_of_measure: 'pcs',
                        quantity: 1,
                        unit_price: 0,
                        discount_percentage: 0,
                        discount_amount: 0,
                        taxable_value: 0,
                        cgst_rate: 9,
                        sgst_rate: 9,
                        igst_rate: 0,
                        cgst_amount: 0,
                        sgst_amount: 0,
                        igst_amount: 0,
                        total_price: 0,
                        is_taxable: true,
                        remarks: null,
                      }]);
                    }} 
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
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

      {/* Purchase Invoices Section */}
      <div className="space-y-4">
        {/* Search for Purchase Invoices */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by invoice number, supplier, item..."
              value={invoiceSearchTerm}
              onChange={(e) => setInvoiceSearchTerm(e.target.value)}
              className="pl-10 bg-background border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Purchase Invoices Table */}
        <Card className="bg-background border shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-xl">Purchase Invoices</CardTitle>
            <CardDescription>Latest purchase invoice entries with search and sorting</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleInvoiceSort('invoice_number')}
                    >
                      Invoice Number
                      {invoiceSortConfig?.key === 'invoice_number' ? (
                        invoiceSortConfig.direction === 'asc' ? (
                          <ArrowUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowDown className="ml-1 h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleInvoiceSort('supplier')}
                    >
                      Supplier
                      {invoiceSortConfig?.key === 'supplier' ? (
                        invoiceSortConfig.direction === 'asc' ? (
                          <ArrowUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowDown className="ml-1 h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleInvoiceSort('date')}
                    >
                      Date
                      {invoiceSortConfig?.key === 'date' ? (
                        invoiceSortConfig.direction === 'asc' ? (
                          <ArrowUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowDown className="ml-1 h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold">Items</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleInvoiceSort('amount')}
                    >
                      Amount
                      {invoiceSortConfig?.key === 'amount' ? (
                        invoiceSortConfig.direction === 'asc' ? (
                          <ArrowUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowDown className="ml-1 h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {invoiceSearchTerm ? 'No invoices found matching your search.' : 'No purchase invoices available.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentInvoices.map((invoice) => {
                    const items = invoice.purchase_invoice_items || [];
                    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
                    
                    // Get item descriptions - ensure we have valid strings
                    const validDescriptions = items
                      .map(item => item.item_description)
                      .filter(desc => desc && desc.trim().length > 0);
                    
                    const itemDescDisplay = validDescriptions.length > 0 
                      ? validDescriptions.slice(0, 2).join(', ') + (validDescriptions.length > 2 ? ' + more...' : '')
                      : 'No items found';

                    return (
                      <TableRow key={invoice.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{invoice.purchase_invoice_number}</TableCell>
                        <TableCell>{supplierNameById[invoice.supplier_id] || 'Unknown'}</TableCell>
                        <TableCell>{new Date(invoice.purchase_invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={itemDescDisplay}>
                            {itemDescDisplay}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {totalQuantity} items
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              invoice.status === 'received' ? 'default' :
                              invoice.status === 'pending' ? 'secondary' :
                              'outline'
                            }
                            className="capitalize"
                          >
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{invoice.total_amount?.toLocaleString() || '0'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Purchase Invoices Pagination */}
        {filteredInvoices.length > invoiceItemsPerPage && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {startInvoiceIndex + 1} to {Math.min(endInvoiceIndex, filteredInvoices.length)} of {filteredInvoices.length} invoices
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentInvoicePage(currentInvoicePage - 1)}
                disabled={currentInvoicePage === 1}
                className="h-8 px-3"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalInvoicePages }, (_, i) => i + 1)
                  .filter(page => {
                    const distance = Math.abs(page - currentInvoicePage);
                    return distance === 0 || distance === 1 || page === 1 || page === totalInvoicePages;
                  })
                  .map((page, index, array) => (
                    <div key={page} className="flex items-center">
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="px-2 text-muted-foreground">...</span>
                      )}
                      <Button
                        variant={currentInvoicePage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentInvoicePage(page)}
                        className="h-8 w-8 p-0"
                      >
                        {page}
                      </Button>
                    </div>
                  ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentInvoicePage(currentInvoicePage + 1)}
                disabled={currentInvoicePage === totalInvoicePages}
                className="h-8 px-3"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Search with Export for Purchase Orders */}
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
                <TableHead className="font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('po_number')}
                  >
                    PO Number
                    {sortConfig?.key === 'po_number' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ArrowDown className="ml-1 h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('supplier')}
                  >
                    Supplier
                    {sortConfig?.key === 'supplier' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ArrowDown className="ml-1 h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('quantity')}
                  >
                    Quantity
                    {sortConfig?.key === 'quantity' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ArrowDown className="ml-1 h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="font-semibold">Item Description</TableHead>
                <TableHead className="font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('order_date')}
                  >
                    Order Date
                    {sortConfig?.key === 'order_date' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ArrowDown className="ml-1 h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('expected_date')}
                  >
                    Expected Date
                    {sortConfig?.key === 'expected_date' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ArrowDown className="ml-1 h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('total_amount')}
                  >
                    Total Amount
                    {sortConfig?.key === 'total_amount' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ArrowDown className="ml-1 h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('status')}
                  >
                    Status
                    {sortConfig?.key === 'status' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ArrowDown className="ml-1 h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPOs.map((po) => {
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
                        onClick={async () => {
                          setEditingPO(po);
                          
                          // Fetch and load existing line items for editing
                          const { data: existingItems } = await supabase
                            .from('purchase_order_items')
                            .select('*')
                            .eq('purchase_order_id', po.id);
                          
                          if (existingItems && existingItems.length > 0) {
                            const mappedItems = existingItems.map((item, index) => ({
                              id: index + 1,
                              sku_number: '',
                              item_description: item.item_description || '',
                              hsn_sac_code: item.hsn_sac_code || '',
                              quantity: item.quantity || 1,
                              unit_of_measure: item.unit_of_measure || 'pcs',
                              unit_price: item.unit_price || 0,
                              discount_percentage: item.discount_percentage || 0,
                              discount_amount: item.discount_amount || 0,
                              value_before_discount: (item.quantity || 1) * (item.unit_price || 0),
                              value_after_discount: item.taxable_value || 0,
                              taxable_value: item.taxable_value || 0,
                              non_taxable_value: 0,
                              is_taxable: item.is_taxable ?? true,
                              gst_rate: item.gst_rate || 0,
                              cgst_rate: item.cgst_rate || 0,
                              sgst_rate: item.sgst_rate || 0,
                              igst_rate: item.igst_rate || 0,
                              cgst_amount: item.cgst_amount || 0,
                              sgst_amount: item.sgst_amount || 0,
                              igst_amount: item.igst_amount || 0,
                              total_gst_amount: (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0),
                              line_total: item.total_price || 0,
                            }));
                            setLineItems(mappedItems);
                          } else {
                            // Reset to default single item if no items exist
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
                              gst_rate: 0,
                              cgst_rate: 0,
                              sgst_rate: 0,
                              igst_rate: 0,
                              cgst_amount: 0,
                              sgst_amount: 0,
                              igst_amount: 0,
                              total_gst_amount: 0,
                              line_total: 0,
                            }]);
                          }
                          
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
              {currentPOs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {filteredPOs.length === 0 ? 'No purchase orders found' : 'No purchase orders on this page'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {/* Professional Pagination Controls for Purchase Orders */}
          {filteredPOs.length > 0 && totalPOPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-border">
              <div className="flex items-center text-sm text-muted-foreground">
                <span>
                  Showing {startPOIndex + 1} to {Math.min(endPOIndex, filteredPOs.length)} of {filteredPOs.length} purchase orders
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Previous Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPOPrevious}
                  disabled={currentPOPage === 1}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                {/* Page Numbers */}
                <div className="flex items-center space-x-1">
                  {getPageNumbers(currentPOPage, totalPOPages).map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-3 py-2 text-sm text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPOPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPOPage(page as number)}
                        className={`px-3 py-2 text-sm font-medium transition-colors ${
                          currentPOPage === page
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {page}
                      </Button>
                    )
                  ))}
                </div>
                
                {/* Next Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPONext}
                  disabled={currentPOPage === totalPOPages}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Management Section */}
      <Card className="bg-background border shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-xl">Supplier Management</CardTitle>
          <CardDescription>Complete CRUD operations for suppliers</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Supplier Ref</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Contact Person</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">City</TableHead>
                <TableHead className="font-semibold">GST Number</TableHead>
                <TableHead className="font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium font-mono text-xs">
                    <Badge variant="outline">{supplier.supplier_ref || 'N/A'}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.contact_person || '-'}</TableCell>
                  <TableCell>{supplier.email || '-'}</TableCell>
                  <TableCell>{supplier.phone || '-'}</TableCell>
                  <TableCell>{supplier.city || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{supplier.gst_number || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setShowEditSupplierDialog(true);
                        }}
                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:border-blue-200"
                        title="Edit Supplier"
                      >
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSupplier(supplier.id)}
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200"
                        title="Delete Supplier"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {currentSuppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {filteredSuppliers.length === 0 ? 'No suppliers found' : 'No suppliers on this page'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {/* Professional Pagination Controls for Suppliers */}
          {filteredSuppliers.length > 0 && totalSupplierPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-border">
              <div className="flex items-center text-sm text-muted-foreground">
                <span>
                  Showing {startSupplierIndex + 1} to {Math.min(endSupplierIndex, filteredSuppliers.length)} of {filteredSuppliers.length} suppliers
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Previous Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToSupplierPrevious}
                  disabled={currentSupplierPage === 1}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                {/* Page Numbers */}
                <div className="flex items-center space-x-1">
                  {getPageNumbers(currentSupplierPage, totalSupplierPages).map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-3 py-2 text-sm text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentSupplierPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToSupplierPage(page as number)}
                        className={`px-3 py-2 text-sm font-medium transition-colors ${
                          currentSupplierPage === page
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {page}
                      </Button>
                    )
                  ))}
                </div>
                
                {/* Next Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToSupplierNext}
                  disabled={currentSupplierPage === totalSupplierPages}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Supplier Dialog */}
      <Dialog open={showEditSupplierDialog} onOpenChange={setShowEditSupplierDialog}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier details</DialogDescription>
          </DialogHeader>
          {editingSupplier && (
            <form onSubmit={handleEditSupplier} className="space-y-6">
              {/* Basic Information */}
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 rounded-xl border border-primary/20">
                <h3 className="text-lg font-semibold text-primary mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-sup-name">Supplier Name *</Label>
                    <Input 
                      id="edit-sup-name" 
                      name="name" 
                      required 
                      defaultValue={editingSupplier.name}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-email">Email</Label>
                    <Input 
                      id="edit-sup-email" 
                      name="email" 
                      type="email" 
                      defaultValue={editingSupplier.email || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-phone">Phone</Label>
                    <Input 
                      id="edit-sup-phone" 
                      name="phone" 
                      defaultValue={editingSupplier.phone || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-contact">Contact Person</Label>
                    <Input 
                      id="edit-sup-contact" 
                      name="contact_person" 
                      defaultValue={editingSupplier.contact_person || ''}
                      className="mt-1" 
                    />
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="bg-gradient-to-r from-blue/5 to-blue/10 p-6 rounded-xl border border-blue/20">
                <h3 className="text-lg font-semibold text-blue-700 mb-4">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-sup-address1">Address Line 1</Label>
                    <Input 
                      id="edit-sup-address1" 
                      name="address_line1" 
                      defaultValue={editingSupplier.address_line1 || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-address2">Address Line 2</Label>
                    <Input 
                      id="edit-sup-address2" 
                      name="address_line2" 
                      defaultValue={editingSupplier.address_line2 || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-city">City</Label>
                    <Input 
                      id="edit-sup-city" 
                      name="city" 
                      defaultValue={editingSupplier.city || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-state">State</Label>
                    <Input 
                      id="edit-sup-state" 
                      name="state" 
                      defaultValue={editingSupplier.state || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-country">Country</Label>
                    <Input 
                      id="edit-sup-country" 
                      name="country" 
                      defaultValue={editingSupplier.country || 'India'}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-pin">Pin Code</Label>
                    <Input 
                      id="edit-sup-pin" 
                      name="pin_code" 
                      defaultValue={editingSupplier.pin_code || ''}
                      className="mt-1" 
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="edit-sup-pos">Place of Supply</Label>
                  <Input 
                    id="edit-sup-pos" 
                    name="place_of_supply" 
                    defaultValue={editingSupplier.place_of_supply || ''}
                    className="mt-1" 
                  />
                </div>
              </div>

              {/* Tax Information */}
              <div className="bg-gradient-to-r from-green/5 to-green/10 p-6 rounded-xl border border-green/20">
                <h3 className="text-lg font-semibold text-green-700 mb-4">Tax Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="edit-sup-gst">GST Number</Label>
                    <Input 
                      id="edit-sup-gst" 
                      name="gst_number" 
                      defaultValue={editingSupplier.gst_number || ''}
                      className="mt-1" 
                      placeholder="e.g., 27AAAAA0000A1Z5" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-pan">PAN Number</Label>
                    <Input 
                      id="edit-sup-pan" 
                      name="pan_number" 
                      defaultValue={editingSupplier.pan_number || ''}
                      className="mt-1" 
                      placeholder="e.g., AAAAA0000A" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-credit">Credit Period (Days)</Label>
                    <Input 
                      id="edit-sup-credit" 
                      name="credit_time" 
                      type="number" 
                      defaultValue={editingSupplier.credit_time || ''}
                      className="mt-1" 
                      placeholder="30" 
                    />
                  </div>
                </div>
              </div>

              {/* Banking Information */}
              <div className="bg-gradient-to-r from-orange/5 to-orange/10 p-6 rounded-xl border border-orange/20">
                <h3 className="text-lg font-semibold text-orange-700 mb-4">Banking Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-sup-bank">Bank Name</Label>
                    <Input 
                      id="edit-sup-bank" 
                      name="bank_name" 
                      defaultValue={editingSupplier.bank_name || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-bank-address">Bank Address</Label>
                    <Input 
                      id="edit-sup-bank-address" 
                      name="bank_address" 
                      defaultValue={editingSupplier.bank_address || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-account">Account Number</Label>
                    <Input 
                      id="edit-sup-account" 
                      name="account_number" 
                      defaultValue={editingSupplier.account_number || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-account-type">Account Type</Label>
                    <Select name="account_type" defaultValue={editingSupplier.account_type || ''}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                        <SelectItem value="od">Overdraft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="edit-sup-ifsc">IFSC Code</Label>
                    <Input 
                      id="edit-sup-ifsc" 
                      name="ifsc_code" 
                      defaultValue={editingSupplier.ifsc_code || ''}
                      className="mt-1" 
                      placeholder="e.g., ICIC0001234" 
                    />
                  </div>
                </div>
              </div>

              {/* Dispatch Address */}
              <div className="bg-gradient-to-r from-purple/5 to-purple/10 p-6 rounded-xl border border-purple/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-purple-700">Dispatch Address</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-same-address"
                      name="same_as_registered_address"
                      defaultChecked={editingSupplier.same_as_registered_address}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="edit-same-address" className="text-sm">Same as registered address</Label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-sup-dispatch1">Dispatch Address Line 1</Label>
                    <Input 
                      id="edit-sup-dispatch1" 
                      name="dispatch_address_line1" 
                      defaultValue={editingSupplier.dispatch_address_line1 || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-dispatch2">Dispatch Address Line 2</Label>
                    <Input 
                      id="edit-sup-dispatch2" 
                      name="dispatch_address_line2" 
                      defaultValue={editingSupplier.dispatch_address_line2 || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-dispatch-city">Dispatch City</Label>
                    <Input 
                      id="edit-sup-dispatch-city" 
                      name="dispatch_city" 
                      defaultValue={editingSupplier.dispatch_city || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-dispatch-state">Dispatch State</Label>
                    <Input 
                      id="edit-sup-dispatch-state" 
                      name="dispatch_state" 
                      defaultValue={editingSupplier.dispatch_state || ''}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-dispatch-country">Dispatch Country</Label>
                    <Input 
                      id="edit-sup-dispatch-country" 
                      name="dispatch_country" 
                      defaultValue={editingSupplier.dispatch_country || 'India'}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sup-dispatch-pin">Dispatch Pin Code</Label>
                    <Input 
                      id="edit-sup-dispatch-pin" 
                      name="dispatch_pin_code" 
                      defaultValue={editingSupplier.dispatch_pin_code || ''}
                      className="mt-1" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80">
                  Update Supplier
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowEditSupplierDialog(false);
                    setEditingSupplier(null);
                  }} 
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Edit Purchase Order Dialog - Complete Form */}
      <Dialog open={showEditPODialog} onOpenChange={setShowEditPODialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-primary">Edit Purchase Order</DialogTitle>
            <DialogDescription>Update all purchase order details including supplier, delivery address, and line items</DialogDescription>
          </DialogHeader>
          {editingPO && (
            <form onSubmit={handleEditPurchaseOrder} className="space-y-6">
              {/* Basic PO Information */}
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 rounded-xl border border-primary/20">
                <h3 className="text-lg font-semibold text-primary mb-4">Purchase Order Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="edit-order-date">Order Date *</Label>
                    <Input 
                      id="edit-order-date" 
                      name="order_date" 
                      type="date" 
                      defaultValue={editingPO.order_date}
                      required 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-expected-date">Expected Date</Label>
                    <Input 
                      id="edit-expected-date" 
                      name="expected_date" 
                      type="date" 
                      defaultValue={editingPO.expected_date || ''}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-status">Status</Label>
                    <Select name="status" defaultValue={editingPO.status}>
                      <SelectTrigger className="mt-1">
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
                  <div className="md:col-span-3">
                    <Label htmlFor="edit-external-ref">External Reference</Label>
                    <Input 
                      id="edit-external-ref" 
                      name="external_po_ref" 
                      defaultValue={editingPO.external_po_ref || ''}
                      placeholder="Reference number, email date, etc."
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Supplier Information (Read-only) */}
              <div className="bg-gradient-to-r from-blue/5 to-blue/10 p-6 rounded-xl border border-blue/20">
                <h3 className="text-lg font-semibold text-blue-700 mb-4">Supplier Information (View Only)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Supplier Name</Label>
                    <Input value={editingPO.supplier?.name || 'N/A'} disabled className="mt-1" />
                  </div>
                  <div>
                    <Label>Supplier Code</Label>
                    <Input value={editingPO.supplier?.supplier_ref || 'N/A'} disabled className="mt-1" />
                  </div>
                  <div>
                    <Label>Contact Person</Label>
                    <Input value={suppliers.find(s => s.name === editingPO.supplier?.name)?.contact_person || 'N/A'} disabled className="mt-1" />
                  </div>
                  <div>
                    <Label>Contact Phone</Label>
                    <Input value={suppliers.find(s => s.name === editingPO.supplier?.name)?.phone || 'N/A'} disabled className="mt-1" />
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue/10 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> To change supplier details, please create a new purchase order or edit the supplier information separately.
                  </p>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="bg-gradient-to-r from-green/5 to-green/10 p-6 rounded-xl border border-green/20">
                <div className="flex items-center gap-3 mb-4">
                  <Truck className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-green-700">Delivery Address</h3>
                </div>
                
                <div className="mb-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-same-address"
                      name="same_as_registered_address"
                      defaultChecked={editingPO.same_as_registered_address}
                      className="w-5 h-5 accent-primary"
                    />
                    <Label htmlFor="edit-same-address" className="text-sm font-medium">
                      Same as company registered address
                    </Label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-delivery-address1">Address Line 1</Label>
                    <Input 
                      id="edit-delivery-address1" 
                      name="delivery_address_line1" 
                      defaultValue={editingPO.delivery_address_line1 || ''}
                      placeholder="Street address"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-delivery-address2">Address Line 2</Label>
                    <Input 
                      id="edit-delivery-address2" 
                      name="delivery_address_line2" 
                      defaultValue={editingPO.delivery_address_line2 || ''}
                      placeholder="Apartment, suite, etc."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-delivery-city">City</Label>
                    <Input 
                      id="edit-delivery-city" 
                      name="delivery_city" 
                      defaultValue={editingPO.delivery_city || ''}
                      placeholder="City"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-delivery-state">State</Label>
                    <Input 
                      id="edit-delivery-state" 
                      name="delivery_state" 
                      defaultValue={editingPO.delivery_state || ''}
                      placeholder="State/Province"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-delivery-country">Country</Label>
                    <Input 
                      id="edit-delivery-country" 
                      name="delivery_country" 
                      defaultValue={editingPO.delivery_country || ''}
                      placeholder="Country"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-delivery-postal">Postal Code</Label>
                    <Input 
                      id="edit-delivery-postal" 
                      name="delivery_postal_code" 
                      defaultValue={editingPO.delivery_postal_code || ''}
                      placeholder="Postal/ZIP code"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Section - Reuse the same table from create form */}
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-secondary/20 to-secondary/10 p-6 rounded-xl border">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-secondary/10 rounded-xl">
                        <Package className="h-6 w-6 text-secondary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">Line Items</h3>
                        <p className="text-sm text-muted-foreground">Update products/services in your purchase order</p>
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
                          <TableHead className="min-w-[60px] font-semibold">Action</TableHead>
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
                                className="w-full min-w-[200px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.hsn_sac_code}
                                onChange={(e) => updateLineItem(item.id, 'hsn_sac_code', e.target.value)}
                                placeholder="HSN/SAC code"
                                className="w-full min-w-[100px]"
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
                                className="w-full min-w-[80px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={item.unit_of_measure} 
                                onValueChange={(value) => updateLineItem(item.id, 'unit_of_measure', value)}
                              >
                                <SelectTrigger className="w-full min-w-[80px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
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
                                className="w-full min-w-[100px]"
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
                                className="w-full min-w-[80px]"
                              />
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
                                className="w-full min-w-[80px]"
                              />
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
                                    className="h-8 w-8 p-0"
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

                  {/* Summary */}
                  <div className="bg-gradient-to-br from-muted/30 to-muted/50 p-6 rounded-xl border shadow-sm space-y-6 mt-6">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <h4 className="text-lg font-semibold text-primary">Purchase Order Summary</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="p-4 bg-background/80">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-muted-foreground">Total Quantity</div>
                          <div className="text-2xl font-bold text-primary">
                            {lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0).toFixed(2)}
                          </div>
                        </div>
                      </Card>
                      
                      <Card className="p-4 bg-background/80">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-muted-foreground">Subtotal</div>
                          <div className="text-2xl font-bold text-green-600">
                            ₹{lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0).toFixed(2)}
                          </div>
                        </div>
                      </Card>
                      
                      <Card className="p-4 bg-background/80">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-muted-foreground">Total Discount</div>
                          <div className="text-2xl font-bold text-orange-600">
                            ₹{lineItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0).toFixed(2)}
                          </div>
                        </div>
                      </Card>
                      
                      <Card className="p-4 bg-background/80">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-muted-foreground">Total Tax</div>
                          <div className="text-2xl font-bold text-blue-600">
                            ₹{lineItems.reduce((sum, item) => sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0).toFixed(2)}
                          </div>
                        </div>
                      </Card>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-semibold">Grand Total:</span>
                        <span className="text-3xl font-bold text-primary">
                          ₹{lineItems.reduce((sum, item) => {
                            const subtotal = (item.quantity || 0) * (item.unit_price || 0);
                            const discount = item.discount_amount || 0;
                            const tax = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
                            return sum + subtotal - discount + tax;
                          }, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-gradient-to-r from-orange/5 to-orange/10 p-6 rounded-xl border border-orange/20">
                <h3 className="text-lg font-semibold text-orange-700 mb-4">Notes & Terms</h3>
                <Textarea 
                  id="edit-notes" 
                  name="notes" 
                  defaultValue={editingPO.notes || ''}
                  placeholder="Add any special instructions, terms, or conditions..."
                  rows={4}
                  className="w-full"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t">
                <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                  <Save className="h-4 w-4 mr-2" />
                  Update Purchase Order
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowEditPODialog(false);
                    setEditingPO(null);
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
                      gst_rate: 0,
                      cgst_rate: 0,
                      sgst_rate: 0,
                      igst_rate: 0,
                      cgst_amount: 0,
                      sgst_amount: 0,
                      igst_amount: 0,
                      total_gst_amount: 0,
                      line_total: 0,
                    }]);
                  }} 
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
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
