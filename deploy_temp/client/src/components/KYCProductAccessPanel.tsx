/**
 * KYC Product Access Panel
 *
 * Shows the client exactly which products their completed KYC unlocks,
 * and for products requiring additional data, shows precisely what's missing.
 * Powered by the /api/kyc/sufficiency endpoint.
 */

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  Lock,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Landmark,
  Heart,
  FileText,
  DollarSign,
  Building2,
  Globe,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

// ─── Types mirroring server/services/kyc-sufficiency-service.ts ──────────────

interface VerificationStatus {
  key: string;
  label: string;
  description: string;
  mandatory: boolean;
  satisfied: boolean;
  verifiedAt?: string;
  expiresAt?: string;
  upgradeAvailable?: boolean;
}

interface DataFieldStatus {
  key: string;
  label: string;
  mandatory: boolean;
  satisfied: boolean;
  prefilledValue?: string | null;
  source: string;
  description: string;
}

interface SufficiencyResult {
  productCode: string;
  productName: string;
  regulatoryBasis: string;
  canProceed: boolean;
  kycTier: string;
  kycVerifiedAt?: string;
  kycExpiresAt?: string;
  kycIsExpired: boolean;
  verifications: VerificationStatus[];
  dataFields: DataFieldStatus[];
  missingMandatory: string[];
  missingOptional: string[];
  prefilledData: Record<string, string | null>;
  completionPercentage: number;
}

interface ProductsResponse {
  success: boolean;
  products: SufficiencyResult[];
}

// ─── Product metadata (icons, categories) ────────────────────────────────────

const PRODUCT_META: Record<string, { icon: React.ElementType; category: string; color: string }> = {
  MUTUAL_FUNDS:        { icon: TrendingUp,  category: "Investments",  color: "text-green-600" },
  EQUITY_TRADING:      { icon: BarChart3,   category: "Investments",  color: "text-blue-600" },
  F_AND_O:             { icon: Zap,         category: "Investments",  color: "text-orange-600" },
  BONDS_NCD:           { icon: Landmark,    category: "Fixed Income", color: "text-indigo-600" },
  FIXED_DEPOSITS:      { icon: DollarSign,  category: "Fixed Income", color: "text-cyan-600" },
  UNLISTED_SECURITIES: { icon: Globe,       category: "Investments",  color: "text-violet-600" },
  PMS_AIF:             { icon: Building2,   category: "Premium",      color: "text-purple-600" },
  LOANS_PERSONAL:      { icon: DollarSign,  category: "Credit",       color: "text-rose-600" },
  LOANS_BUSINESS:      { icon: Building2,   category: "Credit",       color: "text-red-600" },
  INSURANCE_LIFE:      { icon: Shield,      category: "Insurance",    color: "text-sky-600" },
  INSURANCE_HEALTH:    { icon: Heart,       category: "Insurance",    color: "text-pink-600" },
  ITR_FILING:          { icon: FileText,    category: "Tax",          color: "text-amber-600" },
  CRYPTO:              { icon: Globe,       category: "Investments",  color: "text-yellow-600" },
};

const CATEGORIES = ["Investments", "Fixed Income", "Credit", "Insurance", "Tax", "Premium"];

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ canProceed, pct, expired }: { canProceed: boolean; pct: number; expired: boolean }) {
  if (expired) {
    return (
      <Badge variant="destructive" className="text-xs">
        <Clock className="h-3 w-3 mr-1" /> KYC Expired
      </Badge>
    );
  }
  if (canProceed) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
      </Badge>
    );
  }
  if (pct >= 50) {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
        <AlertCircle className="h-3 w-3 mr-1" /> {pct}% — Partial
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">
      <Lock className="h-3 w-3 mr-1" /> Locked
    </Badge>
  );
}

// ─── Single product card ──────────────────────────────────────────────────────

