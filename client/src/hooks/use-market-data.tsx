import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface MarketQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface IndexData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  timestamp?: number;
}

export interface CandleData {
  s: string; // status
  t: number[]; // timestamps
  o: number[]; // open prices
  h: number[]; // high prices
  l: number[]; // low prices
  c: number[]; // close prices
  v?: number[]; // volumes (optional)
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  industry: string;
}

export interface MarketNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface ExchangeStatus {
  name: string;
  status: 'open' | 'closed';
  reason: string;
  nextOpen?: string;
  nextClose?: string;
  tradingHours: string;
}

export interface MarketStatus {
  timestamp: string;
  timezone: string;
  currentTime: string;
  exchanges: {
    nse: ExchangeStatus;
    bse: ExchangeStatus;
    mcx: ExchangeStatus;
    ncdex: ExchangeStatus;
    msei: ExchangeStatus;
    global: ExchangeStatus;
  };
}

export function useMarketQuote(symbol: string) {
  return useQuery<MarketQuote>({
    queryKey: ['/api/market/quote', symbol],
    enabled: !!symbol,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useMarketIndices() {
  return useQuery<IndexData[]>({
    queryKey: ['/api/market/indices'],
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useMarketNews() {
  return useQuery<MarketNews[]>({
    queryKey: ['/api/market/news'],
    refetchInterval: 300000, // Refetch every 5 minutes
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useStockCandles(symbol: string, resolution: string = "D") {
  const to = Math.floor(Date.now() / 1000);
  const from = to - (30 * 24 * 60 * 60); // 30 days ago

  return useQuery<CandleData>({
    queryKey: ['/api/market/candles', symbol, resolution, from, to],
    enabled: !!symbol,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCompanyProfile(symbol: string) {
  return useQuery<CompanyProfile>({
    queryKey: ['/api/market/company', symbol],
    enabled: !!symbol,
    retry: 2,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useMarketStatus() {
  return useQuery<MarketStatus>({
    queryKey: ['/api/market/status'],
    refetchInterval: 60000, // Refetch every minute
    retry: 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Enhanced NSE indices hook for NIFTY, SENSEX etc.
export interface NSEIndex {
  symbol: string;
  ltp: number;
  chng: number;
  per_chng: number;
  volume: number;
  value: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  previousClose?: number;
  source?: string;
  dataQuality?: 'exchange' | 'third_party' | 'estimated' | 'unavailable';
  estimated?: boolean;
  estimationBasis?: string;
  derived?: boolean;
  marketDataTimestamp?: string | null;
  fetchedAt?: string;
}

export interface NSEIndicesResponse {
  status: string;
  data: NSEIndex[];
  marketDataTimestamp?: string | null;
  fetchedAt?: string;
  cached?: boolean;
  unavailable?: boolean;
  error?: string;
}

export function useNSEIndices() {
  return useQuery<NSEIndicesResponse>({
    queryKey: ['/api/nse/indices'],
    refetchInterval: 60000, // Refetch every 60 seconds
    retry: 2,
    staleTime: 30 * 1000,
  });
}

// NSE Market Status hook
export function useNSEMarketStatus() {
  return useQuery<{
    status: string;
    data: any;
  }>({
    queryKey: ['/api/nse/market-status'],
    refetchInterval: 60000, // Refetch every minute
    retry: 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Market movers (gainers/losers) hook
export interface MarketMover {
  symbol: string;
  name?: string;
  ltp: number;
  chng: number;
  per_chng: number;
  volume: number;
  value: number;
}

export function useMarketMovers() {
  return useQuery<{
    gainers: MarketMover[];
    losers: MarketMover[];
  }>({
    queryKey: ['/api/market/movers'],
    refetchInterval: 60000, // Refetch every minute
    retry: 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Combined market data for dashboard header
export interface DashboardMarketData {
  nifty: {
    value: number;
    change: number;
    changePercent: number;
    timestamp: string;
  };
  sensex: {
    value: number;
    change: number;
    changePercent: number;
    timestamp: string;
  };
  totalAUM: string;
  activeSchemes: number;
  lastUpdated: string;
}

export function useDashboardMarketData() {
  return useQuery<DashboardMarketData>({
    queryKey: ['/api/market/dashboard-data'],
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 2,
    staleTime: 15 * 1000, // 15 seconds
  });
}
