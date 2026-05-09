import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface Market {
  id: string;
  marketCode: string;
  marketName: string;
  region: string;
  advisoryLevel: string;
  executionAllowed: boolean;
  baseCurrency: string;
  timezone: string;
  regulatoryBody: string | null;
  regulatoryNotes: string | null;
  isEnabled: boolean;
  rolloutPhase: number;
  enabledEnvironments: string[];
  displayOrder: number;
  flagEmoji: string | null;
}

export interface MarketProduct {
  id: string;
  marketCode: string;
  productCategory: string;
  productSubCategory: string | null;
  isEnabled: boolean;
  advisoryLevel: string;
  requiresAccreditedInvestor: boolean;
  minimumInvestment: string | null;
  minimumInvestmentCurrency: string | null;
  riskCategory: string | null;
  etfOnlyRestriction: boolean;
  complianceNotes: string | null;
}

export interface UserMarketPreferences {
  id: string;
  userId: string;
  selectedMarket: string;
  displayCurrency: string;
  showGlobalMarkets: boolean;
  preferredMarkets: string[] | null;
  lastGlobalAdvisoryAccess: string | null;
  globalAdvisorySessionCount: number;
}

export interface FeatureFlag {
  id: string;
  flagKey: string;
  flagName: string;
  description: string | null;
  isEnabled: boolean;
  defaultValue: any;
  enabledEnvironments: string[];
  isKillSwitch: boolean;
  killSwitchActivatedAt: string | null;
  killSwitchReason: string | null;
  category: string | null;
}

export interface Acknowledgment {
  id: string;
  userId: string;
  marketCode: string;
  acknowledgmentType: string;
  disclaimerVersion: string;
  disclaimerText: string;
  acknowledgedAt: string;
  ipAddress: string | null;
  expiresAt: string | null;
  isRevoked: boolean;
}

export function useEnabledMarkets() {
  return useQuery<{ success: boolean; markets: Market[] }>({
    queryKey: ["/api/global-advisory/markets"],
  });
}

export function useAllMarkets() {
  return useQuery<{ success: boolean; markets: Market[] }>({
    queryKey: ["/api/global-advisory/markets", "all"],
    queryFn: async () => {
      const response = await fetch("/api/global-advisory/markets?all=true", { credentials: "include" });
      return response.json();
    },
  });
}

export function useMarket(marketCode: string) {
  return useQuery<{ success: boolean; market: Market }>({
    queryKey: ["/api/global-advisory/markets", marketCode],
    queryFn: async () => {
      const response = await fetch(`/api/global-advisory/markets/${marketCode}`, { credentials: "include" });
      return response.json();
    },
    enabled: !!marketCode,
  });
}

export function useMarketProducts(marketCode: string) {
  return useQuery<{ success: boolean; products: MarketProduct[] }>({
    queryKey: ["/api/global-advisory/markets", marketCode, "products"],
    queryFn: async () => {
      const response = await fetch(`/api/global-advisory/markets/${marketCode}/products`, { credentials: "include" });
      return response.json();
    },
    enabled: !!marketCode,
  });
}

export function useUserMarketPreferences() {
  return useQuery<{ success: boolean; preferences: UserMarketPreferences }>({
    queryKey: ["/api/global-advisory/preferences"],
  });
}

export function useUpdateMarketPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (preferences: Partial<UserMarketPreferences>) => {
      return apiRequest("/api/global-advisory/preferences", {
        method: "POST",
        body: JSON.stringify(preferences),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-advisory/preferences"] });
    },
  });
}

export function useSelectMarket() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (marketCode: string) => {
      return apiRequest("/api/global-advisory/select-market", {
        method: "POST",
        body: JSON.stringify({ marketCode }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-advisory/preferences"] });
    },
  });
}

export function useFeatureFlags(category?: string) {
  return useQuery<{ success: boolean; flags: FeatureFlag[] }>({
    queryKey: ["/api/global-advisory/feature-flags"],
  });
}

export function useFeatureFlag(flagKey: string) {
  return useQuery<{ success: boolean; isEnabled: boolean; flag: FeatureFlag }>({
    queryKey: ["/api/global-advisory/feature-flags", flagKey],
    queryFn: async () => {
      const response = await fetch(`/api/global-advisory/feature-flags/${flagKey}`, { credentials: "include" });
      return response.json();
    },
    enabled: !!flagKey,
  });
}

