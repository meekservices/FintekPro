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
  return useQuery({
    queryKey: ['/api/market/news'],
    refetchInterval: 300000, // Refetch every 5 minutes
  });
}

export function useStockCandles(symbol: string, resolution: string = "D") {
  const to = Math.floor(Date.now() / 1000);
  const from = to - (30 * 24 * 60 * 60); // 30 days ago

  return useQuery({
    queryKey: ['/api/market/candles', symbol, resolution, from, to],
    enabled: !!symbol,
  });
}

export function useCompanyProfile(symbol: string) {
  return useQuery({
    queryKey: ['/api/market/company', symbol],
    enabled: !!symbol,
  });
}
