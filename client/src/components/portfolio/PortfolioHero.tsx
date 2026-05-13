import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  LucideShield as LucideShield,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioHeroProps {
  totalValue: number;
  investedValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalGain: number;
  totalGainPercent: number;
  holdingsCount: number;
  isLoading?: boolean;
  onRefresh?: () => void;
  panVerified?: boolean;
}

export function PortfolioHero({
  totalValue,
  investedValue,
  dayChange,
  dayChangePercent,
  totalGain,
  totalGainPercent,
  holdingsCount,
  isLoading = false,
  onRefresh,
  panVerified = true,
}: PortfolioHeroProps) {
  const [isValueHidden, setIsValueHidden] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const formatCurrency = (value: number) => {
    if (isValueHidden) return "••••••";
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${value.toLocaleString("en-IN")}`;
  };

  const isDayPositive = dayChange >= 0;
  const isTotalPositive = totalGain >= 0;

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-foreground border-0 shadow-2xl" data-testid="portfolio-hero-loading">
        <CardContent className="p-6 md:p-8">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32 bg-muted" />
            <Skeleton className="h-14 w-64 bg-muted" />
            <div className="flex gap-4">
              <Skeleton className="h-8 w-32 bg-muted" />
              <Skeleton className="h-8 w-32 bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-foreground border-0 shadow-2xl overflow-hidden relative" data-testid="portfolio-hero">
      <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
      <CardContent className="p-6 md:p-8 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              {panVerified && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30">
                  <LucideShield className="h-3 w-3 mr-1" />
                  PAN Verified
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={() => setIsValueHidden(!isValueHidden)}
                data-testid="toggle-value-visibility"
              >
                {isValueHidden ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="refresh-portfolio"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </div>

            <div>
              <p className="text-muted-foreground text-sm font-medium mb-1">Total Portfolio Value</p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight" data-testid="portfolio-total-value">
                {formatCurrency(totalValue)}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full",
                  isDayPositive ? "bg-green-500/20" : "bg-red-500/20"
                )}
                data-testid="day-change-badge"
              >
                {isDayPositive ? (
                  <ArrowUpRight className="h-4 w-4 text-green-400" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-400" />
                )}
                <span className={cn("font-semibold", isDayPositive ? "text-green-400" : "text-red-400")}>
                  {isValueHidden ? "••••" : `${isDayPositive ? "+" : ""}₹${Math.abs(dayChange).toLocaleString("en-IN")}`}
                </span>
                <span className={cn("text-sm", isDayPositive ? "text-green-400/80" : "text-red-400/80")}>
                  ({isDayPositive ? "+" : ""}{dayChangePercent.toFixed(2)}%)
                </span>
                <span className="text-muted-foreground text-sm ml-1">Today</span>
              </div>

              <div
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full",
                  isTotalPositive ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"
                )}
                data-testid="total-gain-badge"
              >
                {isTotalPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
                <span className={cn("font-semibold", isTotalPositive ? "text-green-400" : "text-red-400")}>
                  {isValueHidden ? "••••" : `${isTotalPositive ? "+" : ""}₹${Math.abs(totalGain).toLocaleString("en-IN")}`}
                </span>
                <span className={cn("text-sm", isTotalPositive ? "text-green-400/80" : "text-red-400/80")}>
                  ({isTotalPositive ? "+" : ""}{totalGainPercent.toFixed(2)}%)
                </span>
                <span className="text-muted-foreground text-sm ml-1">Total</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:gap-6">
            <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50" data-testid="invested-value-card">
              <p className="text-muted-foreground text-xs font-medium mb-1">Invested Value</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {formatCurrency(investedValue)}
              </p>
              <p className="text-muted-foreground text-xs mt-1">Cost basis</p>
            </div>

            <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50" data-testid="current-value-card">
              <p className="text-muted-foreground text-xs font-medium mb-1">Current Value</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {formatCurrency(totalValue)}
              </p>
              <p className="text-muted-foreground text-xs mt-1">Market value</p>
            </div>

            <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50" data-testid="total-returns-card">
              <p className="text-muted-foreground text-xs font-medium mb-1">Total Returns</p>
              <p className={cn("text-xl md:text-2xl font-bold", isTotalPositive ? "text-green-400" : "text-red-400")}>
                {isTotalPositive ? "+" : ""}{totalGainPercent.toFixed(2)}%
              </p>
              <p className="text-muted-foreground text-xs mt-1">Since inception</p>
            </div>

            <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50" data-testid="holdings-count-card">
              <p className="text-muted-foreground text-xs font-medium mb-1">Holdings</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">{holdingsCount}</p>
              <p className="text-muted-foreground text-xs mt-1">Active assets</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
