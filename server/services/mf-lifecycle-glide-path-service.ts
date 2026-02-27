import { db } from '../db';
import { mutualFunds } from '@shared/schema';
import { eq, isNotNull, sql } from 'drizzle-orm';

export interface GlidePathStep {
  year: number;
  equityPct: number;
  debtPct: number;
}

export interface LifecycleMetadata {
  maturityYear: number;
  glidePathSteps: GlidePathStep[];
}

export interface GlidePathValidationResult {
  valid: boolean;
  violations: string[];
}

export interface BulkLifecycleValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  results: Array<{ schemeCode: string; schemeName: string; valid: boolean; violations: string[] }>;
}

class MfLifecycleGlidePathService {
  private static instance: MfLifecycleGlidePathService;

  static getInstance(): MfLifecycleGlidePathService {
    if (!this.instance) {
      this.instance = new MfLifecycleGlidePathService();
    }
    return this.instance;
  }

  validateGlidePath(schemeCode: string, lifecycleMetadata: LifecycleMetadata): GlidePathValidationResult {
    const violations: string[] = [];
    const { maturityYear, glidePathSteps } = lifecycleMetadata;

    // Rule 1: At least 2 glide path steps required
    if (!glidePathSteps || glidePathSteps.length < 2) {
      violations.push('Life Cycle Fund must have at least 2 glide path steps defining the equity/debt allocation over time.');
      return { valid: false, violations };
    }

    // Sort steps by year ascending
    const steps = [...glidePathSteps].sort((a, b) => a.year - b.year);

    // Rule 2: No missing year gaps (consecutive years)
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].year - steps[i - 1].year > 1) {
        violations.push(`Missing year in glide path: gap between year ${steps[i - 1].year} and ${steps[i].year}. Steps must be consecutive.`);
      }
    }

    // Rule 3: Equity must monotonically decrease (or stay flat)
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].equityPct > steps[i - 1].equityPct) {
        violations.push(
          `Equity allocation must not increase over time. Year ${steps[i].year} has ${steps[i].equityPct}% equity vs ${steps[i - 1].equityPct}% in year ${steps[i - 1].year}. (SEBI 2026: equity must glide down towards maturity)`
        );
      }
    }

    // Rule 4: Debt must monotonically increase (or stay flat)
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].debtPct < steps[i - 1].debtPct) {
        violations.push(
          `Debt allocation must not decrease over time. Year ${steps[i].year} has ${steps[i].debtPct}% debt vs ${steps[i - 1].debtPct}% in year ${steps[i - 1].year}.`
        );
      }
    }

    // Rule 5: equity + debt must sum to 95-100 at each step
    for (const step of steps) {
      const total = step.equityPct + step.debtPct;
      if (total < 90 || total > 101) {
        violations.push(
          `Year ${step.year}: equity (${step.equityPct}%) + debt (${step.debtPct}%) = ${total}%. Must be between 90-100% (tolerance for other asset classes allowed).`
        );
      }
    }

    // Rule 6: Maturity year must match the last step year
    const lastStepYear = steps[steps.length - 1].year;
    if (maturityYear && lastStepYear !== maturityYear) {
      violations.push(
        `Maturity year (${maturityYear}) must match the last glide path step year (${lastStepYear}).`
      );
    }

    return { valid: violations.length === 0, violations };
  }

  async validateAndPersist(
    schemeCode: string,
    lifecycleMetadata: LifecycleMetadata
  ): Promise<GlidePathValidationResult> {
    const result = this.validateGlidePath(schemeCode, lifecycleMetadata);

    try {
      if (!result.valid) {
        await db.execute(sql`
          UPDATE mutual_funds
          SET compliance_status = 'GLIDE_PATH_INVALID',
              compliance_blocked_reason = ${result.violations.join(' | ')}
          WHERE scheme_code = ${schemeCode}
        `);
        console.log(`[LifecycleValidator] ${schemeCode}: INVALID — ${result.violations.length} violations`);
      } else {
        // Only update if currently PENDING or GLIDE_PATH_INVALID (don't override BLOCKED)
        await db.execute(sql`
          UPDATE mutual_funds
          SET compliance_status = 'VALIDATED',
              compliance_blocked_reason = NULL
          WHERE scheme_code = ${schemeCode}
            AND compliance_status IN ('PENDING', 'GLIDE_PATH_INVALID')
        `);
        console.log(`[LifecycleValidator] ${schemeCode}: VALID glide path`);
      }
    } catch (e: any) {
      console.error(`[LifecycleValidator] DB update error for ${schemeCode}:`, e.message);
    }

    return result;
  }

  async validateAllLifecycleSchemes(): Promise<BulkLifecycleValidationSummary> {
    console.log('[LifecycleValidator] Starting bulk lifecycle glide path validation...');

    const lifecycleFunds = await db.select({
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      lifecycleMetadata: mutualFunds.lifecycleMetadata,
    }).from(mutualFunds)
      .where(isNotNull(mutualFunds.lifecycleMetadata));

    let valid = 0, invalid = 0;
    const results: Array<{ schemeCode: string; schemeName: string; valid: boolean; violations: string[] }> = [];

    for (const fund of lifecycleFunds) {
      if (!fund.lifecycleMetadata || typeof fund.lifecycleMetadata !== 'object') continue;

      const meta = fund.lifecycleMetadata as LifecycleMetadata;
      const result = await this.validateAndPersist(fund.schemeCode, meta);

      if (result.valid) valid++;
      else invalid++;

      results.push({
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName || '',
        valid: result.valid,
        violations: result.violations,
      });
    }

    console.log(`[LifecycleValidator] Complete: ${lifecycleFunds.length} lifecycle funds, ${valid} valid, ${invalid} invalid`);
    return { total: lifecycleFunds.length, valid, invalid, results };
  }

  isPublishingAllowed(complianceStatus: string | null): boolean {
    return complianceStatus !== 'GLIDE_PATH_INVALID' &&
           complianceStatus !== 'BLOCKED' &&
           complianceStatus !== 'OVERLAP_BREACH';
  }
}

export const mfLifecycleGlidePathService = MfLifecycleGlidePathService.getInstance();
export default mfLifecycleGlidePathService;
