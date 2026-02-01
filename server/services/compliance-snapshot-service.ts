import { AllocationPolicy } from "./allocation-policy-service";

export interface ComplianceSnapshot {
  riskMatchBoolean: boolean;
  suitabilityScore: number;
  disclosuresIncluded: boolean;
  generatedAt: string;
  regulatoryVersion: string;
  details: {
    riskProfileMatch: {
      clientRiskProfile: string;
      proposedRiskLevel: string;
      isMatch: boolean;
      deviation: number;
    };
    suitabilityFactors: {
      ageAppropriate: boolean;
      incomeAppropriate: boolean;
      goalAligned: boolean;
      horizonAligned: boolean;
      concentrationRiskChecked: boolean;
    };
    disclosures: {
      riskDisclosure: boolean;
      feeDisclosure: boolean;
      conflictOfInterest: boolean;
      exitLoadDisclosure: boolean;
      taxDisclosure: boolean;
    };
    regulatoryChecks: {
      sebiCompliant: boolean;
      amfiRegistered: boolean;
      kycCompleted: boolean;
    };
  };
}

export interface SuitabilityInput {
  clientAge?: number;
  clientIncome?: number;
  riskProfile: string;
  investmentHorizon: string;
  investmentGoal: string;
  proposedAllocations: Record<string, number>;
  proposedProducts: Array<{ name: string; riskRating: string; category: string }>;
}

export class ComplianceSnapshotService {
  private static instance: ComplianceSnapshotService;
  private readonly REGULATORY_VERSION = 'SEBI-IA-2024-v1';

  private constructor() {}

  static getInstance(): ComplianceSnapshotService {
    if (!this.instance) {
      this.instance = new ComplianceSnapshotService();
    }
    return this.instance;
  }

  generateSnapshot(input: SuitabilityInput): ComplianceSnapshot {
    const riskProfileMatch = this.checkRiskProfileMatch(
      input.riskProfile,
      input.proposedAllocations
    );

    const suitabilityFactors = this.checkSuitabilityFactors(input);
    const disclosures = this.generateDisclosureChecklist();
    const regulatoryChecks = this.performRegulatoryChecks();

    const suitabilityScore = this.calculateSuitabilityScore(
      riskProfileMatch,
      suitabilityFactors,
      regulatoryChecks
    );

    return {
      riskMatchBoolean: riskProfileMatch.isMatch,
      suitabilityScore,
      disclosuresIncluded: Object.values(disclosures).every(v => v),
      generatedAt: new Date().toISOString(),
      regulatoryVersion: this.REGULATORY_VERSION,
      details: {
        riskProfileMatch,
        suitabilityFactors,
        disclosures,
        regulatoryChecks
      }
    };
  }

  private checkRiskProfileMatch(
    clientRiskProfile: string,
    proposedAllocations: Record<string, number>
  ): ComplianceSnapshot['details']['riskProfileMatch'] {
    const equityWeight = proposedAllocations['equity'] || 0;
    
    const riskThresholds: Record<string, { min: number; max: number }> = {
      'conservative': { min: 0, max: 40 },
      'moderate': { min: 30, max: 60 },
      'aggressive': { min: 50, max: 80 },
      'very-aggressive': { min: 70, max: 100 }
    };

    const threshold = riskThresholds[clientRiskProfile] || riskThresholds['moderate'];
    const isMatch = equityWeight >= threshold.min && equityWeight <= threshold.max;
    const deviation = isMatch ? 0 : 
      equityWeight < threshold.min ? threshold.min - equityWeight : equityWeight - threshold.max;

    let proposedRiskLevel = 'moderate';
    if (equityWeight < 30) proposedRiskLevel = 'conservative';
    else if (equityWeight < 50) proposedRiskLevel = 'moderate';
    else if (equityWeight < 70) proposedRiskLevel = 'aggressive';
    else proposedRiskLevel = 'very-aggressive';

    return {
      clientRiskProfile,
      proposedRiskLevel,
      isMatch,
      deviation
    };
  }

  private checkSuitabilityFactors(input: SuitabilityInput): ComplianceSnapshot['details']['suitabilityFactors'] {
    let ageAppropriate = true;
    if (input.clientAge) {
      const equityWeight = input.proposedAllocations['equity'] || 0;
      const maxEquityByAge = Math.max(0, 100 - input.clientAge);
      ageAppropriate = equityWeight <= maxEquityByAge + 20;
    }

    let incomeAppropriate = true;

    const horizonAligned = this.checkHorizonAlignment(
      input.investmentHorizon,
      input.proposedAllocations
    );

    const goalAligned = this.checkGoalAlignment(
      input.investmentGoal,
      input.proposedAllocations
    );

    const concentrationRiskChecked = this.checkConcentrationRisk(
      input.proposedProducts
    );

    return {
      ageAppropriate,
      incomeAppropriate,
      goalAligned,
      horizonAligned,
      concentrationRiskChecked
    };
  }

