import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PermissionWrapper, PermissionButton, PermissionInput, PermissionTextarea, PermissionSelect } from '@/components/ui/permission-wrapper';
import { useToast } from '@/hooks/use-toast';
import { 
  RotateCcw, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Eye, 
  Download,
  ArrowLeft,
  Calendar,
  User,
  Package
} from 'lucide-react';

interface ReturnOrder {
  id: string;
  return_number: string;
  sales_order_number: string;
  customer_name: string;
  return_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  reason: string;
  total_amount: number;
  items: number;
}

interface CreditNote {
  id: string;
  credit_number: string;
  customer_name: string;
  issue_date: string;
  status: 'draft' | 'issued' | 'applied';
  amount: number;
  reason: string;
  reference_type: 'return' | 'manual';
}

export function ReturnsModule() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('returns');
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [isCreditNoteDialogOpen, setIsCreditNoteDialogOpen] = useState(false);

  // Sample data - replace with actual API calls
  const sampleReturnOrders: ReturnOrder[] = [
    {
      id: '1',
      return_number: 'RET-001',
      sales_order_number: 'SO-001',
      customer_name: 'ABC Corp',
      return_date: '2024-01-15',
      status: 'pending',
      reason: 'Defective product',
      total_amount: 1500.00,
      items: 3
    }
  ];

  const sampleCreditNotes: CreditNote[] = [
    {
      id: '1',
      credit_number: 'CN-001',
      customer_name: 'ABC Corp',
      issue_date: '2024-01-16',
      status: 'issued',
      amount: 1500.00,
      reason: 'Product return - defective items',
      reference_type: 'return'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'approved': return 'bg-blue-500 hover:bg-blue-600';
      case 'completed': return 'bg-green-500 hover:bg-green-600';
      case 'rejected': return 'bg-red-500 hover:bg-red-600';
      case 'draft': return 'bg-gray-500 hover:bg-gray-600';
      case 'issued': return 'bg-blue-500 hover:bg-blue-600';
      case 'applied': return 'bg-green-500 hover:bg-green-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const handleCreateReturn = () => {
    toast({
      title: "Return order created",
      description: "Return order has been created successfully."
    });
    setIsReturnDialogOpen(false);
  };

  const handleCreateCreditNote = () => {
    toast({
      title: "Credit note created",
      description: "Credit note has been created successfully."
    });
    setIsCreditNoteDialogOpen(false);
  };

  return (
    <PermissionWrapper section="returns">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="returns" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Return Sales Orders
            </TabsTrigger>
            <TabsTrigger value="credit-notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Credit Notes
            </TabsTrigger>
          </TabsList>

          {/* Return Sales Orders Tab */}
          <TabsContent value="returns" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <RotateCcw className="h-6 w-6" />
                  Return Sales Orders
                </h2>
                <p className="text-muted-foreground">
                  Manage product returns from customers
                </p>
              </div>
              <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
                <DialogTrigger asChild>
                  <PermissionButton section="returns" className="btn-gradient">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Return
                  </PermissionButton>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Return Order</DialogTitle>
                    <DialogDescription>
                      Create a new return order for customer products
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sales-order">Sales Order Number</Label>
                      <PermissionInput 
                        section="returns"
                        id="sales-order" 
                        placeholder="Enter sales order number" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer">Customer</Label>
                      <PermissionInput 
                        section="returns"
                        id="customer" 
                        placeholder="Customer name will auto-populate" 
                        disabled 
                      />
                    </div>
                    <div>
                      <Label htmlFor="reason">Return Reason</Label>
                      <PermissionSelect section="returns">
                        <SelectTrigger>
                          <SelectValue placeholder="Select return reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="defective">Defective Product</SelectItem>
                          <SelectItem value="wrong-item">Wrong Item Shipped</SelectItem>
                          <SelectItem value="damaged">Damaged in Transit</SelectItem>
                          <SelectItem value="not-as-described">Not as Described</SelectItem>
                          <SelectItem value="customer-request">Customer Request</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </PermissionSelect>
                    </div>
                    <div>
                      <Label htmlFor="notes">Additional Notes</Label>
                      <PermissionTextarea 
                        section="returns"
                        id="notes" 
                        placeholder="Enter any additional details..." 
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsReturnDialogOpen(false)}>
                      Cancel
                    </Button>
                    <PermissionButton section="returns" onClick={handleCreateReturn}>
                      Create Return
                    </PermissionButton>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Return Orders</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <PermissionInput 
                        section="returns"
                        placeholder="Search returns..." 
                        className="pl-10 w-64" 
                      />
                    </div>
                    <PermissionButton section="returns" variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </PermissionButton>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Return #</TableHead>
                      <TableHead>Sales Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleReturnOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="flex flex-col items-center gap-4">
                            <RotateCcw className="h-12 w-12 text-muted-foreground" />
                            <div>
                              <p className="text-lg font-semibold">No return orders yet</p>
                              <p className="text-muted-foreground">Return orders will appear here</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sampleReturnOrders.map((returnOrder) => (
                        <TableRow key={returnOrder.id}>
                          <TableCell className="font-medium">{returnOrder.return_number}</TableCell>
                          <TableCell>{returnOrder.sales_order_number}</TableCell>
                          <TableCell>{returnOrder.customer_name}</TableCell>
                          <TableCell>{returnOrder.return_date}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(returnOrder.status)}>
                              {returnOrder.status.charAt(0).toUpperCase() + returnOrder.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{returnOrder.total_amount.toFixed(2)}</TableCell>
                          <TableCell>{returnOrder.items}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <PermissionButton section="returns" variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </PermissionButton>
                              <PermissionButton section="returns" variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </PermissionButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credit Notes Tab */}
          <TabsContent value="credit-notes" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Credit Notes
                </h2>
                <p className="text-muted-foreground">
                  Create and manage credit notes for customers
                </p>
              </div>
              <Dialog open={isCreditNoteDialogOpen} onOpenChange={setIsCreditNoteDialogOpen}>
                <DialogTrigger asChild>
                  <PermissionButton section="returns" className="btn-gradient">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Credit Note
                  </PermissionButton>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Credit Note</DialogTitle>
                    <DialogDescription>
                      Create a new credit note for a customer
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="customer-select">Customer</Label>
                      <PermissionSelect section="returns">
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="abc-corp">ABC Corp</SelectItem>
                          <SelectItem value="xyz-ltd">XYZ Ltd</SelectItem>
                        </SelectContent>
                      </PermissionSelect>
                    </div>
                    <div>
                      <Label htmlFor="reference-type">Reference Type</Label>
                      <PermissionSelect section="returns">
                        <SelectTrigger>
                          <SelectValue placeholder="Select reference type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="return">From Return Order</SelectItem>
                          <SelectItem value="manual">Manual Credit</SelectItem>
                        </SelectContent>
                      </PermissionSelect>
                    </div>
                    <div>
                      <Label htmlFor="amount">Credit Amount</Label>
                      <PermissionInput 
                        section="returns"
                        id="amount" 
                        type="number" 
                        placeholder="0.00" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="credit-reason">Reason</Label>
                      <PermissionTextarea 
                        section="returns"
                        id="credit-reason" 
                        placeholder="Enter reason for credit note..." 
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreditNoteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <PermissionButton section="returns" onClick={handleCreateCreditNote}>
                      Create Credit Note
                    </PermissionButton>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Credit Notes</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <PermissionInput 
                        section="returns"
                        placeholder="Search credit notes..." 
                        className="pl-10 w-64" 
                      />
                    </div>
                    <PermissionButton section="returns" variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </PermissionButton>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Credit Note #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleCreditNotes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center gap-4">
                            <FileText className="h-12 w-12 text-muted-foreground" />
                            <div>
                              <p className="text-lg font-semibold">No credit notes yet</p>
                              <p className="text-muted-foreground">Credit notes will appear here</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sampleCreditNotes.map((creditNote) => (
                        <TableRow key={creditNote.id}>
                          <TableCell className="font-medium">{creditNote.credit_number}</TableCell>
                          <TableCell>{creditNote.customer_name}</TableCell>
                          <TableCell>{creditNote.issue_date}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(creditNote.status)}>
                              {creditNote.status.charAt(0).toUpperCase() + creditNote.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{creditNote.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {creditNote.reference_type === 'return' ? 'Return' : 'Manual'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <PermissionButton section="returns" variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </PermissionButton>
                              <PermissionButton section="returns" variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </PermissionButton>
                              <PermissionButton section="returns" variant="outline" size="sm">
                                <Download className="h-4 w-4" />
                              </PermissionButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionWrapper>
  );
}