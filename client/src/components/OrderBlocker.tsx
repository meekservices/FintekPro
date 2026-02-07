import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info, ShieldAlert, ArrowRight, RefreshCw, CheckCircle2, Circle } from "lucide-react";
import { useLocation } from "wouter";
import { ComplianceError } from "@/hooks/use-order-guard";

interface OrderBlockerProps {
  error: ComplianceError | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  variant?: "inline" | "modal" | "card";
  showDetails?: boolean;
}

const severityIcons = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

const severityColors = {
  error: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400"
};

const severityBg = {
  error: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
  warning: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800",
  info: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
};

function KycTierBadge({ tier, variant }: { tier: string; variant: "current" | "required" }) {
  const bgColor = variant === "current" 
    ? "bg-muted text-muted-foreground"
    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
  return (
    <Badge variant="outline" className={bgColor}>
      {tier}
    </Badge>
  );
}

function MissingStepsChecklist({ steps }: { steps: string[] }) {
  return (
    <div className="mt-3 p-3 bg-muted rounded-lg border border-border">
      <p className="text-sm font-medium text-muted-foreground mb-2">Missing Requirements:</p>
      <ul className="space-y-1.5">
        {steps.map((step, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Circle className="h-3.5 w-3.5 text-amber-500" />
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KycTierComparison({ current, required }: { current: string; required: string }) {
  return (
    <div className="flex items-center gap-2 mt-3 p-3 bg-muted rounded-lg border border-border">
      <div className="flex-1 text-center">
        <p className="text-xs text-muted-foreground mb-1">Current</p>
        <KycTierBadge tier={current} variant="current" />
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 text-center">
        <p className="text-xs text-muted-foreground mb-1">Required</p>
        <KycTierBadge tier={required} variant="required" />
      </div>
    </div>
  );
}

export function OrderBlocker({ 
  error, 
  onDismiss, 
  onRetry,
  variant = "inline",
  showDetails = true 
}: OrderBlockerProps) {
  const [, navigate] = useLocation();

  if (!error) return null;

  const Icon = severityIcons[error.severity];
  const colorClass = severityColors[error.severity];
  const bgClass = severityBg[error.severity];

  const handleCTA = () => {
    if (error.remediation.type === "navigate" && error.remediation.targetRoute) {
      onDismiss?.();
      navigate(error.remediation.targetRoute);
    } else if (onRetry) {
      onDismiss?.();
      onRetry();
    }
  };

  const hasKycTierInfo = error.requiredKycTier && error.currentKycTier;
  const hasMissingSteps = error.missingSteps && error.missingSteps.length > 0;

  if (variant === "modal") {
    return (
      <Dialog open={!!error} onOpenChange={() => onDismiss?.()}>
        <DialogContent className="sm:max-w-md" data-testid="order-blocker-modal">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${bgClass}`}>
                <ShieldAlert className={`h-6 w-6 ${colorClass}`} />
              </div>
              <DialogTitle className="text-xl">
                {error.severity === "error" ? "Order Cannot Be Processed" : "Action Required"}
              </DialogTitle>
            </div>
            <DialogDescription className="pt-4 text-base">
              {error.backendMessage || error.message}
            </DialogDescription>
          </DialogHeader>
          
          {hasKycTierInfo && (
            <KycTierComparison current={error.currentKycTier!} required={error.requiredKycTier!} />
          )}

          {hasMissingSteps && (
            <MissingStepsChecklist steps={error.missingSteps!} />
          )}

          {showDetails && error.details && !hasKycTierInfo && !hasMissingSteps && (
            <div className={`p-3 rounded-lg ${bgClass} border`}>
              <p className="text-sm text-muted-foreground">{error.details}</p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            {onDismiss && (
              <Button variant="outline" onClick={onDismiss} data-testid="btn-dismiss-error">
                Close
              </Button>
            )}
            <Button 
              variant={error.remediation.ctaVariant || "default"}
              onClick={handleCTA}
              className="gap-2"
              data-testid="btn-resolve-error"
            >
              {error.remediation.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (variant === "card") {
    return (
      <Card className={`${bgClass} border-2`} data-testid="order-blocker-card">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${colorClass}`} />
            <CardTitle className="text-lg">
              {error.severity === "error" ? "Order Cannot Be Processed" : "Action Required"}
            </CardTitle>
          </div>
          <CardDescription className="text-base pt-1">
            {error.backendMessage || error.message}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pb-2">
          {hasKycTierInfo && (
            <KycTierComparison current={error.currentKycTier!} required={error.requiredKycTier!} />
          )}

          {hasMissingSteps && (
            <MissingStepsChecklist steps={error.missingSteps!} />
          )}

          {showDetails && error.details && !hasKycTierInfo && !hasMissingSteps && (
            <p className="text-sm text-muted-foreground">{error.details}</p>
          )}
        </CardContent>

        <CardFooter className="gap-2 pt-2">
          {onRetry && error.remediation.type !== "navigate" && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-2" data-testid="btn-retry">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          <Button 
            variant={error.remediation.ctaVariant || "default"}
            size="sm"
            onClick={handleCTA}
            className="gap-2"
            data-testid="btn-resolve-error"
          >
            {error.remediation.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Alert variant={error.severity === "error" ? "destructive" : "default"} className={bgClass} data-testid="order-blocker-inline">
      <Icon className={`h-5 w-5 ${colorClass}`} />
      <AlertTitle className="flex items-center justify-between">
        <span>{error.severity === "error" ? "Order Failed" : "Action Required"}</span>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-2">{error.backendMessage || error.message}</p>
        
        {hasKycTierInfo && (
          <KycTierComparison current={error.currentKycTier!} required={error.requiredKycTier!} />
        )}

        {hasMissingSteps && (
          <MissingStepsChecklist steps={error.missingSteps!} />
        )}

        {showDetails && error.details && !hasKycTierInfo && !hasMissingSteps && (
          <p className="text-sm text-muted-foreground mb-3">{error.details}</p>
        )}

        <div className="flex items-center gap-2 mt-3">
          {onRetry && error.remediation.type !== "navigate" && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-2" data-testid="btn-retry">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          <Button 
            variant={error.remediation.ctaVariant || "default"}
            size="sm"
            onClick={handleCTA}
            className="gap-2"
            data-testid="btn-resolve-error"
          >
            {error.remediation.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss} data-testid="btn-dismiss-error">
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function ComplianceRequirementCard({ 
  title, 
  description, 
  requirements,
  targetRoute,
  ctaLabel = "Complete Now"
}: {
  title: string;
  description: string;
  requirements: { label: string; completed: boolean }[];
  targetRoute: string;
  ctaLabel?: string;
}) {
  const [, navigate] = useLocation();
  const allCompleted = requirements.every(r => r.completed);

  return (
    <Card className={allCompleted ? "border-green-200 dark:border-green-800" : "border-amber-200 dark:border-amber-800"} data-testid="compliance-requirement-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldAlert className={allCompleted ? "h-5 w-5 text-green-600" : "h-5 w-5 text-amber-600"} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        <ul className="space-y-2">
          {requirements.map((req, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm">
              {req.completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              <span className={req.completed ? "text-muted-foreground" : ""}>{req.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      {!allCompleted && (
        <CardFooter>
          <Button onClick={() => navigate(targetRoute)} className="w-full gap-2" data-testid="btn-complete-requirements">
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
