import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

interface ActionFailureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  errorId?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
}

export function ActionFailureModal({
  open,
  onOpenChange,
  title = "Action Failed",
  description = "We couldn't complete your request. Please try again or contact support if the problem persists.",
  errorId,
  onRetry,
  retryLabel = "Try Again",
  isRetrying = false
}: ActionFailureModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        {errorId && (
          <div className="bg-muted p-3 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">Error Reference</p>
            <code className="text-sm font-mono" data-testid="text-error-id">{errorId}</code>
          </div>
        )}
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-close"
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          {onRetry && (
            <Button 
              onClick={onRetry} 
              disabled={isRetrying}
              data-testid="button-retry"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? "Retrying..." : retryLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
