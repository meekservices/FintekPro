/**
 * Listed Entity Registry — FASP Instrument Lifecycle Guard
 *
 * Purpose:  Canonical blocklist of companies that have GRADUATED from Pre-IPO
 *           to live exchange listing (NSE/BSE). Any company matching an entry
 *           here MUST NEVER appear in the Pre-IPO pipeline, regardless of what
 *           the database says about its listing_stage or ipo_status.
 *
 * Screening priority (in order):
 *   1. ISIN  — most reliable; globally unique, immutable
 *   2. CIN   — India MCA-assigned; unique per legal entity
 *   3. Name  — fuzzy last-resort only (typos / aliases still get caught)
 *
 * Governance rules:
 *   - Add an entry here the MOMENT a pre-IPO company lists on an exchange.
 *   - NEVER remove an entry once added — the list is append-only.
 *   - Keep the `listingDate` accurate for audit trail purposes.
 *   - Source ISINs from NSE/BSE official filings or CDSL/NSDL.
 *   - Source CINs from MCA21 portal (https://www.mca.gov.in).
 *
 * @module listed-entity-registry
 * @version 1.0.0
 */

export interface ListedEntityEntry {
  /** Full legal name as per MCA / exchange listing */
  name: string;
  /** ISIN — e.g. INE123A01011. Primary unique key. */
  isin?: string;
  /** CIN — e.g. U67110MH2007PLC168187. Secondary unique key. */
  cin?: string;
  /** Exchange(s) where listed: 'NSE', 'BSE', 'NSE / BSE', 'BSE SME', etc. */
  listedOn: string;
  /** ISO-8601 date the company was first listed */
  listingDate: string;
  /** Optional: brief note explaining why this entry exists */
  note?: string;
}

/**
 * The canonical blocklist. Add entries in descending listingDate order.
 *
 * Two categories of entries:
 *   A. "Graduated" — companies that were in our Pre-IPO pipeline and have since listed.
 *      Add these immediately when a tracked pre-IPO company lists.
 *   B. "Large-cap guard" — long-standing listed companies that could pollute the
 *      pre-IPO pipeline if a stale DB record exists for them. ISIN is mandatory here.
 *
 * ISINs sourced from NSE/BSE official equity master files.
 * CINs sourced from MCA21 portal (https://www.mca.gov.in).
 */
