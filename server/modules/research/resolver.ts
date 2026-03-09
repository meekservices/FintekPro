import axios from "axios";

export interface ResolvedCompany {
  symbol: string;
  name: string;
  exchange: string;
  sector?: string;
}

export async function resolveCompany(query: string): Promise<ResolvedCompany> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-US&region=IN&quotesCount=5&newsCount=0`;

  try {
    const res = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 8000,
    });

    const quotes = res.data?.quotes || [];
    if (!quotes.length) {
      throw new Error(`No results found for: ${query}`);
    }

    const stock = quotes[0];
    return {
      symbol: stock.symbol,
      name: stock.shortname || stock.longname || query,
      exchange: stock.exchange || "NSE",
      sector: stock.sector || undefined,
    };
  } catch (err: any) {
    if (err.message?.startsWith("No results")) throw err;
    const nseSymbol = query.toUpperCase().replace(/\.NS$/, "") + ".NS";
    return {
      symbol: nseSymbol,
      name: query,
      exchange: "NSE",
    };
  }
}
