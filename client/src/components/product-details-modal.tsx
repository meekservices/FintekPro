import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, ShoppingCart, Star, TrendingUp, Shield as LucideShield, Clock, CheckCircle, Info } from "lucide-react";
import { useKycGuard, TransactionType } from "@/hooks/use-kyc-guard";
import { KycGuardModal } from "@/components/kyc/KycGuardModal";

interface Product {
  id: string;
  name: string;
  shortDescription: string;
  category: string;
  productType: string;
  price?: number;
  minimumInvestment: number;
  riskLevel: string;
  expectedReturns: number;
  provider: string;
  features: string[];
  isFeatured: boolean;
  isWishlisted?: boolean;
}

interface ProductDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onWishlistToggle: (productId: string) => void;
  isWishlisted: boolean;
}

// Map product categories to KYC transaction types
function categoryToTxType(category: string): TransactionType {
  const c = category?.toLowerCase() || '';
  if (c.includes('bond') || c.includes('fixed income') || c.includes('ncd') || c.includes('debt')) return 'bonds';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('pms')) return 'pms';
  if (c.includes('aif')) return 'aif';
  if (c.includes('nps')) return 'nps';
  if (c.includes('reit') || c.includes('invit')) return 'reit';
  if (c.includes('mld')) return 'mld';
  if (c.includes('unlisted')) return 'unlisted';
  return 'mutual_funds'; // default
}

export function ProductDetailsModal({ 
  product, 
  isOpen, 
  onClose, 
  onWishlistToggle, 
  isWishlisted 
}: ProductDetailsModalProps) {
  // Hooks must be called before any early returns
  const { guardAction, isChecking, modalState, closeModal, proceedToKyc } = useKycGuard();

  if (!product) return null;

  const txType = categoryToTxType(product.category);

  const handleInvestNow = () => {
    guardAction(txType, () => {
      // Actual invest logic — currently a placeholder; replace with real action
      console.log('[KYC Guard] Proceeding with Invest Now for', product.name);
    });
  };

  const handleStartSip = () => {
    guardAction(txType, () => {
      console.log('[KYC Guard] Proceeding with Start SIP for', product.name);
    });
  };

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case "low": return "text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
      case "medium": return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
      case "high": return "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
      default: return "text-muted-foreground bg-muted border-border";
    }
  };

  const mockDetailedFeatures = [
    "Professional fund management",
    "Diversified portfolio across sectors",
    "Regular dividend distribution option",
    "Tax efficient investment structure",
    "Easy online transaction processing",
    "Transparent fee structure"
  ];

  const mockRegulatoryInfo = {
    nav: "₹45.67",
    fundManager: "Rajesh Kumar",
    expenseRatio: "1.85%",
    aum: "₹12,450 Cr",
    benchmark: "NIFTY 100 TRI",
    exitLoad: "1% if redeemed within 1 year"
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="product-details-modal">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-bold text-foreground">
                {product.name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-2">
                {product.shortDescription}
              </DialogDescription>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline">{product.category}</Badge>
                {product.isFeatured && (
                  <Badge className="bg-finance-blue text-white">
                    <Star className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                )}
                <Badge className={getRiskColor(product.riskLevel)}>
                  {product.riskLevel.charAt(0).toUpperCase() + product.riskLevel.slice(1)} Risk
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onWishlistToggle(product.id)}
              data-testid="button-wishlist-modal"
            >
              <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Key Metrics */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Expected Returns</p>
                      <p className="text-2xl font-bold text-green-600">{product.expectedReturns}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Min Investment</p>
                      <p className="text-2xl font-bold text-foreground">₹{product.minimumInvestment.toLocaleString()}</p>
                    </div>
                    <ShoppingCart className="h-8 w-8 text-finance-blue" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Risk Level</p>
                      <p className="text-lg font-semibold text-foreground">
                        {product.riskLevel.charAt(0).toUpperCase() + product.riskLevel.slice(1)}
                      </p>
                    </div>
                    <LucideShield className="h-8 w-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Provider</p>
                      <p className="text-sm font-medium text-foreground">{product.provider}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Features */}
            <h3 className="text-lg font-semibold mb-4">Key Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {mockDetailedFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>

            {/* Regulatory Information */}
            <h3 className="text-lg font-semibold mb-4">Fund Information</h3>
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Current NAV</p>
                    <p className="font-semibold">{mockRegulatoryInfo.nav}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fund Manager</p>
                    <p className="font-semibold">{mockRegulatoryInfo.fundManager}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expense Ratio</p>
                    <p className="font-semibold">{mockRegulatoryInfo.expenseRatio}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">AUM</p>
                    <p className="font-semibold">{mockRegulatoryInfo.aum}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Benchmark</p>
                    <p className="font-semibold text-xs">{mockRegulatoryInfo.benchmark}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Exit Load</p>
                    <p className="font-semibold text-xs">{mockRegulatoryInfo.exitLoad}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Investment Actions */}
          <div>
            <Card className="sticky top-4">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Investment Options</h3>
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Minimum Investment</span>
                    <span className="font-semibold">₹{product.minimumInvestment.toLocaleString()}</span>
                  </div>
                  {product.price && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Premium/Price</span>
                      <span className="font-semibold">₹{product.price.toLocaleString()}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Expected Returns</span>
                    <span className="font-semibold text-green-600">{product.expectedReturns}% p.a.</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    className="w-full bg-finance-blue hover:bg-finance-blue/90"
                    data-testid="button-invest-now"
                    onClick={handleInvestNow}
                    disabled={isChecking}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {isChecking ? "Checking KYC..." : "Invest Now"}
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    data-testid="button-start-sip"
                    onClick={handleStartSip}
                    disabled={isChecking}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {isChecking ? "Checking KYC..." : "Start SIP"}
                  </Button>
                  
                  <Button variant="outline" className="w-full" data-testid="button-get-info">
                    <Info className="h-4 w-4 mr-2" />
                    Get Information
                  </Button>
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-2">Investment Advisory</h4>
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    Our financial advisors are available to help you make informed investment decisions. 
                    Contact us for personalized guidance.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <KycGuardModal
      open={modalState.open}
      checkResult={modalState.checkResult}
      onClose={closeModal}
      onProceedToKyc={() => proceedToKyc()}
    />
    </>
  );
}