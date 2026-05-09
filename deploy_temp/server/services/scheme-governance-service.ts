import { db } from "../db";
import {
  mutualFunds,
  schemeRenameLog,
  schemeTransactionRules,
  proposalAuditLog,
  proposalVersions,
  type SchemeTransactionRule,
} from "@shared/schema";
import { eq, sql, and, or, ilike } from "drizzle-orm";

export interface SchemeValidationResult {
  isValid: boolean;
  currentName: string;
  wasRenamed: boolean;
  originalName?: string;
  isin?: string;
  schemeCode?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  lumpsumAllowed: boolean;
  sipAllowed: boolean;
  restrictionReason?: string;
  alternativeIsin?: string;
  alternativeSchemeName?: string;
  minLumpsumAmount?: number;
  maxLumpsumAmount?: number;
  minSipAmount?: number;
  subscriptionStatus: string;
}

export interface FundSubstitution {
  originalIsin?: string;
  originalName: string;
  replacementIsin?: string;
  replacementName: string;
  reason: string;
}

class SchemeGovernanceService {
  async validateSchemeName(schemeName: string): Promise<SchemeValidationResult> {
    try {
      const [fund] = await db
        .select({
          schemeName: mutualFunds.schemeName,
          isin: mutualFunds.isin,
          schemeCode: mutualFunds.schemeCode,
        })
        .from(mutualFunds)
        .where(ilike(mutualFunds.schemeName, schemeName))
        .limit(1);

      if (fund) {
        return {
          isValid: true,
          currentName: fund.schemeName,
          wasRenamed: false,
          isin: fund.isin || undefined,
          schemeCode: fund.schemeCode,
        };
      }

      const [renameEntry] = await db
        .select({
          oldName: schemeRenameLog.oldName,
          newName: schemeRenameLog.newName,
          isin: schemeRenameLog.isin,
          schemeCode: schemeRenameLog.schemeCode,
        })
        .from(schemeRenameLog)
        .where(ilike(schemeRenameLog.oldName, schemeName))
        .limit(1);

      if (renameEntry) {
        return {
          isValid: true,
          currentName: renameEntry.newName,
          wasRenamed: true,
          originalName: renameEntry.oldName,
          isin: renameEntry.isin || undefined,
          schemeCode: renameEntry.schemeCode,
        };
      }

      const [fuzzyMatch] = await db
        .select({
          schemeName: mutualFunds.schemeName,
          isin: mutualFunds.isin,
          schemeCode: mutualFunds.schemeCode,
        })
        .from(mutualFunds)
        .where(
          ilike(
            mutualFunds.schemeName,
            `%${schemeName.replace(/ - Regular \(G\)/i, "").replace(/ - Direct \(G\)/i, "").trim()}%`
          )
        )
        .limit(1);

      if (fuzzyMatch) {
        return {
          isValid: true,
          currentName: fuzzyMatch.schemeName,
          wasRenamed: true,
          originalName: schemeName,
          isin: fuzzyMatch.isin || undefined,
          schemeCode: fuzzyMatch.schemeCode,
        };
      }

      return {
        isValid: false,
        currentName: schemeName,
        wasRenamed: false,
      };
    } catch (error) {
      console.error("[SchemeGovernance] Name validation error:", error);
      return {
        isValid: false,
        currentName: schemeName,
        wasRenamed: false,
      };
    }
  }

  async validateAndCorrectSchemeNames(
    schemes: Array<{ name: string; [key: string]: any }>
  ): Promise<{
    corrected: Array<{ name: string; isin?: string; schemeCode?: string; [key: string]: any }>;
    renames: Array<{ oldName: string; newName: string }>;
  }> {
    const corrected: Array<{ name: string; isin?: string; schemeCode?: string; [key: string]: any }> = [];
    const renames: Array<{ oldName: string; newName: string }> = [];

    for (const scheme of schemes) {
      const result = await this.validateSchemeName(scheme.name);
      if (result.wasRenamed) {
        renames.push({ oldName: scheme.name, newName: result.currentName });
        corrected.push({
          ...scheme,
          name: result.currentName,
          isin: result.isin,
          schemeCode: result.schemeCode,
        });
        console.log(
          `[SchemeGovernance] Auto-corrected: "${scheme.name}" → "${result.currentName}"`
        );
      } else {
        corrected.push({
          ...scheme,
          isin: result.isin,
          schemeCode: result.schemeCode,
        });
      }
    }

    return { corrected, renames };
  }

