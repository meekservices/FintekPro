import * as cheerio from "cheerio";

export interface BseMldListing {
  isin: string;
  name: string;
  issuer: string;
  issueDate: string | null;
  maturityDate: string | null;
  faceValue: string;
  couponRate: string | null;
  creditRating: string | null;
  listingType: "listed";
  exchange: "BSE";
  source: "bse_scraper";
}

export interface BseMldImportResult {
  success: boolean;
  listings: BseMldListing[];
  errors: string[];
  totalFetched: number;
  duplicatesSkipped: number;
}

const BSE_DEBT_URL = "https://www.bseindia.com/markets/Debt/debt_corporatebond.html";
const BSE_CORP_DEBT_API = "https://api.bseindia.com/BseIndiaAPI/api/DebsSecuritiesData/w";

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/html, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.bseindia.com/",
          ...options.headers,
        },
      });
      if (response.ok) return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const cleanStr = dateStr.trim();
    const ddmmyyyy = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    const yyyymmdd = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (yyyymmdd) {
      const [, year, month, day] = yyyymmdd;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    const date = new Date(cleanStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
    return null;
  } catch {
    return null;
  }
}

function parseFaceValue(fvStr: string | null | undefined): string {
  if (!fvStr) return "100000";
  const cleanStr = fvStr.replace(/[₹,\s]/g, "");
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return "100000";
  return num.toString();
}

function isMLD(name: string, issuer: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerIssuer = issuer.toLowerCase();
  const mldKeywords = [
    "market linked",
    "mld",
    "market-linked",
    "linked debenture",
    "principal protected",
    "index linked",
    "equity linked",
    "structured",
  ];
  return mldKeywords.some(keyword => 
    lowerName.includes(keyword) || lowerIssuer.includes(keyword)
  );
}

export async function scrapeBseMldListings(): Promise<BseMldImportResult> {
  const listings: BseMldListing[] = [];
  const errors: string[] = [];

  try {
    console.log("[BSE MLD Scraper] Fetching BSE corporate debt data...");
    
    const response = await fetchWithRetry(BSE_CORP_DEBT_API, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.log("[BSE MLD Scraper] API response is not an array, trying HTML scrape...");
      return await scrapeBseDebtHtml();
    }

    console.log(`[BSE MLD Scraper] Found ${data.length} debt securities from BSE API`);

    for (const item of data) {
      try {
        const securityName = item.SecName || item.SecurityName || item.Security_Name || "";
        const issuerName = item.IssuerName || item.Issuer || item.Company || securityName.split(" ")[0] || "";
        
        if (!isMLD(securityName, issuerName)) continue;

        const isin = item.ISIN || item.Isin || "";
        if (!isin) continue;

        listings.push({
          isin: isin.trim().toUpperCase(),
          name: securityName.trim(),
          issuer: issuerName.trim(),
          issueDate: parseDate(item.IssueDate || item.Issue_Date),
          maturityDate: parseDate(item.MaturityDate || item.Maturity_Date || item.Redemption_Date),
          faceValue: parseFaceValue(item.FaceValue || item.Face_Value),
          couponRate: item.CouponRate || item.Coupon_Rate || null,
          creditRating: item.Rating || item.CreditRating || null,
          listingType: "listed",
          exchange: "BSE",
          source: "bse_scraper",
        });
      } catch (itemError: any) {
        errors.push(`Failed to parse item: ${itemError.message}`);
      }
    }

    return {
      success: true,
      listings,
      errors,
      totalFetched: data.length,
      duplicatesSkipped: 0,
    };
  } catch (error: any) {
    console.error("[BSE MLD Scraper] Error fetching from BSE API:", error.message);
    errors.push(`BSE API Error: ${error.message}`);
    
    try {
      return await scrapeBseDebtHtml();
    } catch (htmlError: any) {
      errors.push(`BSE HTML Scrape Error: ${htmlError.message}`);
      return {
        success: false,
        listings: [],
        errors,
        totalFetched: 0,
        duplicatesSkipped: 0,
      };
    }
  }
}

