import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Package, CheckCircle, Clock, Edit, FileText, Search, Eye, Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { TrackingUpdateForm } from '@/components/forms/TrackingUpdateForm';
import { useToast } from '@/hooks/use-toast';

interface TrackableOrder {
  id: string;
  order_number: string;
  type: 'sales' | 'debit_note' | 'sales_invoice';
  status: string;
  order_date: string;
  customer_name?: string;
  supplier_name?: string;
  total_amount: number;
  destination?: string;
  item_count?: number;
  eway_bill_no?: string;
  eway_bill_date?: string;
  carrier_transporter?: string;
  awb_no?: string;
  eta?: string;
  pod_document_url?: string;
  tracking_status?: string;
  dispatch_date?: string;
  delivery_date?: string;
  customers?: { name: string };
  // Additional fields for order details
  delivery_city?: string;
  subtotal_amount?: number;
  tax_amount?: number;
  discount_amount?: number;
  notes?: string;
  // Address fields
  customer_id?: string;
  supplier_id?: string;
}

interface OrderItem {
  id: string;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  line_total: number;
  unit_of_measure?: string;
  hsn_sac_code?: string;
}

interface CustomerAddress {
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_country?: string;
  shipping_pin_code?: string;
}

interface DetailedOrder extends TrackableOrder {
  items: OrderItem[];
  customerAddress?: CustomerAddress;
  supplierAddress?: any;
}

interface OrderDetailDialogProps {
  order: DetailedOrder | null;
  open: boolean;
  onClose: () => void;
}

