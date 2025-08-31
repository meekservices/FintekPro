import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Portfolio, PortfolioHolding, AssetAllocation } from "@shared/schema";

interface EnhancedHolding extends PortfolioHolding {
  currentPrice: string;
  investedValue: string;
  currentValue: string;
  gainLoss: string;
  gainLossPercent: string;
  dayChange: string;
  dayChangePercent: string;
  exchange: string;
  marketData: any;
  lastUpdated: string;
}

interface PortfolioPerformance {
  portfolioId: string;
  totalInvestedValue: string;
  totalCurrentValue: string;
  totalGainLoss: string;
  totalGainLossPercent: string;
  dayChange: string;
  dayChangePercent: string;
  holdingsCount: number;
  exchangeBreakdown: Array<{
    exchange: string;
    value: number;
    percentage: string;
  }>;
  assetBreakdown: Array<{
    assetType: string;
    name: string;
    value: number;
    percentage: string;
    color: string;
  }>;
  lastUpdated: string;
}

export function usePortfolios(userId: string) {
  return useQuery<Portfolio[]>({
    queryKey: ['/api/portfolios', userId],
    enabled: !!userId,
  });
}

export function usePortfolioHoldings(portfolioId: string) {
  return useQuery<PortfolioHolding[]>({
    queryKey: ['/api/portfolios', portfolioId, 'holdings'],
    enabled: !!portfolioId,
  });
}

export function useEnhancedPortfolioHoldings(portfolioId: string) {
  return useQuery<EnhancedHolding[]>({
    queryKey: ['/api/portfolios', portfolioId, 'holdings', 'enhanced'],
    enabled: !!portfolioId,
    refetchInterval: 30000, // Refresh every 30 seconds for live market data
  });
}

export function usePortfolioPerformance(portfolioId: string) {
  return useQuery<PortfolioPerformance>({
    queryKey: ['/api/portfolios', portfolioId, 'performance'],
    enabled: !!portfolioId,
    refetchInterval: 30000, // Refresh every 30 seconds for live performance data
  });
}

export function useAssetAllocation(portfolioId: string) {
  return useQuery<AssetAllocation[]>({
    queryKey: ['/api/portfolios', portfolioId, 'allocation'],
    enabled: !!portfolioId,
  });
}

export function useCreatePortfolio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (portfolioData: any) => {
      const response = await apiRequest("POST", "/api/portfolios", portfolioData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
    },
  });
}

export function useAddHolding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ portfolioId, holdingData }: { portfolioId: string; holdingData: any }) => {
      const response = await apiRequest("POST", `/api/portfolios/${portfolioId}/holdings`, holdingData);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/portfolios', variables.portfolioId, 'holdings'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/portfolios', variables.portfolioId, 'allocation'] 
      });
    },
  });
}

export function useRebalancePortfolio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ portfolioId, targetAllocations }: { portfolioId: string; targetAllocations: any[] }) => {
      const response = await apiRequest("POST", `/api/portfolios/${portfolioId}/rebalance`, {
        targetAllocations
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/portfolios', variables.portfolioId, 'allocation'] 
      });
    },
  });
}

// Portfolio-specific rebalancing suggestions
export function usePortfolioRebalancingSuggestions(portfolioId: string) {
  return useQuery<any[]>({
    queryKey: ['/api/portfolios', portfolioId, 'rebalancing-suggestions'],
    enabled: !!portfolioId,
  });
}

// Portfolio-specific news based on holdings
export function usePortfolioNews(portfolioId: string) {
  return useQuery<any[]>({
    queryKey: ['/api/portfolios', portfolioId, 'news'],
    enabled: !!portfolioId,
    refetchInterval: 300000, // Refresh every 5 minutes
  });
}
