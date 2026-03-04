import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Portfolio, PortfolioHolding, AssetAllocation, EpfHolding, PpfHolding, EpsHolding, InsuranceHolding, NpsAccount, ApyAccount } from "@shared/schema";

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

const toArray = <T>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

export function usePortfolios(userId: string) {
  return useQuery<Portfolio[], Error, Portfolio[]>({
    queryKey: ['/api/portfolios', userId],
    enabled: !!userId,
    select: toArray<Portfolio>,
  });
}

export function usePortfoliosByPan() {
  const { isAuthenticated } = useAuth();
  return useQuery<Portfolio[], Error, Portfolio[]>({
    queryKey: ['/api/portfolios/by-pan'],
    retry: false,
    enabled: isAuthenticated,
    select: toArray<Portfolio>,
  });
}

export function usePortfolioHoldings(portfolioId: string | null) {
  return useQuery<PortfolioHolding[], Error, PortfolioHolding[]>({
    queryKey: ['/api/portfolios', portfolioId, 'holdings'],
    enabled: !!portfolioId,
    select: toArray<PortfolioHolding>,
  });
}

export function useEnhancedPortfolioHoldings(portfolioId: string | null) {
  return useQuery<EnhancedHolding[], Error, EnhancedHolding[]>({
    queryKey: ['/api/portfolios', portfolioId, 'holdings', 'enhanced'],
    enabled: !!portfolioId,
    refetchInterval: 30000,
    select: toArray<EnhancedHolding>,
  });
}

export function usePortfolioPerformance(portfolioId: string | null) {
  return useQuery<PortfolioPerformance>({
    queryKey: ['/api/portfolios', portfolioId, 'performance'],
    enabled: !!portfolioId,
    refetchInterval: 30000,
  });
}

export function useAssetAllocation(portfolioId: string | null) {
  return useQuery<AssetAllocation[], Error, AssetAllocation[]>({
    queryKey: ['/api/portfolios', portfolioId, 'allocation'],
    enabled: !!portfolioId,
    select: toArray<AssetAllocation>,
  });
}

// Government Scheme Holdings hooks
export function useEpfHoldings() {
  return useQuery<EpfHolding[], Error, EpfHolding[]>({
    queryKey: ['/api/government-schemes/epf'],
    select: toArray<EpfHolding>,
  });
}

export function usePpfHoldings() {
  return useQuery<PpfHolding[], Error, PpfHolding[]>({
    queryKey: ['/api/government-schemes/ppf'],
    select: toArray<PpfHolding>,
  });
}

export function useEpsHoldings() {
  return useQuery<EpsHolding[], Error, EpsHolding[]>({
    queryKey: ['/api/government-schemes/eps'],
    select: toArray<EpsHolding>,
  });
}

export function useNpsAccounts() {
  return useQuery<NpsAccount[], Error, NpsAccount[]>({
    queryKey: ['/api/government-schemes/nps'],
    select: toArray<NpsAccount>,
  });
}

export function useApyAccounts() {
  return useQuery<ApyAccount[], Error, ApyAccount[]>({
    queryKey: ['/api/government-schemes/apy'],
    select: toArray<ApyAccount>,
  });
}

// Insurance Holdings hooks
export function useInsuranceHoldings() {
  return useQuery<InsuranceHolding[], Error, InsuranceHolding[]>({
    queryKey: ['/api/insurance-holdings'],
    select: toArray<InsuranceHolding>,
  });
}

export function useCreatePortfolio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (portfolioData: any) => {
      return await apiRequest("/api/portfolios", {
        method: "POST",
        body: JSON.stringify(portfolioData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
    },
  });
}