export function TrackingModule() {
  const { hasAccess } = useBusinessAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<TrackableOrder[]>([]);
  const [debitNotes, setDebitNotes] = useState<TrackableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingOrder, setEditingOrder] = useState<TrackableOrder | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [orderDetailDialogOpen, setOrderDetailDialogOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<DetailedOrder | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const fetchTrackableOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch sales invoices with their corresponding sales order tracking information
      const { data: salesInvoices, error: invoicesError } = await supabase
        .from('sales_invoices')
        .select(`
          id,
          invoice_number,
          status,
          invoice_date,
          total_amount,
          subtotal_amount,
          tax_amount,
          discount_amount,
          customer_name,
          customer_id,
          sales_order_id,
          notes,
          sales_orders!inner(
            id,
            destination,
            item_count,
            eway_bill_no,
            eway_bill_date,
            carrier_transporter,
            awb_no,
            eta,
            pod_document_url,
            tracking_status,
            dispatch_date,
            delivery_date,
            delivery_city,
            customers(name)
          )
        `);

      if (invoicesError) {
        console.error('Error fetching sales invoices:', invoicesError);
        return;
      }

      // Fetch debit notes with tracking fields and all necessary details
      const { data: debitNotesData, error: debitError } = await supabase
        .from('debit_notes')
        .select(`
          id,
          debit_note_number,
          status,
          debit_note_date,
          supplier_name,
          total_amount,
          subtotal_amount,
          tax_amount,
          discount_amount,
          destination,
          item_count,
          eway_bill_no,
          eway_bill_date,
          carrier_transporter,
          awb_no,
          eta,
          pod_document_url,
          tracking_status,
          dispatch_date,
          delivery_date,
          notes,
          supplier_id
        `);

      if (debitError) {
        console.error('Error fetching debit notes:', debitError);
        return;
      }

      // Format sales invoices with tracking information from their sales orders
      const trackableSalesInvoices: TrackableOrder[] = (salesInvoices || []).map(invoice => {
        const salesOrder = invoice.sales_orders;
        
        // Auto-populate destination from delivery_city if not already set
        let autoDestination = salesOrder.destination;
        if (!autoDestination && salesOrder.delivery_city) {
          autoDestination = salesOrder.delivery_city;
        }

        return {
          id: invoice.id,
          order_number: invoice.invoice_number, // Display invoice number instead of order number
          type: 'sales_invoice' as const,
          status: invoice.status,
          order_date: invoice.invoice_date,
          customer_name: salesOrder.customers?.name || invoice.customer_name,
          customer_id: invoice.customer_id,
          total_amount: invoice.total_amount,
          subtotal_amount: invoice.subtotal_amount,
          tax_amount: invoice.tax_amount,
          discount_amount: invoice.discount_amount,
          destination: autoDestination,
          delivery_city: salesOrder.delivery_city,
          item_count: salesOrder.item_count,
          eway_bill_no: salesOrder.eway_bill_no,
          eway_bill_date: salesOrder.eway_bill_date,
          carrier_transporter: salesOrder.carrier_transporter,
          awb_no: salesOrder.awb_no,
          eta: salesOrder.eta,
          pod_document_url: salesOrder.pod_document_url,
          tracking_status: salesOrder.tracking_status || 'pending',
          dispatch_date: salesOrder.dispatch_date,
          delivery_date: salesOrder.delivery_date,
          notes: invoice.notes
        };
      });

      // Format debit notes (destination remains as manually entered)
      const trackableDebitNotes: TrackableOrder[] = (debitNotesData || []).map(note => ({
        id: note.id,
        order_number: note.debit_note_number,
        type: 'debit_note' as const,
        status: note.status,
        order_date: note.debit_note_date,
        supplier_name: note.supplier_name,
        supplier_id: note.supplier_id,
        total_amount: note.total_amount,
        subtotal_amount: note.subtotal_amount,
        tax_amount: note.tax_amount,
        discount_amount: note.discount_amount,
        destination: note.destination,
        item_count: note.item_count,
        eway_bill_no: note.eway_bill_no,
        eway_bill_date: note.eway_bill_date,
        carrier_transporter: note.carrier_transporter,
        awb_no: note.awb_no,
        eta: note.eta,
        pod_document_url: note.pod_document_url,
        tracking_status: note.tracking_status || 'pending',
        dispatch_date: note.dispatch_date,
        delivery_date: note.delivery_date,
        notes: note.notes
      }));

      setOrders(trackableSalesInvoices);
      setDebitNotes(trackableDebitNotes);
    } catch (error) {
      console.error('Error fetching trackable orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (order: TrackableOrder): Promise<DetailedOrder> => {
    let items: OrderItem[] = [];
    let customerAddress: CustomerAddress | undefined;

    try {
      if (order.type === 'sales') {
        // Fetch sales order items
        const { data: salesItems, error: salesItemsError } = await supabase
          .from('sales_order_items')
          .select(`
            id,
            item_description,
            quantity,
            unit_price,
            discount_amount,
            total_price,
            unit_of_measure,
            hsn_sac_code
          `)
          .eq('sales_order_id', order.id);

        if (salesItemsError) {
          console.error('Error fetching sales order items:', salesItemsError);
        } else {
          items = (salesItems || []).map(item => ({
            id: item.id,
            product_name: item.item_description,
            product_sku: 'N/A',
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount || 0,
            tax_amount: 0, // Not available in this table
            line_total: item.total_price,
            unit_of_measure: item.unit_of_measure,
            hsn_sac_code: item.hsn_sac_code
          }));
        }

        // Fetch customer address
        if (order.customer_id) {
          const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select(`
              shipping_address_line1,
              shipping_address_line2,
              shipping_city,
              shipping_state,
              shipping_country,
              shipping_pin_code
            `)
            .eq('id', order.customer_id)
            .single();

          if (customerError) {
            console.error('Error fetching customer address:', customerError);
          } else {
            customerAddress = customer;
          }
        }
      } else if (order.type === 'debit_note') {
        // Fetch debit note items
        const { data: debitItems, error: debitItemsError } = await supabase
          .from('debit_note_items')
          .select(`
            id,
            product_name,
            product_sku,
            quantity,
            unit_price,
            discount_amount,
            tax_amount,
            line_subtotal,
            unit_of_measure,
            hsn_sac_code
          `)
          .eq('debit_note_id', order.id);

        if (debitItemsError) {
          console.error('Error fetching debit note items:', debitItemsError);
        } else {
          items = (debitItems || []).map(item => ({
            id: item.id,
            product_name: item.product_name,
            product_sku: item.product_sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount || 0,
            tax_amount: item.tax_amount || 0,
            line_total: item.line_subtotal,
            unit_of_measure: item.unit_of_measure,
            hsn_sac_code: item.hsn_sac_code
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    }

    return {
      ...order,
      items,
      customerAddress
    };
  };

  const handleTrackingUpdate = () => {
    setIsDialogOpen(false);
    setEditingOrder(null);
    fetchTrackableOrders();
  };

  const handleViewPOD = async (podUrl: string) => {
    if (!podUrl) {
      toast({
        title: 'Error',
        description: 'POD document URL not available',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Open POD document in new tab - bucket is now public
      const newTab = window.open(podUrl, '_blank', 'noopener,noreferrer');
      if (!newTab) {
        toast({
          title: 'Error',
          description: 'Unable to open POD document. Please check your browser popup settings.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error opening POD document:', error);
      toast({
        title: 'Error',
        description: 'Unable to open POD document.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPOD = async (podUrl: string, orderNumber: string) => {
    if (!podUrl) {
      toast({
        title: 'Error',
        description: 'POD document URL not available',
        variant: 'destructive',
      });
      return;
    }

    try {
      toast({
        title: 'Downloading...',
        description: 'Starting POD document download',
      });

      const response = await fetch(podUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get file extension from URL or default to pdf
      const fileExtension = podUrl.split('.').pop()?.toLowerCase() || 'pdf';
      link.download = `POD_${orderNumber}.${fileExtension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'POD document downloaded successfully',
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Error',
        description: 'Failed to download POD document.',
        variant: 'destructive',
      });
    }
  };

  const handleOrderClick = async (order: TrackableOrder) => {
    if (order.type === 'sales_invoice') {
      // For sales invoices, we already have the invoice data, just need to fetch items and address
      setLoadingOrderDetails(true);
      setOrderDetailDialogOpen(true);
      
      try {
        // Fetch invoice items
        const { data: invoiceItems, error: itemsError } = await supabase
          .from('sales_invoice_items')
          .select(`
            id,
            item_description,
            quantity_invoiced,
            unit_price,
            discount_amount,
            tax_amount,
            line_total,
            unit_of_measure,
            hsn_sac_code
          `)
          .eq('sales_invoice_id', order.id);

        if (itemsError) {
          console.error('Error fetching invoice items:', itemsError);
        }

        // Fetch customer address if available
        let customerAddress: CustomerAddress | undefined;
        if (order.customer_id) {
          const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select(`
              shipping_address_line1,
              shipping_address_line2,
              shipping_city,
              shipping_state,
              shipping_country,
              shipping_pin_code
            `)
            .eq('id', order.customer_id)
            .single();

          if (customerError) {
            console.error('Error fetching customer address:', customerError);
          } else {
            customerAddress = customer;
          }
        }

        // Create detailed order with invoice information
        const detailedOrder: DetailedOrder = {
          ...order,
          items: (invoiceItems || []).map(item => ({
            id: item.id,
            product_name: item.item_description,
            product_sku: 'N/A',
            quantity: item.quantity_invoiced,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount || 0,
            tax_amount: item.tax_amount || 0,
            line_total: item.line_total,
            unit_of_measure: item.unit_of_measure,
            hsn_sac_code: item.hsn_sac_code
          })),
          customerAddress
        };

        setSelectedOrderForDetails(detailedOrder);
      } catch (error) {
        console.error('Error loading invoice details:', error);
        toast({
          title: 'Error',
          description: 'Failed to load invoice details',
          variant: 'destructive',
        });
      } finally {
        setLoadingOrderDetails(false);
      }
    } else {
      // For debit notes, show the original order details
      setLoadingOrderDetails(true);
      setOrderDetailDialogOpen(true);
      
      try {
        const detailedOrder = await fetchOrderDetails(order);
        setSelectedOrderForDetails(detailedOrder);
      } catch (error) {
        console.error('Error loading order details:', error);
        toast({
          title: 'Error',
          description: 'Failed to load order details',
          variant: 'destructive',
        });
      } finally {
        setLoadingOrderDetails(false);
      }
    }
  };

  const OrderDetailDialog = ({ order, open, onClose }: OrderDetailDialogProps) => (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {order?.type === 'sales_invoice' ? 'Sales Invoice' : order?.type === 'sales' ? 'Sales Order' : 'Debit Note'} Details - {order?.order_number}
          </DialogTitle>
        </DialogHeader>
        
        {loadingOrderDetails ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : order ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Basic Information</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Order Number:</span> {order.order_number}</p>
                  <p><span className="font-medium">Status:</span> <Badge>{order.status}</Badge></p>
                  <p><span className="font-medium">Date:</span> {format(new Date(order.order_date), 'dd/MM/yyyy')}</p>
                  <p><span className="font-medium">{order.type === 'sales' ? 'Customer' : 'Supplier'}:</span> {order.customer_name || order.supplier_name}</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Financial Summary</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Subtotal:</span> ₹{order.subtotal_amount?.toLocaleString() || '0'}</p>
                  <p><span className="font-medium">Tax Amount:</span> ₹{order.tax_amount?.toLocaleString() || '0'}</p>
                  <p><span className="font-medium">Discount:</span> ₹{order.discount_amount?.toLocaleString() || '0'}</p>
                  <p><span className="font-medium">Total Amount:</span> ₹{order.total_amount.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            {/* Delivery Address */}
            {order.customerAddress && (
              <div>
                <h4 className="font-semibold mb-3">Delivery Address</h4>
                <div className="text-sm bg-muted p-3 rounded">
                  {order.customerAddress.shipping_address_line1 && (
                    <p>{order.customerAddress.shipping_address_line1}</p>
                  )}
                  {order.customerAddress.shipping_address_line2 && (
                    <p>{order.customerAddress.shipping_address_line2}</p>
                  )}
                  <p>
                    {[
                      order.customerAddress.shipping_city,
                      order.customerAddress.shipping_state,
                      order.customerAddress.shipping_country,
                      order.customerAddress.shipping_pin_code
                    ].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}
            
            {/* Items Details */}
            <div>
              <h4 className="font-semibold mb-3">Items Details</h4>
              {order.items && order.items.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Tax</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((item, index) => (
                        <TableRow key={item.id || index}>
                          <TableCell className="font-medium">{item.product_name || 'N/A'}</TableCell>
                          <TableCell>{item.product_sku || 'N/A'}</TableCell>
                          <TableCell>{item.quantity} {item.unit_of_measure || 'pcs'}</TableCell>
                          <TableCell>₹{item.unit_price.toLocaleString()}</TableCell>
                          <TableCell>₹{(item.discount_amount || 0).toLocaleString()}</TableCell>
                          <TableCell>₹{(item.tax_amount || 0).toLocaleString()}</TableCell>
                          <TableCell>₹{item.line_total.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No items found</p>
              )}
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Tracking Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <p><span className="font-medium">Destination:</span> {order.destination || '-'}</p>
                  <p><span className="font-medium">Item Count:</span> {order.item_count || '-'}</p>
                  <p><span className="font-medium">E-way Bill No:</span> {order.eway_bill_no || '-'}</p>
                  <p><span className="font-medium">E-way Bill Date:</span> {order.eway_bill_date ? format(new Date(order.eway_bill_date), 'dd/MM/yyyy') : '-'}</p>
                </div>
                <div className="space-y-2">
                  <p><span className="font-medium">Carrier:</span> {order.carrier_transporter || '-'}</p>
                  <p><span className="font-medium">AWB No:</span> {order.awb_no || '-'}</p>
                  <p><span className="font-medium">ETA:</span> {order.eta ? format(new Date(order.eta), 'dd/MM/yyyy') : '-'}</p>
                  <p><span className="font-medium">Tracking Status:</span> <Badge variant={getStatusColor(order.tracking_status || 'pending')}>{(order.tracking_status || 'pending').replace('_', ' ').toUpperCase()}</Badge></p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Delivery Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <p><span className="font-medium">Dispatch Date:</span> {order.dispatch_date ? format(new Date(order.dispatch_date), 'dd/MM/yyyy') : '-'}</p>
                <p><span className="font-medium">Delivery Date:</span> {order.delivery_date ? format(new Date(order.delivery_date), 'dd/MM/yyyy') : '-'}</p>
              </div>
            </div>

            {order.notes && (
              <div>
                <h4 className="font-semibold mb-3">Notes</h4>
                <p className="text-sm bg-muted p-3 rounded">{order.notes}</p>
              </div>
            )}

            {order.pod_document_url && (
              <div>
                <h4 className="font-semibold mb-3">POD Document</h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleViewPOD(order.pod_document_url!)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View POD
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPOD(order.pod_document_url!, order.order_number)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download POD
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 text-primary" />
      : <ArrowDown className="h-4 w-4 ml-1 text-primary" />;
  };

  const sortData = (data: TrackableOrder[]) => {
    if (!sortConfig) return data;
    
    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.key as keyof TrackableOrder];
      let bValue = b[sortConfig.key as keyof TrackableOrder];
      
      // Handle different data types
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      // For numbers
      if (sortConfig.key === 'total_amount' || sortConfig.key === 'item_count') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }
      
      // For dates
      if (sortConfig.key === 'order_date' || sortConfig.key === 'eway_bill_date' || sortConfig.key === 'dispatch_date' || sortConfig.key === 'delivery_date' || sortConfig.key === 'eta') {
        aValue = aValue ? new Date(aValue as string).getTime() : 0;
        bValue = bValue ? new Date(bValue as string).getTime() : 0;
      }
      
      // For strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  useEffect(() => {
    const initializeTracking = async () => {
      if (hasAccess && hasAccess('tracking')) {
        await fetchTrackableOrders();
      } else {
        setLoading(false);
      }
    };
    
    initializeTracking();
  }, []);

  // Early return for access check
  if (typeof hasAccess !== 'function') {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess('tracking')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to view tracking.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'processing': return 'default';
      case 'dispatched': return 'default';
      case 'in_transit': return 'default';
      case 'delivered': return 'default';
      default: return 'secondary';
    }
  };

  const filteredOrders = sortData(orders.filter(order => {
    const matchesSearch = (order.order_number && order.order_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.awb_no && order.awb_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.eway_bill_no && order.eway_bill_no.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.tracking_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }));

  const filteredDebitNotes = sortData(debitNotes.filter(note => {
    const matchesSearch = (note.order_number && note.order_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (note.supplier_name && note.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (note.awb_no && note.awb_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (note.eway_bill_no && note.eway_bill_no.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || note.tracking_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }));

  const renderTrackingTable = (data: TrackableOrder[], title: string) => {
    // Pagination logic
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);

    return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <Table className="text-sm min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort('order_number')}
                  >
                    Order Number
                    {getSortIcon('order_number')}
                  </Button>
                </TableHead>
                <TableHead className="w-[160px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort('customer_name')}
                  >
                    Customer/Supplier
                    {getSortIcon('customer_name')}
                  </Button>
                </TableHead>
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort('destination')}
                  >
                    Destination
                    {getSortIcon('destination')}
                  </Button>
                </TableHead>
                <TableHead className="w-[80px] text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort('item_count')}
                  >
                    Items
                    {getSortIcon('item_count')}
                  </Button>
                </TableHead>
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort('total_amount')}
                  >
                    Amount
                    {getSortIcon('total_amount')}
                  </Button>
                </TableHead>
                <TableHead className="w-[120px]">E-way Bill No</TableHead>
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent text-xs"
                    onClick={() => handleSort('eway_bill_date')}
                  >
                    E-way Date
                    {getSortIcon('eway_bill_date')}
                  </Button>
                </TableHead>
                <TableHead className="w-[160px]">Carrier/Transporter</TableHead>
                <TableHead className="w-[120px]">AWB No</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No {title.toLowerCase()} to track</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-primary hover:underline text-xs font-medium"
                        onClick={() => handleOrderClick(item)}
                      >
                        {item.order_number}
                      </Button>
                    </TableCell>
                    <TableCell className="truncate max-w-[160px]" title={item.customer_name || item.supplier_name}>
                      {item.customer_name || item.supplier_name}
                    </TableCell>
                    <TableCell className="truncate max-w-[120px]" title={item.destination || item.delivery_city}>
                      {item.destination || item.delivery_city || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.item_count || '-'}
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      ₹{item.total_amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="truncate max-w-[120px]" title={item.eway_bill_no}>
                      {item.eway_bill_no || '-'}
                    </TableCell>
                    <TableCell>
                      {item.eway_bill_date ? format(new Date(item.eway_bill_date), 'dd/MM/yy') : '-'}
                    </TableCell>
                    <TableCell className="truncate max-w-[160px]" title={item.carrier_transporter}>
                      {item.carrier_transporter || '-'}
                    </TableCell>
                    <TableCell className="truncate max-w-[120px]" title={item.awb_no}>
                      {item.awb_no || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog open={isDialogOpen && editingOrder?.id === item.id} onOpenChange={setIsDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setEditingOrder(item)}
                              title="Edit Tracking"
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Update Tracking Information - {item.order_number}</DialogTitle>
                            </DialogHeader>
                            <TrackingUpdateForm
                              orderId={item.id}
                              orderType={item.type === 'sales_invoice' ? 'sales' : item.type}
                              initialData={{
                                destination: item.destination,
                                item_count: item.item_count,
                                eway_bill_no: item.eway_bill_no,
                                eway_bill_date: item.eway_bill_date ? new Date(item.eway_bill_date) : undefined,
                                carrier_transporter: item.carrier_transporter,
                                awb_no: item.awb_no,
                                eta: item.eta ? new Date(item.eta) : undefined,
                                tracking_status: item.tracking_status as any,
                                dispatch_date: item.dispatch_date ? new Date(item.dispatch_date) : undefined,
                                delivery_date: item.delivery_date ? new Date(item.delivery_date) : undefined,
                                pod_document_url: item.pod_document_url,
                              }}
                              onSuccess={handleTrackingUpdate}
                              onCancel={() => setIsDialogOpen(false)}
                            />
                          </DialogContent>
                        </Dialog>
                        
                        {item.pod_document_url && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleViewPOD(item.pod_document_url!)}
                              title="View POD"
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleDownloadPOD(item.pod_document_url!, item.order_number)}
                              title="Download POD"
                              className="h-8 w-8 p-0"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, data.length)} of {data.length} items
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="min-w-[32px]"
                  >
                    {page}
                  </Button>
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Track & Trace</h1>
          <p className="text-muted-foreground">Monitor the status of your sales orders and debit notes</p>
        </div>
        <div className="flex items-center space-x-2">
          <Truck className="h-6 w-6 text-primary" />
          <Package className="h-6 w-6 text-secondary" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card 
          className={`cursor-pointer transition-all duration-200 ${
            statusFilter === 'pending' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
          }`}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
        >
          <CardContent className="p-4 flex items-center space-x-2">
            <Clock className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">
                {[...orders, ...debitNotes].filter(item => item.tracking_status === 'pending').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all duration-200 ${
            statusFilter === 'dispatched' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
          }`}
          onClick={() => setStatusFilter(statusFilter === 'dispatched' ? 'all' : 'dispatched')}
        >
          <CardContent className="p-4 flex items-center space-x-2">
            <Package className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Dispatched</p>
              <p className="text-2xl font-bold">
                {[...orders, ...debitNotes].filter(item => item.tracking_status === 'dispatched').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all duration-200 ${
            statusFilter === 'in_transit' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
          }`}
          onClick={() => setStatusFilter(statusFilter === 'in_transit' ? 'all' : 'in_transit')}
        >
          <CardContent className="p-4 flex items-center space-x-2">
            <Truck className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">In Transit</p>
              <p className="text-2xl font-bold">
                {[...orders, ...debitNotes].filter(item => item.tracking_status === 'in_transit').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all duration-200 ${
            statusFilter === 'delivered' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
          }`}
          onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
        >
          <CardContent className="p-4 flex items-center space-x-2">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Delivered</p>
              <p className="text-2xl font-bold">
                {[...orders, ...debitNotes].filter(item => item.tracking_status === 'delivered').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all duration-200 ${
            statusFilter === 'all' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
          }`}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-4 flex items-center space-x-2">
            <Package className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{orders.length + debitNotes.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by order number, customer, AWB, or e-way bill..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tracking Tables */}
      <Tabs defaultValue="sales" className="w-full" onValueChange={() => setCurrentPage(1)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger 
            value="sales"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Sales Orders
          </TabsTrigger>
          <TabsTrigger 
            value="debit_notes"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Debit Notes
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="sales" className="space-y-4">
          {renderTrackingTable(filteredOrders, 'Sales Orders')}
        </TabsContent>
        
        <TabsContent value="debit_notes" className="space-y-4">
          {renderTrackingTable(filteredDebitNotes, 'Debit Notes')}
        </TabsContent>
      </Tabs>

      {/* Order Detail Dialog */}
      <OrderDetailDialog 
        order={selectedOrderForDetails}
        open={orderDetailDialogOpen}
        onClose={() => {
          setOrderDetailDialogOpen(false);
          setSelectedOrderForDetails(null);
        }}
      />
    </div>
  );
}