import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CreditCard, 
  Home, 
  Car,
  Calendar,
  TrendingDown,
  Clock,
  IndianRupee,
  FileText,
  Building,
  Wallet
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { FinancialObligation } from "@shared/schema";

const typeIcons: Record<string, any> = {
  home_loan: Home,
  car_loan: Car,
  personal_loan: Wallet,
  education_loan: FileText,
  credit_card: CreditCard,
  other_emi: Building,
  insurance_premium: IndianRupee,
  rent: Home,
  utility: IndianRupee,
  maintenance: IndianRupee,
};

export function ObligationMapping() {
  const { data: obligations = [], isLoading } = useQuery<FinancialObligation[]>({
    queryKey: ['/api/financial-obligations'],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const activeObligations = obligations.filter(o => o.isActive !== false);
  const totalMonthly = activeObligations.reduce((sum, o) => sum + Number(o.monthlyAmount || 0), 0);

  const getDaysUntilDue = (endDate: string | null) => {
    if (!endDate) return 999;
    const now = new Date();
    const due = new Date(endDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">My Obligations</h2>
        <p className="text-muted-foreground">Your EMIs, loans, and recurring financial commitments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-obligations">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Monthly Outflow</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalMonthly)}</p>
                <p className="text-xs text-muted-foreground mt-1">{activeObligations.length} active obligations</p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-remaining-tenure">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(activeObligations.reduce((sum, o) => sum + Number(o.totalOutstanding || 0), 0))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">across all loans</p>
              </div>
              <Calendar className="w-10 h-10 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-obligations-count">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Obligations</p>
                <p className="text-2xl font-bold text-blue-600">{activeObligations.length}</p>
                <p className="text-xs text-muted-foreground mt-1">loans & commitments</p>
              </div>
              <CreditCard className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Obligations List */}
      {activeObligations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">No Active Obligations</h3>
            <p className="text-muted-foreground">
              You don't have any active EMIs, loans, or recurring financial commitments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Your Obligations
            </CardTitle>
            <CardDescription>
              All your EMIs, loans, and recurring payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeObligations.map((obligation) => {
                const Icon = typeIcons[obligation.obligationType || 'other_emi'] || CreditCard;
                const remainingMonths = obligation.remainingTenure || 0;
                
                return (
                  <div 
                    key={obligation.id} 
                    className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border"
                    data-testid={`obligation-${obligation.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {obligation.institutionName || obligation.obligationType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {obligation.obligationType?.replace(/_/g, ' ').toUpperCase() || 'OTHER'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {obligation.priority?.toUpperCase() || 'ESSENTIAL'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xl font-bold text-foreground">{formatCurrency(Number(obligation.monthlyAmount))}</p>
                      <p className="text-xs text-muted-foreground">per month</p>
                      {remainingMonths > 0 && (
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {remainingMonths} months left
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
