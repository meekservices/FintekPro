import type { FinancialData } from "./dataService";
import OpenAI from "openai";

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
  "Banks": {
    industryTrends: "Indian banking sector is experiencing a structural credit cycle upcycle, with healthy loan growth across retail, MSME, and infrastructure lending, while asset quality remains at multi-decade lows and NIMs stay supportive.",
    expansionPlans: "Banks are accelerating branch and digital channel expansion, investing in AI-driven underwriting and fraud detection, and scaling secured lending books while managing deposit franchise competitiveness.",
    outlook: "India's credit penetration remains well below global peers, providing a long runway for profitable growth as financialisation deepens, supported by RBI's balanced monetary stance and regulatory buffers.",
  },
  "Finance": {
    industryTrends: "India's NBFC and financial services sector is capitalising on underpenetrated credit markets in consumer durables, affordable housing, microfinance, and vehicle financing, supported by improving underwriting data and formalisation.",
    expansionPlans: "Financial companies are broadening product suites, co-lending partnerships with banks, and deploying technology-first origination and collection models to improve unit economics and customer acquisition cost.",
    outlook: "Rising financial inclusion, digital payments infrastructure, and India's young working-age population make financial services one of the most attractive long-duration growth themes across market cycles.",
  },
  "Automobiles": {
    industryTrends: "India's automotive sector is experiencing strong premiumisation tailwinds in passenger vehicles and robust two-wheeler recovery, while EV adoption is accelerating in the two-wheeler and commercial vehicle segments.",
    expansionPlans: "Auto OEMs are investing heavily in EV platforms, localising battery supply chains, expanding into new segments like electric three-wheelers and rural markets, and building software-defined vehicle capabilities.",
    outlook: "India is on track to become the world's third-largest auto market with structural demand from rising incomes, urban migration, and fleet electrification commitments by fleet operators providing multi-year visibility.",
  },
  "FMCG": {
    industryTrends: "India's FMCG sector is witnessing a rural consumption recovery post-inflation normalisation, with premiumisation driving value growth in urban markets and modern trade/e-commerce accelerating distribution penetration.",
    expansionPlans: "FMCG companies are investing in brand extensions, direct-to-consumer channels, regional product customisation, and strengthening distribution in Tier-2/3 cities to drive volume growth beyond metro markets.",
    outlook: "Favourable monsoon outlook, government welfare spending, and easing commodity prices should support margin recovery and volume acceleration, making the sector a defensive anchor with structural growth characteristics.",
  },
  "Cement": {
    industryTrends: "India's cement sector is benefiting from a government-driven infrastructure supercycle — roads, railways, affordable housing, and smart city projects — driving sustained capacity utilisation and pricing discipline.",
    expansionPlans: "Cement companies are aggressively expanding grinding capacity through acquisitions and greenfield expansions in high-growth markets, while investing in alternative fuels and waste heat recovery to lower costs.",
    outlook: "India's per-capita cement consumption at ~240 kg remains well below the global average of ~500 kg, underpinning a multi-decade demand runway as urbanisation, industrial expansion, and housing construction accelerate.",
  },
  "Power": {
    industryTrends: "India's power sector is at an inflection point with renewable energy capacity additions accelerating to meet the 500 GW target by 2030, while thermal power remains essential for baseload stability in a grid balancing act.",
    expansionPlans: "Power companies are investing in solar, wind, and hybrid projects, battery energy storage systems, green hydrogen pilots, and smart grid infrastructure to position for India's energy transition.",
    outlook: "India's electricity demand is expected to grow at 6–7% annually over the next decade driven by EV charging, industrial expansion, and residential electrification, creating sustained investment opportunities across the power value chain.",
  },
  "Real Estate": {
    industryTrends: "India's residential real estate market is experiencing its strongest upcycle in a decade, driven by affordability improvement post-consolidation, work-from-home-driven upgrade demand, and RERA-driven trust in organised developers.",
    expansionPlans: "Real estate companies are expanding into affordable housing, launching luxury/ultra-luxury projects in top-6 cities, entering new geographies, and scaling data centres and industrial park portfolios.",
    outlook: "With housing supply from organised developers still recovering and India's homeownership aspirations structurally intact, leading branded developers are well-positioned to grow market share at expanding margins through the cycle.",
  },
  "Metals & Mining": {
    industryTrends: "India's metals sector is benefiting from domestic infrastructure spending and government anti-dumping protections, while global steel and aluminium demand is supported by energy transition metals requirements.",
    expansionPlans: "Metal companies are pursuing downstream value-added product expansion, raw material backward integration through mining acquisitions, and decarbonisation capex to prepare for green steel premiums in export markets.",
    outlook: "India's domestic steel consumption per capita at ~80 kg versus the global average of ~225 kg, combined with the manufacturing push under PLI schemes, provides a compelling structural growth case for domestic-focused producers.",
  },
  "Telecom": {
    industryTrends: "India's telecom sector has consolidated into a three-player oligopoly, enabling disciplined tariff hikes, while 5G rollout is accelerating enterprise use-cases in manufacturing, logistics, and smart infrastructure.",
    expansionPlans: "Telecom companies are investing in fixed wireless access, enterprise managed services, home broadband, and digital services adjacencies to diversify revenue beyond voice and mobile data.",
    outlook: "Rising ARPU from tariff normalisation, growing enterprise 5G revenues, and India's underpenetrated home broadband market provide a multi-year revenue and EBITDA growth pathway for well-capitalised operators.",
  },
  "Insurance": {
    industryTrends: "India's insurance sector remains one of the most underpenetrated globally with life insurance density at ~$70 versus ~$400 in developed markets, with term and health insurance growing fastest on rising risk awareness.",
    expansionPlans: "Insurance companies are investing in digital distribution through embedded insurance partnerships, bancassurance channel deepening, and rural penetration to expand their addressable market beyond metro India.",
    outlook: "Favourable demographics, growing financial awareness, regulatory support for simplified products, and rising healthcare costs create a decade-long structural growth opportunity for disciplined insurers.",
  },
  "Consumer Durables": {
    industryTrends: "India's consumer durables sector is on a structurally higher growth trajectory driven by household electrification, rising disposable incomes, rapid urbanisation, and premiumisation across air conditioners, refrigerators, and washing machines.",
    expansionPlans: "Consumer durable companies are aggressively localising manufacturing to benefit from PLI schemes, expanding product ranges into premium segments, and building direct-to-consumer digital channels.",
    outlook: "India's consumer durable penetration at 20–40% for most categories versus 80–100% in China provides a compelling volume growth story, amplified by favourable demographic trends and surging real estate construction activity.",
  },
};

