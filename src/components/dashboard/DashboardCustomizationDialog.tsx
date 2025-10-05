import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Eye, EyeOff } from 'lucide-react';
import { useDashboardCustomization } from '@/hooks/useDashboardCustomization';
import { Separator } from '@/components/ui/separator';

interface DashboardCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WIDGET_LABELS: Record<string, string> = {
  kpi: 'Key Performance Indicators',
  urgentActions: 'Urgent Actions',
  purchase: 'Purchase & Procurement',
  inventory: 'Inventory & Warehouse',
  sales: 'Sales & Customer',
  finance: 'Accounts & Finance',
  shipments: 'Shipment Status',
  activities: 'Recent Activities',
};

const REFRESH_INTERVALS = [
  { value: 60000, label: '1 minute' },
  { value: 300000, label: '5 minutes' },
  { value: 600000, label: '10 minutes' },
  { value: 1800000, label: '30 minutes' },
  { value: 3600000, label: '1 hour' },
];

export const DashboardCustomizationDialog: React.FC<DashboardCustomizationDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const {
    customization,
    toggleWidget,
    setRefreshInterval,
    toggleCompactView,
    resetCustomization,
  } = useDashboardCustomization();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <DialogTitle>Dashboard Customization</DialogTitle>
          </div>
          <DialogDescription>
            Customize your dashboard layout and preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Widget Visibility */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Widget Visibility</Label>
            <div className="space-y-3">
              {Object.entries(customization.widgets).map(([id, widget]) => (
                <div
                  key={id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {widget.visible ? (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                      {WIDGET_LABELS[id] || id}
                    </span>
                  </div>
                  <Switch
                    checked={widget.visible}
                    onCheckedChange={() => toggleWidget(id)}
                    aria-label={`Toggle ${WIDGET_LABELS[id] || id}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Display Preferences */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Display Preferences</Label>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label htmlFor="compact-view" className="font-medium">
                    Compact View
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reduce spacing between sections
                  </p>
                </div>
                <Switch
                  id="compact-view"
                  checked={customization.compactView}
                  onCheckedChange={toggleCompactView}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label htmlFor="refresh-interval" className="font-medium">
                    Auto Refresh
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatic data refresh interval
                  </p>
                </div>
                <Select
                  value={customization.refreshInterval.toString()}
                  onValueChange={(value) => setRefreshInterval(parseInt(value))}
                >
                  <SelectTrigger className="w-[140px]" id="refresh-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFRESH_INTERVALS.map((interval) => (
                      <SelectItem
                        key={interval.value}
                        value={interval.value.toString()}
                      >
                        {interval.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetCustomization();
              onOpenChange(false);
            }}
          >
            Reset to Default
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