export function useAddHolding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ portfolioId, holdingData }: { portfolioId: string; holdingData: any }) => {
      return await apiRequest(`/api/portfolios/${portfolioId}/holdings`, {
        method: "POST",
        body: JSON.stringify(holdingData),
      });
    },
    onSuccess: (_, variables) => {
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
      return await apiRequest(`/api/portfolios/${portfolioId}/rebalance`, {
        method: "POST",
        body: JSON.stringify({ targetAllocations }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/portfolios', variables.portfolioId, 'allocation'] 
      });
    },
  });
}

// Portfolio-specific rebalancing suggestions
export function usePortfolioRebalancingSuggestions(portfolioId: string | null) {
  return useQuery<any[]>({
    queryKey: ['/api/portfolios', portfolioId, 'rebalancing-suggestions'],
    enabled: !!portfolioId,
  });
}

// Portfolio-specific news based on holdings
export function usePortfolioNews(portfolioId: string | null) {
  return useQuery<any[]>({
    queryKey: ['/api/portfolios', portfolioId, 'news'],
    enabled: !!portfolioId,
    refetchInterval: 300000, // Refresh every 5 minutes
  });
}

// ============================================
// Portfolio Import Types & Mutations
// ============================================

export type ImportSource = 'cas_statement' | 'broker_pdf' | 'wealthy_url' | 'manual_entry' | 'url_import';

export type AssetType = 'equity' | 'mutual_fund' | 'etf' | 'bond' | 'gold' | 'debt' | 'hybrid' | 'pms' | 'aif' | 'reit' | 'invit' | 'unlisted' | 'other';

export interface ImportedHolding {
  id?: string;
  symbol?: string;
  isin?: string;
  name: string;
  assetType: AssetType;
  quantity: string;
  avgPrice: string;
  currentValue?: string;
  purchaseDate?: string;
  source?: ImportSource;
  folioNumber?: string;
  amcName?: string;
  schemeName?: string;
  lots?: any[];
  lotCount?: number;
  lotSummary?: string;
  broker?: string;
}

export interface ImportResult {
  success: boolean;
  holdings: ImportedHolding[];
  summary?: {
    totalHoldings: number;
    totalInvested: number;
    totalCurrentValue: number;
    equityPercent: number;
    debtPercent: number;
  };
  investor?: {
    name: string;
    pan: string;
    lastSync?: string;
  };
  errors?: string[];
  warnings?: string[];
  brokerDetected?: string;
  confidenceScore?: number;
  source?: string;
  tierBreakdown?: any;
  lotCounts?: any;
  reconciliation?: any;
  portfolioSummary?: any;
}

export interface ParseOptions {
  prospectId?: string;
  userId?: string;
  replaceExisting?: boolean;
  source?: ImportSource;
}

export function useParsePortfolioPDF() {
  return useMutation<ImportResult, Error, { file: File; options?: ParseOptions }>({
    mutationFn: async ({ file, options }) => {
      const formData = new FormData();
      formData.append('portfolio', file);
      if (options?.prospectId) {
        formData.append('prospectId', options.prospectId);
      }
      
      const endpoint = options?.prospectId 
        ? `/api/agent/prospects/${options.prospectId}/portfolio/upload`
        : '/api/portfolio/import/pdf';
      
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to parse PDF' }));
        throw new Error(error.message || 'Failed to parse PDF');
      }
      return res.json();
    },
  });
}

export function useParsePortfolioURL() {
  return useMutation<ImportResult, Error, { url: string; options?: ParseOptions }>({
    mutationFn: async ({ url, options }) => {
      const endpoint = options?.prospectId
        ? `/api/agent/prospects/${options.prospectId}/portfolio/import-url`
        : '/api/portfolio/import/url';
      
      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ url, replaceExisting: options?.replaceExisting }),
      });
      return res.json();
    },
  });
}

export function useParseCASStatement() {
  return useMutation<ImportResult, Error, { file: File; type: 'cas' | 'demat'; options?: ParseOptions }>({
    mutationFn: async ({ file, type, options }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      if (options?.prospectId) {
        formData.append('prospectId', options.prospectId);
      }
      
      const endpoint = options?.prospectId
        ? '/api/agent-wizard/portfolio/parse-cas'
        : '/api/portfolio/import/cas';
      
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to parse CAS statement' }));
        throw new Error(error.message || 'Failed to parse CAS statement');
      }
      return res.json();
    },
  });
}

