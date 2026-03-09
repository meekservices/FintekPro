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

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function fetchQuote(symbol: string): Promise<any> {
  return yahooFinance.quoteSummary(symbol, {
    modules: ["price", "financialData", "defaultKeyStatistics", "summaryDetail"],
  }, { validateResult: false });
}

async function fetchWithRetry(symbol: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) await delay(2000 * attempt);
      return await fetchQuote(symbol);
    } catch (err: any) {
      const msg = err.message || "";
      const isRateLimit = msg.includes("Too Many Requests") || msg.includes("429");
      if (isRateLimit && attempt < retries - 1) {
        continue;
      }
      throw err;
    }
  }
}

function extractData(data: any, symbol: string): FinancialData {
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
}

function altSymbol(symbol: string): string | null {
  if (symbol.endsWith(".BO")) return symbol.replace(".BO", ".NS");
  if (symbol.endsWith(".NS")) return symbol.replace(".NS", ".BO");
  return null;
}

export async function getFinancialData(symbol: string): Promise<FinancialData> {
  let lastError: any;

  const attempts = [symbol, altSymbol(symbol)].filter(Boolean) as string[];

  for (const sym of attempts) {
    try {
      const data = await fetchWithRetry(sym);
      return extractData(data, sym);
    } catch (err: any) {
      lastError = err;
    }
  }

  throw new Error(
    `Failed to fetch financial data for ${symbol}: ${lastError?.message ?? "Unknown error"}`
  );
}
