import { useState, useEffect, useCallback } from 'react';
import { useNetworkState } from '@/hooks/use-network-state';
import { useAuth } from '@/hooks/useAuth';
import { actionQueueService, startSyncListener } from '@/lib/action-queue';
import { QueuedActionsBadge, ComplianceDisclosure } from '@/components/SyncStatusIndicator';
import { cn } from '@/lib/utils';

export function GlobalActionQueueMonitor() {
  const { user } = useAuth();
  const { status } = useNetworkState();
  const [queuedCount, setQueuedCount] = useState(0);

  const userId = user?.id ? String(user.id) : null;
  const isOffline = status === 'offline';

  const updateCount = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await actionQueueService.getPendingCount(userId);
      setQueuedCount(count);
    } catch (error) {
      console.error('[GlobalActionQueueMonitor] Failed to get pending count:', error);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    updateCount();
    const intervalId = setInterval(updateCount, 5000);
    const cleanup = startSyncListener(userId);

    const handleOnline = () => {
      setTimeout(updateCount, 2000);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(intervalId);
      cleanup();
      window.removeEventListener('online', handleOnline);
    };
  }, [userId, updateCount]);

  if (queuedCount === 0) {
    return null;
  }

  return (
    <div 
      className={cn(
        'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs',
        'animate-in slide-in-from-right-5 duration-300'
      )}
      data-testid="global-action-queue-monitor"
    >
      <div className="bg-card border rounded-lg shadow-lg p-3">
        <QueuedActionsBadge count={queuedCount} />
        {isOffline && queuedCount > 0 && (
          <div className="mt-2">
            <ComplianceDisclosure type="offline" />
          </div>
        )}
      </div>
    </div>
  );
}
