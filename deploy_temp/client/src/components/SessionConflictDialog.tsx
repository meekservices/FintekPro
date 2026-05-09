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
import { AlertTriangle } from "lucide-react";

interface SessionConflictDialogProps {
  open: boolean;
  onContinue: () => void;
  onForceLogout: () => void;
  sessionCount?: number;
}

export function SessionConflictDialog({
  open,
  onContinue,
  onForceLogout,
  sessionCount = 1,
}: SessionConflictDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent data-testid="dialog-session-conflict">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <AlertDialogTitle data-testid="text-dialog-title">Active Session Detected</AlertDialogTitle>
          </div>
          <AlertDialogDescription data-testid="text-dialog-description">
            You're already logged in from {sessionCount === 1 ? "another session" : `${sessionCount} other sessions`}.
            <br /><br />
            Choose to continue with your existing session or force logout to start a fresh session with updated permissions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={onContinue}
            data-testid="button-continue-session"
          >
            Continue Session
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onForceLogout}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-force-logout"
          >
            Force Logout & Login Fresh
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
