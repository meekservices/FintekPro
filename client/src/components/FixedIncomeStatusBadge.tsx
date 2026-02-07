import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, EyeOff, ShieldCheck } from "lucide-react";

type InstrumentStatus = 'SELLABLE' | 'VISIBLE' | 'HIDDEN';

interface FixedIncomeStatusBadgeProps {
  status: InstrumentStatus;
  showLabel?: boolean;
}

export function FixedIncomeStatusBadge({ status, showLabel = true }: FixedIncomeStatusBadgeProps) {
  switch (status) {
    case 'SELLABLE':
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-200 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {showLabel && 'Available'}
        </Badge>
      );
    case 'VISIBLE':
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200 gap-1">
          <AlertTriangle className="h-3 w-3" />
          {showLabel && 'View Only'}
        </Badge>
      );
    case 'HIDDEN':
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
          <EyeOff className="h-3 w-3" />
          {showLabel && 'Hidden'}
        </Badge>
      );
    default:
      return null;
  }
}

interface VisibleInstrumentWarningProps {
  instrumentName?: string;
  compact?: boolean;
}

export function VisibleInstrumentWarning({ instrumentName, compact = false }: VisibleInstrumentWarningProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>This instrument is shown for reference only and cannot be recommended or transacted.</span>
      </div>
    );
  }

  return (
    <Alert className="bg-amber-50 border-amber-200">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-700">
        <strong>{instrumentName || 'This instrument'}</strong> is displayed for reference only. 
        It cannot be recommended or transacted at this time due to liquidity, regulatory, or credit constraints.
      </AlertDescription>
    </Alert>
  );
}

interface InstrumentActionControlsProps {
  status: InstrumentStatus;
  onBuy?: () => void;
  onRecommend?: () => void;
  onViewDetails?: () => void;
  isLoading?: boolean;
}

export function InstrumentActionControls({ 
  status, 
  onBuy, 
  onRecommend, 
  onViewDetails,
  isLoading = false 
}: InstrumentActionControlsProps) {
  const canTransact = status === 'SELLABLE';
  
  return (
    <div className="flex gap-2">
      {canTransact ? (
        <>
          {onBuy && (
            <button 
              onClick={onBuy}
              disabled={isLoading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              Buy
            </button>
          )}
          {onRecommend && (
            <button 
              onClick={onRecommend}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              Recommend
            </button>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2 text-amber-600 text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>View only</span>
        </div>
      )}
      {onViewDetails && (
        <button 
          onClick={onViewDetails}
          className="px-4 py-2 border border-border text-muted-foreground rounded-md hover:bg-muted transition-colors text-sm"
        >
          Details
        </button>
      )}
    </div>
  );
}

export function FixedIncomeStatusLegend() {
  return (
    <div className="flex flex-wrap gap-4 p-3 bg-muted rounded-lg text-sm">
      <div className="flex items-center gap-2">
        <FixedIncomeStatusBadge status="SELLABLE" />
        <span className="text-muted-foreground">Can buy/recommend</span>
      </div>
      <div className="flex items-center gap-2">
        <FixedIncomeStatusBadge status="VISIBLE" />
        <span className="text-muted-foreground">Reference only</span>
      </div>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <span className="text-muted-foreground">SEBI compliant classification</span>
      </div>
    </div>
  );
}