export function useCanExecuteInMarket(marketCode: string) {
  return useQuery<{ success: boolean; canExecute: boolean; reason?: string }>({
    queryKey: ["/api/global-advisory/can-execute", marketCode],
    queryFn: async () => {
      const response = await fetch(`/api/global-advisory/can-execute/${marketCode}`, { credentials: "include" });
      return response.json();
    },
    enabled: !!marketCode,
  });
}

export function useUserAcknowledgments() {
  return useQuery<{ success: boolean; acknowledgments: Acknowledgment[] }>({
    queryKey: ["/api/global-advisory/acknowledgments"],
  });
}

export function useHasAcknowledged(marketCode: string, type: string) {
  return useQuery<{ success: boolean; hasAcknowledged: boolean }>({
    queryKey: ["/api/global-advisory/acknowledgments/check", marketCode, type],
    queryFn: async () => {
      const response = await fetch(`/api/global-advisory/acknowledgments/check/${marketCode}/${type}`, { credentials: "include" });
      return response.json();
    },
    enabled: !!marketCode && !!type,
  });
}

export function useRecordAcknowledgment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      marketCode: string;
      acknowledgmentType: string;
      disclaimerVersion: string;
      disclaimerText: string;
    }) => {
      return apiRequest("/api/global-advisory/acknowledgments", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-advisory/acknowledgments"] });
    },
  });
}

export interface MarketEligibility {
  marketCode: string;
  marketName: string;
  isEligible: boolean;
  advisoryLevel: string;
  canExecute: boolean;
  allowedProducts: string[];
  restrictions: string[];
  baseCurrency: string;
  flagEmoji: string | null;
}

export interface JurisdictionFeatureFlags {
  canExecuteTrades: boolean;
  canViewAnalytics: boolean;
  canAccessRealTimeData: boolean;
  canAccessResearch: boolean;
  canAccessAlerts: boolean;
  hasEtfOnlyRestriction: boolean;
  requiresAccreditedStatus: boolean;
  requiredAcknowledgments: string[];
}

export interface CurrencyConversionResult {
  convertedAmount: number;
  rate: number;
  fromCurrency: string;
  toCurrency: string;
}

export function useMarketEligibility() {
  return useQuery<{ success: boolean; eligibility: { markets: MarketEligibility[]; primaryMarket: string; isAnalyticsMode: boolean } }>({
    queryKey: ["/api/global-advisory/eligibility"],
  });
}

export function useMarketEligibilityForMarket(marketCode: string) {
  return useQuery<{ success: boolean; eligibility: MarketEligibility }>({
    queryKey: ["/api/global-advisory/eligibility", marketCode],
    queryFn: async () => {
      const response = await fetch(`/api/global-advisory/eligibility/${marketCode}`, { credentials: "include" });
      return response.json();
    },
    enabled: !!marketCode,
  });
}

export function useCurrencyConversion(amount: number, fromCurrency: string, toCurrency: string) {
  return useQuery<{ success: boolean } & CurrencyConversionResult>({
    queryKey: ["/api/global-advisory/convert", amount, fromCurrency, toCurrency],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        amount: amount.toString(), 
        from: fromCurrency, 
        to: toCurrency 
      });
      const response = await fetch(`/api/global-advisory/convert?${params}`, { credentials: "include" });
      return response.json();
    },
    enabled: amount > 0 && !!fromCurrency && !!toCurrency && fromCurrency !== toCurrency,
  });
}

export function useExchangeRates(baseCurrency: string = "INR") {
  return useQuery<{ success: boolean; rates: Record<string, number> }>({
    queryKey: ["/api/global-advisory/exchange-rates", baseCurrency],
    queryFn: async () => {
      const params = new URLSearchParams({ baseCurrency });
      const response = await fetch(`/api/global-advisory/exchange-rates?${params}`, { credentials: "include" });
      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function getAdvisoryBadgeConfig(advisoryLevel: string): { label: string; variant: "default" | "secondary" | "outline" | "destructive"; description: string } {
  switch (advisoryLevel) {
    case "FULL":
      return { 
        label: "Full Advisory", 
        variant: "default",
        description: "Full advisory and execution services available"
      };
    case "ANALYTICS_ONLY":
      return { 
        label: "Analytics-Only", 
        variant: "secondary",
        description: "Analytics and signals only - execute with your broker"
      };
    default:
      return { 
        label: "Limited", 
        variant: "outline",
        description: "Limited services available"
      };
  }
}

export function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    SGD: "S$",
    JPY: "¥",
    HKD: "HK$",
    AED: "د.إ"
  };
  return symbols[currencyCode] || currencyCode;
}
