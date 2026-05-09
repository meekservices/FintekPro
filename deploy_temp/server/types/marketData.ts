export interface MarketQuoteData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  source: 'finnhub' | 'yahoo' | 'fallback' | 'unavailable';
  timestamp: string;
}

export interface CompanyProfileData {
  symbol: string;
  name: string;
  description?: string;
  industry?: string;
  marketCap?: number;
  exchange?: string;
  country?: string;
  currency?: string;
  website?: string;
  logo?: string;
  source: 'finnhub' | 'static' | 'fallback';
  timestamp: string;
}

export interface NewsItem {
  id: number;
  title: string;
  summary: string;
  url: string;
  image?: string;
  datetime: string;
  source: string;
  category: string;
  provider: string;
}

export interface IndexQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}
