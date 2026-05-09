import { useNetworkState, NetworkStatus } from '@/hooks/use-network-state';
import { Wifi, WifiOff, AlertTriangle, X, RefreshCw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NetworkStatusBannerProps {
  className?: string;
  showWhenOnline?: boolean;
}

export function NetworkStatusBanner({ className, showWhenOnline = false }: NetworkStatusBannerProps) {
  const { status, isOnline, isSlow, isServerError, checkConnection, lastChecked, retryCount } = useNetworkState();
  const [dismissed, setDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (status !== 'online') {
      setDismissed(false);
    }
  }, [status]);

  const handleRefresh = async () => {
    setIsChecking(true);
    await checkConnection();
    setIsChecking(false);
  };

  if (dismissed && status !== 'offline') {
    return null;
  }

  if (status === 'online' && !showWhenOnline) {
    return null;
  }

  const getBannerConfig = (status: NetworkStatus) => {
    switch (status) {
      case 'offline':
        return {
          icon: WifiOff,
          bgColor: 'bg-red-500 dark:bg-red-600',
          textColor: 'text-foreground',
          title: 'You are offline',
          message: 'Some features are unavailable. Changes will sync when connected.',
          dismissible: false,
        };
      case 'server-error':
        return {
          icon: Server,
          bgColor: 'bg-orange-500 dark:bg-orange-600',
          textColor: 'text-foreground',
          title: 'Server temporarily unavailable',
          message: retryCount > 0 ? `Retrying... (attempt ${retryCount}/3)` : 'Reconnecting automatically...',
          dismissible: true,
        };
      case 'slow':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-amber-500 dark:bg-amber-600',
          textColor: 'text-foreground',
          title: 'Slow connection detected',
          message: 'Low data mode activated. Some features may be limited.',
          dismissible: true,
        };
      case 'online':
        return {
          icon: Wifi,
          bgColor: 'bg-green-500 dark:bg-green-600',
          textColor: 'text-foreground',
          title: 'Connected',
          message: 'All features available.',
          dismissible: true,
        };
    }
  };

  const config = getBannerConfig(status);
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] px-4 py-2 flex items-center justify-between gap-4',
        config.bgColor,
        config.textColor,
        className
      )}
      role="alert"
      aria-live="polite"
      data-testid="network-status-banner"
    >
      <div className="flex items-center gap-3 flex-1">
        <Icon className={cn("h-5 w-5 flex-shrink-0", isServerError && retryCount > 0 && "animate-pulse")} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className="font-semibold text-sm" data-testid="network-status-title">
            {config.title}
          </span>
          <span className="text-sm opacity-90 hidden sm:inline">
            {config.message}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-foreground hover:bg-card/20"
          onClick={handleRefresh}
          disabled={isChecking || (isServerError && retryCount > 0)}
          data-testid="button-check-connection"
        >
          <RefreshCw className={cn('h-4 w-4', (isChecking || (isServerError && retryCount > 0)) && 'animate-spin')} />
          <span className="ml-1 hidden sm:inline">Check</span>
        </Button>

        {config.dismissible && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-foreground hover:bg-card/20"
            onClick={() => setDismissed(true)}
            data-testid="button-dismiss-banner"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function NetworkStatusIndicator({ className }: { className?: string }) {
  const { status, isSlow, isOffline, isServerError } = useNetworkState();

  if (status === 'online') {
    return null;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        isOffline && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        isServerError && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        isSlow && !isServerError && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        className
      )}
      data-testid="network-status-indicator"
    >
      {isOffline ? (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </>
      ) : isServerError ? (
        <>
          <Server className="h-3 w-3" />
          <span>Server Issue</span>
        </>
      ) : (
        <>
          <AlertTriangle className="h-3 w-3" />
          <span>Slow</span>
        </>
      )}
    </div>
  );
}

export function OfflineGuard({ 
  children, 
  fallback,
  action = 'execute'
}: { 
  children: ReactNode; 
  fallback?: ReactNode;
  action?: 'execute' | 'submit' | 'trade' | 'payment';
}) {
  const { isOffline } = useNetworkState();

  if (isOffline) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    const actionMessages: Record<string, string> = {
      execute: 'This action requires an internet connection.',
      submit: 'Submission requires an internet connection.',
      trade: 'Trading requires an internet connection.',
      payment: 'Payments require an internet connection.',
    };

    return (
      <div className="flex flex-col items-center justify-center p-6 text-center bg-muted/50 rounded-lg border border-dashed" data-testid="offline-guard-message">
        <WifiOff className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          {actionMessages[action]}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Please check your connection and try again.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
