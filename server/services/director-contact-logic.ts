/**
 * Director Contact Logic — Pure Functions
 *
 * Contains all algorithmic logic for director contact enrichment.
 * Zero server dependencies: no DB, no Redis, no HTTP clients.
 * This makes the functions fully unit-testable without infrastructure mocking.
 *
 * Consumed by: director-contact-service.ts (which handles I/O)
 * Tested by:   server/tests/director-contact-service.test.ts
 */

// ── Decision-maker score rules ─────────────────────────────────────────────────
//
// Evaluated in ORDER — first matching keyword wins.
// Tune scores here without touching any other file.

export const DECISION_MAKER_SCORE_RULES: Array<{
  keywords: string[];
  score: number;
  category: string;
}> = [
  { keywords: ["promoter", "founder", "proprietor"], score: 100, category: "promoter" },
  { keywords: ["managing director", "md", "cmd", "chairman and managing director"], score: 95, category: "managing_director" },
  { keywords: ["chief executive", "ceo"], score: 95, category: "ceo" },
  { keywords: ["whole time director", "wtd", "whole-time director", "executive director"], score: 90, category: "executive_director" },
  { keywords: ["chief financial", "cfo", "finance director", "vp finance", "head finance", "director finance", "group cfo", "treasurer", "financial controller"], score: 85, category: "cfo" },
  { keywords: ["joint managing", "jmd", "deputy managing", "dmd", "president"], score: 80, category: "senior_executive" },
  { keywords: ["chairman", "additional managing"], score: 75, category: "chairman" },
  // ── Specific modifier types MUST appear before the generic "director" rule ──
  { keywords: ["nominee director", "alternate director", "government director", "institutional director"], score: 30, category: "governance" },
  { keywords: ["independent director"], score: 40, category: "independent" },
  { keywords: ["non-executive director", "non executive director", "non-executive", "non executive"], score: 55, category: "non_executive" },
  { keywords: ["nominee", "alternate"], score: 30, category: "governance" },
  { keywords: ["independent"], score: 40, category: "independent" },
  // ── Generic fallback — must be last ───────────────────────────────────────
  { keywords: ["director"], score: 60, category: "director" },
];

// ── Mobile status ──────────────────────────────────────────────────────────────

export type MobileStatus =
  | "found"         // valid, unique, normalised mobile
  | "not_found"     // primary/fallback provider returned no mobile for this director
  | "invalid"       // mobile present but fails structural validation
  | "duplicate"     // higher-ranked director already owns this number
  | "lookup_error"; // API call itself failed

/** Which external provider supplied the director data */
export type DirectorDataSource = "credhive" | "probe42";

// ── Indian mobile normaliser ───────────────────────────────────────────────────

/**
 * Normalises an Indian mobile number to E.164 format (+91XXXXXXXXXX).
 *
 * Accepts:
 *   9876543210          → +919876543210
 *   09876543210         → +919876543210
 *   919876543210        → +919876543210
 *   +919876543210       → +919876543210 (no-op)
 *   With spaces/hyphens → stripped first
 *
 * Returns null for structurally invalid numbers.
 */
export function normalizeIndianMobile(raw: string): string | null {
  if (!raw) return null;

  const cleaned = raw.replace(/[\s\-\.]/g, "");
  const stripped = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

  let tenDigit: string;

  if (/^91\d{10}$/.test(stripped)) {
    tenDigit = stripped.slice(2);
  } else if (/^\d{10}$/.test(stripped)) {
    tenDigit = stripped;
  } else if (/^0\d{10}$/.test(stripped)) {
    tenDigit = stripped.slice(1);
  } else {
    return null;
  }

  // Indian mobiles start with 6-9
  if (!/^[6-9]/.test(tenDigit)) return null;

  return `+91${tenDigit}`;
}

export function isValidIndianMobile(raw: string): boolean {
  return normalizeIndianMobile(raw) !== null;
}

// ── Decision-maker scorer ──────────────────────────────────────────────────────

/**
 * Assigns a decision-maker score and category to a director based on their
 * designation and optional promoter flag.
 */
export function scoreDirector(
  designation: string,
  isPromoter?: boolean,
): { score: number; category: string } {
  if (isPromoter) return { score: 100, category: "promoter" };

  const d = designation
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  for (const rule of DECISION_MAKER_SCORE_RULES) {
    if (rule.keywords.some((kw) => d.includes(kw))) {
      return { score: rule.score, category: rule.category };
    }
  }

  return { score: 60, category: "director" };
}

// ── Input / output types for the pure pipeline ─────────────────────────────────

