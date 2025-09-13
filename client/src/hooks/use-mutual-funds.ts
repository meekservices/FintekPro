import { useQuery } from '@tanstack/react-query';

// API request helper
async function apiRequest(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  const result = await response.json();
  // Extract data from {success: true, data: [...]} structure
  return result.data || result;
}

export interface MutualFundData {
  id?: string;
  schemeCode: string;
  schemeName: string;
  category?: string;
  fundHouse?: string;
  nav: string;
  change?: string;
  changePercent?: string;
  expenseRatio?: string;
  aum?: string;
  riskLevel?: string;
  returns1y?: string;
  returns3y?: string;
  returns5y?: string;
  lastUpdated?: Date;
  historicalData?: Array<{date: string, nav: string}>;
}

export function useMutualFunds() {
  return useQuery<MutualFundData[]>({
    queryKey: ['/api/mutual-funds'],
    queryFn: () => apiRequest('/api/mutual-funds'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });
}

export function useMutualFund(schemeCode: string) {
  return useQuery<MutualFundData>({
    queryKey: ['/api/mutual-funds', schemeCode],
    queryFn: () => apiRequest(`/api/mutual-funds/${schemeCode}`),
    enabled: !!schemeCode,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function usePopularMutualFunds() {
  return useQuery<MutualFundData[]>({
    queryKey: ['/api/mutual-funds/popular'],
    queryFn: () => apiRequest('/api/mutual-funds/popular'),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useSearchMutualFunds(query: string) {
  return useQuery<MutualFundData[]>({
    queryKey: ['/api/mutual-funds/search', query],
    queryFn: () => apiRequest(`/api/mutual-funds/search/${encodeURIComponent(query)}`),
    enabled: !!query && query.length > 2,
    staleTime: 5 * 60 * 1000,
  });
}