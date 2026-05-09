import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DraftStatus } from '@/lib/draft-storage';
import { useNetworkState } from '@/hooks/use-network-state';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SyncStatusIndicatorProps {
  status: DraftStatus;
  lastSaved?: Date | null;
  onRetry?: () => void;
  className?: string;
  showLabel?: boolean;
}

export function SyncStatusIndicator({
  status,
  lastSaved,
  onRetry,
  className,
  showLabel = true,
}: SyncStatusIndicatorProps) {
  const { isOffline } = useNetworkState();

  const getStatusConfig = () => {
    switch (status) {
      case 'synced':
        return {
          icon: Check,
          label: 'Saved',
          description: lastSaved ? `Last saved ${formatTime(lastSaved)}` : 'All changes saved',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
        };
      case 'pending':
        return {
          icon: isOffline ? CloudOff : Clock,
          label: isOffline ? 'Saved locally' : 'Saving...',
          description: isOffline 
            ? 'Changes saved offline. Will sync when connected.' 
            : 'Saving your changes...',
          color: isOffline ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400',
          bgColor: isOffline ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30',
        };
      case 'syncing':
        return {
          icon: RefreshCw,
          label: 'Syncing',
          description: 'Syncing your changes...',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          animate: true,
        };
      case 'failed':
        return {
          icon: AlertCircle,
          label: 'Sync failed',
          description: 'Failed to save. Click to retry.',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
        };
      default:
        return {
          icon: Cloud,
          label: 'Ready',
          description: 'Ready to sync',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/30',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
            config.bgColor,
            config.color,
            status === 'failed' && onRetry && 'cursor-pointer hover:opacity-80',
            className
          )}
          onClick={status === 'failed' && onRetry ? onRetry : undefined}
          data-testid="sync-status-indicator"
        >
          <Icon className={cn('h-3 w-3', config.animate && 'animate-spin')} />
          {showLabel && <span>{config.label}</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

export function QueuedActionsBadge({ count }: { count: number }) {
  const { isOffline } = useNetworkState();

  if (count === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" data-testid="queued-actions-badge">
          <Clock className="h-3 w-3" />
          <span>{count} queued</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {isOffline 
            ? `${count} action(s) will be processed when you're back online.`
            : `${count} action(s) queued for processing.`
          }
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ComplianceDisclosure({ 
  type = 'execution',
  className 
}: { 
  type?: 'execution' | 'offline' | 'advisory';
  className?: string;
}) {
  const disclosures = {
    execution: 'Execution will occur only after internet connectivity is restored and confirmed.',
    offline: 'Actions performed while offline are drafts only. No transactions will be executed until you are online.',
    advisory: 'This is for informational purposes only and does not constitute financial advice. Please consult a SEBI-registered advisor before making investment decisions.',
  };

  return (
    <div className={cn(
      'text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg border border-dashed',
      className
    )} data-testid="compliance-disclosure">
      <p>{disclosures[type]}</p>
    </div>
  );
}

export function OfflineActionMessage({ 
  action,
  onDismiss
}: { 
  action: 'saved' | 'queued' | 'synced' | 'failed';
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (action === 'synced') {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [action, onDismiss]);

  if (!visible) return null;

  const messages = {
    saved: {
      icon: CloudOff,
      title: 'Saved locally',
      description: 'Your changes have been saved on this device.',
      color: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    },
    queued: {
      icon: Clock,
      title: 'Queued for sync',
      description: 'This action will be processed when you reconnect.',
      color: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
    },
    synced: {
      icon: Check,
      title: 'Synced',
      description: 'Your changes have been saved to the server.',
      color: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30',
    },
    failed: {
      icon: AlertCircle,
      title: 'Failed',
      description: 'Could not save your changes. Please try again.',
      color: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
    },
  };

  const config = messages[action] || messages.queued;
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border',
      config.color
    )} data-testid="offline-action-message">
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-sm">{config.title}</p>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </div>
      {onDismiss && (
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDismiss}>
          ×
        </Button>
      )}
    </div>
  );
}