export function useSmartImport() {
  return useMutation<ImportResult, Error, { file?: File; url?: string; prospectId?: string }>({
    mutationFn: async ({ file, url, prospectId }) => {
      const formData = new FormData();
      if (file) formData.append('portfolio', file);
      if (url) formData.append('url', url);
      if (prospectId) formData.append('prospectId', prospectId);

      const res = await fetch('/api/portfolio/import/smart', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to import portfolio' }));
        throw new Error(error.message || error.error || 'Failed to import portfolio');
      }
      return res.json();
    },
  });
}

export function useImportWealthyURL() {
  const queryClient = useQueryClient();
  
  return useMutation<ImportResult, Error, { url: string; replaceExisting?: boolean }>({
    mutationFn: async ({ url, replaceExisting }) => {
      const res = await apiRequest('POST', '/api/portfolio/import-wealthy', { url, replaceExisting });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/external-holdings'] });
    },
  });
}

export function useSaveImportedHoldings() {
  const queryClient = useQueryClient();
  
  return useMutation<{ success: boolean; savedCount: number }, Error, { 
    holdings: ImportedHolding[]; 
    prospectId?: string;
    portfolioId?: string;
    source: ImportSource;
    replaceExisting?: boolean;
  }>({
    mutationFn: async ({ holdings, prospectId, portfolioId, source, replaceExisting }) => {
      const endpoint = prospectId 
        ? `/api/agent-wizard/prospects/${prospectId}/portfolio/save`
        : '/api/portfolio/import/save';
      
      // apiRequest already parses JSON responses, so return the result directly
      const result = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ holdings, portfolioId, source, replaceExisting }),
      });
      return result;
    },
    onSuccess: (_, variables) => {
      if (variables.portfolioId) {
        queryClient.invalidateQueries({ queryKey: ['/api/portfolios', variables.portfolioId, 'holdings'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/external-holdings'] });
    },
  });
}

export function useDeleteHolding() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, { holdingId: string; portfolioId: string }>({
    mutationFn: async ({ holdingId, portfolioId }) => {
      await apiRequest(`/api/portfolios/${portfolioId}/holdings/${holdingId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios', variables.portfolioId, 'holdings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios', variables.portfolioId, 'allocation'] });
    },
  });
}

export function useUpdateHolding() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, { holdingId: string; portfolioId: string; updates: Partial<ImportedHolding> }>({
    mutationFn: async ({ holdingId, portfolioId, updates }) => {
      await apiRequest(`/api/portfolios/${portfolioId}/holdings/${holdingId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios', variables.portfolioId, 'holdings'] });
    },
  });
}

// Import History Types
export interface ImportHistoryEntry {
  id: string;
  timestamp: string;
  source: string;
  provider: string | null;
  holdingsCount: number;
  totalValue: number;
  isinMatchedCount: number;
  confidenceScore: number;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}

// Hook to fetch import history for a client
export function useImportHistory(clientId: string | undefined) {
  return useQuery<{ history: ImportHistoryEntry[]; count: number }>({
    queryKey: ['/api/ai-investment/portfolio', clientId, 'import-history'],
    enabled: !!clientId,
  });
}

// Hook to record import history entry
export function useRecordImportHistory() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; entry: ImportHistoryEntry }, Error, { clientId: string; data: Omit<ImportHistoryEntry, 'id' | 'timestamp'> }>({
    mutationFn: async ({ clientId, data }) => {
      const res = await apiRequest(`/api/ai-investment/portfolio/${clientId}/import-history`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-investment/portfolio', variables.clientId, 'import-history'] });
    },
  });
}
