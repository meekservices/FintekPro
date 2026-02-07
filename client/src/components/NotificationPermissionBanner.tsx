import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NotificationPermissionBannerProps {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  onEnableNotifications: () => Promise<boolean>;
  isLoading?: boolean;
}

const BANNER_DISMISSED_KEY = 'notification_banner_dismissed';

export function NotificationPermissionBanner({
  isSupported,
  permission,
  isSubscribed,
  onEnableNotifications,
  isLoading = false,
}: NotificationPermissionBannerProps) {
  const [dismissed, setDismissed] = useState(true);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (!wasDismissed) {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
  };

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const success = await onEnableNotifications();
      if (success) {
        setDismissed(true);
      }
    } finally {
      setEnabling(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  if (permission === 'denied') {
    return null;
  }

  if (isSubscribed || permission === 'granted') {
    return null;
  }

  if (dismissed || isLoading) {
    return null;
  }

  return (
    <div 
      className={cn(
        "bg-gradient-to-r from-emerald-600 to-teal-600 text-foreground px-4 py-3",
        "flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300"
      )}
      data-testid="notification-permission-banner"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-card/20 rounded-full">
          <Bell className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">Stay updated with notifications</p>
          <p className="text-xs text-foreground/80">
            Get alerts for new leads, tasks, and client updates
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleEnable}
          disabled={enabling}
          className="bg-card text-emerald-700 hover:bg-card/90"
          data-testid="button-enable-notifications"
        >
          {enabling ? 'Enabling...' : 'Enable Notifications'}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="text-foreground hover:bg-card/20 h-8 w-8"
          data-testid="button-dismiss-notification-banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