async function scrapeBseDebtHtml(): Promise<BseMldImportResult> {
  const listings: BseMldListing[] = [];
  const errors: string[] = [];

  try {
    console.log("[BSE MLD Scraper] Attempting HTML scrape from BSE debt page...");
    
    const response = await fetchWithRetry(BSE_DEBT_URL);
    const html = await response.text();
    const $ = cheerio.load(html);

    let totalRows = 0;

    $("table tbody tr").each((_, row) => {
      totalRows++;
      const cells = $(row).find("td");
      if (cells.length < 4) return;

      const isin = $(cells[0]).text().trim();
      const name = $(cells[1]).text().trim();
      const issuer = $(cells[2]).text().trim() || name.split(" ")[0];
      const maturityDate = $(cells[3]).text().trim();
      const faceValue = cells.length > 4 ? $(cells[4]).text().trim() : "";
      const couponRate = cells.length > 5 ? $(cells[5]).text().trim() : "";
      const creditRating = cells.length > 6 ? $(cells[6]).text().trim() : "";

      if (!isin || !name) return;
      if (!isMLD(name, issuer)) return;

      listings.push({
        isin: isin.trim().toUpperCase(),
        name,
        issuer,
        issueDate: null,
        maturityDate: parseDate(maturityDate),
        faceValue: parseFaceValue(faceValue),
        couponRate: couponRate || null,
        creditRating: creditRating || null,
        listingType: "listed",
        exchange: "BSE",
        source: "bse_scraper",
      });
    });

    console.log(`[BSE MLD Scraper] HTML scrape found ${listings.length} MLDs from ${totalRows} rows`);

    return {
      success: true,
      listings,
      errors,
      totalFetched: totalRows,
      duplicatesSkipped: 0,
    };
  } catch (error: any) {
    console.error("[BSE MLD Scraper] HTML scrape error:", error.message);
    errors.push(`HTML Scrape Error: ${error.message}`);
    return {
      success: false,
      listings: [],
      errors,
      totalFetched: 0,
      duplicatesSkipped: 0,
    };
  }
}

export function generateSampleMldListings(): BseMldListing[] {
  const issuers = [
    { name: "HDFC Bank Ltd", rating: "AAA" },
    { name: "ICICI Bank Ltd", rating: "AAA" },
    { name: "State Bank of India", rating: "AAA" },
    { name: "Axis Bank Ltd", rating: "AA+" },
    { name: "Kotak Mahindra Bank Ltd", rating: "AAA" },
    { name: "IndusInd Bank Ltd", rating: "AA+" },
    { name: "Yes Bank Ltd", rating: "A+" },
    { name: "IDFC First Bank Ltd", rating: "AA" },
    { name: "Bajaj Finance Ltd", rating: "AAA" },
    { name: "Tata Capital Ltd", rating: "AAA" },
    { name: "L&T Finance Ltd", rating: "AAA" },
    { name: "Mahindra Finance Ltd", rating: "AA+" },
    { name: "Shriram Transport Finance", rating: "AA+" },
    { name: "Piramal Capital Ltd", rating: "AA" },
    { name: "JM Financial Ltd", rating: "AA" },
    { name: "IIFL Finance Ltd", rating: "AA" },
    { name: "Cholamandalam Investment", rating: "AA+" },
    { name: "Sundaram Finance Ltd", rating: "AAA" },
    { name: "Muthoot Finance Ltd", rating: "AA+" },
    { name: "Manappuram Finance Ltd", rating: "AA" },
    { name: "Aditya Birla Finance Ltd", rating: "AAA" },
    { name: "Edelweiss Financial", rating: "AA" },
    { name: "CRISIL Ltd", rating: "AAA" },
    { name: "CARE Ratings Ltd", rating: "AAA" },
    { name: "Reliance Capital Ltd", rating: "A" },
  ];
  
  const mldTypes = [
    "Market Linked Debentures",
    "Principal Protected MLD",
    "Index Linked NCD",
    "Structured MLD",
    "Equity Linked Debentures",
    "Nifty Linked MLD",
    "Bank Nifty Linked MLD",
    "Multi-Asset MLD",
  ];
  
  const tenors = [2, 3, 4, 5, 7];
  const faceValues = ["100000", "500000", "1000000", "200000"];
  
  const listings: BseMldListing[] = [];
  let isinCounter = 1;
  
  for (const issuer of issuers) {
    const numMlds = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < numMlds; i++) {
      const mldType = mldTypes[Math.floor(Math.random() * mldTypes.length)];
      const tenor = tenors[Math.floor(Math.random() * tenors.length)];
      const series = String.fromCharCode(65 + i);
      
      const issueYear = 2023 + Math.floor(Math.random() * 2);
      const issueMonth = Math.floor(Math.random() * 12) + 1;
      const maturityYear = issueYear + tenor;
      
      const isinNum = String(isinCounter++).padStart(5, "0");
      
      listings.push({
        isin: `INE${isinNum}A08${String(100 + isinCounter).slice(-3)}`,
        name: `${issuer.name.split(" ")[0]} ${mldType} Series ${series} ${maturityYear}`,
        issuer: issuer.name,
        issueDate: `${issueYear}-${String(issueMonth).padStart(2, "0")}-15`,
        maturityDate: `${maturityYear}-${String(issueMonth).padStart(2, "0")}-15`,
        faceValue: faceValues[Math.floor(Math.random() * faceValues.length)],
        couponRate: null,
        creditRating: issuer.rating,
        listingType: "listed",
        exchange: "BSE",
        source: "bse_scraper",
      });
    }
  }
  
  return listings;
}
