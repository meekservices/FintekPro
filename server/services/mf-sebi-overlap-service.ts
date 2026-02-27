import { db } from '../db';
import { mutualFunds } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';

interface HoldingRow {
  isin: string;
  weightPercent: number;
}

interface OverlapPair {
  schemeCodeA: string;
  schemeCodeB: string;
  overlapPercent: number;
  breachFlag: boolean;
  schemeNameA?: string;
  schemeNameB?: string;
  categoryA?: string;
  categoryB?: string;
}

interface ComputeAllResult {
  pairsComputed: number;
  breachesFound: number;
  schemesCovered: number;
}

// SEBI breach thresholds (2026 circular)
const THEMATIC_SECTORAL_THRESHOLD = 50; // >50% overlap = breach for thematic/sectoral
const DEFAULT_OVERLAP_THRESHOLD = 60;   // >60% overlap = breach for others

const THEMATIC_KEYWORDS = ['sectoral', 'thematic', 'infrastructure', 'technology', 'pharma', 'banking', 'consumption', 'manufacturing', 'psu'];

function isThematicSectoral(category: string | null): boolean {
  if (!category) return false;
  const cat = category.toLowerCase();
  return THEMATIC_KEYWORDS.some(kw => cat.includes(kw));
}

class MfSebiOverlapService {
  private static instance: MfSebiOverlapService;

  static getInstance(): MfSebiOverlapService {
    if (!this.instance) {
      this.instance = new MfSebiOverlapService();
    }
    return this.instance;
  }

  // ── Import holdings from mf_scheme_stock_holdings → mf_portfolio_holdings ─
  async importHoldingsFromSchemeStockHoldings(limit = 10000): Promise<{ imported: number; schemes: number }> {
    console.log('[SEBIOverlap] Importing scheme holdings from mf_scheme_stock_holdings...');

    try {
      // Get distinct scheme codes that have holdings
      const schemesResult = await db.execute(sql`
        SELECT DISTINCT scheme_code, MAX(as_of_date) as latest_date
        FROM mf_scheme_stock_holdings
        WHERE percentage_holdings IS NOT NULL AND percentage_holdings > 0
        GROUP BY scheme_code
        LIMIT ${limit}
      `);
      const schemes = (schemesResult as any).rows || [];

      let totalImported = 0;

      for (const scheme of schemes) {
        const { scheme_code, latest_date } = scheme;
        const asOfDate = latest_date || new Date().toISOString().split('T')[0];

        try {
          // Normalize weights to sum to 100 for this scheme on this date
          const holdingsResult = await db.execute(sql`
            SELECT isin, stock_name, SUM(percentage_holdings) as weight
            FROM mf_scheme_stock_holdings
            WHERE scheme_code = ${scheme_code}
            GROUP BY isin, stock_name
            HAVING isin IS NOT NULL AND SUM(percentage_holdings) > 0
          `);
          const holdings = (holdingsResult as any).rows || [];

          if (holdings.length === 0) continue;

          const totalWeight = holdings.reduce((sum: number, h: any) => sum + parseFloat(h.weight || 0), 0);
          if (totalWeight === 0) continue;

          for (const h of holdings) {
            const normalizedWeight = (parseFloat(h.weight) / totalWeight) * 100;
            await db.execute(sql`
              INSERT INTO mf_portfolio_holdings (scheme_code, isin, stock_name, weight_percent, as_of_date)
              VALUES (${scheme_code}, ${h.isin}, ${h.stock_name}, ${normalizedWeight.toFixed(4)}, ${asOfDate})
              ON CONFLICT (scheme_code, isin, as_of_date) DO UPDATE SET
                weight_percent = EXCLUDED.weight_percent,
                stock_name = COALESCE(EXCLUDED.stock_name, mf_portfolio_holdings.stock_name)
            `);
          }

          totalImported += holdings.length;
        } catch (e: any) {
          console.error(`[SEBIOverlap] Import error for scheme ${scheme_code}:`, e.message);
        }
      }

      console.log(`[SEBIOverlap] Import complete: ${totalImported} holdings across ${schemes.length} schemes`);
      return { imported: totalImported, schemes: schemes.length };
    } catch (e: any) {
      console.error('[SEBIOverlap] importHoldings error:', e.message);
      return { imported: 0, schemes: 0 };
    }
  }

