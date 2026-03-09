import type { FinancialData } from "./dataService";

export interface CommentaryData {
  industryTrends: string;
  expansionPlans: string;
  outlook: string;
}

const cache = new Map<string, { data: CommentaryData; expiresAt: number }>();

const SECTOR_FALLBACKS: Record<string, CommentaryData> = {
  "Construction Vehicles": {
    industryTrends: "India's infrastructure push — National Infrastructure Pipeline (₹111 lakh crore), Smart Cities, and road construction boom — is driving multi-year demand for construction equipment and specialised vehicles.",
    expansionPlans: "Companies in this sector are expanding dealer networks, strengthening aftermarket/service revenue streams, and investing in fuel-efficient or electric product lines to capture evolving customer preferences.",
    outlook: "With government capital expenditure remaining elevated and private sector construction activity rebounding, construction vehicle companies are well-positioned for sustained volume growth over the next 3-5 years.",
  },
  "Refineries & Marketing": {
    industryTrends: "India's petroleum refining sector is benefiting from rising domestic fuel demand, refinery capacity additions, and strategic petroleum product exports that leverage competitive refining margins.",
    expansionPlans: "Major refiners are investing in petrochemical integration, capacity upgrades, and green energy transition projects including hydrogen and biofuels to diversify revenue and reduce carbon exposure.",
    outlook: "Structural domestic demand growth, India's refining capacity advantage, and government energy security priorities support long-term earnings visibility for integrated refiners.",
  },
  "Pharmaceuticals": {
    industryTrends: "India's pharmaceutical industry continues to dominate global generic drug supply, while domestic formulations growth, complex generic launches, and biosimilar opportunities provide multiple growth vectors.",
    expansionPlans: "Pharma companies are expanding US FDA-approved manufacturing capacity, investing in specialty/complex generics pipelines, and exploring biologics and CDMO partnerships to capture higher-value market segments.",
    outlook: "Favourable demographics, healthcare spending growth, insurance penetration, and India's cost advantage in global drug manufacturing provide a compelling structural growth thesis.",
  },
  "Computers - Software & Consulting": {
    industryTrends: "Indian IT services are riding structural demand from cloud migration, digital transformation, and AI/ML adoption globally, with deal sizes expanding and vendor consolidation benefiting large integrated players.",
    expansionPlans: "IT companies are investing in generative AI capabilities, expanding GCC service offerings, and building domain-specific solutions to move up the value chain from commodity services.",
    outlook: "With global enterprise technology spending resilient and India's talent cost advantage intact, the sector offers earnings visibility through large multi-year deal pipelines and expanding margin profiles.",
  },
};

const GENERIC_FALLBACK: CommentaryData = {
  industryTrends: "The sector is benefiting from India's structural economic growth, rising domestic consumption, and supportive government policy — creating a conducive environment for sustained business expansion.",
  expansionPlans: "The company appears focused on operational efficiency improvement, market share consolidation, and selective capacity additions to capitalise on near-term demand opportunities.",
  outlook: "India's strong macroeconomic fundamentals, demographic dividend, and growing formalisation of the economy provide a supportive backdrop for well-managed companies in this sector.",
};

function pct(v: number | null): string {
  if (v === null || v === undefined) return "N/A";
  return `${(v * 100).toFixed(1)}%`;
}

export async function generateCommentary(
  companyName: string,
  sector: string | null,
  industry: string | null,
  f: FinancialData
): Promise<CommentaryData> {
  const cacheKey = `${companyName}__${sector}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const sectorKey = sector ?? "";

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("No Gemini API key");

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const prompt = `You are a senior equity research analyst at a top Indian brokerage. 
Write EXACTLY 3 sentences responding to the following three questions — one sentence each, no more, no less.

Company: ${companyName}
Sector/Industry: ${sector ?? "N/A"} / ${industry ?? "N/A"}
Key Financial Profile: Revenue Growth: ${pct(f.revenueGrowth)}, Earnings Growth: ${pct(f.earningsGrowth)}, ROE: ${pct(f.roe)}, D/E Ratio: ${f.debtToEquity?.toFixed(2) ?? "N/A"}

Question 1 (Sentence 1): What are the current structural growth drivers and key tailwinds for the ${sector ?? "sector"} industry in India?
Question 2 (Sentence 2): What are likely expansion or strategic initiatives ${companyName} is pursuing, based on its financial profile and sector dynamics?
Question 3 (Sentence 3): Why does this sector/company merit investor attention right now?

Rules:
- Be specific and reference real sector dynamics or government policies
- Mention INR amounts or % figures where relevant
- Do NOT mention the stock price, CMP, or give BUY/SELL ratings
- Each sentence must be self-contained and informative
- Return ONLY the 3 sentences, numbered 1., 2., 3. with no extra text`;

    const result = await Promise.race([
      ai.models.generateContent({ model: "gemini-2.0-flash", contents: prompt }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 12_000)),
    ]) as any;

    const text: string = result.text ?? result.response?.text?.() ?? "";
    const lines = text.split("\n").map((l: string) => l.replace(/^\d+\.\s*/, "").trim()).filter((l: string) => l.length > 20);

    if (lines.length >= 3) {
      const data: CommentaryData = {
        industryTrends: lines[0],
        expansionPlans: lines[1],
        outlook: lines[2],
      };
      cache.set(cacheKey, { data, expiresAt: Date.now() + 60 * 60 * 1000 });
      return data;
    }
    throw new Error("Insufficient response lines");
  } catch (e: any) {
    console.warn(`[ResearchNote] Gemini commentary failed for ${companyName}:`, e?.message);
    const fallback = SECTOR_FALLBACKS[sectorKey] ?? GENERIC_FALLBACK;
    cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + 15 * 60 * 1000 });
    return fallback;
  }
}
