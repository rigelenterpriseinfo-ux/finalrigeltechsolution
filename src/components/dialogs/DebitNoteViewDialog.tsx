import React from "react";
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
import { format } from "date-fns";
import { FileText, ExternalLink, BarChart3 } from "lucide-react";

interface DebitNoteViewDialogProps {
  debitNote: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebitNoteViewDialog({
  debitNote,
  open,
  onOpenChange,
}: DebitNoteViewDialogProps) {
  if (!debitNote) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Debit Note Details</DialogTitle>
          <DialogDescription>
            View debit note information and items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Debit Note Number</h3>
                <p className="text-lg font-semibold">{debitNote.debit_note_number}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Supplier</h3>
                <p className="font-medium">{debitNote.supplier_name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Reason</h3>
                <p>{debitNote.reason}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Date</h3>
                <p>{format(new Date(debitNote.debit_note_date), "MMM dd, yyyy")}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <Badge className={getStatusColor(debitNote.status)}>
                  {debitNote.status.charAt(0).toUpperCase() + debitNote.status.slice(1)}
                </Badge>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Created</h3>
                <p>{format(new Date(debitNote.created_at), "MMM dd, yyyy HH:mm")}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Product</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Qty</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Unit Price</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Discount</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Tax</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {debitNote.items?.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-gray-500">{item.product_sku}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
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

          {/* Cross-Module Navigation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Related Information</h3>
            
            {/* Settlement Information */}
            {(debitNote.credit_note_numbers || debitNote.settlement_status !== 'open') && (
              <div>
                <h4 className="text-md font-semibold mb-3">Settlement Status</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-500">Current Status</h5>
                      <Badge className={`mt-1 ${
                        debitNote.settlement_status === 'settled' ? 'bg-green-100 text-green-800' :
                        debitNote.settlement_status === 'partially_settled' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {debitNote.settlement_status === 'settled' ? 'Fully Settled' :
                         debitNote.settlement_status === 'partially_settled' ? 'Partially Settled' : 'Open'}
                      </Badge>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-500">Outstanding Balance</h5>
                      <p className={`text-lg font-semibold ${
                        debitNote.difference_amount > 0 ? 'text-red-600' : 
                        debitNote.difference_amount < 0 ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        ₹{Math.abs(debitNote.difference_amount || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  {debitNote.credit_note_numbers && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-500 mb-2">Linked Credit Notes</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-3 bg-white rounded border">
                          <div>
                            <p className="font-medium">{debitNote.credit_note_numbers}</p>
                            <p className="text-sm text-gray-500">
                              Credit Amount: ₹{(debitNote.credit_note_total_amount || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-blue-600 border-blue-200">
                              Linked
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Navigate to Purchase module to view credit notes
                                window.location.hash = '#purchase';
                                onOpenChange(false);
                              }}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="pt-2 border-t">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.location.hash = '#purchase';
                          onOpenChange(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        View All Credit Notes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.location.hash = '#reports/ap-ar';
                          onOpenChange(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <BarChart3 className="h-4 w-4" />
                        AP/AR Reports
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{debitNote.subtotal_amount.toFixed(2)}</span>
              </div>
              {debitNote.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span>Total Discount:</span>
                  <span>-₹{debitNote.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Total Tax:</span>
                <span>₹{debitNote.tax_amount.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Amount:</span>
                <span>₹{debitNote.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {debitNote.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-2">Notes</h3>
                <p className="text-gray-600">{debitNote.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}