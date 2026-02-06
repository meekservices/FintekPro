import { useEffect, useRef, useCallback, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

interface IdleTimeoutManagerProps {
  isAuthenticated: boolean;
  timeoutMinutes?: number;
}

export function IdleTimeoutManager({ isAuthenticated, timeoutMinutes = 15 }: IdleTimeoutManagerProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityThresholdRef = useRef(timeoutMinutes * 60 * 1000);

  // Reset idle timer on user activity
  const resetIdleTimer = useCallback(() => {
    // Clear existing timers
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    
    // Reset state
    setShowWarning(false);
    setCountdown(60);

    if (!isAuthenticated) return;

    // Set new idle timer
    idleTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, inactivityThresholdRef.current);
  }, [isAuthenticated]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    try {
      await fetch('/api/logout', { 
        method: 'POST', 
        credentials: 'include' 
      });
    } catch (e) {
      console.warn('[IdleTimeout] Logout request failed, continuing with redirect');
    }

    window.location.href = '/auth';
  }, []);

  // Handle "Stay Logged In" button click
  const handleStayLoggedIn = useCallback(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Start countdown when warning dialog is shown
  useEffect(() => {
    if (!showWarning) return;

    let timeLeft = 60;
    setCountdown(timeLeft);

    countdownTimerRef.current = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);

      if (timeLeft <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
        handleLogout();
      }
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [showWarning, handleLogout]);

  // Setup activity listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousemove', 'click', 'keypress', 'scroll', 'touchstart'];
    
    // Use a flag to debounce event handlers
    let isResetting = false;

    const handleActivity = () => {
      if (isResetting || showWarning) return;
      isResetting = true;
      resetIdleTimer();
      setTimeout(() => {
        isResetting = false;
      }, 1000); // Debounce for 1 second
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initialize the timer on mount
    resetIdleTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [isAuthenticated, showWarning, resetIdleTimer]);

  if (!isAuthenticated) return null;

  return (
    <Dialog open={showWarning} onOpenChange={setShowWarning}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <DialogTitle>Session Timeout Warning</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <DialogDescription className="text-base">
            Your session will expire due to inactivity in <span className="font-semibold text-red-600 dark:text-red-400">{countdown} seconds</span>.
          </DialogDescription>
          
          <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Security Notice:</span> As per RBI Digital Lending Guidelines, sessions are automatically locked after {timeoutMinutes} minutes of inactivity for your security.
            </p>
          </div>

          <div className="flex items-center justify-center">
            <div className="text-4xl font-bold text-red-600 dark:text-red-400 tabular-nums w-16 text-center">
              {countdown.toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleLogout()}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout Now
          </Button>
          <Button
            variant="default"
            onClick={handleStayLoggedIn}
            className="flex items-center gap-2"
          >
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
