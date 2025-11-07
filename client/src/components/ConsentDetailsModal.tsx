import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, Calendar, Database, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { format } from 'date-fns';

interface ConsentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consent: {
    id: string;
    dataSource: 'mutual_funds' | 'demat' | 'bank' | 'loans' | 'insurance' | 'epf' | 'nps' | 'apy';
    provider?: string;
    status: 'active' | 'revoked' | 'expired';
    consentPurpose: string;
    grantedAt: string;
    expiresAt: string;
    lastSyncedAt?: string;
  } | null;
  onGrant?: () => void;
  onRevoke?: () => void;
  isGranting?: boolean;
  isRevoking?: boolean;
}

const DATA_SOURCE_DETAILS = {
  mutual_funds: {
    label: 'Mutual Funds',
    dataCollected: ['Folio numbers', 'Scheme names', 'Units held', 'Current NAV', 'Investment amount', 'Current value', 'Transaction history'],
    purpose: 'To provide consolidated view of all your mutual fund investments and calculate portfolio performance metrics',
    provider: 'BSE Star MFD API / AMFI',
    frequency: 'Daily',
    retention: '90 days after consent revocation'
  },
  demat: {
    label: 'Demat Holdings',
    dataCollected: ['DP ID', 'Client ID', 'Stock holdings', 'Quantity', 'Average price', 'Current market price', 'ISIN codes'],
    purpose: 'To track your equity portfolio value and provide real-time profit/loss analysis',
    provider: 'CDSL / NSDL',
    frequency: 'Daily',
    retention: '90 days after consent revocation'
  },
  bank: {
    label: 'Bank Accounts',
    dataCollected: ['Account numbers (masked)', 'Account type', 'Current balance', 'Bank name', 'IFSC code'],
    purpose: 'To display liquid assets and help with financial planning and cash flow analysis',
    provider: 'Account Aggregator Network',
    frequency: 'Daily',
    retention: '90 days after consent revocation'
  },
  loans: {
    label: 'Loan Liabilities',
    dataCollected: ['Loan account numbers (masked)', 'Loan type', 'Outstanding amount', 'EMI amount', 'Interest rate', 'Tenure remaining'],
    purpose: 'To calculate net worth accurately and provide debt management recommendations',
    provider: 'CIBIL / Lenders via Account Aggregator',
    frequency: 'Weekly',
    retention: '90 days after consent revocation'
  },
  insurance: {
    label: 'Insurance Policies',
    dataCollected: ['Policy numbers (masked)', 'Policy type', 'Sum assured', 'Premium amount', 'Maturity date', 'Nominee details'],
    purpose: 'To track insurance coverage and identify protection gaps in your financial plan',
    provider: 'Turtlefin Insurance API',
    frequency: 'Monthly',
    retention: '90 days after consent revocation'
  },
  epf: {
    label: 'EPF/VPF Accounts',
    dataCollected: ['UAN number (masked)', 'EPF balance', 'Employer contributions', 'Employee contributions', 'Interest earned'],
    purpose: 'To include retirement savings in net worth calculation and retirement planning',
    provider: 'EPFO via Account Aggregator',
    frequency: 'Monthly',
    retention: '90 days after consent revocation'
  },
  nps: {
    label: 'National Pension System',
    dataCollected: ['PRAN number (masked)', 'Current corpus', 'Contribution history', 'Fund allocation', 'Returns'],
    purpose: 'To track retirement corpus and provide retirement planning insights',
    provider: 'NSDL CRA via Account Aggregator',
    frequency: 'Monthly',
    retention: '90 days after consent revocation'
  },
  apy: {
    label: 'Atal Pension Yojana',
    dataCollected: ['PRAN number (masked)', 'Contribution amount', 'Guaranteed pension amount', 'Contribution history'],
    purpose: 'To include government pension scheme in retirement planning calculations',
    provider: 'NSDL CRA via Account Aggregator',
    frequency: 'Monthly',
    retention: '90 days after consent revocation'
  }
};

export function ConsentDetailsModal({
  open,
  onOpenChange,
  consent,
  onGrant,
  onRevoke,
  isGranting,
  isRevoking
}: ConsentDetailsModalProps) {
  if (!consent) return null;

  const details = DATA_SOURCE_DETAILS[consent.dataSource];
  const isActive = consent.status === 'active';
  const isExpired = consent.status === 'expired';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-consent-details">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            {details.label} - Consent Details
          </DialogTitle>
          <DialogDescription>
            Review what data we collect and how it's used
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            <Badge
              variant={isActive ? 'default' : isExpired ? 'destructive' : 'secondary'}
              data-testid={`badge-status-${consent.status}`}
            >
              {isActive && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {isExpired && <AlertTriangle className="h-3 w-3 mr-1" />}
              {consent.status.toUpperCase()}
            </Badge>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Granted On
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {format(new Date(consent.grantedAt), 'PPP')}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Expires On
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {format(new Date(consent.expiresAt), 'PPP')}
              </p>
            </div>
          </div>

          {consent.lastSyncedAt && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4 text-muted-foreground" />
                Last Synced
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {format(new Date(consent.lastSyncedAt), 'PPP p')}
              </p>
            </div>
          )}

          <Separator />

          {/* Purpose */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              Purpose of Data Collection
            </h4>
            <p className="text-sm text-muted-foreground pl-6">
              {details.purpose}
            </p>
          </div>

          {/* Data Collected */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Data Collected</h4>
            <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
              {details.dataCollected.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Provider & Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Data Provider</h4>
              <p className="text-sm text-muted-foreground">{details.provider}</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Sync Frequency</h4>
              <p className="text-sm text-muted-foreground">{details.frequency}</p>
            </div>
          </div>

          {/* Data Retention */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Data Retention Policy</h4>
            <p className="text-sm text-muted-foreground">{details.retention}</p>
          </div>

          <Separator />

          {/* RBI Compliance */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              RBI Account Aggregator Compliance
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-6">
              <li>Your data is fetched through RBI-regulated Account Aggregator network</li>
              <li>All data is encrypted end-to-end during transmission</li>
              <li>You can revoke consent at any time</li>
              <li>Data is stored securely and not shared with third parties</li>
              <li>You retain full ownership and control of your financial data</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          {isActive && onRevoke && (
            <Button
              variant="destructive"
              onClick={onRevoke}
              disabled={isRevoking}
              data-testid="button-revoke-consent"
            >
              {isRevoking ? 'Revoking...' : 'Revoke Consent'}
            </Button>
          )}
          {!isActive && onGrant && (
            <Button
              onClick={onGrant}
              disabled={isGranting}
              data-testid="button-grant-consent"
            >
              {isGranting ? 'Granting...' : isExpired ? 'Renew Consent' : 'Grant Consent'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
