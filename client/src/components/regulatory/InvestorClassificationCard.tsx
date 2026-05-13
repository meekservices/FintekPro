import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  User, 
  TrendingUp, 
  LucideShield as LucideShield, 
  Building2, 
  Crown, 
  Info,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  IndianRupee
} from "lucide-react";

interface InvestorType {
  type: string;
  displayName: string;
  minInvestment: number | null;
  maxInvestment: number | null;
  netWorthRequired?: number;
  features: string[];
  brokerageRange: string;
  typicalYieldImpact: string;
  eligibleEntities?: string[];
}

interface ClassificationData {
  id: string;
  classificationType: string;
  classificationBasis: string;
  investmentAmountAtClassification: string | null;
  netWorthAtClassification: string | null;
  classificationStatus: string;
  classifiedAt: string;
  expiresAt: string | null;
}

interface BrokerageStructure {
  brokerageFeePercent: string;
  platformFeePercent: string;
  exchangeChargePercent: string;
  clearingChargePercent: string;
  sebiFeePercent: string;
  stampDutyPercent: string;
  gstPercent: string;
  typicalYieldImpactBps: number;
}

const investorTypeIcons: Record<string, typeof User> = {
  retail: User,
  sHNI: TrendingUp,
  bHNI: Crown,
  qib: Building2,
  anchor: LucideShield,
};

const investorTypeColors: Record<string, string> = {
  retail: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  sHNI: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  bHNI: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  qib: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  anchor: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
};