const GENERIC_FALLBACK: CommentaryData = {
  industryTrends: "The sector is benefiting from India's structural economic growth, rising domestic consumption, and supportive government policy — creating a conducive environment for sustained business expansion.",
  expansionPlans: "The company appears focused on operational efficiency improvement, market share consolidation, and selective capacity additions to capitalise on near-term demand opportunities.",
  outlook: "India's strong macroeconomic fundamentals, demographic dividend, and growing formalisation of the economy provide a supportive backdrop for well-managed companies in this sector.",
};

// Aliases for sector variants
const SECTOR_ALIASES: Record<string, string> = {
  "Road Assets - Toll Annuity Hybrid-Annuity": "Road Assets",
  "Road Assets - Toll": "Road Assets",
  "Road Assets - Annuity": "Road Assets",
  "Infrastructure Investment Trust": "Road Assets",
  "Real Estate Investment Trust": "Real Estate",
};

// Additional sector fallbacks not covered above
Object.assign(SECTOR_FALLBACKS, {
  "Road Assets": {
    industryTrends: "India's National Monetisation Pipeline (NMP) targeting ₹6 lakh crore of brownfield infrastructure assets and the National Infrastructure Pipeline (NIP) of ₹111 lakh crore are creating a structural tailwind for InvITs, which offer investors stable, long-term cash flows from operating road assets backed by government concession agreements.",
    expansionPlans: "Road InvITs are actively expanding their asset base through acquisition of additional highway projects from NHAI and private developers, while optimising toll collection efficiency, refinancing high-cost debt at lower rates, and targeting distribution yield improvement for unit holders.",
    outlook: "With India's road network expanding at record pace under Bharatmala and PM Gati Shakti, and institutional appetite for yield-generating infrastructure assets rising, InvITs offer a compelling combination of predictable distribution yield (6–9%), inflation-linked revenue escalation, and capital appreciation potential over a 5–10 year horizon.",
  },
  "REIT": {
    industryTrends: "India's REIT market is maturing rapidly with three listed REITs covering over 80 million sq ft of Grade-A commercial office space, benefiting from India's emergence as a global GCC (Global Capability Centre) hub with 1,600+ GCCs operating from India.",
    expansionPlans: "REITs are expanding portfolios through asset acquisitions, development of adjacent mixed-use real estate, and geographic diversification to cities like Chennai, Hyderabad, and Pune, while optimising occupancy and rental escalations across existing assets.",
    outlook: "Rising demand for high-quality office space from multinational GCCs, domestic IT expansion, and flex-space operators, combined with India's favourable demographics and urbanisation trajectory, position REITs as an attractive fixed-income alternative with real estate upside.",
  },
});