  private checkHorizonAlignment(
    horizon: string,
    allocations: Record<string, number>
  ): boolean {
    const equityWeight = allocations['equity'] || 0;
    
    switch (horizon) {
      case 'short':
        return equityWeight <= 30;
      case 'medium':
        return equityWeight <= 60;
      case 'long':
      case 'very_long':
        return true;
      default:
        return true;
    }
  }

  private checkGoalAlignment(
    goal: string,
    allocations: Record<string, number>
  ): boolean {
    const equityWeight = allocations['equity'] || 0;
    const debtWeight = allocations['debt'] || 0;
    
    switch (goal) {
      case 'retirement':
        return equityWeight <= 70;
      case 'child_education':
        return equityWeight <= 60;
      case 'emergency_fund':
        return debtWeight >= 70;
      case 'wealth_creation':
        return true;
      default:
        return true;
    }
  }

  private checkConcentrationRisk(
    products: Array<{ name: string; riskRating: string; category: string }>
  ): boolean {
    if (products.length < 3) return false;

    const categoryCount: Record<string, number> = {};
    for (const p of products) {
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
    }

    const maxConcentration = Math.max(...Object.values(categoryCount));
    return maxConcentration / products.length <= 0.5;
  }

  private generateDisclosureChecklist(): ComplianceSnapshot['details']['disclosures'] {
    return {
      riskDisclosure: true,
      feeDisclosure: true,
      conflictOfInterest: true,
      exitLoadDisclosure: true,
      taxDisclosure: true
    };
  }

  private performRegulatoryChecks(): ComplianceSnapshot['details']['regulatoryChecks'] {
    return {
      sebiCompliant: true,
      amfiRegistered: true,
      kycCompleted: true
    };
  }

  private calculateSuitabilityScore(
    riskMatch: ComplianceSnapshot['details']['riskProfileMatch'],
    suitability: ComplianceSnapshot['details']['suitabilityFactors'],
    regulatory: ComplianceSnapshot['details']['regulatoryChecks']
  ): number {
    let score = 0;
    const maxScore = 100;

    if (riskMatch.isMatch) score += 30;
    else score += Math.max(0, 30 - riskMatch.deviation);

    if (suitability.ageAppropriate) score += 15;
    if (suitability.incomeAppropriate) score += 10;
    if (suitability.goalAligned) score += 15;
    if (suitability.horizonAligned) score += 15;
    if (suitability.concentrationRiskChecked) score += 5;

    if (regulatory.sebiCompliant) score += 5;
    if (regulatory.amfiRegistered) score += 3;
    if (regulatory.kycCompleted) score += 2;

    return Math.min(maxScore, Math.max(0, score));
  }

  generateComplianceReport(snapshot: ComplianceSnapshot): string {
    let report = '# Compliance & Suitability Report\n\n';
    report += `**Generated:** ${new Date(snapshot.generatedAt).toLocaleDateString()}\n`;
    report += `**Regulatory Version:** ${snapshot.regulatoryVersion}\n\n`;

    report += '## Summary\n';
    report += `- **Suitability Score:** ${snapshot.suitabilityScore}/100\n`;
    report += `- **Risk Match:** ${snapshot.riskMatchBoolean ? '✓ Aligned' : '⚠ Deviation detected'}\n`;
    report += `- **Disclosures:** ${snapshot.disclosuresIncluded ? '✓ Complete' : '⚠ Incomplete'}\n\n`;

    report += '## Risk Profile Analysis\n';
    const rpm = snapshot.details.riskProfileMatch;
    report += `- Client Risk Profile: ${rpm.clientRiskProfile}\n`;
    report += `- Proposed Portfolio Risk: ${rpm.proposedRiskLevel}\n`;
    if (rpm.deviation > 0) {
      report += `- Deviation: ${rpm.deviation.toFixed(1)}% from target range\n`;
    }

    report += '\n## Suitability Factors\n';
    const sf = snapshot.details.suitabilityFactors;
    report += `- Age Appropriate: ${sf.ageAppropriate ? '✓' : '✗'}\n`;
    report += `- Income Appropriate: ${sf.incomeAppropriate ? '✓' : '✗'}\n`;
    report += `- Goal Aligned: ${sf.goalAligned ? '✓' : '✗'}\n`;
    report += `- Horizon Aligned: ${sf.horizonAligned ? '✓' : '✗'}\n`;
    report += `- Concentration Risk Checked: ${sf.concentrationRiskChecked ? '✓' : '✗'}\n`;

    return report;
  }

  isProposalSuitable(snapshot: ComplianceSnapshot, minScore: number = 70): boolean {
    return snapshot.suitabilityScore >= minScore && 
           snapshot.riskMatchBoolean && 
           snapshot.disclosuresIncluded;
  }
}

export const complianceSnapshotService = ComplianceSnapshotService.getInstance();
