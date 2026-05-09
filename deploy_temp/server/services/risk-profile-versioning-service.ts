/**
 * Risk Profile Versioning Service (Task 8)
 * 
 * Stores version history of risk profiles with timestamps for audit trail
 * SEBI-compliant risk profile management
 */

interface RiskProfileVersion {
  versionId: string;
  userId: string;
  version: number;
  answers: {
    investmentObjective: string;
    investmentHorizon: string;
    riskTolerance: string;
    incomeLevel: string;
    tradingExperience: string;
  };
  computedProfile: {
    riskCategory: 'conservative' | 'moderate' | 'aggressive';
    riskScore: number;
    weightedScore: number;
  };
  metadata: {
    source: 'onboarding' | 'annual_refresh' | 'manual_update' | 'life_event';
    triggeredBy?: string;
    ipAddress?: string;
    deviceFingerprint?: string;
    changeReason?: string;
  };
  previousVersionId: string | null;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

interface RiskScoreWeights {
  investmentObjective: { [key: string]: number };
  investmentHorizon: { [key: string]: number };
  riskTolerance: { [key: string]: number };
  incomeLevel: { [key: string]: number };
  tradingExperience: { [key: string]: number };
}

class RiskProfileVersioningService {
  private versions: Map<string, RiskProfileVersion[]> = new Map();
  
  private readonly PROFILE_VALIDITY_DAYS = 365;
  
  private readonly weights: RiskScoreWeights = {
    investmentObjective: {
      'capital_preservation': 10,
      'income_generation': 30,
      'balanced_growth': 50,
      'aggressive_growth': 70,
      'speculation': 90
    },
    investmentHorizon: {
      'less_than_1_year': 20,
      '1_to_3_years': 40,
      '3_to_5_years': 60,
      '5_to_10_years': 80,
      'more_than_10_years': 95
    },
    riskTolerance: {
      'very_low': 10,
      'low': 30,
      'moderate': 50,
      'high': 70,
      'very_high': 90
    },
    incomeLevel: {
      'below_5_lakhs': 20,
      '5_to_10_lakhs': 40,
      '10_to_25_lakhs': 60,
      '25_to_50_lakhs': 75,
      'above_50_lakhs': 90
    },
    tradingExperience: {
      'none': 10,
      'beginner': 30,
      'intermediate': 50,
      'advanced': 70,
      'professional': 90
    }
  };

  /**
   * Create a new risk profile version
   */
  createVersion(
    userId: string,
    answers: RiskProfileVersion['answers'],
    metadata: Partial<RiskProfileVersion['metadata']> = {}
  ): RiskProfileVersion {
    const userVersions = this.versions.get(userId) || [];
    const previousVersion = userVersions.find(v => v.isActive);
    
    // Deactivate previous version
    if (previousVersion) {
      previousVersion.isActive = false;
    }

    const versionNumber = userVersions.length + 1;
    const computedProfile = this.computeRiskProfile(answers);
    const versionId = this.generateVersionId(userId, versionNumber);

    const newVersion: RiskProfileVersion = {
      versionId,
      userId,
      version: versionNumber,
      answers,
      computedProfile,
      metadata: {
        source: metadata.source || 'manual_update',
        triggeredBy: metadata.triggeredBy,
        ipAddress: metadata.ipAddress,
        deviceFingerprint: metadata.deviceFingerprint,
        changeReason: metadata.changeReason
      },
      previousVersionId: previousVersion?.versionId || null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.PROFILE_VALIDITY_DAYS * 24 * 60 * 60 * 1000),
      isActive: true
    };

    userVersions.push(newVersion);
    this.versions.set(userId, userVersions);

    console.log(`📊 [Risk Profile] Created version ${versionNumber} for user ${userId.substring(0, 8)}...: ${computedProfile.riskCategory} (score: ${computedProfile.riskScore})`);

    return newVersion;
  }

  /**
   * Compute weighted risk profile score (Task 7)
   */
  computeRiskProfile(answers: RiskProfileVersion['answers']): RiskProfileVersion['computedProfile'] {
    const objectiveWeight = 0.25;
    const horizonWeight = 0.20;
    const toleranceWeight = 0.30;
    const incomeWeight = 0.15;
    const experienceWeight = 0.10;

    const objectiveScore = this.weights.investmentObjective[answers.investmentObjective] || 50;
    const horizonScore = this.weights.investmentHorizon[answers.investmentHorizon] || 50;
    const toleranceScore = this.weights.riskTolerance[answers.riskTolerance] || 50;
    const incomeScore = this.weights.incomeLevel[answers.incomeLevel] || 50;
    const experienceScore = this.weights.tradingExperience[answers.tradingExperience] || 50;

    const weightedScore = 
      (objectiveScore * objectiveWeight) +
      (horizonScore * horizonWeight) +
      (toleranceScore * toleranceWeight) +
      (incomeScore * incomeWeight) +
      (experienceScore * experienceWeight);

    const riskScore = Math.round(weightedScore);
    
    let riskCategory: 'conservative' | 'moderate' | 'aggressive';
    if (riskScore <= 35) {
      riskCategory = 'conservative';
    } else if (riskScore <= 65) {
      riskCategory = 'moderate';
    } else {
      riskCategory = 'aggressive';
    }

    return {
      riskCategory,
      riskScore,
      weightedScore
    };
  }

