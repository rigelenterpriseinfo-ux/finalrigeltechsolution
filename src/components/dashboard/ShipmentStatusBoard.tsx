import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Truck, MapPin, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ShipmentStatus } from '@/hooks/useOperationsData';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ShipmentStatusBoardProps {
  statuses: ShipmentStatus[];
  loading?: boolean;
}

const statusConfig = {
  pending: {
    icon: Package,
    label: 'Pending',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    badgeVariant: 'default' as const,
  },
  dispatched: {
    icon: Truck,
    label: 'Dispatched',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    badgeVariant: 'secondary' as const,
  },
  in_transit: {
    icon: MapPin,
    label: 'In Transit',
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    badgeVariant: 'outline' as const,
  },
  delivered: {
    icon: CheckCircle,
    label: 'Delivered',
    color: 'bg-green-500/10 text-green-600 border-green-500/30',
    badgeVariant: 'outline' as const,
  },
};

export const ShipmentStatusBoard: React.FC<ShipmentStatusBoardProps> = ({
  statuses,
  loading = false,
}) => {
  const navigate = useNavigate();
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Shipment Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Shipment Status</h3>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => navigate('/dashboard?module=tracking')}
        >
          View All
        </Button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statuses.map((status) => {
          const config = statusConfig[status.status];
          const Icon = config.icon;
          const isExpanded = expandedStatus === status.status;

          return (
            <div key={status.status}>
              <Card 
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md border',
                  config.color
                )}
                onClick={() => setExpandedStatus(isExpanded ? null : status.status)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('p-2 rounded-lg', config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant={config.badgeVariant} className="text-xs">
                      {status.count}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{config.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {status.count} {status.count === 1 ? 'order' : 'orders'}
                    </p>
                  </div>
                  {status.orders.length > 0 && (
                    <div className="mt-2 flex items-center justify-center">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expanded Order List */}
              {isExpanded && status.orders.length > 0 && (
                <Card className="mt-2 border-l-4" style={{ borderLeftColor: config.color.split(' ')[0].replace('bg-', '').replace('/10', '') }}>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      {status.orders.map((order) => (
                        <div 
                          key={order.id}
                          className="flex items-center justify-between p-2 hover:bg-muted/50 rounded text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{order.orderNumber}</p>
                            <p className="text-muted-foreground truncate">{order.customerName}</p>
                          </div>
                          <span className="font-semibold ml-2 whitespace-nowrap">
                            ₹{order.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
