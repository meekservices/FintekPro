import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useRebalancePortfolio } from "@/hooks/use-portfolio";
import { ASSET_TYPE_LABELS, ASSET_COLORS } from "@/lib/constants";
import { Calculator, TrendingUp, AlertTriangle } from "lucide-react";

interface RebalanceDashboardProps {
  portfolioId: string;
  totalValue: number;
}

interface TargetAllocation {
  assetType: string;
  percentage: number;
}

export function RebalanceDashboard({ portfolioId, totalValue }: RebalanceDashboardProps) {
  const [targetAllocations, setTargetAllocations] = useState<TargetAllocation[]>([
    { assetType: "equity", percentage: 65 },
    { assetType: "debt", percentage: 25 },
    { assetType: "gold", percentage: 5 },
    { assetType: "alternative", percentage: 5 },
  ]);

  const [isCalculating, setIsCalculating] = useState(false);
  const [rebalanceResults, setRebalanceResults] = useState<any>(null);

  const { mutate: calculateRebalance, isPending } = useRebalancePortfolio();

  const handleAllocationChange = (assetType: string, percentage: number) => {
    setTargetAllocations(prev => 
      prev.map(allocation => 
        allocation.assetType === assetType 
          ? { ...allocation, percentage }
          : allocation
      )
    );
    setRebalanceResults(null); // Clear previous results
  };

  const getTotalPercentage = () => {
    return targetAllocations.reduce((sum, allocation) => sum + allocation.percentage, 0);
  };

  const isValidAllocation = () => {
    const total = getTotalPercentage();
    return total === 100;
  };

  const handleCalculateRebalance = () => {
    if (!isValidAllocation()) return;

    setIsCalculating(true);
    calculateRebalance(
      { portfolioId, targetAllocations },
      {
        onSuccess: (data) => {
          setRebalanceResults(data);
          setIsCalculating(false);
        },
        onError: (error) => {
          console.error("Error calculating rebalance:", error);
          setIsCalculating(false);
        }
      }
    );
  };

  const resetToDefaults = () => {
    setTargetAllocations([
      { assetType: "equity", percentage: 65 },
      { assetType: "debt", percentage: 25 },
      { assetType: "gold", percentage: 5 },
      { assetType: "alternative", percentage: 5 },
    ]);
    setRebalanceResults(null);
  };

  return (
    <Card className="mb-8" data-testid="rebalance-dashboard">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Calculator className="h-6 w-6 text-finance-blue" />
          <CardTitle className="text-2xl font-bold text-foreground" data-testid="rebalance-title">
            Portfolio Rebalance Calculator
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Target Allocation Input */}
          <div>
            <h3 className="font-bold text-foreground mb-4" data-testid="target-allocation-title">
              Set Target Allocation
            </h3>
            
            <div className="space-y-4" data-testid="allocation-inputs">
              {targetAllocations.map((allocation) => (
                <div key={allocation.assetType} className="flex items-center space-x-4">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: ASSET_COLORS[allocation.assetType as keyof typeof ASSET_COLORS] }}
                  ></div>
                  <Label className="w-20 text-sm font-medium">
                    {ASSET_TYPE_LABELS[allocation.assetType as keyof typeof ASSET_TYPE_LABELS]}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={allocation.percentage}
                    onChange={(e) => handleAllocationChange(allocation.assetType, parseFloat(e.target.value) || 0)}
                    className="w-20"
                    data-testid={`input-${allocation.assetType}`}
                  />
                  <span className="text-muted-foreground">%</span>
                  <div className="flex-1 text-right text-sm text-muted-foreground">
                    ₹{((allocation.percentage / 100) * totalValue).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Validation */}
            <div className="mt-4 p-3 rounded-lg bg-muted" data-testid="allocation-validation">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Allocation:</span>
                <span 
                  className={`font-bold ${
                    getTotalPercentage() === 100 ? 'text-finance-green' : 'text-finance-red'
                  }`}
                  data-testid="total-percentage"
                >
                  {getTotalPercentage()}%
                </span>
              </div>
              {!isValidAllocation() && (
                <div className="flex items-center mt-2 text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span>Total allocation must equal 100%</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6">
              <Button
                onClick={handleCalculateRebalance}
                disabled={!isValidAllocation() || isPending || isCalculating}
                className="flex-1 bg-finance-blue text-white hover:bg-blue-700"
                data-testid="calculate-rebalance-button"
              >
                {isPending || isCalculating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Calculating...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Calculate Rebalance
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={resetToDefaults}
                data-testid="reset-button"
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Rebalance Results */}
          <div>
            <h3 className="font-bold text-foreground mb-4" data-testid="rebalance-results-title">
              Rebalance Analysis
            </h3>
            
            {rebalanceResults ? (
              <div className="space-y-4" data-testid="rebalance-results">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-3">Required Actions</h4>
                  <div className="space-y-3">
                    {rebalanceResults.rebalanceCalculations?.map((calc: any, index: number) => (
                      <div 
                        key={calc.assetType} 
                        className="flex justify-between items-center"
                        data-testid={`rebalance-action-${calc.assetType}`}
                      >
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: ASSET_COLORS[calc.assetType as keyof typeof ASSET_COLORS] }}
                          ></div>
                          <span className="font-medium">
                            {ASSET_TYPE_LABELS[calc.assetType as keyof typeof ASSET_TYPE_LABELS]}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${calc.action === 'BUY' ? 'text-finance-green' : 'text-finance-red'}`}>
                            {calc.action} ₹{Math.abs(calc.rebalanceAmount).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {calc.currentValue.toLocaleString()} → {calc.targetValue.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-2">Summary</h4>
                  <div className="text-sm text-muted-foreground">
                    <p>Total portfolio value: ₹{totalValue.toLocaleString()}</p>
                    <p>Actions required: {rebalanceResults.rebalanceCalculations?.filter((c: any) => Math.abs(c.rebalanceAmount) > 1000).length || 0}</p>
                    <p className="text-finance-green font-medium mt-2">
                      Your portfolio will be optimally balanced after these changes.
                    </p>
                  </div>
                </div>

                <Button 
                  className="w-full bg-finance-green text-white hover:bg-green-700"
                  data-testid="execute-rebalance-button"
                >
                  Execute Rebalance
                </Button>
              </div>
            ) : (
              <div className="bg-muted p-8 rounded-lg text-center" data-testid="no-results">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Set your target allocation and click calculate to see rebalance recommendations</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
