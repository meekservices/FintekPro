import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Globe, Shield, CheckCircle } from "lucide-react";

type UserType = 'individual' | 'corporate' | 'nri';

interface UserTypeSelectionProps {
  selectedType: UserType | null;
  onSelect: (type: UserType) => void;
  ctaLabel?: string;
  showTierInfo?: boolean;
}

export function UserTypeSelection({ 
  selectedType, 
  onSelect, 
  ctaLabel = "Select your account type to begin the verification process",
  showTierInfo = true 
}: UserTypeSelectionProps) {
  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* KYC Tier Information */}
      {showTierInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Shield className="h-5 w-5" />
              3-Tier KYC System
            </CardTitle>
            <CardDescription>
              Progressive verification levels unlocking different products and services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tier 1 */}
              <div className="p-4 border rounded-lg space-y-3 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/40">
                    Tier 1
                  </Badge>
                  <span className="text-xs text-muted-foreground">Basic KYC</span>
                </div>
                <h4 className="font-semibold text-sm">Essential Trading</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Stocks & Equity
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Mutual Funds
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    ETFs
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Required: PAN + KRA Verification
                </p>
              </div>

              {/* Tier 2 */}
              <div className="p-4 border rounded-lg space-y-3 bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/40">
                    Tier 2
                  </Badge>
                  <span className="text-xs text-muted-foreground">Enhanced KYC</span>
                </div>
                <h4 className="font-semibold text-sm">Advanced Products</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    All Tier 1 +
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    IPO Applications
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Bonds & Debentures
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    F&O Trading
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Required: Aadhaar + Bank Account
                </p>
              </div>

              {/* Tier 3 */}
              <div className="p-4 border rounded-lg space-y-3 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40">
                    Tier 3
                  </Badge>
                  <span className="text-xs text-muted-foreground">Accredited Investor</span>
                </div>
                <h4 className="font-semibold text-sm">Premium Access</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    All Tier 2 +
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Private Equity
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Alternative Investments
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Structured Products
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Required: Income/Net Worth Proof
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Start Your KYC Journey</CardTitle>
          <CardDescription>{ctaLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => onSelect("individual")}
              className="p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all text-center space-y-3"
              data-testid="button-select-individual"
            >
              <User className="h-12 w-12 mx-auto text-primary" />
              <h3 className="font-semibold">Individual</h3>
              <p className="text-sm text-muted-foreground">
                For personal investments
              </p>
            </button>

            <button
              onClick={() => onSelect("corporate")}
              className="p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all text-center space-y-3"
              data-testid="button-select-corporate"
            >
              <Building2 className="h-12 w-12 mx-auto text-primary" />
              <h3 className="font-semibold">Non-Individual</h3>
              <p className="text-sm text-muted-foreground">
                For businesses and entities
              </p>
            </button>

            <button
              onClick={() => onSelect("nri")}
              className="p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all text-center space-y-3"
              data-testid="button-select-nri"
            >
              <Globe className="h-12 w-12 mx-auto text-primary" />
              <h3 className="font-semibold">NRI</h3>
              <p className="text-sm text-muted-foreground">
                For Non-Resident Indians
              </p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
