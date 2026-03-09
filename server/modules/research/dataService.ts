import yahooFinance from "yahoo-finance2";

export interface FinancialData {
  price: number | null;
  previousClose: number | null;
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  roe: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  dividendYield: number | null;
  beta: number | null;
  targetMeanPrice: number | null;
  currency: string;
}

export async function getFinancialData(symbol: string): Promise<FinancialData> {
  try {
    const data = await yahooFinance.quoteSummary(symbol, {
      modules: ["price", "financialData", "defaultKeyStatistics", "summaryDetail"],
    });

    return {
      price: data.price?.regularMarketPrice ?? null,
      previousClose: data.price?.regularMarketPreviousClose ?? null,
      marketCap: data.price?.marketCap ?? null,
      pe: (data.defaultKeyStatistics?.trailingPE as number) ?? null,
      eps: (data.defaultKeyStatistics?.trailingEps as number) ?? null,
      roe: data.financialData?.returnOnEquity ?? null,
      debtToEquity: data.financialData?.debtToEquity ?? null,
      revenueGrowth: data.financialData?.revenueGrowth ?? null,
      earningsGrowth: data.financialData?.earningsGrowth ?? null,
      fiftyTwoWeekHigh: data.summaryDetail?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: data.summaryDetail?.fiftyTwoWeekLow ?? null,
      dividendYield: data.summaryDetail?.dividendYield ?? null,
      beta: data.summaryDetail?.beta ?? null,
      targetMeanPrice: data.financialData?.targetMeanPrice ?? null,
      currency: data.price?.currency ?? "INR",
    };
  } catch (err: any) {
    throw new Error(`Failed to fetch financial data for ${symbol}: ${err.message}`);
  }
}
