import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface PushSubscriptionState {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AgentNotification {
  id: string;
  type: 'lead_assigned' | 'task_due' | 'meeting_reminder' | 'proposal_response' | 'commission_credited';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    permission: 'unsupported',
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  const checkSupport = useCallback(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    return isSupported;
  }, []);

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<AgentNotification[]>({
    queryKey: ['/api/agent/notifications'],
    refetchInterval: 30000,
  });

  const subscribeMutation = useMutation({
    mutationFn: async (subscription: PushSubscription) => {
      return apiRequest('/api/agent/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });
    },
    onSuccess: () => {
      setState(prev => ({ ...prev, isSubscribed: true, error: null }));
    },
    onError: (error: Error) => {
      setState(prev => ({ ...prev, error: error.message }));
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest(`/api/agent/notifications/${notificationId}/read`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/agent/notifications/mark-all-read', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications'] });
    },
  });

  useEffect(() => {
    async function initializePushNotifications() {
      const isSupported = checkSupport();
      
      if (!isSupported) {
        setState({
          isSupported: false,
          permission: 'unsupported',
          isSubscribed: false,
          isLoading: false,
          error: null,
        });
        return;
      }

      const permission = Notification.permission;
      
      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        let isSubscribed = false;
        
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          isSubscribed = !!subscription;
        }

        setState({
          isSupported: true,
          permission,
          isSubscribed,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setState({
          isSupported: true,
          permission,
          isSubscribed: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to check subscription status',
        });
      }
    }

    initializePushNotifications();
  }, [checkSupport]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      return permission === 'granted';
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to request permission' 
      }));
      return false;
    }
  }, [state.isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || state.permission !== 'granted') {
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      let registration = await navigator.serviceWorker.getRegistration('/sw.js');
      
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await subscribeMutation.mutateAsync(existingSubscription);
        setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
        return true;
      }

      const subscribeOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };

      if (PUBLIC_VAPID_KEY) {
        subscribeOptions.applicationServerKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY) as any;
      }

      const subscription = await registration.pushManager.subscribe(subscribeOptions);
      await subscribeMutation.mutateAsync(subscription);
      
      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
      return true;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe' 
      }));
      return false;
    }
  }, [state.isSupported, state.permission, subscribeMutation]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }
      
      setState(prev => ({ ...prev, isSubscribed: false }));
      return true;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to unsubscribe' 
      }));
      return false;
    }
  }, [state.isSupported]);

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    const granted = await requestPermission();
    if (granted) {
      return await subscribe();
    }
    return false;
  }, [requestPermission, subscribe]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    ...state,
    notifications,
    notificationsLoading,
    unreadCount,
    requestPermission,
    subscribe,
    unsubscribe,
    enableNotifications,
    markAsRead: (id: string) => markReadMutation.mutate(id),
    markAllAsRead: () => markAllReadMutation.mutate(),
  };
}
