import { MfMonthwisePerformance } from "./MfMonthwisePerformance";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, TrendingUp, ShoppingCart, Calendar, DollarSign, Repeat } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MutualFundData } from "@/hooks/use-mutual-funds";
import { AccountSelectionWidget } from "@/components/AccountSelectionWidget";
import { useUnifiedCart } from "@/contexts/UnifiedCartContext";

interface InvestmentModalProps {
  fund: MutualFundData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InvestmentModal({ fund, isOpen, onClose }: InvestmentModalProps) {
  const { toast } = useToast();
  const { addItem: addToUnifiedCart } = useUnifiedCart();
  const [investmentType, setInvestmentType] = useState<"SIP" | "LUMPSUM">("SIP");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [duration, setDuration] = useState("");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | undefined>();

  const addToCartMutation = useMutation({
    mutationFn: async (cartItem: any) => {
      return await apiRequest("/api/cart/items", {
        method: "POST",
        body: JSON.stringify(cartItem),
      });
    },
    onSuccess: async (_, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      
      // Also add to unified cart for consolidated tracking
      try {
        const amountValue = variables.investmentAmount || 0;
        const mfMetadata = variables.metadata || {};
        await addToUnifiedCart({
          mutualFundSchemeCode: variables.investmentId?.toString() || fund?.schemeCode?.toString() || '',
          displayName: fund?.schemeName || 'Mutual Fund Investment',
          amount: String(amountValue),
          quantity: 1,
          productCategory: 'mutual_fund',
          source: 'client',
          metadata: {
            ...mfMetadata,
            investmentType: mfMetadata.investmentType || 'LUMPSUM',
            frequency: mfMetadata.frequency,
            duration: mfMetadata.duration,
            fundHouse: fund?.fundHouse,
            category: fund?.category,
            nav: fund?.nav,
            schemeCode: fund?.schemeCode,
          } as Record<string, any>,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/unified-cart"] });
      } catch (err) {
        console.error("Failed to add to unified cart:", err);
        toast({
          title: "Partially Added",
          description: "Added to cart but unified tracking failed. Please try again.",
          variant: "default",
        });
      }
      
      toast({
        title: "Added to Cart",
        description: "Investment plan added to your cart successfully",
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add to cart",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setInvestmentType("SIP");
    setAmount("");
    setFrequency("MONTHLY");
    setDuration("");
    setSelectedBankAccountId(undefined);
  };

  const handleAddToCart = () => {
    if (!fund) return;

    // Validation
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid investment amount",
        variant: "destructive",
      });
      return;
    }

    if (investmentType === "SIP" && (!duration || parseInt(duration) <= 0)) {
      toast({
        title: "Invalid Duration",
        description: "Please enter a valid duration for SIP",
        variant: "destructive",
      });
      return;
    }

    // Validate bank account is selected
    if (!selectedBankAccountId) {
      toast({
        title: "Bank Account Required",
        description: "Please select a bank account for this transaction",
        variant: "destructive",
      });
      return;
    }

    const cartItem = {
      itemType: "investment",
      investmentId: fund.schemeCode,
      investmentAmount: amountNum,
      quantity: 1,
      metadata: {
        investmentType,
        frequency: investmentType === "SIP" ? frequency : undefined,
        duration: investmentType === "SIP" ? parseInt(duration) : undefined,
        fundHouse: fund.fundHouse,
        category: fund.category,
        nav: fund.nav,
        schemeCode: fund.schemeCode,
        name: fund.schemeName,
        description: `${investmentType} - ${fund.fundHouse}`,
        bankAccountId: selectedBankAccountId,
      },
    };

    addToCartMutation.mutate(cartItem);
  };

  if (!fund) return null;

  const navValue = parseFloat(fund.nav || "0");
  const minSipAmount = 500;
  const minLumpsumAmount = 1000;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="investment-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-finance-blue" />
            Invest in Mutual Fund
          </DialogTitle>
          <DialogDescription>
            Choose your investment type and add to cart
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Fund Details */}
          <div className="bg-gradient-to-br from-finance-blue/10 to-blue-50 dark:from-finance-blue/20 dark:to-gray-800 rounded-lg p-4 border border-finance-blue/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-finance-blue rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1" data-testid="modal-fund-name">
                  {fund.schemeName}
                </h3>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground" data-testid="modal-fund-house">
                  {fund.fundHouse}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">Current NAV</p>
                    <p className="text-lg font-bold text-finance-blue" data-testid="modal-nav-value">
                      ₹{navValue.toFixed(2)}
                    </p>
                  </div>
                  {fund.category && (
                    <div>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">Category</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {fund.category}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Investment Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Investment Type</Label>
            <RadioGroup
              value={investmentType}
              onValueChange={(value) => setInvestmentType(value as "SIP" | "LUMPSUM")}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="SIP"
                  id="sip"
                  className="peer sr-only"
                  data-testid="radio-sip"
                />
                <Label
                  htmlFor="sip"
                  className="flex flex-col items-center gap-2 rounded-lg border-2 border-border dark:border-border bg-white dark:bg-muted p-4 cursor-pointer hover:bg-muted dark:hover:bg-gray-700 peer-data-[state=checked]:border-finance-blue peer-data-[state=checked]:bg-finance-blue/5 transition-all"
                >
                  <Repeat className="h-8 w-8 text-finance-blue" />
                  <div className="text-center">
                    <p className="font-semibold">SIP</p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">Systematic Investment Plan</p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">Min ₹{minSipAmount}/month</p>
                  </div>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="LUMPSUM"
                  id="lumpsum"
                  className="peer sr-only"
                  data-testid="radio-lumpsum"
                />
                <Label
                  htmlFor="lumpsum"
                  className="flex flex-col items-center gap-2 rounded-lg border-2 border-border dark:border-border bg-white dark:bg-muted p-4 cursor-pointer hover:bg-muted dark:hover:bg-gray-700 peer-data-[state=checked]:border-finance-blue peer-data-[state=checked]:bg-finance-blue/5 transition-all"
                >
                  <DollarSign className="h-8 w-8 text-finance-blue" />
                  <div className="text-center">
                    <p className="font-semibold">Lumpsum</p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">One-time Investment</p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">Min ₹{minLumpsumAmount}</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-base font-semibold">
              {investmentType === "SIP" ? "Monthly Investment Amount" : "Investment Amount"}
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                placeholder={investmentType === "SIP" ? `Min ₹${minSipAmount}` : `Min ₹${minLumpsumAmount}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9"
                data-testid="input-amount"
              />
            </div>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">
              {investmentType === "SIP"
                ? `Minimum ₹${minSipAmount} per month`
                : `Minimum ₹${minLumpsumAmount} for one-time investment`}
            </p>
          </div>

          {/* SIP-specific fields */}
          {investmentType === "SIP" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="frequency" className="text-base font-semibold">
                  Frequency
                </Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="frequency" data-testid="select-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration" className="text-base font-semibold">
                  Duration (Months)
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="duration"
                    type="number"
                    placeholder="e.g., 12, 24, 60"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="pl-9"
                    data-testid="input-duration"
                  />
                </div>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                  Recommended: 12 months or more for better returns
                </p>
              </div>
            </>
          )}

          {/* Bank Account Selection */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Payment Account</Label>
            <AccountSelectionWidget
              productType="mutual_fund"
              selectedBankAccountId={selectedBankAccountId}
              onBankAccountChange={setSelectedBankAccountId}
              compact={true}
              showLabels={false}
            />
          </div>

          {/* Summary */}
          {amount && (investmentType === "LUMPSUM" || duration) && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Investment Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground dark:text-muted-foreground">Type:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{investmentType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground dark:text-muted-foreground">
                    {investmentType === "SIP" ? "Monthly Amount:" : "Investment Amount:"}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">₹{parseFloat(amount).toLocaleString()}</span>
                </div>
                {investmentType === "SIP" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground dark:text-muted-foreground">Frequency:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{frequency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground dark:text-muted-foreground">Duration:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{duration} months</span>
                    </div>
                    <div className="flex justify-between border-t border-green-300 dark:border-green-700 pt-2 mt-2">
                      <span className="text-foreground dark:text-foreground font-semibold">Total Investment:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        ₹{(parseFloat(amount) * parseInt(duration)).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}


          {/* Monthly Performance Section */}
          {fund?.schemeCode && (
            <div className="mt-4 border-t pt-4">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    View Monthly Performance
                  </span>
                  <span className="text-muted-foreground text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-3">
                  <MfMonthwisePerformance schemeCode={fund.schemeCode} months={12} />
                </div>
              </details>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToCart}
              disabled={addToCartMutation.isPending}
              className="flex-1 bg-finance-blue hover:bg-blue-600"
              data-testid="button-add-to-cart"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {addToCartMutation.isPending ? "Adding..." : "Add to Cart"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