function ProductCard({ product }: { product: SufficiencyResult }) {
  const [expanded, setExpanded] = useState(false);
  const [, setLocation] = useLocation();
  const meta = PRODUCT_META[product.productCode] ?? { icon: Globe, category: "Other", color: "text-muted-foreground" };
  const Icon = meta.icon;

  const missingVerifications = product.verifications.filter(v => v.mandatory && !v.satisfied);
  const missingData = product.dataFields.filter(f => f.mandatory && !f.satisfied);
  const satisfiedVerifications = product.verifications.filter(v => v.satisfied);
  const satisfiedData = product.dataFields.filter(f => f.satisfied);

  return (
    <Card
      className={cn(
        "transition-all duration-200 cursor-pointer",
        product.canProceed
          ? "border-green-200 dark:border-green-900 hover:shadow-md"
          : product.completionPercentage >= 50
          ? "border-amber-200 dark:border-amber-900 hover:shadow-sm"
          : "border-slate-200 dark:border-slate-800 opacity-90"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center",
              product.canProceed ? "bg-green-50 dark:bg-green-950" : "bg-slate-100 dark:bg-slate-800"
            )}>
              <Icon className={cn("h-5 w-5", product.canProceed ? meta.color : "text-muted-foreground")} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{product.productName}</CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill canProceed={product.canProceed} pct={product.completionPercentage} expired={product.kycIsExpired} />
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Progress bar for partial */}
        {!product.canProceed && !product.kycIsExpired && (
          <Progress value={product.completionPercentage} className="h-1 mt-2" />
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4" onClick={e => e.stopPropagation()}>
          <p className="text-xs text-muted-foreground border-t pt-3">
            {product.regulatoryBasis}
          </p>

          {/* Already satisfied */}
          {(satisfiedVerifications.length > 0 || satisfiedData.length > 0) && (
            <div>
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Already verified from your KYC
              </p>
              <div className="flex flex-wrap gap-1.5">
                {satisfiedVerifications.map(v => (
                  <span key={v.key} className="inline-flex items-center gap-1 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {v.label}
                    {v.verifiedAt && (
                      <span className="text-[10px] text-green-500">
                        · {new Date(v.verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                    )}
                  </span>
                ))}
                {satisfiedData.map(f => (
                  <span key={f.key} className="inline-flex items-center gap-1 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {f.label}
                    {f.prefilledValue && (
                      <span className="text-[10px] text-green-500 max-w-[80px] truncate">· {f.prefilledValue}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing mandatory */}
          {(missingVerifications.length > 0 || missingData.length > 0) && (
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Still needed to proceed
              </p>
              <div className="space-y-1.5">
                {missingVerifications.map(v => (
                  <div key={v.key} className="flex items-start gap-2 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium">{v.label}</span>
                      <span className="text-muted-foreground ml-1">— {v.description}</span>
                      {v.upgradeAvailable === false && (
                        <span className="block text-[10px] text-rose-500 mt-0.5">Requires actual video session (SEBI mandate)</span>
                      )}
                    </div>
                  </div>
                ))}
                {missingData.map(f => (
                  <div key={f.key} className="flex items-start gap-2 text-xs">
                    <div className={cn(
                      "h-3.5 w-3.5 mt-0.5 shrink-0 rounded-full border-2",
                      f.source === 'pan_api' || f.source === 'aadhaar_okyc' || f.source === 'ckyc'
                        ? "border-blue-400"
                        : "border-slate-400"
                    )} />
                    <div>
                      <span className="font-medium">{f.label}</span>
                      <span className="text-muted-foreground ml-1">— {f.description}</span>
                      <span className="block text-[10px] text-muted-foreground capitalize">
                        Source: {f.source.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* T005: "Complete requirements" CTA for amber/partial cards */}
          {!product.canProceed && !product.kycIsExpired && (missingVerifications.length > 0 || missingData.length > 0) && (
            <div className="pt-1">
              {/* Only show verifiable-via-KYC-wizard items (exclude manual-only like demat, video KYC) */}
              {missingVerifications.some(v => v.upgradeAvailable !== false) || missingData.some(f => ['pan_api', 'aadhaar_okyc', 'ckyc', 'user_input'].includes(f.source)) ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(`/profile?tab=kyc-dashboard&product=${product.productCode}`);
                  }}
                >
                  Complete remaining requirements
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              ) : (
                <p className="text-[11px] text-muted-foreground text-center py-1">
                  Remaining steps require dedicated verification sessions (e.g., video KYC, demat setup).
                </p>
              )}
            </div>
          )}

          {product.canProceed && (
            <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-300">
                Your KYC is complete for this product. No additional verification needed.
                {product.kycExpiresAt && (
                  <span className="block text-[10px] mt-0.5 text-green-600">
                    Valid until {new Date(product.kycExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function KYCProductAccessPanel() {
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["/api/kyc/sufficiency"],
  });

  const products = data?.products ?? [];

  const readyCount = products.filter(p => p.canProceed).length;
  const totalCount = products.length;

  const categories = ["All", ...CATEGORIES.filter(cat =>
    products.some(p => PRODUCT_META[p.productCode]?.category === cat)
  )];

  const filteredProducts = activeCategory === "All"
    ? products
    : products.filter(p => PRODUCT_META[p.productCode]?.category === activeCategory);

  // Sort: ready first, then partial, then locked
  const sorted = [...filteredProducts].sort((a, b) => {
    if (a.canProceed !== b.canProceed) return a.canProceed ? -1 : 1;
    return b.completionPercentage - a.completionPercentage;
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Product Access — KYC Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Product Access — KYC Status
            </CardTitle>
            <CardDescription className="mt-1">
              Your KYC data is reused automatically. Only missing details are needed for each product.
            </CardDescription>
          </div>
          {totalCount > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">{readyCount}</p>
              <p className="text-xs text-muted-foreground">of {totalCount} ready</p>
            </div>
          )}
        </div>

        {/* Category filter tabs */}
        <div className="flex gap-1.5 flex-wrap mt-3">
          {categories.map(cat => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {sorted.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Complete your KYC to see product access</p>
          </div>
        )}

        {sorted.map(product => (
          <ProductCard key={product.productCode} product={product} />
        ))}

        {totalCount > 0 && readyCount < totalCount && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Tap any product to see what's already verified and what else is needed.
              Your verified data is pre-filled — you only enter what's genuinely missing.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
