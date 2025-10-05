import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  CreditCard, 
  FileText, 
  RotateCcw,
  Inbox,
  Receipt
} from 'lucide-react';
import { RecentActivity } from '@/hooks/useOperationsData';
import { cn } from '@/lib/utils';

interface RecentActivitiesTimelineProps {
  activities: RecentActivity[];
  loading?: boolean;
}

const activityConfig = {
  po: {
    icon: Package,
    color: 'bg-blue-500/10 text-blue-600',
    iconBg: 'bg-blue-500',
  },
  payment: {
    icon: CreditCard,
    color: 'bg-green-500/10 text-green-600',
    iconBg: 'bg-green-500',
  },
  shipment: {
    icon: FileText,
    color: 'bg-purple-500/10 text-purple-600',
    iconBg: 'bg-purple-500',
  },
  invoice: {
    icon: Receipt,
    color: 'bg-amber-500/10 text-amber-600',
    iconBg: 'bg-amber-500',
  },
  grn: {
    icon: Inbox,
    color: 'bg-teal-500/10 text-teal-600',
    iconBg: 'bg-teal-500',
  },
  return: {
    icon: RotateCcw,
    color: 'bg-red-500/10 text-red-600',
    iconBg: 'bg-red-500',
  },
};

export const RecentActivitiesTimeline: React.FC<RecentActivitiesTimelineProps> = ({
  activities,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Recent Activities</h3>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Recent Activities</h3>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-center">
              No recent activities to display
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Recent Activities</h3>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-6">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

            {activities.map((activity, index) => {
              const config = activityConfig[activity.type];
              const Icon = config.icon;

              return (
                <div key={activity.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className={cn(
                    'relative z-10 flex items-center justify-center w-10 h-10 rounded-full',
                    config.iconBg
                  )}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>

                  {/* Activity content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{activity.title}</p>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {activity.relativeTime}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-xs text-muted-foreground">
                        by {activity.user}
                      </p>
                      {activity.amount && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <p className="text-xs font-semibold">
                            ₹{activity.amount.toLocaleString('en-IN')}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
