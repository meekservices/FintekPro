import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

interface RetryContext {
  queryKey?: readonly unknown[];
  url?: string;
  method?: string;
  body?: any;
}

interface SessionContextType {
  isSessionExpired: boolean;
  retryContext: RetryContext | null;
  setSessionExpired: (expired: boolean, retryContext?: RetryContext) => void;
  clearSessionExpired: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

let globalSessionExpiredCallback: ((expired: boolean, retryContext?: RetryContext) => void) | null = null;

export function notifySessionExpired(retryContext?: RetryContext) {
  if (globalSessionExpiredCallback) {
    globalSessionExpiredCallback(true, retryContext);
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [retryContext, setRetryContext] = useState<RetryContext | null>(null);

  const setSessionExpired = useCallback((expired: boolean, context?: RetryContext) => {
    setIsSessionExpired(expired);
    if (context) {
      setRetryContext(context);
    }
  }, []);

  const clearSessionExpired = useCallback(() => {
    setIsSessionExpired(false);
    setRetryContext(null);
  }, []);

  globalSessionExpiredCallback = setSessionExpired;

  const value = useMemo(() => ({
    isSessionExpired,
    retryContext,
    setSessionExpired,
    clearSessionExpired,
  }), [isSessionExpired, retryContext, setSessionExpired, clearSessionExpired]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