function pct(v: number | null): string {
  if (v === null || v === undefined) return "N/A";
  return `${(v * 100).toFixed(1)}%`;
}

async function tryGeminiGenerate(prompt: string, retries = 1): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("No Gemini API key");
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        ai.models.generateContent({ model: "gemini-3.1-flash-lite", contents: prompt }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 12_000)),
      ]) as any;
      return result.text ?? result.response?.text?.() ?? "";
    } catch (e: any) {
      const is429 = e?.status === 429 || e?.message?.includes("429") || e?.message?.toLowerCase().includes("quota") || e?.message?.toLowerCase().includes("rate");
      if (is429 && attempt < retries) {
        await new Promise(res => setTimeout(res, 3000));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded");
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

    const text = await tryGeminiGenerate(prompt, 1);
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
    console.warn(`[ResearchNote] Gemini commentary failed for ${companyName}:`, e?.message?.slice(0, 120));

    // Try OpenAI as fallback before using static sector text
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        const openai = new OpenAI({ apiKey: openaiKey });
        const prompt = `You are a senior equity research analyst at a top Indian brokerage.
Write EXACTLY 3 sentences responding to the following three questions — one sentence each.

Company: ${companyName}
Sector/Industry: ${sector ?? "N/A"} / ${industry ?? "N/A"}
Key Financial Profile: Revenue Growth: ${pct(f.revenueGrowth)}, Earnings Growth: ${pct(f.earningsGrowth)}, ROE: ${pct(f.roe)}, D/E Ratio: ${f.debtToEquity?.toFixed(2) ?? "N/A"}

Question 1 (Sentence 1): What are the current structural growth drivers and key tailwinds for the ${sector ?? "sector"} industry in India?
Question 2 (Sentence 2): What are likely expansion or strategic initiatives ${companyName} is pursuing, based on its financial profile and sector dynamics?
Question 3 (Sentence 3): Why does this sector/company merit investor attention right now?

Rules: Be specific, reference real sector dynamics or policies, mention INR amounts where relevant. Do NOT mention stock price or give BUY/SELL ratings.
Return ONLY the 3 sentences, numbered 1., 2., 3. with no extra text.`;

        const result = await Promise.race([
          openai.chat.completions.create({ model: "gpt-4.1-mini", messages: [{ role: "user", content: prompt }], max_tokens: 300 }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("OpenAI timeout")), 10_000)),
        ]) as any;
        const text: string = result.choices?.[0]?.message?.content ?? "";
        const lines = text.split("\n").map((l: string) => l.replace(/^\d+\.\s*/, "").trim()).filter((l: string) => l.length > 20);
        if (lines.length >= 3) {
          const data: CommentaryData = { industryTrends: lines[0], expansionPlans: lines[1], outlook: lines[2] };
          console.log(`[ResearchNote] OpenAI commentary fallback succeeded for ${companyName}`);
          cache.set(cacheKey, { data, expiresAt: Date.now() + 60 * 60 * 1000 });
          return data;
        }
      }
    } catch (openaiErr: any) {
      console.warn(`[ResearchNote] OpenAI commentary fallback failed for ${companyName}:`, openaiErr?.message?.slice(0, 80));
    }

    // Final fallback: resolve sector alias then use static sector text
    const resolvedSector = SECTOR_ALIASES[sectorKey] ?? sectorKey;
    const fallback = SECTOR_FALLBACKS[resolvedSector] ?? SECTOR_FALLBACKS[sectorKey] ?? GENERIC_FALLBACK;
    cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + 15 * 60 * 1000 });
    return fallback;
  }
}
