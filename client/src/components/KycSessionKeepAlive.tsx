import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KycSessionKeepAliveProps {
  sessionId: string;
  expiresAt: string | null;
  onSessionExpired?: () => void;
  onSessionExtended?: (newExpiresAt: string) => void;
}

export function KycSessionKeepAlive({ 
  sessionId, 
  expiresAt,
  onSessionExpired,
  onSessionExtended
}: KycSessionKeepAliveProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const { toast } = useToast();

  const extendSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ success: boolean; message: string; expiresAt: string }>(
        `/api/kyc/production/extend-session`,
        {
          method: "POST",
          data: { sessionId },
        }
      );
    },
    onSuccess: (data) => {
      toast({
        title: "Session Extended",
        description: "Your session has been extended by 30 minutes.",
      });
      setShowDialog(false);
      // Pass the new expiration time to the parent
      if (data.expiresAt) {
        onSessionExtended?.(data.expiresAt);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to extend session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ success: boolean; message: string }>(
        `/api/kyc/production/cancel-session`,
        {
          method: "POST",
          data: { sessionId },
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Session Ended",
        description: "Your KYC session has been ended.",
      });
      setShowDialog(false);
      onSessionExpired?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to end session. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!expiresAt) return;

    const checkExpiration = () => {
      const now = new Date();
      const expiryDate = new Date(expiresAt);
      const minutesLeft = Math.floor((expiryDate.getTime() - now.getTime()) / 1000 / 60);

      setMinutesRemaining(minutesLeft);

      // Show dialog 3 minutes before expiration
      if (minutesLeft <= 3 && minutesLeft > 0 && !showDialog) {
        setShowDialog(true);
      }

      // Auto-expire if time runs out
      if (minutesLeft <= 0) {
        onSessionExpired?.();
      }
    };

    // Check immediately
    checkExpiration();

    // Check every 30 seconds
    const interval = setInterval(checkExpiration, 30000);

    return () => clearInterval(interval);
  }, [expiresAt, showDialog, onSessionExpired]);

  const handleExtend = () => {
    extendSessionMutation.mutate();
  };

  const handleEnd = () => {
    cancelSessionMutation.mutate();
  };

  return (
    <>
      {/* Session Timer Display */}
      {minutesRemaining !== null && minutesRemaining > 0 && minutesRemaining <= 5 && (
        <div className="fixed bottom-4 right-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 shadow-lg z-50">
          <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
            <Clock className="h-4 w-4" />
            <span className="font-medium">
              Session expires in {minutesRemaining} {minutesRemaining === 1 ? 'minute' : 'minutes'}
            </span>
          </div>
        </div>
      )}

      {/* Keep-Alive Dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent data-testid="session-keepalive-dialog">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <AlertDialogTitle data-testid="dialog-title">
                Session About to Expire
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription data-testid="dialog-description">
              Your KYC verification session will expire in {minutesRemaining || 0} {minutesRemaining === 1 ? 'minute' : 'minutes'}.
              Would you like to continue working for another 30 minutes, or end your session now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleEnd}
              disabled={cancelSessionMutation.isPending}
              data-testid="button-end-session"
            >
              End Session
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleExtend}
              disabled={extendSessionMutation.isPending}
              data-testid="button-extend-session"
            >
              {extendSessionMutation.isPending ? "Extending..." : "Continue Working (+30 min)"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
