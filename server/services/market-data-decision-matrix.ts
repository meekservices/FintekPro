/**
 * market-data-decision-matrix.ts
 *
 * Market Data Ingestion & Decision Matrix — FintekPro GCR v1.0 & FASP-AI Architecture.
 *
 * Purpose:
 *   Formalizes the routing and architectural rules for market data feeds across
 *   FintekPro's advisory, wealth, trading, and execution systems.
 *
 * Decision Matrix:
 *   1. Daily Market Briefs & EOD Analysis   -> REST_BATCH (Cached snapshot, low frequency)
 *   2. Stock Screener & Fundamentals         -> REST_BATCH (Batch quote up to 500 symbols)
 *   3. Treasury & Sovereign Bond Yields      -> REST_BATCH (CCIL / FBIL daily fixing)
 *   4. Unlisted Valuations & Governance      -> REST_BATCH (MCA / periodic quarterly appraisals)
 *   5. Model Portfolio Rebalance Execution   -> STREAMING_WEBSOCKET (Live tick validation before execution)
 *   6. Live Watchlist & Real-Time Tickers    -> STREAMING_WEBSOCKET (Sub-100ms push via Protobuf/SSE)
 *   7. Live Option Chains & F&O Greeks       -> STREAMING_WEBSOCKET (Live Delta, Gamma, Theta, IV)
 *
 * @module market-data-decision-matrix
 * @version 1.0.0
 */

export type MarketDataProtocol = "REST_BATCH" | "STREAMING_WEBSOCKET";

export type MarketDataUseCase =
  | "DAILY_MARKET_BRIEF_EOD"
  | "STOCK_SCREENER_FUNDAMENTALS"
  | "TREASURY_BOND_YIELDS"
  | "UNLISTED_VALUATION"
  | "MODEL_PORTFOLIO_REBALANCING"
  | "LIVE_WATCHLIST"
  | "LIVE_OPTION_CHAIN"
  | "NCDEX_AGRI_COMMODITIES";

export interface DecisionMatrixEntry {
  useCase: MarketDataUseCase;
  name: string;
  protocol: MarketDataProtocol;
  recommendedProvider: "UPSTOX" | "ALPACA" | "CCIL_FBIL" | "MCA_VALUATION" | "ANGEL_ONE";
  targetLatencyMs: number;
  cacheTtlSeconds: number;
  rationale: string;
  fallbackProtocol: MarketDataProtocol;
}

