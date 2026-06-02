/**
 * hub-types.ts
 * Shared type definitions for the AlpacaClientHub component.
 * Imported by hub.tsx to keep the component file free of inline interface declarations.
 */

import type { LucideIcon } from "lucide-react";

/** Shape of the /api/us-trading/account API response */
export interface AccountQueryResponse {
  account: Record<string, string> | null;
  onboarding: boolean;
  onboarding_status: string;
  is_paper: boolean;
}

/** Props for the NavItem sub-component used in the sidebar */
export interface NavItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  activeView: string;
  setActiveView: (id: string) => void;
}

/** A single US stock or ETF instrument from /api/alpaca/market/instruments */
export interface MarketInstrument {
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  expenseRatio?: number | null;
  category?: string;
}

/** Shape of the /api/alpaca/market/instruments API response */
export interface MarketInstrumentsResponse {
  data: {
    stocks: MarketInstrument[];
    etfs: MarketInstrument[];
    fxRate?: number;
    marketStatus?: {
      isOpen: boolean;
      nextOpen?: string;
      nextClose?: string;
    };
  };
}

/** A single AI stock recommendation from /api/alpaca/market/best-buys */
export interface StockRecommendation {
  symbol: string;
  name?: string;
  price?: number;
  priceInr?: number;
  change?: number;
  changePercent: number;          // required — comparisons use >= without optional chaining
  type?: string;                  // e.g. 'stock', 'etf'
  signal: 'buy' | 'hold' | 'sell';
  confidenceScore: number;
  rationale?: string;
  sector?: string;
  marketCap?: string;
  factorsConsidered: string[];    // required — array accessed by index without ?.
}

/** Shape of the /api/alpaca/market/best-buys API response */
export interface BestBuysResponse {
  data: {
    recommendations: StockRecommendation[];
    modelVersion?: string;
    disclaimer?: string;
  };
}
