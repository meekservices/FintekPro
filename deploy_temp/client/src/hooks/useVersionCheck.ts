import { useState, useEffect, useCallback } from "react";
import { APP_VERSION, VERSION_CHECK_INTERVAL } from "@shared/version";

interface VersionInfo {
  version: string;
  buildTimestamp: string;
  serverTime: string;
}

interface VersionCheckResult {
  isOutdated: boolean;
  currentVersion: string;
  serverVersion: string | null;
  lastChecked: Date | null;
  isChecking: boolean;
  error: string | null;
  checkNow: () => Promise<void>;
  dismissUpdate: () => void;
  forceUpdate: () => void;
}

export function useVersionCheck(): VersionCheckResult {
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkVersion = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      const response = await fetch("/api/version", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch version");
      }
      
      const data = await response.json();
      
      if (data.success && data.data?.version) {
        setServerVersion(data.data.version);
        setLastChecked(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Version check failed");
    } finally {
      setIsChecking(false);
    }
  }, []);

  const forceUpdate = useCallback(async () => {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        }
      } catch (err) {
        console.error("Service worker update failed:", err);
      }
    }
    
    sessionStorage.removeItem("versionDismissed");
    window.location.reload();
  }, []);

  const dismissUpdate = useCallback(() => {
    if (serverVersion) {
      setIsDismissed(true);
      sessionStorage.setItem("versionDismissed", serverVersion);
    }
  }, [serverVersion]);

  useEffect(() => {
    if (serverVersion) {
      const dismissed = sessionStorage.getItem("versionDismissed");
      if (dismissed === serverVersion) {
        setIsDismissed(true);
      } else if (dismissed && dismissed !== serverVersion) {
        setIsDismissed(false);
        sessionStorage.removeItem("versionDismissed");
      }
    }
  }, [serverVersion]);

  useEffect(() => {
    checkVersion();
    
    const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, [checkVersion]);

  const isOutdated = !isDismissed && serverVersion !== null && serverVersion !== APP_VERSION;

  return {
    isOutdated,
    currentVersion: APP_VERSION,
    serverVersion,
    lastChecked,
    isChecking,
    error,
    checkNow: checkVersion,
    dismissUpdate,
    forceUpdate
  };
}
