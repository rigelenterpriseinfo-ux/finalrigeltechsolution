import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingDown, AlertTriangle } from 'lucide-react';

interface AgingSummary {
  total_skus: number;
  total_qty: number;
  total_value: number;
  aging_0_30_qty: number;
  aging_0_30_value: number;
  aging_31_90_qty: number;
  aging_31_90_value: number;
  aging_91_180_qty: number;
  aging_91_180_value: number;
  aging_181_365_qty: number;
  aging_181_365_value: number;
  aging_365_plus_qty: number;
  aging_365_plus_value: number;
  dead_stock_skus: number;
  dead_stock_value: number;
}

export const AgingDashboardWidget = () => {
  const { company } = useAuth();
  const [agingSummary, setAgingSummary] = useState<AgingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgingSummary();
  }, [company?.id]);

  const fetchAgingSummary = async () => {
    if (!company?.id) return;
    
    try {
      const { data, error } = await supabase.rpc('get_company_aging_summary', {
        p_company_id: company.id
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setAgingSummary(data[0]);
      }
    } catch (error) {
      console.error('Error fetching aging summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Card className="animate-pulse h-48" />;
  if (!agingSummary) return null;

  const getPercentage = (value: number) => 
    Math.round((value / (agingSummary.total_value || 1)) * 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Inventory Aging Analysis
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Fresh Stock */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm">Fresh (0-30 days)</span>
            </div>
            <div className="text-right">
              <div className="font-semibold">{getPercentage(agingSummary.aging_0_30_value)}%</div>
              <div className="text-xs text-muted-foreground">₹{agingSummary.aging_0_30_value.toLocaleString()}</div>
            </div>
          </div>

          {/* Good Stock */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-sm">Good (31-90 days)</span>
            </div>
            <div className="text-right">
              <div className="font-semibold">{getPercentage(agingSummary.aging_31_90_value)}%</div>
              <div className="text-xs text-muted-foreground">₹{agingSummary.aging_31_90_value.toLocaleString()}</div>
            </div>
          </div>

          {/* Aging Stock */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <span className="text-sm">Aging (91-180 days)</span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-yellow-600">{getPercentage(agingSummary.aging_91_180_value)}%</div>
              <div className="text-xs text-muted-foreground">₹{agingSummary.aging_91_180_value.toLocaleString()}</div>
            </div>
          </div>

          {/* Slow Moving */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full" />
              <span className="text-sm">Slow (181-365 days)</span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-orange-600">{getPercentage(agingSummary.aging_181_365_value)}%</div>
              <div className="text-xs text-muted-foreground">₹{agingSummary.aging_181_365_value.toLocaleString()}</div>
            </div>
          </div>

          {/* Dead Stock */}
          {agingSummary.aging_365_plus_value > 0 && (
            <div className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700">Dead Stock (365+ days)</span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-red-600">{getPercentage(agingSummary.aging_365_plus_value)}%</div>
                <div className="text-xs text-red-500">₹{agingSummary.aging_365_plus_value.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Inventory Value</span>
            <span className="font-semibold">₹{agingSummary.total_value.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};