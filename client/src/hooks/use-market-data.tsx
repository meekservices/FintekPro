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
  finnhubIndustry: string;
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
