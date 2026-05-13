import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield as LucideShield, Building, Lock, Clock, AlertCircle } from 'lucide-react';

interface ConsentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataSource: string;
  sourceLabel: string;
  provider: string;
  description: string;
  onConfirm: () => void;
  isPending?: boolean;
}

export function ConsentPreviewDialog({
  open,
  onOpenChange,
  dataSource,
  sourceLabel,
  provider,
  description,
  onConfirm,
  isPending = false
}: ConsentPreviewDialogProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedDataUsage, setAcceptedDataUsage] = useState(false);

  const handleConfirm = () => {
    if (acceptedTerms && acceptedDataUsage) {
      onConfirm();
      setAcceptedTerms(false);
      setAcceptedDataUsage(false);
    }
  };

  const handleClose = () => {
    setAcceptedTerms(false);
    setAcceptedDataUsage(false);
    onOpenChange(false);
  };

  const consentText = getConsentText(dataSource, provider);
  const dataUsageText = getDataUsageText(dataSource);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]" data-testid="dialog-consent-preview">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LucideShield className="h-5 w-5 text-blue-600" />
            Grant Data Access Consent
          </DialogTitle>
          <DialogDescription>
            Review and authorize access to your {sourceLabel}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Data Provider</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{provider}</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{description}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Consent Terms
              </h4>
              <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-3">
                {consentText.map((paragraph, index) => (
                  <p key={index} className="text-muted-foreground">{paragraph}</p>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Data Usage
              </h4>
              <div className="bg-muted/50 p-4 rounded-lg text-sm">
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  {dataUsageText.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                This consent is valid for <Badge variant="secondary">90 days</Badge> and can be revoked anytime
              </span>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="accept-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  data-testid="checkbox-accept-terms"
                />
                <label htmlFor="accept-terms" className="text-sm cursor-pointer">
                  I have read and agree to the consent terms. I understand that my data will be fetched from {provider} and stored securely.
                </label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="accept-data-usage"
                  checked={acceptedDataUsage}
                  onCheckedChange={(checked) => setAcceptedDataUsage(checked === true)}
                  data-testid="checkbox-accept-data-usage"
                />
                <label htmlFor="accept-data-usage" className="text-sm cursor-pointer">
                  I consent to FintekPro using my {sourceLabel} data for portfolio analysis, financial planning, and personalized recommendations.
                </label>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            data-testid="button-cancel-consent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!acceptedTerms || !acceptedDataUsage || isPending}
            data-testid="button-confirm-consent"
          >
            {isPending ? 'Granting...' : 'Grant Consent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getConsentText(dataSource: string, provider: string): string[] {
  return [
    `I hereby grant consent to FintekPro to fetch and store my ${getDataSourceLabel(dataSource)} data from ${provider} for the purpose of portfolio management and financial planning.`,
    `Data Protection: All data will be encrypted using AES-256 encryption and stored securely in compliance with RBI Account Aggregator Framework and SEBI regulations.`,
    `FintekPro will not share this data with third parties without my explicit consent, except as required by law or regulatory authorities.`,
    `I can revoke this consent at any time through my account settings. Upon revocation, no new data will be fetched, but existing data will be retained as per regulatory requirements.`
  ];
}

function getDataUsageText(dataSource: string): string[] {
  const baseUsage = [
    'Display holdings in your unified portfolio dashboard',
    'Calculate returns, gains, and performance metrics',
    'Generate consolidated financial reports',
    'Provide personalized investment recommendations'
  ];

  const sourceSpecificUsage: Record<string, string[]> = {
    mutual_funds: [...baseUsage, 'Track SIP performance and suggest rebalancing'],
    demat: [...baseUsage, 'Analyze sector allocation and stock performance'],
    bank: [...baseUsage, 'Track cash flow and suggest liquidity optimization'],
    loans: [...baseUsage, 'Calculate net worth and suggest debt repayment strategies'],
    insurance: [...baseUsage, 'Analyze coverage gaps and suggest policy renewals'],
    epf: [...baseUsage, 'Track retirement corpus and suggest contributions'],
    nps: [...baseUsage, 'Analyze pension planning and asset allocation'],
    apy: [...baseUsage, 'Track pension benefits and eligibility']
  };

  return sourceSpecificUsage[dataSource] || baseUsage;
}

function getDataSourceLabel(dataSource: string): string {
  const labels: Record<string, string> = {
    mutual_funds: 'Mutual Fund Holdings',
    demat: 'Demat Account Holdings',
    bank: 'Bank Account Information',
    loans: 'Loan Liabilities',
    insurance: 'Insurance Policies',
    epf: 'EPF/VPF Account Information',
    nps: 'National Pension System Accounts',
    apy: 'Atal Pension Yojana Benefits'
  };
  return labels[dataSource] || dataSource;
}
