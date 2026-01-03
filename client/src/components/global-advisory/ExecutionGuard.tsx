import { type ReactNode } from "react";
import { AlertTriangle, Lock, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useGlobalAdvisory } from "@/contexts/GlobalAdvisoryContext";

interface ExecutionGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  showWarning?: boolean;
}

export function ExecutionGuard({ children, fallback, showWarning = true }: ExecutionGuardProps) {
  const { canExecute, selectedMarket, showExecutionRedirect } = useGlobalAdvisory();
  
  if (canExecute) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (!showWarning) {
    return null;
  }
  
  return (
    <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-900/20" data-testid="execution-guard-warning">
      <Lock className="h-4 w-4" />
      <AlertTitle>Execution Not Available</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Trading execution is not available for {selectedMarket?.marketName || "this market"}. 
          FintekPro provides analytics-only advisory for international markets.
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={showExecutionRedirect}
          className="mt-2"
          data-testid="button-show-execution-redirect"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Execute with Your Broker
        </Button>
      </AlertDescription>
    </Alert>
  );
}

interface ExecutionBlockedButtonProps {
  originalLabel: string;
  originalOnClick?: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ExecutionBlockedButton({ 
  originalLabel, 
  originalOnClick, 
  variant = "default",
  size = "default",
  className 
}: ExecutionBlockedButtonProps) {
  const { canExecute, showExecutionRedirect } = useGlobalAdvisory();
  
  if (canExecute) {
    return (
      <Button 
        variant={variant} 
        size={size} 
        className={className}
        onClick={originalOnClick}
        data-testid="button-execute-enabled"
      >
        {originalLabel}
      </Button>
    );
  }
  
  return (
    <Button 
      variant="secondary" 
      size={size} 
      className={`${className} opacity-75`}
      onClick={showExecutionRedirect}
      data-testid="button-execute-blocked"
    >
      <ExternalLink className="h-4 w-4 mr-2" />
      Discuss with Broker
    </Button>
  );
}

interface AnalyticsOnlyBannerProps {
  className?: string;
}

export function AnalyticsOnlyBanner({ className }: AnalyticsOnlyBannerProps) {
  const { isGlobalMode, selectedMarket, advisoryLevel } = useGlobalAdvisory();
  
  if (!isGlobalMode || advisoryLevel === "FULL") {
    return null;
  }
  
  return (
    <div 
      className={`flex items-center gap-2 p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm rounded-md ${className}`}
      data-testid="analytics-only-banner"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        <strong>Analytics-Only Mode:</strong> {selectedMarket?.marketName} market provides signals and analytics only. 
        Execute trades with your licensed broker.
      </span>
    </div>
  );
}