  /**
   * Get active risk profile for user
   */
  getActiveProfile(userId: string): RiskProfileVersion | null {
    const userVersions = this.versions.get(userId) || [];
    return userVersions.find(v => v.isActive) || null;
  }

  /**
   * Get all versions for user (audit trail)
   */
  getAllVersions(userId: string): RiskProfileVersion[] {
    return this.versions.get(userId) || [];
  }

  /**
   * Get version by ID
   */
  getVersion(versionId: string): RiskProfileVersion | null {
    for (const userVersions of this.versions.values()) {
      const version = userVersions.find(v => v.versionId === versionId);
      if (version) return version;
    }
    return null;
  }

  /**
   * Check if profile needs refresh (annual requirement)
   */
  needsRefresh(userId: string): {
    needsRefresh: boolean;
    daysUntilExpiry: number | null;
    lastUpdated: Date | null;
  } {
    const activeProfile = this.getActiveProfile(userId);
    
    if (!activeProfile) {
      return { needsRefresh: true, daysUntilExpiry: null, lastUpdated: null };
    }

    const daysUntilExpiry = Math.ceil(
      (activeProfile.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    return {
      needsRefresh: daysUntilExpiry <= 30, // Prompt 30 days before expiry
      daysUntilExpiry,
      lastUpdated: activeProfile.createdAt
    };
  }

  /**
   * Compare two versions for changes
   */
  compareVersions(versionId1: string, versionId2: string): {
    hasChanges: boolean;
    changes: string[];
    riskCategoryChanged: boolean;
    scoreDifference: number;
  } {
    const v1 = this.getVersion(versionId1);
    const v2 = this.getVersion(versionId2);

    if (!v1 || !v2) {
      return { hasChanges: false, changes: [], riskCategoryChanged: false, scoreDifference: 0 };
    }

    const changes: string[] = [];

    if (v1.answers.investmentObjective !== v2.answers.investmentObjective) {
      changes.push(`Investment objective: ${v1.answers.investmentObjective} → ${v2.answers.investmentObjective}`);
    }
    if (v1.answers.investmentHorizon !== v2.answers.investmentHorizon) {
      changes.push(`Investment horizon: ${v1.answers.investmentHorizon} → ${v2.answers.investmentHorizon}`);
    }
    if (v1.answers.riskTolerance !== v2.answers.riskTolerance) {
      changes.push(`Risk tolerance: ${v1.answers.riskTolerance} → ${v2.answers.riskTolerance}`);
    }
    if (v1.answers.incomeLevel !== v2.answers.incomeLevel) {
      changes.push(`Income level: ${v1.answers.incomeLevel} → ${v2.answers.incomeLevel}`);
    }
    if (v1.answers.tradingExperience !== v2.answers.tradingExperience) {
      changes.push(`Trading experience: ${v1.answers.tradingExperience} → ${v2.answers.tradingExperience}`);
    }

    return {
      hasChanges: changes.length > 0,
      changes,
      riskCategoryChanged: v1.computedProfile.riskCategory !== v2.computedProfile.riskCategory,
      scoreDifference: v2.computedProfile.riskScore - v1.computedProfile.riskScore
    };
  }

  /**
   * Export audit trail for compliance
   */
  exportAuditTrail(userId: string): {
    userId: string;
    totalVersions: number;
    activeProfile: RiskProfileVersion | null;
    versionHistory: Array<{
      version: number;
      riskCategory: string;
      riskScore: number;
      createdAt: Date;
      source: string;
    }>;
  } {
    const versions = this.getAllVersions(userId);
    
    return {
      userId,
      totalVersions: versions.length,
      activeProfile: this.getActiveProfile(userId),
      versionHistory: versions.map(v => ({
        version: v.version,
        riskCategory: v.computedProfile.riskCategory,
        riskScore: v.computedProfile.riskScore,
        createdAt: v.createdAt,
        source: v.metadata.source
      }))
    };
  }

  private generateVersionId(userId: string, version: number): string {
    const timestamp = Date.now().toString(36);
    return `RP-${userId.substring(0, 8)}-V${version}-${timestamp}`;
  }
}

export const riskProfileVersioningService = new RiskProfileVersioningService();
export type { RiskProfileVersion };