export interface DirectorInput {
  din: string;
  name: string;
  designation: string;
  is_active: boolean;
  mobile?: string;
  email?: string;
  is_promoter?: boolean;
  date_of_appointment?: string;
  date_of_cessation?: string;
  shareholding_percentage?: number;
  executive_type?: string;
}

export interface ScoredDirector extends DirectorInput {
  decisionMakerScore: number;
  priorityRank: number;
  scoreCategory: string;
  mobileRaw?: string;
  mobileNormalized?: string;
  mobileStatus: MobileStatus;
  contactSource: DirectorDataSource;
  /** ISO timestamp of the provider fetch that returned this director */
  credhiveLookupAt: string;
}

export type ContactTier = "primary" | "secondary" | "tertiary";

export interface DirectorContactTier {
  tier: ContactTier;
  din: string;
  name: string;
  designation: string;
  decisionMakerScore: number;
  mobile: string;
  mobileRaw: string;
  email?: string;
  source: DirectorDataSource;
  credhiveLookupAt: string;
}

export interface PipelineResult {
  contacts: DirectorContactTier[];
  allDirectors: ScoredDirector[];
  totalDirectors: number;
  contactableDirectors: number;
}

// ── Core pipeline — pure, no I/O ───────────────────────────────────────────────

/**
 * Full director contact pipeline. Pure function — no side effects.
 *
 * Steps:
 *   1. Score all directors.
 *   2. Sort by score DESC, then by appointment date ASC (tiebreak).
 *   3. Assign priorityRank.
 *   4. Validate + normalise mobile for each director.
 *   5. Deduplicate normalised mobiles (higher-ranked director wins).
 *   6. Filter contactable directors (mobileStatus === "found").
 *   7. Assign tiers to up to 3 contactable directors.
 *
 * @param rawDirectors  - Directors from CredHive (with optional mobile field)
 * @param lookupAt      - ISO timestamp of the CredHive fetch
 * @returns             - Pipeline result with contacts + full scored universe
 */
export function runDirectorContactPipeline(
  rawDirectors: DirectorInput[],
  lookupAt: string,
  source: DirectorDataSource = "credhive",
): PipelineResult {
  // Step 1 + 2: Score and sort
  const sorted = rawDirectors
    .map((d) => {
      const { score, category } = scoreDirector(d.designation, d.is_promoter);
      return {
        ...d,
        decisionMakerScore: score,
        scoreCategory: category,
        priorityRank: 0, // assigned below
        mobileRaw: d.mobile,
        mobileNormalized: undefined as string | undefined,
        mobileStatus: "not_found" as MobileStatus,
        contactSource: source,
        credhiveLookupAt: lookupAt,
      };
    })
    .sort((a, b) => {
      if (b.decisionMakerScore !== a.decisionMakerScore) {
        return b.decisionMakerScore - a.decisionMakerScore;
      }
      const tA = a.date_of_appointment
        ? new Date(a.date_of_appointment).getTime()
        : Infinity;
      const tB = b.date_of_appointment
        ? new Date(b.date_of_appointment).getTime()
        : Infinity;
      return tA - tB;
    });

  // Step 3: Assign priorityRank
  sorted.forEach((d, i) => { d.priorityRank = i + 1; });

  // Step 4 + 5: Validate and deduplicate mobiles
  const seenMobiles = new Set<string>();
  const validated: ScoredDirector[] = sorted.map((d) => {
    const raw = d.mobileRaw;

    if (!raw) return { ...d, mobileStatus: "not_found" as MobileStatus };

    const normalized = normalizeIndianMobile(raw);

    if (!normalized) return { ...d, mobileStatus: "invalid" as MobileStatus };

    if (seenMobiles.has(normalized)) {
      return { ...d, mobileNormalized: normalized, mobileStatus: "duplicate" as MobileStatus };
    }

    seenMobiles.add(normalized);
    return { ...d, mobileNormalized: normalized, mobileStatus: "found" as MobileStatus };
  });

  // Step 6: Filter contactable
  const contactable = validated.filter((d) => d.mobileStatus === "found");

  // Step 7: Assign tiers
  const tierNames: ContactTier[] = ["primary", "secondary", "tertiary"];
  const contacts: DirectorContactTier[] = contactable.slice(0, 3).map((d, i) => ({
    tier: tierNames[i],
    din: d.din,
    name: d.name,
    designation: d.designation,
    decisionMakerScore: d.decisionMakerScore,
    mobile: d.mobileNormalized!,
    mobileRaw: d.mobileRaw!,
    email: d.email,
    source,
    credhiveLookupAt: lookupAt,
  }));

  return {
    contacts,
    allDirectors: validated,
    totalDirectors: validated.length,
    contactableDirectors: contactable.length,
  };
}
