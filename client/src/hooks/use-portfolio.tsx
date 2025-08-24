import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Portfolio, PortfolioHolding, AssetAllocation } from "@shared/schema";

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
