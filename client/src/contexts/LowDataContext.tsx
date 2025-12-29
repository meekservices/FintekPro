import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNetworkState } from '@/hooks/use-network-state';

interface LowDataContextValue {
  isLowDataMode: boolean;
  isAutoLowData: boolean;
  manualOverride: boolean | null;
  setManualOverride: (value: boolean | null) => void;
  toggleLowDataMode: () => void;
}

const LowDataContext = createContext<LowDataContextValue | null>(null);

const LOW_DATA_STORAGE_KEY = 'fintekpro-low-data-mode';

export function LowDataProvider({ children }: { children: ReactNode }) {
  const { isSlow, isOffline } = useNetworkState();
  const [manualOverride, setManualOverrideState] = useState<boolean | null>(() => {
    const stored = localStorage.getItem(LOW_DATA_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const isAutoLowData = isSlow || isOffline;
  
  const isLowDataMode = manualOverride !== null ? manualOverride : isAutoLowData;

  const setManualOverride = (value: boolean | null) => {
    setManualOverrideState(value);
    if (value !== null) {
      localStorage.setItem(LOW_DATA_STORAGE_KEY, JSON.stringify(value));
    } else {
      localStorage.removeItem(LOW_DATA_STORAGE_KEY);
    }
  };

  const toggleLowDataMode = () => {
    if (manualOverride === null) {
      setManualOverride(!isAutoLowData);
    } else {
      setManualOverride(!manualOverride);
    }
  };

  useEffect(() => {
    if (isLowDataMode) {
      document.documentElement.classList.add('low-data-mode');
    } else {
      document.documentElement.classList.remove('low-data-mode');
    }
  }, [isLowDataMode]);

  return (
    <LowDataContext.Provider
      value={{
        isLowDataMode,
        isAutoLowData,
        manualOverride,
        setManualOverride,
        toggleLowDataMode,
      }}
    >
      {children}
    </LowDataContext.Provider>
  );
}

export function useLowDataMode() {
  const context = useContext(LowDataContext);
  if (!context) {
    throw new Error('useLowDataMode must be used within a LowDataProvider');
  }
  return context;
}