  async checkEligibility(
    schemeIdentifier: string,
    identifierType: "isin" | "schemeCode" | "name" = "name"
  ): Promise<EligibilityResult> {
    try {
      let rule: SchemeTransactionRule | undefined;

      if (identifierType === "isin") {
        const [r] = await db
          .select()
          .from(schemeTransactionRules)
          .where(eq(schemeTransactionRules.isin, schemeIdentifier))
          .limit(1);
        rule = r;
      } else if (identifierType === "schemeCode") {
        const [r] = await db
          .select()
          .from(schemeTransactionRules)
          .where(eq(schemeTransactionRules.schemeCode, schemeIdentifier))
          .limit(1);
        rule = r;
      } else {
        const [r] = await db
          .select()
          .from(schemeTransactionRules)
          .where(ilike(schemeTransactionRules.schemeName, `%${schemeIdentifier}%`))
          .limit(1);
        rule = r;
      }

      if (!rule) {
        return {
          eligible: true,
          lumpsumAllowed: true,
          sipAllowed: true,
          subscriptionStatus: "OPEN",
        };
      }

      const lumpsumAllowed = rule.lumpsumAllowed !== false;
      const sipAllowed = rule.sipAllowed !== false;
      const status = rule.subscriptionStatus || "OPEN";

      return {
        eligible: lumpsumAllowed && sipAllowed && status !== "CLOSED",
        lumpsumAllowed,
        sipAllowed,
        restrictionReason: rule.restrictionReason || undefined,
        alternativeIsin: rule.alternativeIsin || undefined,
        alternativeSchemeName: rule.alternativeSchemeName || undefined,
        minLumpsumAmount: rule.minLumpsumAmount ? Number(rule.minLumpsumAmount) : undefined,
        maxLumpsumAmount: rule.maxLumpsumAmount ? Number(rule.maxLumpsumAmount) : undefined,
        minSipAmount: rule.minSipAmount ? Number(rule.minSipAmount) : undefined,
        subscriptionStatus: status,
      };
    } catch (error) {
      console.error("[SchemeGovernance] Eligibility check error:", error);
      return {
        eligible: true,
        lumpsumAllowed: true,
        sipAllowed: true,
        subscriptionStatus: "OPEN",
      };
    }
  }