export function InvestorClassificationCard() {
  const [showDetails, setShowDetails] = useState(false);

  const { data: classificationResponse, isLoading: classificationLoading } = useQuery<{
    success: boolean;
    classification: ClassificationData | null;
    message?: string;
  }>({
    queryKey: ["/api/regulatory/my-classification"],
  });

  const { data: investorTypesResponse, isLoading: typesLoading } = useQuery<{
    success: boolean;
    investorTypes: InvestorType[];
    sebiThresholds: {
      retailMax: number;
      sHniMax: number;
      qibMinNetWorth: number;
      anchorMinInvestment: number;
    };
  }>({
    queryKey: ["/api/regulatory/investor-types"],
  });

  const classification = classificationResponse?.classification;
  const investorTypes = investorTypesResponse?.investorTypes || [];
  const currentType = investorTypes.find(t => t.type === classification?.classificationType);
  const Icon = investorTypeIcons[classification?.classificationType || 'retail'] || User;

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)} Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)} L`;
    } else {
      return `₹${amount.toLocaleString('en-IN')}`;
    }
  };

  if (classificationLoading || typesLoading) {
    return (
      <Card data-testid="card-investor-classification-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-investor-classification">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${investorTypeColors[classification?.classificationType || 'retail']?.split(' ')[0] || 'bg-muted'}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg" data-testid="text-investor-type-title">
                Investor Classification
              </CardTitle>
              <CardDescription data-testid="text-investor-type-description">
                {classification 
                  ? "Your SEBI investor category"
                  : "Classification pending - will be assigned on first investment"}
              </CardDescription>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  data-testid="button-classification-info"
                  onClick={() => setShowDetails(true)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View classification details</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {classification ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge 
                className={`${investorTypeColors[classification.classificationType]} text-sm px-3 py-1`}
                data-testid="badge-investor-type"
              >
                {currentType?.displayName || classification.classificationType.toUpperCase()}
              </Badge>
              <Badge 
                variant="outline" 
                className={classification.classificationStatus === 'active' 
                  ? "border-green-500 text-green-600" 
                  : "border-yellow-500 text-yellow-600"}
                data-testid="badge-classification-status"
              >
                {classification.classificationStatus === 'active' 
                  ? <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                  : <><AlertTriangle className="h-3 w-3 mr-1" /> {classification.classificationStatus}</>
                }
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground">Classification Basis</span>
                <p className="font-medium capitalize" data-testid="text-classification-basis">
                  {classification.classificationBasis.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Brokerage Rate</span>
                <p className="font-medium text-green-600" data-testid="text-brokerage-rate">
                  {currentType?.brokerageRange || 'Standard'}
                </p>
              </div>
              {currentType && (
                <>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Investment Range</span>
                    <p className="font-medium" data-testid="text-investment-range">
                      {currentType.minInvestment 
                        ? `${formatCurrency(currentType.minInvestment)}${currentType.maxInvestment ? ` - ${formatCurrency(currentType.maxInvestment)}` : '+'}`
                        : 'No limit'
                      }
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Yield Impact</span>
                    <p className="font-medium text-orange-600" data-testid="text-yield-impact">
                      ~{currentType.typicalYieldImpact}
                    </p>
                  </div>
                </>
              )}
            </div>

            {classification.expiresAt && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Classification Expires</span>
                  <span className="font-medium" data-testid="text-classification-expiry">
                    {new Date(classification.expiresAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="mb-2">No classification assigned yet</p>
            <p className="text-sm">Your investor type will be automatically determined based on your first investment amount</p>
          </div>
        )}
      </CardContent>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>SEBI Investor Classification Guide</DialogTitle>
            <DialogDescription>
              Understanding your investor category and its benefits
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {investorTypes.map((type) => {
              const TypeIcon = investorTypeIcons[type.type] || User;
              const isCurrentType = classification?.classificationType === type.type;
              
              return (
                <div 
                  key={type.type}
                  className={`p-4 rounded-lg border ${isCurrentType ? 'border-primary bg-primary/5' : 'border-border'}`}
                  data-testid={`card-investor-type-${type.type}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${investorTypeColors[type.type]?.split(' ')[0] || 'bg-muted'}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{type.displayName}</h4>
                        {isCurrentType && (
                          <Badge variant="default" className="text-xs">Your Category</Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground block">Investment</span>
                          <span className="font-medium">
                            {type.minInvestment 
                              ? `${formatCurrency(type.minInvestment)}${type.maxInvestment ? ` - ${formatCurrency(type.maxInvestment)}` : '+'}`
                              : 'As per rules'
                            }
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Brokerage</span>
                          <span className="font-medium text-green-600">{type.brokerageRange}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Yield Impact</span>
                          <span className="font-medium text-orange-600">{type.typicalYieldImpact}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {type.features.slice(0, 3).map((feature, idx) => (
                          <Badge 
                            key={idx} 
                            variant="secondary" 
                            className="text-xs font-normal"
                          >
                            {feature}
                          </Badge>
                        ))}
                        {type.features.length > 3 && (
                          <Badge variant="outline" className="text-xs font-normal">
                            +{type.features.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function TransactionCostCalculator({ 
  investmentAmount,
  productCategory = 'bonds'
}: { 
  investmentAmount: number;
  productCategory?: string;
}) {
  const { data: classificationResponse } = useQuery<{
    success: boolean;
    classification: ClassificationData | null;
  }>({
    queryKey: ["/api/regulatory/my-classification"],
  });

  const investorType = classificationResponse?.classification?.classificationType || 'retail';

  const { data: costsResponse, isLoading } = useQuery<{
    success: boolean;
    transactionCosts: {
      brokerage: number;
      platformFee: number;
      exchangeCharges: number;
      clearingCharges: number;
      sebiFee: number;
      stampDuty: number;
      gst: number;
      totalCharges: number;
      netInvestmentAmount: number;
      yieldImpactBps: number;
    };
    brokerageStructure: BrokerageStructure;
  }>({
    queryKey: ["/api/regulatory/calculate-costs", investmentAmount, investorType, productCategory],
    queryFn: () => apiRequest("/api/regulatory/calculate-costs", {
      method: "POST",
      body: JSON.stringify({
        investmentAmount,
        investorType,
        productCategory,
      }),
    }),
    enabled: investmentAmount > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  const costs = costsResponse?.transactionCosts;
  if (!costs) return null;

  return (
    <div className="space-y-3 text-sm" data-testid="section-transaction-costs">
      <div className="flex justify-between items-center text-muted-foreground">
        <span>Investment Amount</span>
        <span className="font-medium text-foreground">₹{investmentAmount.toLocaleString('en-IN')}</span>
      </div>
      
      <div className="border-t pt-2 space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Brokerage</span>
          <span>₹{costs.brokerage.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Platform Fee</span>
          <span>₹{costs.platformFee.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Exchange Charges</span>
          <span>₹{costs.exchangeCharges.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">SEBI Fee</span>
          <span>₹{costs.sebiFee.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Stamp Duty</span>
          <span>₹{costs.stampDuty.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">GST (18%)</span>
          <span>₹{costs.gst.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="border-t pt-2 space-y-1">
        <div className="flex justify-between font-medium">
          <span>Total Charges</span>
          <span className="text-red-600">₹{costs.totalCharges.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Net Investment</span>
          <span className="text-green-600">₹{costs.netInvestmentAmount.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Approximate Yield Impact</span>
          <span>{costs.yieldImpactBps} bps</span>
        </div>
      </div>
    </div>
  );
}