  // ── Compute pairwise overlap between two schemes ─────────────────────────
  async computeOverlap(schemeCodeA: string, schemeCodeB: string): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT SUM(LEAST(a.weight_percent, b.weight_percent)) as overlap
        FROM mf_portfolio_holdings a
        JOIN mf_portfolio_holdings b ON a.isin = b.isin
        WHERE a.scheme_code = ${schemeCodeA}
          AND b.scheme_code = ${schemeCodeB}
          AND a.as_of_date = (SELECT MAX(as_of_date) FROM mf_portfolio_holdings WHERE scheme_code = ${schemeCodeA})
          AND b.as_of_date = (SELECT MAX(as_of_date) FROM mf_portfolio_holdings WHERE scheme_code = ${schemeCodeB})
      `);
      const rows = (result as any).rows || [];
      return parseFloat(rows[0]?.overlap || '0');
    } catch (e: any) {
      console.error(`[SEBIOverlap] computeOverlap error (${schemeCodeA}, ${schemeCodeB}):`, e.message);
      return 0;
    }
  }

  // ── Compute all pairwise overlaps for schemes with holdings ───────────────
  async computeAllOverlaps(filterByCategory?: string): Promise<ComputeAllResult> {
    console.log('[SEBIOverlap] Computing all pairwise overlaps...');

    // Get schemes that have portfolio holdings
    let schemesQuery = sql`
      SELECT DISTINCT mf.scheme_code, mf.category, mf.scheme_sub_category
      FROM mutual_funds mf
      INNER JOIN mf_portfolio_holdings mph ON mf.scheme_code = mph.scheme_code
      WHERE mf.is_published = true
    `;

    const schemesResult = await db.execute(schemesQuery);
    const schemes = (schemesResult as any).rows || [];

    if (filterByCategory) {
      const filtered = schemes.filter((s: any) => (s.category || '').toLowerCase().includes(filterByCategory.toLowerCase()));
      console.log(`[SEBIOverlap] Filtered to ${filtered.length} ${filterByCategory} schemes`);
    }

    const activeSchemes = schemes;
    let pairsComputed = 0;
    let breachesFound = 0;

    // Pairwise computation (upper triangle only — A<B to avoid duplicates)
    for (let i = 0; i < activeSchemes.length; i++) {
      for (let j = i + 1; j < activeSchemes.length; j++) {
        const schemeA = activeSchemes[i];
        const schemeB = activeSchemes[j];

        const overlap = await this.computeOverlap(schemeA.scheme_code, schemeB.scheme_code);
        if (overlap === 0) continue; // Skip non-overlapping pairs

        const thresholdA = isThematicSectoral(schemeA.category) ? THEMATIC_SECTORAL_THRESHOLD : DEFAULT_OVERLAP_THRESHOLD;
        const thresholdB = isThematicSectoral(schemeB.category) ? THEMATIC_SECTORAL_THRESHOLD : DEFAULT_OVERLAP_THRESHOLD;
        const threshold = Math.min(thresholdA, thresholdB); // Use stricter threshold if either is thematic
        const breachFlag = overlap > threshold;

        try {
          await db.execute(sql`
            INSERT INTO mf_overlap_matrix (scheme_code_a, scheme_code_b, overlap_percent, breach_flag)
            VALUES (${schemeA.scheme_code}, ${schemeB.scheme_code}, ${overlap.toFixed(4)}, ${breachFlag})
            ON CONFLICT (scheme_code_a, scheme_code_b) DO UPDATE SET
              overlap_percent = EXCLUDED.overlap_percent,
              breach_flag = EXCLUDED.breach_flag,
              computed_at = NOW()
          `);
        } catch (e: any) {
          console.error(`[SEBIOverlap] Matrix upsert error:`, e.message);
        }

        pairsComputed++;
        if (breachFlag) breachesFound++;

        if (pairsComputed % 100 === 0) {
          console.log(`[SEBIOverlap] Progress: ${pairsComputed} pairs computed, ${breachesFound} breaches...`);
        }
      }
    }

    console.log(`[SEBIOverlap] Complete: ${pairsComputed} pairs, ${breachesFound} breaches, ${activeSchemes.length} schemes`);
    return { pairsComputed, breachesFound, schemesCovered: activeSchemes.length };
  }

  // ── Apply breach rules — transition breached schemes to OVERLAP_BREACH ────
  async applyBreachRules(): Promise<{ breachedSchemes: string[] }> {
    const breachedResult = await db.execute(sql`
      SELECT DISTINCT scheme_code_a as scheme_code FROM mf_overlap_matrix WHERE breach_flag = true
      UNION
      SELECT DISTINCT scheme_code_b as scheme_code FROM mf_overlap_matrix WHERE breach_flag = true
    `);
    const breachedRows = (breachedResult as any).rows || [];
    const breachedSchemes = breachedRows.map((r: any) => r.scheme_code as string);

    for (const schemeCode of breachedSchemes) {
      try {
        await db.execute(sql`
          UPDATE mutual_funds
          SET compliance_status = 'OVERLAP_BREACH'
          WHERE scheme_code = ${schemeCode}
            AND compliance_status NOT IN ('BLOCKED', 'GLIDE_PATH_INVALID')
        `);

        await db.execute(sql`
          INSERT INTO mf_compliance_state_log (scheme_code, from_status, to_status, reason, triggered_by)
          SELECT scheme_code, compliance_status, 'OVERLAP_BREACH',
                 'SEBI scheme-to-scheme portfolio overlap exceeds SEBI 2026 threshold', 'SEBI_OVERLAP_ENGINE'
          FROM mutual_funds
          WHERE scheme_code = ${schemeCode}
          LIMIT 1
        `);
      } catch (e: any) {
        console.error(`[SEBIOverlap] applyBreachRules error for ${schemeCode}:`, e.message);
      }
    }

    console.log(`[SEBIOverlap] Applied breach rules to ${breachedSchemes.length} schemes`);
    return { breachedSchemes };
  }

  // ── Get all overlap breaches with scheme names ────────────────────────────
  async getOverlapBreaches(): Promise<OverlapPair[]> {
    const result = await db.execute(sql`
      SELECT
        om.scheme_code_a, om.scheme_code_b, om.overlap_percent, om.breach_flag, om.computed_at,
        mf_a.scheme_name as scheme_name_a, mf_a.category as category_a,
        mf_b.scheme_name as scheme_name_b, mf_b.category as category_b
      FROM mf_overlap_matrix om
      LEFT JOIN mutual_funds mf_a ON mf_a.scheme_code = om.scheme_code_a
      LEFT JOIN mutual_funds mf_b ON mf_b.scheme_code = om.scheme_code_b
      WHERE om.breach_flag = true
      ORDER BY om.overlap_percent DESC
      LIMIT 500
    `);
    const rows = (result as any).rows || [];

    return rows.map((r: any) => ({
      schemeCodeA: r.scheme_code_a,
      schemeCodeB: r.scheme_code_b,
      overlapPercent: parseFloat(r.overlap_percent),
      breachFlag: r.breach_flag,
      schemeNameA: r.scheme_name_a,
      schemeNameB: r.scheme_name_b,
      categoryA: r.category_a,
      categoryB: r.category_b,
    }));
  }
}

export const mfSebiOverlapService = MfSebiOverlapService.getInstance();
export default mfSebiOverlapService;