  async validateProposalEligibility(
    proposalId: string,
    schemes: Array<{
      name: string;
      isin?: string;
      investmentType: "lumpsum" | "sip";
      amount: number;
    }>
  ): Promise<{
    allEligible: boolean;
    results: Array<{
      schemeName: string;
      eligible: boolean;
      reason?: string;
      alternativeName?: string;
    }>;
  }> {
    const results: Array<{
      schemeName: string;
      eligible: boolean;
      reason?: string;
      alternativeName?: string;
    }> = [];
    let allEligible = true;

    for (const scheme of schemes) {
      const identifier = scheme.isin || scheme.name;
      const identifierType = scheme.isin ? "isin" as const : "name" as const;
      const eligibility = await this.checkEligibility(identifier, identifierType);

      const isTypeAllowed =
        scheme.investmentType === "lumpsum"
          ? eligibility.lumpsumAllowed
          : eligibility.sipAllowed;

      let amountValid = true;
      if (scheme.investmentType === "lumpsum") {
        if (eligibility.minLumpsumAmount && scheme.amount < eligibility.minLumpsumAmount) {
          amountValid = false;
        }
        if (eligibility.maxLumpsumAmount && scheme.amount > eligibility.maxLumpsumAmount) {
          amountValid = false;
        }
      } else if (scheme.investmentType === "sip") {
        if (eligibility.minSipAmount && scheme.amount < eligibility.minSipAmount) {
          amountValid = false;
        }
      }

      const eligible = isTypeAllowed && amountValid && eligibility.subscriptionStatus !== "CLOSED";

      if (!eligible) {
        allEligible = false;
      }

      const reason = !isTypeAllowed
        ? eligibility.restrictionReason || `${scheme.investmentType} not allowed for this scheme`
        : !amountValid
        ? `Amount ₹${scheme.amount} outside allowed range`
        : eligibility.subscriptionStatus === "CLOSED"
        ? "Scheme subscription is closed"
        : undefined;

      results.push({
        schemeName: scheme.name,
        eligible,
        reason,
        alternativeName: eligible ? undefined : eligibility.alternativeSchemeName || undefined,
      });

      try {
        await db.insert(proposalAuditLog).values({
          proposalId,
          eventType: "ELIGIBILITY_CHECK",
          isin: scheme.isin || null,
          schemeName: scheme.name,
          investmentType: scheme.investmentType,
          validationStatus: eligible ? "PASSED" : "BLOCKED",
          validationMessage: reason || "Eligible",
          metadata: {
            amount: scheme.amount,
            lumpsumAllowed: eligibility.lumpsumAllowed,
            sipAllowed: eligibility.sipAllowed,
            subscriptionStatus: eligibility.subscriptionStatus,
          },
        });
      } catch (auditErr) {
        console.warn("[SchemeGovernance] Audit log insert failed:", auditErr);
      }
    }

    return { allEligible, results };
  }

  async findAlternativeScheme(
    restrictedSchemeName: string,
    category?: string,
    riskLevel?: string
  ): Promise<{
    found: boolean;
    scheme?: { name: string; isin?: string; schemeCode?: string; category?: string };
  }> {
    try {
      const eligibility = await this.checkEligibility(restrictedSchemeName, "name");
      if (eligibility.alternativeSchemeName) {
        const altEligibility = await this.checkEligibility(
          eligibility.alternativeSchemeName,
          "name"
        );
        if (altEligibility.eligible) {
          const [altFund] = await db
            .select({
              schemeName: mutualFunds.schemeName,
              isin: mutualFunds.isin,
              schemeCode: mutualFunds.schemeCode,
              category: mutualFunds.category,
            })
            .from(mutualFunds)
            .where(ilike(mutualFunds.schemeName, `%${eligibility.alternativeSchemeName}%`))
            .limit(1);

          if (altFund) {
            return {
              found: true,
              scheme: {
                name: altFund.schemeName,
                isin: altFund.isin || undefined,
                schemeCode: altFund.schemeCode,
                category: altFund.category || undefined,
              },
            };
          }
        }
      }

      if (category) {
        const categoryPattern = `%${category}%`;
        const candidates = await db
          .select({
            schemeName: mutualFunds.schemeName,
            isin: mutualFunds.isin,
            schemeCode: mutualFunds.schemeCode,
            category: mutualFunds.category,
            riskLevel: mutualFunds.riskLevel,
          })
          .from(mutualFunds)
          .where(
            and(
              ilike(mutualFunds.category, categoryPattern),
              eq(mutualFunds.schemeStatus, "active"),
              eq(mutualFunds.planType, "regular")
            )
          )
          .limit(20);

        for (const candidate of candidates) {
          const cEligibility = await this.checkEligibility(
            candidate.schemeCode,
            "schemeCode"
          );
          if (cEligibility.eligible) {
            return {
              found: true,
              scheme: {
                name: candidate.schemeName,
                isin: candidate.isin || undefined,
                schemeCode: candidate.schemeCode,
                category: candidate.category || undefined,
              },
            };
          }
        }
      }

      return { found: false };
    } catch (error) {
      console.error("[SchemeGovernance] Alternative search error:", error);
      return { found: false };
    }
  }

