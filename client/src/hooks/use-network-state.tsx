import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export type NetworkStatus = 'online' | 'offline' | 'slow';

interface NetworkState {
  status: NetworkStatus;
  isOnline: boolean;
  isOffline: boolean;
  isSlow: boolean;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
  lastChecked: Date;
}

interface NetworkContextValue extends NetworkState {
  checkConnection: () => Promise<NetworkStatus>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [state, setState] = useState<NetworkState>(() => ({
    status: navigator.onLine ? 'online' : 'offline',
    isOnline: navigator.onLine,
    isOffline: !navigator.onLine,
    isSlow: false,
    effectiveType: null,
    downlink: null,
    rtt: null,
    lastChecked: new Date(),
  }));

  const getNetworkInfo = useCallback(() => {
    const connection = (navigator as any).connection || 
                       (navigator as any).mozConnection || 
                       (navigator as any).webkitConnection;
    
    if (connection) {
      return {
        effectiveType: connection.effectiveType || null,
        downlink: connection.downlink || null,
        rtt: connection.rtt || null,
      };
    }
    return { effectiveType: null, downlink: null, rtt: null };
  }, []);

  const determineStatus = useCallback((isOnline: boolean, networkInfo: { effectiveType: string | null; downlink: number | null; rtt: number | null }): NetworkStatus => {
    if (!isOnline) return 'offline';
    
    if (networkInfo.effectiveType) {
      if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
        return 'slow';
      }
      if (networkInfo.effectiveType === '3g' && networkInfo.rtt && networkInfo.rtt > 400) {
        return 'slow';
      }
    }
    
    if (networkInfo.downlink !== null && networkInfo.downlink < 0.5) {
      return 'slow';
    }
    
    if (networkInfo.rtt !== null && networkInfo.rtt > 500) {
      return 'slow';
    }
    
    return 'online';
  }, []);

  const checkConnection = useCallback(async (): Promise<NetworkStatus> => {
    const isOnline = navigator.onLine;
    const networkInfo = getNetworkInfo();
    
    if (!isOnline) {
      const newStatus = 'offline';
      setState(prev => ({
        ...prev,
        status: newStatus,
        isOnline: false,
        isOffline: true,
        isSlow: false,
        ...networkInfo,
        lastChecked: new Date(),
      }));
      return newStatus;
    }

    try {
      const startTime = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch('/api/health', { 
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      const responseTime = performance.now() - startTime;
      
      let status: NetworkStatus = determineStatus(true, networkInfo);
      if (responseTime > 2000) {
        status = 'slow';
      }
      
      setState(prev => ({
        ...prev,
        status,
        isOnline: status !== 'offline',
        isOffline: status === 'offline',
        isSlow: status === 'slow',
        ...networkInfo,
        lastChecked: new Date(),
      }));
      
      return status;
    } catch (error) {
      const newStatus = 'offline';
      setState(prev => ({
        ...prev,
        status: newStatus,
        isOnline: false,
        isOffline: true,
        isSlow: false,
        ...networkInfo,
        lastChecked: new Date(),
      }));
      return newStatus;
    }
  }, [getNetworkInfo, determineStatus]);

  useEffect(() => {
    const handleOnline = () => {
      checkConnection();
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        status: 'offline',
        isOnline: false,
        isOffline: true,
        isSlow: false,
        lastChecked: new Date(),
      }));
    };

    const handleConnectionChange = () => {
      checkConnection();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = (navigator as any).connection || 
                       (navigator as any).mozConnection || 
                       (navigator as any).webkitConnection;
    
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    checkConnection();

    const intervalId = setInterval(checkConnection, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
      clearInterval(intervalId);
    };
  }, [checkConnection]);

  return (
    <NetworkContext.Provider value={{ ...state, checkConnection }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkState() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetworkState must be used within a NetworkProvider');
  }
  return context;
}

export function useIsOnline(): boolean {
  const { isOnline } = useNetworkState();
  return isOnline;
}

export function useIsOffline(): boolean {
  const { isOffline } = useNetworkState();
  return isOffline;
}

export function useNetworkStatus(): NetworkStatus {
  const { status } = useNetworkState();
  return status;
}
