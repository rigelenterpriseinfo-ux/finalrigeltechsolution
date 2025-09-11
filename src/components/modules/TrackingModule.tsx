import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Package, CheckCircle, Clock, Edit, FileText, Search } from 'lucide-react';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface TrackableOrder {
  id: string;
  order_number: string;
  type: 'sales' | 'debit_note';
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
}

export function TrackingModule() {
  const { hasAccess } = useBusinessAuth();
  const [orders, setOrders] = useState<TrackableOrder[]>([]);
  const [debitNotes, setDebitNotes] = useState<TrackableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchTrackableOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch sales orders with tracking fields
      const { data: salesOrders, error: salesError } = await supabase
        .from('sales_orders')
        .select(`
          id,
          order_number,
          status,
          order_date,
          total_amount,
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
          customers(name)
        `);

      if (salesError) {
        console.error('Error fetching sales orders:', salesError);
        return;
      }

      // Fetch debit notes with tracking fields
      const { data: debitNotesData, error: debitError } = await supabase
        .from('debit_notes')
        .select(`
          id,
          debit_note_number,
          status,
          debit_note_date,
          supplier_name,
          total_amount,
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
          delivery_date
        `);

      if (debitError) {
        console.error('Error fetching debit notes:', debitError);
        return;
      }

      // Format sales orders
      const trackableSalesOrders: TrackableOrder[] = (salesOrders || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        type: 'sales' as const,
        status: order.status,
        order_date: order.order_date,
        customer_name: order.customers?.name,
        total_amount: order.total_amount,
        destination: order.destination,
        item_count: order.item_count,
        eway_bill_no: order.eway_bill_no,
        eway_bill_date: order.eway_bill_date,
        carrier_transporter: order.carrier_transporter,
        awb_no: order.awb_no,
        eta: order.eta,
        pod_document_url: order.pod_document_url,
        tracking_status: order.tracking_status || 'pending',
        dispatch_date: order.dispatch_date,
        delivery_date: order.delivery_date
      }));

      // Format debit notes
      const trackableDebitNotes: TrackableOrder[] = (debitNotesData || []).map(note => ({
        id: note.id,
        order_number: note.debit_note_number,
        type: 'debit_note' as const,
        status: note.status,
        order_date: note.debit_note_date,
        supplier_name: note.supplier_name,
        total_amount: note.total_amount,
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
        delivery_date: note.delivery_date
      }));

      setOrders(trackableSalesOrders);
      setDebitNotes(trackableDebitNotes);
    } catch (error) {
      console.error('Error fetching trackable orders:', error);
    } finally {
      setLoading(false);
    }
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
  }, []); // Empty dependency to run only once

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

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.awb_no && order.awb_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.eway_bill_no && order.eway_bill_no.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.tracking_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const filteredDebitNotes = debitNotes.filter(note => {
    const matchesSearch = note.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.supplier_name && note.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (note.awb_no && note.awb_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (note.eway_bill_no && note.eway_bill_no.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || note.tracking_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const renderTrackingTable = (data: TrackableOrder[], title: string) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Number</TableHead>
              <TableHead>Customer/Supplier</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Item Count</TableHead>
              <TableHead>E-way Bill No</TableHead>
              <TableHead>E-way Bill Date</TableHead>
              <TableHead>Carrier/Transporter</TableHead>
              <TableHead>AWB No</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dispatch Date</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>POD</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No {title.toLowerCase()} to track</p>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.order_number}</TableCell>
                  <TableCell>{item.customer_name || item.supplier_name}</TableCell>
                  <TableCell>{item.destination || '-'}</TableCell>
                  <TableCell>{item.item_count || '-'}</TableCell>
                  <TableCell>{item.eway_bill_no || '-'}</TableCell>
                  <TableCell>
                    {item.eway_bill_date ? format(new Date(item.eway_bill_date), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>{item.carrier_transporter || '-'}</TableCell>
                  <TableCell>{item.awb_no || '-'}</TableCell>
                  <TableCell>
                    {item.eta ? format(new Date(item.eta), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(item.tracking_status || 'pending')}>
                      {(item.tracking_status || 'pending').replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.dispatch_date ? format(new Date(item.dispatch_date), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {item.delivery_date ? format(new Date(item.delivery_date), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {item.pod_document_url ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={item.pod_document_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Update Tracking Information</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-4">
                          <p className="col-span-2 text-muted-foreground">
                            Tracking update functionality will be implemented in the next phase.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Track & Trace</h1>
          <p className="text-muted-foreground">Monitor your orders and shipments with comprehensive tracking</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[...filteredOrders, ...filteredDebitNotes].filter(o => 
                o.tracking_status === 'in_transit' || o.tracking_status === 'dispatched'
              ).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Shipment</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[...filteredOrders, ...filteredDebitNotes].filter(o => 
                o.tracking_status === 'pending' || o.tracking_status === 'processing'
              ).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[...filteredOrders, ...filteredDebitNotes].filter(o => 
                o.tracking_status === 'delivered'
              ).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length + filteredDebitNotes.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order number, customer, AWB, E-way bill..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs for different order types */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales Orders</TabsTrigger>
          <TabsTrigger value="debit_notes">Debit Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          {renderTrackingTable(filteredOrders, "Sales Orders Tracking")}
        </TabsContent>

        <TabsContent value="debit_notes" className="space-y-4">
          {renderTrackingTable(filteredDebitNotes, "Debit Notes Tracking")}
        </TabsContent>
      </Tabs>
    </div>
  );
}