  async seedTransactionRulesFromRegistry(
    registry: Array<{
      fundNamePattern: string;
      restrictionType: "lumpsum" | "sip" | "both";
      reason: string;
      effectiveFrom: string;
      alternativeFund?: string;
    }>
  ): Promise<{ seeded: number; errors: number }> {
    let seeded = 0;
    let errors = 0;

    for (const entry of registry) {
      try {
        const funds = await db
          .select({
            schemeCode: mutualFunds.schemeCode,
            schemeName: mutualFunds.schemeName,
            isin: mutualFunds.isin,
          })
          .from(mutualFunds)
          .where(ilike(mutualFunds.schemeName, `%${entry.fundNamePattern}%`))
          .limit(10);

        let altIsin: string | null = null;
        let altName: string | null = null;
        if (entry.alternativeFund) {
          const [altFund] = await db
            .select({ isin: mutualFunds.isin, schemeName: mutualFunds.schemeName })
            .from(mutualFunds)
            .where(ilike(mutualFunds.schemeName, `%${entry.alternativeFund}%`))
            .limit(1);
          if (altFund) {
            altIsin = altFund.isin;
            altName = altFund.schemeName;
          }
        }

        for (const fund of funds) {
          const existing = await db
            .select({ id: schemeTransactionRules.id })
            .from(schemeTransactionRules)
            .where(eq(schemeTransactionRules.schemeCode, fund.schemeCode))
            .limit(1);

          const lumpsumAllowed =
            entry.restrictionType === "lumpsum" || entry.restrictionType === "both"
              ? false
              : true;
          const sipAllowed =
            entry.restrictionType === "sip" || entry.restrictionType === "both"
              ? false
              : true;

          if (existing.length > 0) {
            await db
              .update(schemeTransactionRules)
              .set({
                lumpsumAllowed,
                sipAllowed,
                subscriptionStatus: lumpsumAllowed && sipAllowed ? "OPEN" : "RESTRICTED",
                restrictionReason: entry.reason,
                alternativeIsin: altIsin,
                alternativeSchemeName: altName || entry.alternativeFund || null,
                effectiveFrom: entry.effectiveFrom,
                updatedAt: new Date(),
              })
              .where(eq(schemeTransactionRules.schemeCode, fund.schemeCode));
          } else {
            await db.insert(schemeTransactionRules).values({
              isin: fund.isin,
              schemeCode: fund.schemeCode,
              schemeName: fund.schemeName,
              lumpsumAllowed,
              sipAllowed,
              subscriptionStatus: lumpsumAllowed && sipAllowed ? "OPEN" : "RESTRICTED",
              restrictionReason: entry.reason,
              alternativeIsin: altIsin,
              alternativeSchemeName: altName || entry.alternativeFund || null,
              effectiveFrom: entry.effectiveFrom,
            });
          }
          seeded++;
        }
      } catch (err) {
        console.error(
          `[SchemeGovernance] Error seeding rule for ${entry.fundNamePattern}:`,
          err
        );
        errors++;
      }
    }

    console.log(
      `[SchemeGovernance] Seeded ${seeded} transaction rules, ${errors} errors`
    );
    return { seeded, errors };
  }

  async logProposalAuditEvent(
    proposalId: string,
    eventType: string,
    data: {
      isin?: string;
      schemeCode?: string;
      schemeName?: string;
      investmentType?: string;
      validationStatus: string;
      validationMessage?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      await db.insert(proposalAuditLog).values({
        proposalId,
        eventType,
        isin: data.isin || null,
        schemeCode: data.schemeCode || null,
        schemeName: data.schemeName || null,
        investmentType: data.investmentType || null,
        validationStatus: data.validationStatus,
        validationMessage: data.validationMessage || null,
        metadata: data.metadata || null,
      });
    } catch (error) {
      console.warn("[SchemeGovernance] Audit log failed:", error);
    }
  }

