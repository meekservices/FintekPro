import { useCallback, useMemo } from 'react';
import { useNetworkState, NetworkStatus } from '@/hooks/use-network-state';
import { useAuth } from '@/hooks/useAuth';
import { 
  checkOfflinePermission, 
  getDisallowedActions, 
  getAllowedActions,
  ActionCategory,
  UserRole,
  OFFLINE_CAPABILITIES
} from '@/lib/offline-rbac';
import { useToast } from '@/hooks/use-toast';

export function useOfflineRBAC() {
  const { status: networkStatus } = useNetworkState();
  const { user } = useAuth();
  const { toast } = useToast();

  const userRole: UserRole = useMemo(() => {
    if (!user) return 'client';
    const roles = user.roles as string[] | undefined;
    if (roles && roles.length > 0) {
      if (roles.includes('admin')) return 'admin';
      if (roles.includes('agent')) return 'agent';
      if (roles.includes('partner')) return 'partner';
    }
    return 'client';
  }, [user]);

  const networkState = useMemo(() => {
    return networkStatus as 'online' | 'offline' | 'slow';
  }, [networkStatus]);

  const canPerformAction = useCallback((action: ActionCategory): boolean => {
    const result = checkOfflinePermission(userRole, action, networkState);
    return result.allowed;
  }, [userRole, networkState]);

  const getActionMessage = useCallback((action: ActionCategory): string | undefined => {
    const result = checkOfflinePermission(userRole, action, networkState);
    return result.message;
  }, [userRole, networkState]);

  const tryAction = useCallback((action: ActionCategory, onAllowed: () => void): boolean => {
    const result = checkOfflinePermission(userRole, action, networkState);
    
    if (result.allowed) {
      onAllowed();
      return true;
    }
    
    toast({
      title: 'Action not available',
      description: result.message || 'This action is not available in your current network state.',
      variant: 'destructive',
    });
    
    return false;
  }, [userRole, networkState, toast]);

  const disallowedActions = useMemo(() => {
    return getDisallowedActions(userRole, networkState);
  }, [userRole, networkState]);

  const allowedActions = useMemo(() => {
    return getAllowedActions(userRole, networkState);
  }, [userRole, networkState]);

  const offlineCapabilities = useMemo(() => {
    return OFFLINE_CAPABILITIES[userRole];
  }, [userRole]);

  const isExecutionBlocked = useMemo(() => {
    return !canPerformAction('execute');
  }, [canPerformAction]);

  const isSubmissionBlocked = useMemo(() => {
    return !canPerformAction('submit');
  }, [canPerformAction]);

  const isPaymentBlocked = useMemo(() => {
    return !canPerformAction('payment');
  }, [canPerformAction]);

  const isTradeBlocked = useMemo(() => {
    return !canPerformAction('trade');
  }, [canPerformAction]);

  return {
    userRole,
    networkState,
    canPerformAction,
    getActionMessage,
    tryAction,
    disallowedActions,
    allowedActions,
    offlineCapabilities,
    isExecutionBlocked,
    isSubmissionBlocked,
    isPaymentBlocked,
    isTradeBlocked,
  };
}

export function withOfflineGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredAction: ActionCategory
) {
  return function OfflineGuardedComponent(props: P) {
    const { canPerformAction, getActionMessage } = useOfflineRBAC();

    if (!canPerformAction(requiredAction)) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/50 rounded-lg border border-dashed" data-testid="offline-guard-blocked">
          <p className="text-sm text-muted-foreground">
            {getActionMessage(requiredAction)}
          </p>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}
