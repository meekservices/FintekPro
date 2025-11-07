import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ExpiredConsentsBannerProps {
  expiredCount: number;
  onRenewAll: () => void;
  isRenewing?: boolean;
}

export function ExpiredConsentsBanner({
  expiredCount,
  onRenewAll,
  isRenewing
}: ExpiredConsentsBannerProps) {
  if (expiredCount === 0) return null;

  return (
    <Alert variant="destructive" className="mb-4" data-testid="alert-expired-consents">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          You have {expiredCount} expired consent{expiredCount > 1 ? 's' : ''}. 
          Renew them to continue auto-syncing your financial data.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onRenewAll}
          disabled={isRenewing}
          className="ml-4"
          data-testid="button-renew-all-consents"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRenewing ? 'animate-spin' : ''}`} />
          {isRenewing ? 'Renewing...' : 'Renew All'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