export const MARKET_DATA_DECISION_MATRIX: Record<MarketDataUseCase, DecisionMatrixEntry> = {
  DAILY_MARKET_BRIEF_EOD: {
    useCase: "DAILY_MARKET_BRIEF_EOD",
    name: "Daily Market Briefs & EOD Analysis",
    protocol: "REST_BATCH",
    recommendedProvider: "UPSTOX",
    targetLatencyMs: 2000,
    cacheTtlSeconds: 300,
    rationale: "EOD summaries operate on daily snapshots. WebSocket streaming creates unnecessary connection churn.",
    fallbackProtocol: "REST_BATCH",
  },
  STOCK_SCREENER_FUNDAMENTALS: {
    useCase: "STOCK_SCREENER_FUNDAMENTALS",
    name: "Stock Screener & Fundamental Analysis",
    protocol: "REST_BATCH",
    recommendedProvider: "UPSTOX",
    targetLatencyMs: 1500,
    cacheTtlSeconds: 60,
    rationale: "Multi-symbol filters query 100+ tickers at once. Batch REST (up to 500 symbols/req) is most bandwidth-efficient.",
    fallbackProtocol: "REST_BATCH",
  },
  TREASURY_BOND_YIELDS: {
    useCase: "TREASURY_BOND_YIELDS",
    name: "Treasury & Sovereign Bond Yields",
    protocol: "REST_BATCH",
    recommendedProvider: "CCIL_FBIL",
    targetLatencyMs: 3000,
    cacheTtlSeconds: 1800,
    rationale: "G-Sec and T-Bill reference yields are fixed periodically (CCIL/FBIL fixings), not high-frequency tick streaming.",
    fallbackProtocol: "REST_BATCH",
  },
  UNLISTED_VALUATION: {
    useCase: "UNLISTED_VALUATION",
    name: "Unlisted Equity Valuations",
    protocol: "REST_BATCH",
    recommendedProvider: "MCA_VALUATION",
    targetLatencyMs: 5000,
    cacheTtlSeconds: 86400,
    rationale: "Unlisted and pre-IPO shares have quarterly filings and dealer quotes, not live exchange streaming.",
    fallbackProtocol: "REST_BATCH",
  },
  MODEL_PORTFOLIO_REBALANCING: {
    useCase: "MODEL_PORTFOLIO_REBALANCING",
    name: "Model Portfolio Rebalancing Execution",
    protocol: "STREAMING_WEBSOCKET",
    recommendedProvider: "UPSTOX",
    targetLatencyMs: 100,
    cacheTtlSeconds: 2,
    rationale: "Executing atomic basket rebalancing requires live tick validation to avoid slippage exceeding the FASP-AI 30bps limit.",
    fallbackProtocol: "REST_BATCH",
  },
  LIVE_WATCHLIST: {
    useCase: "LIVE_WATCHLIST",
    name: "Live Watchlist & Active Tickers",
    protocol: "STREAMING_WEBSOCKET",
    recommendedProvider: "UPSTOX",
    targetLatencyMs: 100,
    cacheTtlSeconds: 1,
    rationale: "Frequent user monitoring burns REST quotas (1,000 req/min). WebSocket Protobuf streaming reduces HTTP overhead to zero.",
    fallbackProtocol: "REST_BATCH",
  },
  LIVE_OPTION_CHAIN: {
    useCase: "LIVE_OPTION_CHAIN",
    name: "Live Option Chains & F&O Greeks",
    protocol: "STREAMING_WEBSOCKET",
    recommendedProvider: "UPSTOX",
    targetLatencyMs: 100,
    cacheTtlSeconds: 1,
    rationale: "Streaming Greeks (Delta, Gamma, Theta, IV) across dozens of strikes is only feasible via binary Protobuf WebSocket.",
    fallbackProtocol: "REST_BATCH",
  },
  NCDEX_AGRI_COMMODITIES: {
    useCase: "NCDEX_AGRI_COMMODITIES",
    name: "NCDEX Agricultural Commodity Benchmarks",
    protocol: "REST_BATCH",
    recommendedProvider: "ANGEL_ONE",
    targetLatencyMs: 1500,
    cacheTtlSeconds: 60,
    rationale: "Upstox does not cover NCDEX; Angel One SmartAPI provides native ncx_fo exchange support for Indian agri-derivatives.",
    fallbackProtocol: "REST_BATCH",
  },
};

export class MarketDataDecisionEngine {
  private static version = "1.0.0";

  /**
   * Evaluates the recommended ingestion mode for a given use case.
   */
  static evaluate(useCase: MarketDataUseCase): DecisionMatrixEntry {
    return MARKET_DATA_DECISION_MATRIX[useCase] || {
      useCase,
      name: "Default Ingestion",
      protocol: "REST_BATCH",
      recommendedProvider: "UPSTOX",
      targetLatencyMs: 1000,
      cacheTtlSeconds: 60,
      rationale: "Default safe fallback for unclassified market data queries.",
      fallbackProtocol: "REST_BATCH",
    };
  }

  /**
   * Checks whether a specific use case should use WebSocket streaming.
   */
  static shouldUseWebSocket(useCase: MarketDataUseCase): boolean {
    return this.evaluate(useCase).protocol === "STREAMING_WEBSOCKET";
  }

  /**
   * Returns all matrix rules for telemetry and frontend transparency.
   */
  static getAllRules(): DecisionMatrixEntry[] {
    return Object.values(MARKET_DATA_DECISION_MATRIX);
  }

  /**
   * Returns the metadata and engine version for explainability.
   */
  static getMetadata() {
    return {
      engine_version: `market-data-decision-matrix@${this.version}`,
      calculation_timestamp: new Date().toISOString(),
      standards: ["FASP-AI v1.0", "GCR v1.0", "SEBI IA Regs"],
    };
  }
}