  async createProposalVersion(
    proposalId: string,
    payload: Record<string, any>,
    changeReason: string,
    changedSchemes: FundSubstitution[],
    createdBy?: string
  ): Promise<number> {
    try {
      const [latest] = await db
        .select({ maxVersion: sql<number>`COALESCE(MAX(${proposalVersions.versionNumber}), 0)` })
        .from(proposalVersions)
        .where(eq(proposalVersions.proposalId, proposalId));

      const nextVersion = (latest?.maxVersion || 0) + 1;

      await db.insert(proposalVersions).values({
        proposalId,
        versionNumber: nextVersion,
        payload,
        changeReason,
        changedSchemes: changedSchemes as any,
        createdBy: createdBy || "system",
      });

      return nextVersion;
    } catch (error) {
      console.error("[SchemeGovernance] Version creation failed:", error);
      return 0;
    }
  }

  async getRecentRenames(limit: number = 50): Promise<Array<{
    schemeCode: string;
    oldName: string;
    newName: string;
    isin: string | null;
    detectedAt: Date | null;
  }>> {
    return db
      .select({
        schemeCode: schemeRenameLog.schemeCode,
        oldName: schemeRenameLog.oldName,
        newName: schemeRenameLog.newName,
        isin: schemeRenameLog.isin,
        detectedAt: schemeRenameLog.detectedAt,
      })
      .from(schemeRenameLog)
      .orderBy(sql`${schemeRenameLog.detectedAt} DESC`)
      .limit(limit);
  }

  async getTransactionRules(filters?: {
    restricted?: boolean;
    subscriptionStatus?: string;
  }): Promise<SchemeTransactionRule[]> {
    let query = db.select().from(schemeTransactionRules);

    if (filters?.restricted) {
      return db
        .select()
        .from(schemeTransactionRules)
        .where(
          or(
            eq(schemeTransactionRules.lumpsumAllowed, false),
            eq(schemeTransactionRules.sipAllowed, false),
            eq(schemeTransactionRules.subscriptionStatus, "CLOSED"),
            eq(schemeTransactionRules.subscriptionStatus, "RESTRICTED")
          )
        );
    }

    if (filters?.subscriptionStatus) {
      return db
        .select()
        .from(schemeTransactionRules)
        .where(
          eq(schemeTransactionRules.subscriptionStatus, filters.subscriptionStatus)
        );
    }

    return query;
  }

  async getProposalAuditTrail(proposalId: string) {
    return db
      .select()
      .from(proposalAuditLog)
      .where(eq(proposalAuditLog.proposalId, proposalId))
      .orderBy(sql`${proposalAuditLog.createdAt} ASC`);
  }

  async getProposalVersions(proposalId: string) {
    return db
      .select()
      .from(proposalVersions)
      .where(eq(proposalVersions.proposalId, proposalId))
      .orderBy(sql`${proposalVersions.versionNumber} ASC`);
  }

  async resolveSchemeByIsin(isin: string): Promise<{
    found: boolean;
    schemeName?: string;
    schemeCode?: string;
    category?: string;
    fundHouse?: string;
  }> {
    try {
      const [fund] = await db
        .select({
          schemeName: mutualFunds.schemeName,
          schemeCode: mutualFunds.schemeCode,
          category: mutualFunds.category,
          fundHouse: mutualFunds.fundHouse,
        })
        .from(mutualFunds)
        .where(
          or(
            eq(mutualFunds.isin, isin),
            eq(mutualFunds.isinGrowth, isin),
            eq(mutualFunds.isinDividendPayout, isin)
          )
        )
        .limit(1);

      if (fund) {
        return {
          found: true,
          schemeName: fund.schemeName,
          schemeCode: fund.schemeCode,
          category: fund.category || undefined,
          fundHouse: fund.fundHouse || undefined,
        };
      }

      return { found: false };
    } catch (error) {
      console.error("[SchemeGovernance] ISIN resolve error:", error);
      return { found: false };
    }
  }
}

export const schemeGovernanceService = new SchemeGovernanceService();
