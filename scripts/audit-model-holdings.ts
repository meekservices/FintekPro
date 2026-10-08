interface Holding {
  rank?: number;
  name?: string;
  instrumentName?: string;
  isin?: string;
  symbol?: string;
  amfiSchemeCode?: string;
  schemeCode?: string;
  type?: string;
  category?: string;
  assetClass?: string;
  weight?: number;
  targetWeight?: number;
  currentReturn?: number;
  returns_1y?: number;
  beta?: number;
  sharpe?: number;
  [key: string]: any;
}

interface Portfolio {
  id: string;
  name: string;
  assetClass: string;
  riskProfile: string;
  rebalancingFrequency: string | null;
  rebalancingMode: string | null;
  driftScore?: number;
  maxDrawdown?: string | number;
  maxDrawdownThreshold?: string | number;
  circuitBreakerTripped?: boolean;
  holdings: Holding[];
  totalHoldings?: number;
}

interface AuditReport {
  id: string;
  name: string;
  assetClass: string;
  riskProfile: string;
  rebalancingFrequency: string | null;
  rebalancingMode: string | null;
  totalHoldings: number;
  weightSum: number;
  weightError: boolean;
  missingIsinCount: number;
  invalidIsinCount: number;
  missingAmfiCount: number;
  missingTypeCount: number;
  duplicateCount: number;
  holdingsDetails: Array<{
    rank: any;
    name: string;
    isin: string | null;
    symbol: string | null;
    amfiSchemeCode: string | null;
    type: string | null;
    weight: number;
    targetWeight: number | null;
    issues: string[];
  }>;
}

