import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { FileText, TrendingUp, AlertCircle, CheckCircle, X } from 'lucide-react';
import { APARFilters } from '@/contexts/APARFilterContext';

interface APSummary {
  total_debit_notes: number;
  open_debit_notes: number;
  settled_debit_notes: number; 
  partially_settled_debit_notes: number;
  total_debit_amount: number;
  outstanding_amount: number;
  credit_amount: number;
}

interface APDashboardWidgetProps {
  filters?: APARFilters;
  showFilterLabel?: boolean;
  onFilterClear?: () => void;
}

export function APDashboardWidget({ filters, showFilterLabel = false, onFilterClear }: APDashboardWidgetProps = {}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [apSummary, setApSummary] = useState<APSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const memoizedFilters = useMemo(() => filters, [
    filters?.searchTerm,
    filters?.statusFilter,
    filters?.supplierFilter,
    filters?.customerFilter,
    filters?.dateRange?.start,
    filters?.dateRange?.end
  ]);

  const fetchAPSummary = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('debit_notes')
        .select(`
          *,
          supplier_credit_notes:supplier_credit_notes(
            total_amount
          )
        `)
        .eq('company_id', profile?.company_id);

      // Apply filters if provided
      if (memoizedFilters?.searchTerm) {
        query = query.or(`debit_note_number.ilike.%${memoizedFilters.searchTerm}%,supplier_name.ilike.%${memoizedFilters.searchTerm}%,reason.ilike.%${memoizedFilters.searchTerm}%`);
      }
      
      if (memoizedFilters?.statusFilter && memoizedFilters.statusFilter !== 'all') {
        query = query.eq('status', memoizedFilters.statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate summary statistics
      let totalDebitNotes = 0;
      let openDebitNotes = 0;
      let settledDebitNotes = 0;
      let partiallySettledDebitNotes = 0;
      let totalDebitAmount = 0;
      let outstandingAmount = 0;
      let creditAmount = 0;

      (data || []).forEach((debitNote: any) => {
        totalDebitNotes++;
        totalDebitAmount += debitNote.total_amount || 0;
        
        const creditTotal = (debitNote.supplier_credit_notes || [])
          .reduce((sum: number, cn: any) => sum + (cn.total_amount || 0), 0);
        
        creditAmount += creditTotal;
        const balance = debitNote.total_amount - creditTotal;
        
        if (creditTotal === 0) {
          openDebitNotes++;
          outstandingAmount += debitNote.total_amount;
        } else if (creditTotal >= debitNote.total_amount) {
          settledDebitNotes++;
        } else {
          partiallySettledDebitNotes++;
          outstandingAmount += balance;
        }
      });

      setApSummary({
        total_debit_notes: totalDebitNotes,
        open_debit_notes: openDebitNotes,
        settled_debit_notes: settledDebitNotes,
        partially_settled_debit_notes: partiallySettledDebitNotes,
        total_debit_amount: totalDebitAmount,
        outstanding_amount: outstandingAmount,
        credit_amount: creditAmount
      });

    } catch (error) {
      console.error('Error fetching AP summary:', error);
      toast({
        title: "Error",
        description: "Failed to fetch accounts payable summary",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, memoizedFilters, toast]);

  useEffect(() => {
    if (profile?.company_id) {
      fetchAPSummary();
    }
  }, [profile?.company_id, fetchAPSummary]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Accounts Payable (AP)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!apSummary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Accounts Payable (AP)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Accounts Payable (AP)
          </div>
          {showFilterLabel && filters?.searchTerm && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Filtered by: {filters.searchTerm}
              </Badge>
              {onFilterClear && (
                <Button variant="ghost" size="sm" onClick={onFilterClear}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {apSummary.total_debit_notes}
            </div>
            <div className="text-sm text-blue-600">Total Debit Notes</div>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              ₹{apSummary.total_debit_amount.toLocaleString()}
            </div>
            <div className="text-sm text-green-600">Total Debit Amount</div>
          </div>
        </div>

        {/* Settlement Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Settlement Status</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Open</span>
                <Badge variant="destructive" className="text-xs">
                  {apSummary.open_debit_notes}
                </Badge>
              </div>
              <span className="text-sm font-medium text-red-600">
                ₹{apSummary.outstanding_amount.toLocaleString()}
              </span>
            </div>

            {apSummary.partially_settled_debit_notes > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Partially Settled</span>
                  <Badge variant="secondary" className="text-xs">
                    {apSummary.partially_settled_debit_notes}
                  </Badge>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Settled</span>
                <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                  {apSummary.settled_debit_notes}
                </Badge>
              </div>
              <span className="text-sm font-medium text-green-600">
                ₹{apSummary.credit_amount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Outstanding Amount Alert */}
        {apSummary.outstanding_amount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Outstanding Balance: ₹{apSummary.outstanding_amount.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-red-600 mt-1">
              {apSummary.open_debit_notes + apSummary.partially_settled_debit_notes} debit note(s) require attention
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              // Navigate to Purchase module - could be implemented as a prop or context action
              window.location.hash = '#purchase';
            }}
          >
            View All Debit Notes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}