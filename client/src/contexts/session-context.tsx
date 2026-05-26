import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { clearAuthenticationFlag, clearStoredSessionId } from "@/lib/queryClient";

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
  handleLogoutAndRedirect: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

let globalSessionExpiredCallback: ((expired: boolean, retryContext?: RetryContext) => void) | null = null;
let isSessionExpiredTriggered = false;

export function notifySessionExpired(retryContext?: RetryContext) {
  if (globalSessionExpiredCallback && !isSessionExpiredTriggered) {
    isSessionExpiredTriggered = true;
    globalSessionExpiredCallback(true, retryContext);
  }
}

export function resetSessionExpiredFlag() {
  isSessionExpiredTriggered = false;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [retryContext, setRetryContext] = useState<RetryContext | null>(null);
  const isLoggingOut = useRef(false);

  const setSessionExpired = useCallback((expired: boolean, context?: RetryContext) => {
    setIsSessionExpired(expired);
    if (context) {
      setRetryContext(context);
    }
  }, []);

  const clearSessionExpired = useCallback(() => {
    setIsSessionExpired(false);
    setRetryContext(null);
    resetSessionExpiredFlag();
  }, []);

  const handleLogoutAndRedirect = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    
    try {
      await fetch('/api/logout', { 
        method: 'POST', 
        credentials: 'include' 
      });
    } catch (e) {
      console.warn('[Session] Logout request failed, continuing with redirect');
    }
    
    clearSessionExpired();
    clearAuthenticationFlag();
    clearStoredSessionId();
    isLoggingOut.current = false;
    window.location.href = '/auth';
  }, [clearSessionExpired]);

  globalSessionExpiredCallback = setSessionExpired;

  const value = useMemo(() => ({
    isSessionExpired,
    retryContext,
    setSessionExpired,
    clearSessionExpired,
    handleLogoutAndRedirect,
  }), [isSessionExpired, retryContext, setSessionExpired, clearSessionExpired, handleLogoutAndRedirect]);

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
