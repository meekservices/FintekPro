import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Plus, CheckCircle2, Building2, ExternalLink } from 'lucide-react';
import { useLocation } from 'wouter';

interface AAConsent {
  id: number;
  consentId: string;
  consentStatus: string;
  fiTypes: string[];
  consentExpiry: string;
  lastDataFetchAt?: string;
}

interface AAAccount {
  id: number;
  linkedToPortfolio: boolean;
  fipName: string;
}

export function AAIntegrationCard() {
  const [, navigate] = useLocation();
  
  const { data: consentsData } = useQuery<{ data: AAConsent[] }>({
    queryKey: ['/api/aa/consents'],
  });

  const { data: accountsData } = useQuery<{ data: AAAccount[] }>({
    queryKey: ['/api/aa/discovered-accounts'],
  });

  const consents = consentsData?.data || [];
  const accounts = accountsData?.data || [];
  
  const activeConsents = consents.filter(c => c.consentStatus === 'active');
  const linkedAccounts = accounts.filter(a => a.linkedToPortfolio);
  const totalFIPs = new Set(accounts.map(a => a.fipName)).size;

  return (
    <Card className="relative" data-testid="card-aa-integration">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Account Aggregator</CardTitle>
              <CardDescription className="text-xs">RBI-regulated data fetching</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            AA Framework
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center p-2 rounded-lg bg-accent/50">
            <div className="text-2xl font-bold text-primary" data-testid="text-aa-active-consents">
              {activeConsents.length}
            </div>
            <div className="text-xs text-muted-foreground">Active Consents</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-accent/50">
            <div className="text-2xl font-bold text-primary" data-testid="text-aa-linked-accounts">
              {linkedAccounts.length}
            </div>
            <div className="text-xs text-muted-foreground">Linked Accounts</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-accent/50">
            <div className="text-2xl font-bold text-primary" data-testid="text-aa-fips">
              {totalFIPs}
            </div>
            <div className="text-xs text-muted-foreground">Institutions</div>
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          {activeConsents.length > 0 ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">
                {activeConsents.length} active consent{activeConsents.length !== 1 ? 's' : ''} • {accounts.length} account{accounts.length !== 1 ? 's' : ''} discovered
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>No active consents. Create one to fetch financial data.</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1" 
            onClick={() => navigate('/aa-consents')}
            data-testid="button-manage-aa-consents"
          >
            <Shield className="mr-2 h-3 w-3" />
            Manage Consents
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1" 
            onClick={() => navigate('/aa-accounts')}
            data-testid="button-view-aa-accounts"
          >
            <Building2 className="mr-2 h-3 w-3" />
            View Accounts
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Securely fetch data from banks, mutual funds, and insurance providers through RBI-regulated Account Aggregators.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