async function runAudit() {
  const url = "https://fintekpro-app-7f3fb64pqq-el.a.run.app/api/model-portfolios";
  console.log(`Fetching model portfolios from ${url}...`);

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch portfolios: ${resp.status} ${resp.statusText}`);
  }

  const json = await resp.json();
  const portfolios: Portfolio[] = json.data ?? [];

  console.log(`Retrieved ${portfolios.length} live model portfolios.\n`);

  const results: AuditReport[] = [];

  for (const p of portfolios) {
    const rawHoldings = Array.isArray(p.holdings) ? p.holdings : [];
    let weightSum = 0;
    let missingIsinCount = 0;
    let invalidIsinCount = 0;
    let missingAmfiCount = 0;
    let missingTypeCount = 0;
    const seenNames = new Set<string>();
    const seenIsins = new Set<string>();
    let duplicateCount = 0;

    const holdingsDetails = rawHoldings.map((h, idx) => {
      const issues: string[] = [];
      const weight = Number(h.weight ?? 0);
      weightSum += weight;

      if (!h.weight || weight <= 0) {
        issues.push("zero_or_missing_weight");
      }

      // ISIN validation
      const isin = h.isin ? String(h.isin).trim() : null;
      if (!isin) {
        missingIsinCount++;
        issues.push("missing_isin");
      } else if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) {
        invalidIsinCount++;
        issues.push(`invalid_isin_format(${isin})`);
      } else {
        if (seenIsins.has(isin)) {
          duplicateCount++;
          issues.push(`duplicate_isin(${isin})`);
        }
        seenIsins.add(isin);
      }

      // Duplicate name
      const name = String(h.name ?? h.instrumentName ?? `Holding_${idx + 1}`).trim();
      if (seenNames.has(name.toLowerCase())) {
        duplicateCount++;
        issues.push("duplicate_name");
      }
      seenNames.add(name.toLowerCase());

      // Type / category
      const type = h.type ?? h.category ?? h.assetClass ?? null;
      if (!type) {
        missingTypeCount++;
        issues.push("missing_type_or_category");
      }

      // Mutual fund AMFI scheme code check
      const isMf = isin?.startsWith("INF") || (type && /mf|mutual|fund|hybrid|debt|liquid/i.test(type));
      const amfiCode = h.amfiSchemeCode ?? h.schemeCode ?? null;
      if (isMf && !amfiCode) {
        missingAmfiCount++;
        issues.push("mf_missing_amfi_scheme_code");
      }

      return {
        rank: h.rank ?? idx + 1,
        name,
        isin,
        symbol: h.symbol ?? null,
        amfiSchemeCode: amfiCode,
        type,
        weight,
        targetWeight: h.targetWeight != null ? Number(h.targetWeight) : null,
        issues,
      };
    });

    const weightError = Math.abs(weightSum - 100) > 0.1;

    results.push({
      id: p.id,
      name: p.name,
      assetClass: p.assetClass,
      riskProfile: p.riskProfile,
      rebalancingFrequency: p.rebalancingFrequency,
      rebalancingMode: p.rebalancingMode,
      totalHoldings: rawHoldings.length,
      weightSum: Math.round(weightSum * 100) / 100,
      weightError,
      missingIsinCount,
      invalidIsinCount,
      missingAmfiCount,
      missingTypeCount,
      duplicateCount,
      holdingsDetails,
    });
  }

  // Summary statistics
  const totalPortfolios = results.length;
  const portfoliosWithWeightErrors = results.filter((r) => r.weightError);
  const portfoliosWithMissingIsin = results.filter((r) => r.missingIsinCount > 0);
  const portfoliosWithInvalidIsin = results.filter((r) => r.invalidIsinCount > 0);
  const portfoliosWithMissingAmfi = results.filter((r) => r.missingAmfiCount > 0);
  const portfoliosWithDuplicates = results.filter((r) => r.duplicateCount > 0);

  console.log("================================================================================");
  console.log("                    MODEL PORTFOLIOS INSTRUMENTS AUDIT REPORT                  ");
  console.log("================================================================================");
  console.log(`Total Published Portfolios Audited     : ${totalPortfolios}`);
  console.log(`Portfolios with Weight != 100%         : ${portfoliosWithWeightErrors.length}`);
  console.log(`Portfolios with Missing ISINs          : ${portfoliosWithMissingIsin.length}`);
  console.log(`Portfolios with Invalid ISIN Format    : ${portfoliosWithInvalidIsin.length}`);
  console.log(`Portfolios with MF Missing AMFI Code   : ${portfoliosWithMissingAmfi.length}`);
  console.log(`Portfolios with Duplicate Holdings     : ${portfoliosWithDuplicates.length}`);
  console.log("================================================================================\n");

  for (const r of results) {
    const hasIssues =
      r.weightError ||
      r.missingIsinCount > 0 ||
      r.invalidIsinCount > 0 ||
      r.missingAmfiCount > 0 ||
      r.duplicateCount > 0;

    const badge = hasIssues ? "⚠️ ISSUES FOUND" : "✅ CLEAN";
    console.log(
      `--------------------------------------------------------------------------------`
    );
    console.log(
      `[${r.id}] "${r.name}" (${r.assetClass.toUpperCase()} / ${r.riskProfile.toUpperCase()}) — ${badge}`
    );
    console.log(
      `  Holdings Count: ${r.totalHoldings} | Weight Sum: ${r.weightSum}% | Mode: ${r.rebalancingMode} | Freq: ${r.rebalancingFrequency}`
    );
    if (r.weightError) {
      console.log(`  ❌ WEIGHT ERROR: Sum is ${r.weightSum}%, expected 100.0%`);
    }
    if (r.duplicateCount > 0) {
      console.log(`  ❌ DUPLICATES: ${r.duplicateCount} duplicate holding(s)`);
    }
    if (r.missingIsinCount > 0) {
      console.log(`  ⚠️ MISSING ISINs: ${r.missingIsinCount} holding(s)`);
    }
    if (r.invalidIsinCount > 0) {
      console.log(`  ❌ INVALID ISINs: ${r.invalidIsinCount} holding(s)`);
    }
    if (r.missingAmfiCount > 0) {
      console.log(`  ⚠️ MF MISSING AMFI CODE: ${r.missingAmfiCount} scheme(s)`);
    }

    const problemHoldings = r.holdingsDetails.filter((h) => h.issues.length > 0);
    if (problemHoldings.length > 0) {
      console.log("  Problem Holdings Breakdown:");
      for (const ph of problemHoldings) {
        console.log(
          `    - [${ph.weight}%] "${ph.name}" (ISIN: ${ph.isin ?? "NONE"}, AMFI: ${ph.amfiSchemeCode ?? "NONE"}): ${ph.issues.join(", ")}`
        );
      }
    }
  }

  process.exit(0);
}

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
