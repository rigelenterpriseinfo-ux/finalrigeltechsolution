import React from 'react';
import { ArrowLeft, Bell, BellOff, Moon, Volume2, VolumeX, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

interface NotificationPreferencesProps {
  onBack: () => void;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ onBack }) => {
  const { preferences, updatePreferences } = useNotifications();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-6 pb-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">Notification Preferences</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Master Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {preferences.enabled ? (
                <Bell className="h-5 w-5 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="enabled" className="text-base font-medium">
                  Enable Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for important updates
                </p>
              </div>
            </div>
            <Switch
              id="enabled"
              checked={preferences.enabled}
              onCheckedChange={(enabled) => updatePreferences({ enabled })}
            />
          </div>
        </div>

        <Separator />

        {/* Sound & Vibration */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Sound & Haptics</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {preferences.sound ? (
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="sound" className="font-medium">
                  Sound
                </Label>
                <p className="text-xs text-muted-foreground">
                  Play sound for high-priority alerts
                </p>
              </div>
            </div>
            <Switch
              id="sound"
              checked={preferences.sound}
              disabled={!preferences.enabled}
              onCheckedChange={(sound) => updatePreferences({ sound })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="vibration" className="font-medium">
                  Vibration
                </Label>
                <p className="text-xs text-muted-foreground">
                  Vibrate for important notifications
                </p>
              </div>
            </div>
            <Switch
              id="vibration"
              checked={preferences.vibration}
              disabled={!preferences.enabled}
              onCheckedChange={(vibration) => updatePreferences({ vibration })}
            />
          </div>
        </div>

        <Separator />

        {/* Desktop Notifications */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Desktop</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="desktop" className="font-medium">
                  Desktop Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show system notifications for urgent alerts
                </p>
              </div>
            </div>
            <Switch
              id="desktop"
              checked={preferences.desktop}
              disabled={!preferences.enabled}
              onCheckedChange={(desktop) => updatePreferences({ desktop })}
            />
          </div>
        </div>

        <Separator />

        {/* Quiet Hours */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Quiet Hours</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="quietHours" className="font-medium">
                Enable Quiet Hours
              </Label>
              <p className="text-xs text-muted-foreground">
                Mute non-urgent notifications during specified times
              </p>
            </div>
            <Switch
              id="quietHours"
              checked={preferences.quietHours.enabled}
              disabled={!preferences.enabled}
              onCheckedChange={(enabled) =>
                updatePreferences({
                  quietHours: { ...preferences.quietHours, enabled },
                })
              }
            />
          </div>

          {preferences.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div className="space-y-2">
                <Label htmlFor="start" className="text-xs text-muted-foreground">
                  Start Time
                </Label>
                <Input
                  id="start"
                  type="time"
                  value={preferences.quietHours.start}
                  onChange={(e) =>
                    updatePreferences({
                      quietHours: {
                        ...preferences.quietHours,
                        start: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end" className="text-xs text-muted-foreground">
                  End Time
                </Label>
                <Input
                  id="end"
                  type="time"
                  value={preferences.quietHours.end}
                  onChange={(e) =>
                    updatePreferences({
                      quietHours: {
                        ...preferences.quietHours,
                        end: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Categories */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Notification Categories</h3>
          <p className="text-xs text-muted-foreground">
            Choose which types of notifications you want to receive
          </p>

          {Object.entries(preferences.categories).map(([category, enabled]) => (
            <div key={category} className="flex items-center justify-between">
              <Label htmlFor={category} className="font-medium capitalize">
                {category}
              </Label>
              <Switch
                id={category}
                checked={enabled}
                disabled={!preferences.enabled}
                onCheckedChange={(value) =>
                  updatePreferences({
                    categories: {
                      ...preferences.categories,
                      [category]: value,
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
