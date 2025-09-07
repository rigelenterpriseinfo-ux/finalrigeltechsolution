import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { 
  FileText, 
  Download, 
  Calendar, 
  AlertCircle, 
  TrendingUp, 
  BarChart3,
  RefreshCw,
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface OutstandingDebitNote {
  id: string;
  debit_note_number: string;
  debit_note_date: string;
  supplier_name: string;
  total_amount: number;
  outstanding_amount: number;
  days_outstanding: number;
  settlement_status: string;
}

interface PendingCreditNote {
  id: string;
  rso_number: string;
  rso_date: string;
  customer_name: string;
  total_amount: number;
  days_pending: number;
  status: string;
}

interface SettlementMatch {
  debit_note_id: string;
  debit_note_number: string;
  credit_note_id: string;
  credit_note_number: string;
  match_amount: number;
  match_percentage: number;
  status: string;
}

interface APARSummary {
  total_outstanding_ap: number;
  total_pending_ar: number;
  aged_ap_30_days: number;
  aged_ap_60_days: number;
  aged_ap_90_days: number;
  pending_ar_30_days: number;
  pending_ar_60_days: number;
  pending_ar_90_days: number;
}

export function APARReportsModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('outstanding-ap');
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
    to: new Date().toISOString().split('T')[0] // today
  });
  
  // Data states
  const [outstandingDebitNotes, setOutstandingDebitNotes] = useState<OutstandingDebitNote[]>([]);
  const [pendingCreditNotes, setPendingCreditNotes] = useState<PendingCreditNote[]>([]);
  const [settlementMatches, setSettlementMatches] = useState<SettlementMatch[]>([]);
  const [aparSummary, setAparSummary] = useState<APARSummary | null>(null);

  useEffect(() => {
    if (profile?.company_id) {
      loadReportsData();
    }
  }, [profile?.company_id, dateFilter]);

  const loadReportsData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadOutstandingDebitNotes(),
        loadPendingCreditNotes(),
        loadSettlementMatches(),
        loadAPARSummary()
      ]);
    } catch (error) {
      console.error('Error loading reports data:', error);
      toast({
        title: "Error",
        description: "Failed to load reports data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOutstandingDebitNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('debit_notes')
        .select(`
          *,
          supplier_credit_notes:supplier_credit_notes(total_amount)
        `)
        .eq('company_id', profile?.company_id)
        .gte('debit_note_date', dateFilter.from)
        .lte('debit_note_date', dateFilter.to);

      if (error) throw error;

      const processedData: OutstandingDebitNote[] = (data || [])
        .map((dn: any) => {
          const creditTotal = (dn.supplier_credit_notes || [])
            .reduce((sum: number, cn: any) => sum + (cn.total_amount || 0), 0);
          const outstandingAmount = dn.total_amount - creditTotal;
          
          if (outstandingAmount <= 0) return null; // Skip settled notes
          
          const daysPending = differenceInDays(new Date(), parseISO(dn.debit_note_date));
          
          return {
            id: dn.id,
            debit_note_number: dn.debit_note_number,
            debit_note_date: dn.debit_note_date,
            supplier_name: dn.supplier_name,
            total_amount: dn.total_amount,
            outstanding_amount: outstandingAmount,
            days_outstanding: daysPending,
            settlement_status: creditTotal === 0 ? 'open' : 'partially_settled'
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.days_outstanding - a.days_outstanding);

      setOutstandingDebitNotes(processedData);
    } catch (error) {
      console.error('Error loading outstanding debit notes:', error);
    }
  };

  const loadPendingCreditNotes = async () => {
    try {
      // Get RSOs without credit notes
      const { data: rsos, error: rsoError } = await supabase
        .from('return_order_header')
        .select('*')
        .eq('company_id', profile?.company_id)
        .gte('rso_date', dateFilter.from)
        .lte('rso_date', dateFilter.to);

      if (rsoError) throw rsoError;

      const { data: creditNotes, error: cnError } = await supabase
        .from('credit_notes')
        .select('rso_id')
        .eq('company_id', profile?.company_id);

      if (cnError) throw cnError;

      const rsoIdsWithCreditNotes = new Set(creditNotes?.map(cn => cn.rso_id).filter(Boolean) || []);
      
      const pendingRsos = (rsos || [])
        .filter(rso => !rsoIdsWithCreditNotes.has(rso.id))
        .map(rso => ({
          id: rso.id,
          rso_number: rso.rso_number,
          rso_date: rso.rso_date,
          customer_name: rso.customer_name,
          total_amount: rso.total_amount,
          days_pending: differenceInDays(new Date(), parseISO(rso.rso_date)),
          status: rso.status
        }))
        .sort((a, b) => b.days_pending - a.days_pending);

      setPendingCreditNotes(pendingRsos);
    } catch (error) {
      console.error('Error loading pending credit notes:', error);
    }
  };

  const loadSettlementMatches = async () => {
    try {
      // Get debit notes with their credit notes for matching analysis
      const { data, error } = await supabase
        .from('debit_notes')
        .select(`
          id,
          debit_note_number,
          total_amount,
          supplier_credit_notes:supplier_credit_notes(
            id,
            supplier_credit_note_number,
            total_amount
          )
        `)
        .eq('company_id', profile?.company_id);

      if (error) throw error;

      const matches: SettlementMatch[] = [];
      
      (data || []).forEach((dn: any) => {
        (dn.supplier_credit_notes || []).forEach((cn: any) => {
          const matchPercentage = Math.min((cn.total_amount / dn.total_amount) * 100, 100);
          matches.push({
            debit_note_id: dn.id,
            debit_note_number: dn.debit_note_number,
            credit_note_id: cn.id,
            credit_note_number: cn.supplier_credit_note_number,
            match_amount: cn.total_amount,
            match_percentage: matchPercentage,
            status: matchPercentage >= 100 ? 'fully_matched' : 'partially_matched'
          });
        });
      });

      setSettlementMatches(matches);
    } catch (error) {
      console.error('Error loading settlement matches:', error);
    }
  };

  const loadAPARSummary = async () => {
    try {
      // Calculate summary metrics
      const currentDate = new Date();
      const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(currentDate.getTime() - 60 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(currentDate.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Fake data for demo - in real implementation, this would come from the loaded data
      const summary: APARSummary = {
        total_outstanding_ap: outstandingDebitNotes.reduce((sum, dn) => sum + dn.outstanding_amount, 0),
        total_pending_ar: pendingCreditNotes.reduce((sum, pcn) => sum + pcn.total_amount, 0),
        aged_ap_30_days: outstandingDebitNotes.filter(dn => dn.days_outstanding >= 30 && dn.days_outstanding < 60).reduce((sum, dn) => sum + dn.outstanding_amount, 0),
        aged_ap_60_days: outstandingDebitNotes.filter(dn => dn.days_outstanding >= 60 && dn.days_outstanding < 90).reduce((sum, dn) => sum + dn.outstanding_amount, 0),
        aged_ap_90_days: outstandingDebitNotes.filter(dn => dn.days_outstanding >= 90).reduce((sum, dn) => sum + dn.outstanding_amount, 0),
        pending_ar_30_days: pendingCreditNotes.filter(pcn => pcn.days_pending >= 30 && pcn.days_pending < 60).reduce((sum, pcn) => sum + pcn.total_amount, 0),
        pending_ar_60_days: pendingCreditNotes.filter(pcn => pcn.days_pending >= 60 && pcn.days_pending < 90).reduce((sum, pcn) => sum + pcn.total_amount, 0),
        pending_ar_90_days: pendingCreditNotes.filter(pcn => pcn.days_pending >= 90).reduce((sum, pcn) => sum + pcn.total_amount, 0)
      };

      setAparSummary(summary);
    } catch (error) {
      console.error('Error loading AP/AR summary:', error);
    }
  };

  const getAgingBadge = (days: number) => {
    if (days >= 90) return <Badge variant="destructive">90+ days</Badge>;
    if (days >= 60) return <Badge variant="secondary" className="bg-orange-100 text-orange-800">60-89 days</Badge>;
    if (days >= 30) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">30-59 days</Badge>;
    return <Badge variant="default" className="bg-green-100 text-green-800">0-29 days</Badge>;
  };

  const exportToExcel = (data: any[], filename: string, sheetName: string) => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    
    toast({
      title: "Success",
      description: "Report exported successfully",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AP/AR Reports & Analytics</h2>
          <p className="text-muted-foreground">Comprehensive accounts payable and receivable reporting</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadReportsData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <Label>Date Range:</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                type="date"
                value={dateFilter.from}
                onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                className="w-auto"
              />
              <span>to</span>
              <Input
                type="date"
                value={dateFilter.to}
                onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                className="w-auto"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Dashboard */}
      {aparSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding AP</p>
                  <p className="text-2xl font-bold text-red-600">
                    ₹{aparSummary.total_outstanding_ap.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Pending AR</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ₹{aparSummary.total_pending_ar.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">AP 90+ Days</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ₹{aparSummary.aged_ap_90_days.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">AR 90+ Days</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₹{aparSummary.pending_ar_90_days.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="outstanding-ap">Outstanding AP</TabsTrigger>
          <TabsTrigger value="pending-ar">Pending AR</TabsTrigger>
          <TabsTrigger value="settlement-matching">Settlement Matching</TabsTrigger>
        </TabsList>

        {/* Outstanding AP Report */}
        <TabsContent value="outstanding-ap">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Outstanding Debit Notes (Aging Report)</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={() => exportToExcel(outstandingDebitNotes, 'outstanding_ap_report', 'Outstanding AP')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Debit Note</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : outstandingDebitNotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No outstanding debit notes found
                      </TableCell>
                    </TableRow>
                  ) : (
                    outstandingDebitNotes.map((dn) => (
                      <TableRow key={dn.id}>
                        <TableCell className="font-medium">{dn.debit_note_number}</TableCell>
                        <TableCell>{format(parseISO(dn.debit_note_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{dn.supplier_name}</TableCell>
                        <TableCell className="text-right">₹{dn.total_amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          ₹{dn.outstanding_amount.toLocaleString()}
                        </TableCell>
                        <TableCell>{getAgingBadge(dn.days_outstanding)}</TableCell>
                        <TableCell>
                          <Badge variant={dn.settlement_status === 'open' ? 'destructive' : 'secondary'}>
                            {dn.settlement_status === 'open' ? 'Open' : 'Partially Settled'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending AR Report */}
        <TabsContent value="pending-ar">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pending Credit Notes (RSO Processing Report)</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={() => exportToExcel(pendingCreditNotes, 'pending_ar_report', 'Pending AR')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RSO Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Days Pending</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : pendingCreditNotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No pending credit notes found
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingCreditNotes.map((pcn) => (
                      <TableRow key={pcn.id}>
                        <TableCell className="font-medium">{pcn.rso_number}</TableCell>
                        <TableCell>{format(parseISO(pcn.rso_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{pcn.customer_name}</TableCell>
                        <TableCell className="text-right">₹{pcn.total_amount.toLocaleString()}</TableCell>
                        <TableCell>{getAgingBadge(pcn.days_pending)}</TableCell>
                        <TableCell>
                          <Badge variant={pcn.status === 'Confirmed' ? 'default' : 'secondary'}>
                            {pcn.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settlement Matching Report */}
        <TabsContent value="settlement-matching">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Settlement Matching Report</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={() => exportToExcel(settlementMatches, 'settlement_matching_report', 'Settlement Matches')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Debit Note</TableHead>
                    <TableHead>Credit Note</TableHead>
                    <TableHead className="text-right">Match Amount</TableHead>
                    <TableHead className="text-right">Match %</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : settlementMatches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No settlement matches found
                      </TableCell>
                    </TableRow>
                  ) : (
                    settlementMatches.map((match, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{match.debit_note_number}</TableCell>
                        <TableCell>{match.credit_note_number}</TableCell>
                        <TableCell className="text-right">₹{match.match_amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{match.match_percentage.toFixed(1)}%</TableCell>
                        <TableCell>
                          <Badge variant={match.status === 'fully_matched' ? 'default' : 'secondary'}>
                            {match.status === 'fully_matched' ? 'Fully Matched' : 'Partially Matched'}
                          </Badge>
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
  );
}