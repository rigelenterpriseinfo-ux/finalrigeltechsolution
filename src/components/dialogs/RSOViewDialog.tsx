import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { FileText, ExternalLink, Plus } from "lucide-react";

interface RSOViewDialogProps {
  rso: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCreditNote?: (rsoId: string) => void;
}

interface CreditNote {
  id: string;
  cn_number: string;
  cn_date: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export function RSOViewDialog({
  rso,
  open,
  onOpenChange,
  onCreateCreditNote
}: RSOViewDialogProps) {
  const { toast } = useToast();
  const [linkedCreditNotes, setLinkedCreditNotes] = useState<CreditNote[]>([]);
  const [rsoItems, setRsoItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rso && open) {
      fetchLinkedCreditNotes();
      fetchRSOItems();
    }
  }, [rso, open]);

  const fetchLinkedCreditNotes = async () => {
    if (!rso?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('rso_id', rso.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinkedCreditNotes(data || []);
    } catch (error) {
      console.error('Error fetching linked credit notes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch linked credit notes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRSOItems = async () => {
    if (!rso?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('return_order_lines')
        .select('*')
        .eq('return_order_id', rso.id);

      if (error) throw error;
      setRsoItems(data || []);
    } catch (error) {
      console.error('Error fetching RSO items:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Confirmed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCreditNoteStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'Confirmed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalCreditAmount = linkedCreditNotes.reduce((sum, cn) => sum + (cn.total_amount || 0), 0);
  const outstandingAmount = (rso?.total_amount || 0) - totalCreditAmount;
  
  const creditNoteStatus = linkedCreditNotes.length === 0 ? 'pending' :
    linkedCreditNotes.some(cn => cn.status === 'Confirmed') ? 'processed' : 'draft';

  if (!rso) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return Sales Order Details</DialogTitle>
          <DialogDescription>
            View RSO information, items, and linked credit notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">RSO Number</h3>
                <p className="text-lg font-semibold">{rso.rso_number}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Customer</h3>
                <p className="font-medium">{rso.customer_name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Invoice Reference</h3>
                <p>{rso.invoice_number}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Reason for Credit</h3>
                <p>{rso.reason_for_credit}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">RSO Date</h3>
                <p>{format(new Date(rso.rso_date), "MMM dd, yyyy")}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <Badge className={getStatusColor(rso.status)}>
                  {rso.status}
                </Badge>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Total Amount</h3>
                <p className="text-lg font-semibold">₹{rso.total_amount.toFixed(2)}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Created</h3>
                <p>{format(new Date(rso.created_at), "MMM dd, yyyy HH:mm")}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Credit Notes Processing Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Credit Note Processing Status</span>
                <Badge variant={
                  creditNoteStatus === 'processed' ? 'default' :
                  creditNoteStatus === 'draft' ? 'secondary' : 'destructive'
                } className={
                  creditNoteStatus === 'processed' ? 'bg-green-100 text-green-800' :
                  creditNoteStatus === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }>
                  {creditNoteStatus === 'processed' ? 'Credit Notes Processed' :
                   creditNoteStatus === 'draft' ? 'Credit Notes in Draft' : 'Credit Notes Pending'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {linkedCreditNotes.length}
                  </div>
                  <div className="text-sm text-blue-600">Credit Notes</div>
                </div>
                
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    ₹{totalCreditAmount.toLocaleString()}
                  </div>
                  <div className="text-sm text-green-600">Total Credited</div>
                </div>

                <div className={`p-3 rounded-lg ${outstandingAmount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <div className={`text-2xl font-bold ${outstandingAmount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    ₹{Math.abs(outstandingAmount).toLocaleString()}
                  </div>
                  <div className={`text-sm ${outstandingAmount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {outstandingAmount > 0 ? 'Outstanding' : 'Balanced'}
                  </div>
                </div>
              </div>

              {/* Linked Credit Notes List */}
              {linkedCreditNotes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Linked Credit Notes</h4>
                  <div className="space-y-2">
                    {linkedCreditNotes.map((cn) => (
                      <div key={cn.id} className="flex items-center justify-between p-3 bg-white rounded border">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <div>
                            <p className="font-medium">{cn.cn_number}</p>
                            <p className="text-sm text-gray-500">
                              {format(new Date(cn.cn_date), "MMM dd, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge className={getCreditNoteStatusColor(cn.status)}>
                            {cn.status}
                          </Badge>
                          <p className="font-medium">₹{cn.total_amount.toFixed(2)}</p>
                          <Button variant="ghost" size="sm" title="View Credit Note">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create Credit Note Action */}
              {linkedCreditNotes.length === 0 && onCreateCreditNote && (
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-blue-800">No Credit Notes Found</h4>
                      <p className="text-sm text-blue-600 mt-1">
                        This RSO has not been processed into credit notes yet. Create credit notes to complete the return process.
                      </p>
                    </div>
                    <Button 
                      onClick={() => onCreateCreditNote(rso.id)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Credit Note
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* RSO Items Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Return Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Product</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Return Qty</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Unit Price</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Discount</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Tax</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rsoItems.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-gray-500">{item.product_sku}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{item.return_qty}</td>
                      <td className="px-4 py-3 text-right">₹{item.unit_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        {item.discount_percentage > 0 && (
                          <div>
                            <div>{item.discount_percentage}%</div>
                            <div className="text-sm text-gray-500">₹{item.discount_amount.toFixed(2)}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">₹{item.tax_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium">₹{item.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{rso.subtotal_amount?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Tax:</span>
                <span>₹{rso.tax_amount?.toFixed(2) || '0.00'}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Amount:</span>
                <span>₹{rso.total_amount?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {rso.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-2">Notes</h3>
                <p className="text-gray-600">{rso.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}