import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Shield, Clock, Database, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AutoPopulationConsentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onConsentsGranted: () => void;
}

interface DataSource {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
}

const DATA_SOURCES: DataSource[] = [
  {
    id: "insurance",
    name: "Insurance Policies",
    description: "Life, health, and general insurance policies from Turtlefin and other providers",
    defaultEnabled: true
  },
  {
    id: "loans",
    name: "Loan Liabilities",
    description: "Home loans, personal loans, credit card debts via CIBIL credit report",
    defaultEnabled: true
  },
  {
    id: "mutual_funds",
    name: "Mutual Fund Holdings",
    description: "All mutual fund investments via BSE STAR MFD API",
    defaultEnabled: false
  },
  {
    id: "demat",
    name: "Demat Holdings",
    description: "Stocks, ETFs, bonds from NSDL and CDSL depository accounts",
    defaultEnabled: false
  },
  {
    id: "epf",
    name: "EPF/VPF Accounts",
    description: "Employee Provident Fund and Voluntary PF balances from EPFO",
    defaultEnabled: false
  },
  {
    id: "nps",
    name: "NPS Accounts",
    description: "National Pension System Tier I and Tier II account balances",
    defaultEnabled: false
  },
  {
    id: "apy",
    name: "APY Accounts",
    description: "Atal Pension Yojana account details and pension benefits",
    defaultEnabled: false
  }
];

export function AutoPopulationConsentDialog({ 
  isOpen, 
  onOpenChange, 
  userId,
  onConsentsGranted 
}: AutoPopulationConsentDialogProps) {
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(DATA_SOURCES.filter(ds => ds.defaultEnabled).map(ds => ds.id))
  );
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const consentMutation = useMutation({
    mutationFn: async () => {
      const consents = Array.from(selectedSources).map(dataSource => ({
        userId,
        dataSource,
        purpose: "Auto-populate financial portfolio data",
        scope: ["read"]
      }));

      return await apiRequest("/api/consents/batch-grant", "POST", { consents });
    },
    onSuccess: () => {
      toast({
        title: "Consents Granted",
        description: `Successfully granted access to ${selectedSources.size} data source(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/consents"] });
      onConsentsGranted();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Consent error:", error);
      toast({
        title: "Consent Failed",
        description: "Failed to grant consents. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleToggleSource = (sourceId: string) => {
    const newSet = new Set(selectedSources);
    if (newSet.has(sourceId)) {
      newSet.delete(sourceId);
    } else {
      newSet.add(sourceId);
    }
    setSelectedSources(newSet);
  };

  const handleGrantConsents = () => {
    if (!hasAcceptedTerms) {
      toast({
        title: "Please Accept Terms",
        description: "You must accept the terms and conditions to proceed.",
        variant: "destructive",
      });
      return;
    }

    if (selectedSources.size === 0) {
      toast({
        title: "No Data Sources Selected",
        description: "Please select at least one data source to continue.",
        variant: "destructive",
      });
      return;
    }

    consentMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-auto-population-consent">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-auto-pop-consent-title">
            <Shield className="h-5 w-5 text-blue-600" />
            Auto-Populate Your Financial Portfolio
          </DialogTitle>
          <DialogDescription data-testid="text-auto-pop-consent-description">
            Grant FintekPro permission to securely fetch and consolidate your financial data from multiple sources.
            This will give you a complete view of your wealth in one place.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Benefits Section */}
          <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Why Auto-Populate?
            </h3>
            <ul className="text-green-800 dark:text-green-200 text-sm space-y-1">
              <li>• <strong>Complete Picture:</strong> See all your investments, insurance, and loans in one dashboard</li>
              <li>• <strong>Accurate Analytics:</strong> Get precise IRR, XIRR, and asset allocation calculations</li>
              <li>• <strong>Time Saving:</strong> No manual data entry required</li>
              <li>• <strong>Always Updated:</strong> Automatic syncing keeps your portfolio current</li>
            </ul>
          </div>

          {/* Data Sources Selection */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Select Data Sources
            </h3>
            <div className="space-y-3">
              {DATA_SOURCES.map((source) => (
                <div key={source.id} className="flex items-start space-x-3 p-3 border rounded hover:bg-accent/50 transition-colors">
                  <Checkbox
                    id={`source-${source.id}`}
                    checked={selectedSources.has(source.id)}
                    onCheckedChange={() => handleToggleSource(source.id)}
                    data-testid={`checkbox-source-${source.id}`}
                  />
                  <div className="grid gap-1 flex-1">
                    <Label
                      htmlFor={`source-${source.id}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {source.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {source.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Information */}
          <div className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/20">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Security & Privacy
            </h3>
            <ul className="text-amber-800 dark:text-amber-200 text-sm space-y-1">
              <li>• All data is fetched through secure, encrypted government and financial institution APIs</li>
              <li>• Your credentials are never stored; we use token-based authentication</li>
              <li>• Data is encrypted in transit and at rest using industry-standard AES-256</li>
              <li>• Access is limited to read-only operations for portfolio display</li>
              <li>• You can revoke consent for any data source at any time from Settings</li>
            </ul>
          </div>

          {/* Consent Duration */}
          <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Consent Validity
            </h3>
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              These consents will be valid for <strong>1 year</strong> from today. 
              You will be prompted to renew consent when it expires. You can review or revoke 
              consents anytime from your Profile → Privacy Settings.
            </p>
          </div>

          {/* Terms Acceptance */}
          <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/50">
            <Checkbox
              id="accept-terms"
              checked={hasAcceptedTerms}
              onCheckedChange={(checked) => setHasAcceptedTerms(checked === true)}
              data-testid="checkbox-accept-terms"
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="accept-terms"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                I accept the terms and conditions
              </Label>
              <p className="text-xs text-muted-foreground">
                By checking this box, you consent to FintekPro accessing your selected financial data 
                sources for portfolio management and analytics. This consent complies with RBI Account 
                Aggregator Framework and data protection regulations.
              </p>
            </div>
          </div>

          {/* Selected Count */}
          <div className="text-center text-sm text-muted-foreground">
            {selectedSources.size} of {DATA_SOURCES.length} data sources selected
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button 
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={consentMutation.isPending}
            data-testid="button-consent-cancel"
          >
            Skip for Now
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={handleGrantConsents}
            disabled={!hasAcceptedTerms || selectedSources.size === 0 || consentMutation.isPending}
            data-testid="button-consent-submit"
          >
            {consentMutation.isPending ? "Granting Consents..." : `Grant Consent (${selectedSources.size} sources)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