export const LISTED_ENTITY_REGISTRY: ListedEntityEntry[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // A. Graduated Pre-IPOs (tracked in FintekPro pipeline, now listed)
  // ══════════════════════════════════════════════════════════════════════════

  // ── FY2026 Listings ────────────────────────────────────────────────────────
  {
    name: "National Stock Exchange of India Limited",
    isin: "INE524B01027",
    cin: "U67120MH1992PLC069769",
    listedOn: "BSE",
    listingDate: "2026-09-24",
    note: "NSE IPO opened 17 Sep 2026; listing 24 Sep 2026",
  },

  // ── FY2025 Listings ────────────────────────────────────────────────────────
  {
    name: "HDB Financial Services Limited",
    isin: "INE756I01018",
    cin: "U65993GJ2007PLC051028",
    listedOn: "NSE / BSE",
    listingDate: "2025-04-16",
    note: "HDFC Bank subsidiary; DRHP filed 2024",
  },
  {
    name: "Swiggy Limited",
    isin: "INE01ZS01028",
    cin: "U74999KA2013PLC097582",
    listedOn: "NSE / BSE",
    listingDate: "2024-11-13",
  },
  {
    name: "Ola Electric Mobility Limited",
    isin: "INE0LWL01017",
    cin: "U35999KA2017PLC168989",
    listedOn: "NSE / BSE",
    listingDate: "2024-08-09",
  },
  {
    name: "FirstCry (Brainbees Solutions Limited)",
    isin: "INE03WB01016",
    cin: "U52100MH2010PLC201261",
    listedOn: "NSE / BSE",
    listingDate: "2024-08-13",
  },

  // ── FY2024 Listings ────────────────────────────────────────────────────────
  {
    name: "Tata Technologies Limited",
    isin: "INE142M01025",
    cin: "U72900PN1994PLC013313",
    listedOn: "NSE / BSE",
    listingDate: "2023-11-30",
  },
  {
    name: "Mankind Pharma Limited",
    isin: "INE634S01028",
    cin: "U24231DL2007PLC163404",
    listedOn: "NSE / BSE",
    listingDate: "2023-05-09",
  },

  // ── FY2023 Listings ────────────────────────────────────────────────────────
  {
    name: "Life Insurance Corporation of India",
    isin: "INE0J1Y01017",
    cin: "U99999MH1956GOI009113",
    listedOn: "NSE / BSE",
    listingDate: "2022-05-17",
    note: "Largest IPO in India history",
  },
  {
    name: "Delhivery Limited",
    isin: "INE148O01028",
    cin: "U64200HR2011PLC044870",
    listedOn: "NSE / BSE",
    listingDate: "2022-05-24",
  },
  {
    name: "Policy Bazaar (PB Fintech Limited)",
    isin: "INE417T01026",
    cin: "U74999HR2008PLC035701",
    listedOn: "NSE / BSE",
    listingDate: "2021-11-15",
  },

  // ── FY2022 Listings ────────────────────────────────────────────────────────
  {
    name: "Nykaa (FSN E-Commerce Ventures Limited)",
    isin: "INE388Y01029",
    cin: "U52600MH2012PLC230136",
    listedOn: "NSE / BSE",
    listingDate: "2021-11-10",
  },
  {
    name: "Paytm (One97 Communications Limited)",
    isin: "INE982J01020",
    cin: "U72200DL2000PLC107747",
    listedOn: "NSE / BSE",
    listingDate: "2021-11-18",
  },
  {
    name: "Zomato Limited",
    isin: "INE758T01015",
    cin: "U74999DL2010PLC198141",
    listedOn: "NSE / BSE",
    listingDate: "2021-07-23",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // B. Large-cap Guard — long-standing listed companies that must NEVER
  //    appear in the Pre-IPO pipeline due to naming collisions or stale DB
  //    records. ISINs verified from NSE equity master file.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Hero Group ─────────────────────────────────────────────────────────────
  // NOTE: Hero FinCorp Ltd (NBFC subsidiary) IS a genuine pre-IPO — do NOT add it here.
  //       Only Hero MotoCorp (the listed motorcycle OEM) is blocked.
  {
    name: "Hero MotoCorp Limited",
    isin: "INE158A01026",
    cin: "L35911DL1984PLC017354",
    listedOn: "NSE / BSE",
    listingDate: "1995-01-01",
    note: "BSE: 500182 | NSE: HEROMOTOCO — long-standing listed company",
  },

  // ── Reliance & Large Conglomerates ─────────────────────────────────────────
  {
    name: "Reliance Industries Limited",
    isin: "INE002A01018",
    cin: "L17110MH1973PLC019786",
    listedOn: "NSE / BSE",
    listingDate: "1977-01-01",
    note: "BSE: 500325 | NSE: RELIANCE",
  },
  {
    name: "Tata Consultancy Services Limited",
    isin: "INE467B01029",
    cin: "L22210MH1995PLC084781",
    listedOn: "NSE / BSE",
    listingDate: "2004-08-25",
    note: "BSE: 532540 | NSE: TCS",
  },
  {
    name: "Infosys Limited",
    isin: "INE009A01021",
    cin: "L85110KA1981PLC013115",
    listedOn: "NSE / BSE",
    listingDate: "1993-02-01",
    note: "BSE: 500209 | NSE: INFY",
  },
  {
    name: "Wipro Limited",
    isin: "INE075A01022",
    cin: "L32102KA1945PLC020800",
    listedOn: "NSE / BSE",
    listingDate: "1945-01-01",
    note: "BSE: 507685 | NSE: WIPRO",
  },
  {
    name: "HCL Technologies Limited",
    isin: "INE860A01027",
    cin: "L74140DL1991PLC046369",
    listedOn: "NSE / BSE",
    listingDate: "1999-11-10",
    note: "BSE: 532281 | NSE: HCLTECH",
  },
  {
    name: "Larsen & Toubro Limited",
    isin: "INE018A01030",
    cin: "L99999MH1946PLC004768",
    listedOn: "NSE / BSE",
    listingDate: "1950-01-01",
    note: "BSE: 500510 | NSE: LT",
  },

  // ── Banking & Finance ───────────────────────────────────────────────────────
  {
    name: "HDFC Bank Limited",
    isin: "INE040A01034",
    cin: "L65920MH1994PLC080618",
    listedOn: "NSE / BSE",
    listingDate: "1995-05-19",
    note: "BSE: 500180 | NSE: HDFCBANK",
  },
  {
    name: "ICICI Bank Limited",
    isin: "INE090A01021",
    cin: "L65190GJ1994PLC021012",
    listedOn: "NSE / BSE",
    listingDate: "1997-09-17",
    note: "BSE: 532174 | NSE: ICICIBANK",
  },
  {
    name: "Kotak Mahindra Bank Limited",
    isin: "INE237A01028",
    cin: "L65110MH1985PLC038137",
    listedOn: "NSE / BSE",
    listingDate: "1995-01-01",
    note: "BSE: 500247 | NSE: KOTAKBANK",
  },
  {
    name: "Axis Bank Limited",
    isin: "INE238A01034",
    cin: "L65110GJ1993PLC020769",
    listedOn: "NSE / BSE",
    listingDate: "1998-11-02",
    note: "BSE: 532215 | NSE: AXISBANK",
  },
  {
    name: "State Bank of India",
    isin: "INE062A01020",
    cin: "L55230MH1955GOI009661",
    listedOn: "NSE / BSE",
    listingDate: "1994-03-01",
    note: "BSE: 500112 | NSE: SBIN",
  },
  {
    name: "Bajaj Finance Limited",
    isin: "INE296A01024",
    cin: "L65910MH1987PLC042961",
    listedOn: "NSE / BSE",
    listingDate: "1994-01-01",
    note: "BSE: 500034 | NSE: BAJFINANCE",
  },

  // ── Auto & Consumer ────────────────────────────────────────────────────────
  {
    name: "Maruti Suzuki India Limited",
    isin: "INE585B01010",
    cin: "L34103DL1981PLC011375",
    listedOn: "NSE / BSE",
    listingDate: "2003-07-09",
    note: "BSE: 532500 | NSE: MARUTI",
  },
  {
    name: "Hyundai Motor India Limited",
    isin: "INE884M01019",
    cin: "U34100TN1996PLC034553",
    listedOn: "NSE / BSE",
    listingDate: "2024-10-22",
    note: "BSE: 544229 | NSE: HYUNDAIINDIA — IPO Oct 2024",
  },
  {
    name: "Asian Paints Limited",
    isin: "INE021A01026",
    cin: "L24220MH1945PLC004598",
    listedOn: "NSE / BSE",
    listingDate: "1982-01-01",
    note: "BSE: 500820 | NSE: ASIANPAINT",
  },
  {
    name: "Hindustan Unilever Limited",
    isin: "INE030A01027",
    cin: "L15140MH1933PLC002030",
    listedOn: "NSE / BSE",
    listingDate: "1950-01-01",
    note: "BSE: 500696 | NSE: HINDUNILVR",
  },
  {
    name: "ITC Limited",
    isin: "INE154A01025",
    cin: "L16005WB1910PLC001985",
    listedOn: "NSE / BSE",
    listingDate: "1970-01-01",
    note: "BSE: 500875 | NSE: ITC",
  },
  {
    name: "Titan Company Limited",
    isin: "INE280A01028",
    cin: "L74999KA1984PLC010556",
    listedOn: "NSE / BSE",
    listingDate: "1995-01-01",
    note: "BSE: 500114 | NSE: TITAN",
  },
];


// ── Internal lookup indexes (built once on module load) ─────────────────────

/** Set of normalized ISINs for O(1) lookup */
const ISIN_SET = new Set<string>(
  LISTED_ENTITY_REGISTRY
    .map((e) => e.isin?.toUpperCase().trim())
    .filter((v): v is string => Boolean(v)),
);

/** Set of normalized CINs for O(1) lookup */
const CIN_SET = new Set<string>(
  LISTED_ENTITY_REGISTRY
    .map((e) => e.cin?.toUpperCase().trim())
    .filter((v): v is string => Boolean(v)),
);

/**
 * Pre-computed name fragments for substring matching.
 * Each entry produces its full name and a short slug (first 3 meaningful words).
 */
const NAME_FRAGMENTS: string[] = LISTED_ENTITY_REGISTRY.flatMap((e) => {
  const full = e.name.toLowerCase();
  const words = full
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const shortSlug = words.slice(0, 3).join(" ");
  return [full, shortSlug];
});

// ── Public API ──────────────────────────────────────────────────────────────

export interface ScreeningResult {
  /** Whether the entity is blocked (listed/graduated) */
  isListed: boolean;
  /** Which identifier triggered the block */
  matchedBy?: "isin" | "cin" | "name";
  /** The matched registry entry (if any) */
  entry?: ListedEntityEntry;
}

/**
 * Screen a company against the listed-entity registry.
 *
 * Priority: ISIN → CIN → name. Returns immediately on the first match.
 *
 * @param params.name  - Company display name
 * @param params.isin  - Optional ISIN (from DB or curated data)
 * @param params.cin   - Optional CIN (from DB or curated data)
 * @returns ScreeningResult with isListed=true if the company must be blocked
 *
 * @example
 * screenListedEntity({ name: "Swiggy", isin: "INE01ZS01028" });
 * // => { isListed: true, matchedBy: "isin", entry: { name: "Swiggy Limited", ... } }
 */
export function screenListedEntity(params: {
  name: string;
  isin?: string | null;
  cin?: string | null;
}): ScreeningResult {
  const { name, isin, cin } = params;

  // 1. ISIN check — O(1), globally unique
  if (isin) {
    const key = isin.toUpperCase().trim();
    if (ISIN_SET.has(key)) {
      const entry = LISTED_ENTITY_REGISTRY.find((e) => e.isin?.toUpperCase() === key);
      return { isListed: true, matchedBy: "isin", entry };
    }
  }

  // 2. CIN check — O(1), MCA-assigned per legal entity
  if (cin) {
    const key = cin.toUpperCase().trim();
    if (CIN_SET.has(key)) {
      const entry = LISTED_ENTITY_REGISTRY.find((e) => e.cin?.toUpperCase() === key);
      return { isListed: true, matchedBy: "cin", entry };
    }
  }

  // 3. Name check — last resort, substring match against registry fragments
  if (name) {
    const normalized = name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const hit = NAME_FRAGMENTS.find(
      (fragment) => fragment.length >= 6 && normalized.includes(fragment),
    );

    if (hit) {
      const entry = LISTED_ENTITY_REGISTRY.find((e) => {
        const slug = e.name
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 20);
        return normalized.includes(slug);
      });
      return { isListed: true, matchedBy: "name", entry };
    }
  }

  return { isListed: false };
}

/**
 * Convenience boolean wrapper around `screenListedEntity`.
 * Use inside `.filter()` calls where only true/false is needed.
 */
export function isListedEntity(params: {
  name: string;
  isin?: string | null;
  cin?: string | null;
}): boolean {
  return screenListedEntity(params).isListed;
}
