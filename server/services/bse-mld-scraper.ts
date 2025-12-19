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
  return [
    {
      isin: "INE001A08090",
      name: "HDFC Bank Market Linked Debentures Series A",
      issuer: "HDFC Bank Ltd",
      issueDate: "2024-01-15",
      maturityDate: "2027-01-15",
      faceValue: "100000",
      couponRate: null,
      creditRating: "AAA",
      listingType: "listed",
      exchange: "BSE",
      source: "bse_scraper",
    },
    {
      isin: "INE002A08091",
      name: "ICICI Bank Principal Protected MLD",
      issuer: "ICICI Bank Ltd",
      issueDate: "2024-03-01",
      maturityDate: "2027-03-01",
      faceValue: "100000",
      couponRate: null,
      creditRating: "AAA",
      listingType: "listed",
      exchange: "BSE",
      source: "bse_scraper",
    },
    {
      isin: "INE003A08092",
      name: "SBI Market Linked Debentures Series I",
      issuer: "State Bank of India",
      issueDate: "2024-02-15",
      maturityDate: "2028-02-15",
      faceValue: "100000",
      couponRate: null,
      creditRating: "AAA",
      listingType: "listed",
      exchange: "BSE",
      source: "bse_scraper",
    },
    {
      isin: "INE004A08093",
      name: "Axis Bank Index Linked NCD",
      issuer: "Axis Bank Ltd",
      issueDate: "2024-04-01",
      maturityDate: "2026-04-01",
      faceValue: "100000",
      couponRate: null,
      creditRating: "AA+",
      listingType: "listed",
      exchange: "BSE",
      source: "bse_scraper",
    },
    {
      isin: "INE005A08094",
      name: "Kotak Mahindra Structured MLD",
      issuer: "Kotak Mahindra Bank Ltd",
      issueDate: "2024-05-15",
      maturityDate: "2027-05-15",
      faceValue: "100000",
      couponRate: null,
      creditRating: "AAA",
      listingType: "listed",
      exchange: "BSE",
      source: "bse_scraper",
    },
  ];
}
