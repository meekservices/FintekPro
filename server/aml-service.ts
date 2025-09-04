import axios from 'axios';
import { createHash } from 'crypto';

// AML Service Configuration
interface AMLConfig {
  sanctionScannerApiKey?: string;
  complyCubeApiKey?: string;
  sumsubApiKey?: string;
  shuftiProApiKey?: string;
  environment: 'production' | 'sandbox';
}

// Risk Assessment Types
export interface RiskProfile {
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  lastUpdated: Date;
  nextReviewDate: Date;
}

export interface RiskFactor {
  type: 'sanctions' | 'pep' | 'adverse_media' | 'high_risk_country' | 'suspicious_activity';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  dateDetected: Date;
}

// AML Screening Results
export interface AMLScreeningResult {
  userId: string;
  screeningId: string;
  status: 'clear' | 'flagged' | 'under_review' | 'blocked';
  riskProfile: RiskProfile;
  sanctionsMatch: SanctionsMatch[];
  pepMatch: PEPMatch[];
  adverseMedia: AdverseMediaMatch[];
  completedAt: Date;
}

export interface SanctionsMatch {
  listName: string;
  matchType: 'exact' | 'partial' | 'fuzzy';
  confidence: number;
  sanctionedEntity: {
    name: string;
    aliases: string[];
    dateOfBirth?: string;
    nationality?: string;
    sanctionType: string;
    listingDate: Date;
    authority: string;
  };
}

export interface PEPMatch {
  name: string;
  position: string;
  country: string;
  category: 'head_of_state' | 'government' | 'judicial' | 'military' | 'party_official' | 'international_org';
  riskLevel: 'low' | 'medium' | 'high';
  relationshipType: 'direct' | 'family' | 'close_associate';
  lastVerified: Date;
}

export interface AdverseMediaMatch {
  headline: string;
  summary: string;
  source: string;
  publishDate: Date;
  severity: 'low' | 'medium' | 'high';
  categories: string[];
  url?: string;
}

// Transaction Monitoring
export interface TransactionAlert {
  alertId: string;
  userId: string;
  transactionId: string;
  alertType: 'unusual_volume' | 'unusual_pattern' | 'high_risk_country' | 'structuring' | 'velocity';
  riskScore: number;
  description: string;
  status: 'open' | 'investigating' | 'closed' | 'false_positive';
  createdAt: Date;
  investigatedBy?: string;
  resolution?: string;
}

class AMLService {
  private config: AMLConfig;

  constructor(config: AMLConfig) {
    this.config = config;
  }

  // Comprehensive KYC/AML Screening
  async performFullScreening(userData: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    nationality?: string;
    countryOfResidence?: string;
    passportNumber?: string;
    userId: string;
  }): Promise<AMLScreeningResult> {
    const screeningId = this.generateScreeningId(userData.userId);
    
    try {
      // Parallel screening across multiple providers
      const [sanctionsResult, pepResult, adverseMediaResult] = await Promise.all([
        this.screenSanctions(userData),
        this.screenPEP(userData),
        this.screenAdverseMedia(userData)
      ]);

      const riskProfile = this.calculateRiskProfile([
        ...sanctionsResult,
        ...pepResult,
        ...adverseMediaResult
      ]);

      const status = this.determineOverallStatus(riskProfile);

      return {
        userId: userData.userId,
        screeningId,
        status,
        riskProfile,
        sanctionsMatch: sanctionsResult,
        pepMatch: pepResult,
        adverseMedia: adverseMediaResult,
        completedAt: new Date()
      };

    } catch (error) {
      console.error('AML Screening Error:', error);
      throw new Error('Failed to complete AML screening');
    }
  }

  // Sanctions List Screening
  private async screenSanctions(userData: any): Promise<SanctionsMatch[]> {
    const searchQuery = `${userData.firstName} ${userData.lastName}`;
    
    // Mock implementation - replace with actual API calls
    const sanctionedEntities = await this.searchSanctionsList(searchQuery, userData);
    
    return sanctionedEntities.map((entity: any) => ({
      listName: entity.listName,
      matchType: entity.matchType,
      confidence: entity.confidence,
      sanctionedEntity: {
        name: entity.name,
        aliases: entity.aliases || [],
        dateOfBirth: entity.dateOfBirth,
        nationality: entity.nationality,
        sanctionType: entity.sanctionType,
        listingDate: new Date(entity.listingDate),
        authority: entity.authority
      }
    }));
  }

  // PEP Screening
  private async screenPEP(userData: any): Promise<PEPMatch[]> {
    // Mock implementation - replace with actual PEP database API
    const pepMatches = await this.searchPEPDatabase(userData);
    
    return pepMatches.map((match: any) => ({
      name: match.name,
      position: match.position,
      country: match.country,
      category: match.category,
      riskLevel: match.riskLevel,
      relationshipType: match.relationshipType || 'direct',
      lastVerified: new Date(match.lastVerified)
    }));
  }

  // Adverse Media Screening
  private async screenAdverseMedia(userData: any): Promise<AdverseMediaMatch[]> {
    const searchQuery = `"${userData.firstName} ${userData.lastName}" fraud money laundering terrorism`;
    
    // Mock implementation - replace with media monitoring API
    const mediaMatches = await this.searchAdverseMedia(searchQuery);
    
    return mediaMatches.map((match: any) => ({
      headline: match.headline,
      summary: match.summary,
      source: match.source,
      publishDate: new Date(match.publishDate),
      severity: match.severity,
      categories: match.categories,
      url: match.url
    }));
  }

  // Mock API Implementations (Replace with actual API calls)
  private async searchSanctionsList(query: string, userData: any): Promise<any[]> {
    // Simulated sanctions screening
    // In production, integrate with:
    // - OFAC SDN List
    // - EU Sanctions List
    // - UN Sanctions List
    // - UK HM Treasury List
    
    const suspiciousNames = ['ivan petrov', 'aleksandr volkov', 'dmitri sokolov'];
    const fullName = `${userData.firstName} ${userData.lastName}`.toLowerCase();
    
    if (suspiciousNames.some(name => fullName.includes(name))) {
      return [{
        listName: 'OFAC SDN List',
        matchType: 'partial',
        confidence: 85,
        name: fullName,
        aliases: [],
        sanctionType: 'Financial Sanctions',
        listingDate: '2023-01-15',
        authority: 'US Treasury OFAC'
      }];
    }
    
    return [];
  }

  private async searchPEPDatabase(userData: any): Promise<any[]> {
    // Simulated PEP screening
    // In production, integrate with commercial PEP databases
    
    const pepNames = ['rajesh kumar', 'priya sharma', 'amit singh'];
    const fullName = `${userData.firstName} ${userData.lastName}`.toLowerCase();
    
    if (pepNames.some(name => fullName.includes(name))) {
      return [{
        name: fullName,
        position: 'Government Official',
        country: userData.countryOfResidence || 'Unknown',
        category: 'government',
        riskLevel: 'medium',
        relationshipType: 'direct',
        lastVerified: new Date().toISOString()
      }];
    }
    
    return [];
  }

  private async searchAdverseMedia(query: string): Promise<any[]> {
    // Simulated adverse media search
    // In production, integrate with news aggregation APIs
    
    return []; // No adverse media for demo
  }

  // Risk Calculation
  private calculateRiskProfile(riskFactors: any[]): RiskProfile {
    let baseRiskScore = 10; // Base risk score
    const factors: RiskFactor[] = [];
    
    // Add sanctions risk
    const sanctionsFactors = riskFactors.filter(f => f.listName);
    sanctionsFactors.forEach(sanction => {
      baseRiskScore += 40;
      factors.push({
        type: 'sanctions',
        description: `Match found on ${sanction.listName}`,
        severity: 'high',
        source: sanction.listName,
        dateDetected: new Date()
      });
    });
    
    // Add PEP risk
    const pepFactors = riskFactors.filter(f => f.position);
    pepFactors.forEach(pep => {
      baseRiskScore += 25;
      factors.push({
        type: 'pep',
        description: `PEP identified: ${pep.position} in ${pep.country}`,
        severity: pep.riskLevel === 'high' ? 'high' : 'medium',
        source: 'PEP Database',
        dateDetected: new Date()
      });
    });
    
    // Add adverse media risk
    const mediaFactors = riskFactors.filter(f => f.headline);
    mediaFactors.forEach(media => {
      baseRiskScore += media.severity === 'high' ? 20 : 10;
      factors.push({
        type: 'adverse_media',
        description: media.headline,
        severity: media.severity,
        source: media.source,
        dateDetected: new Date()
      });
    });
    
    const riskScore = Math.min(baseRiskScore, 100);
    const riskLevel = this.getRiskLevel(riskScore);
    
    return {
      riskScore,
      riskLevel,
      factors,
      lastUpdated: new Date(),
      nextReviewDate: new Date(Date.now() + (riskLevel === 'high' ? 90 : 365) * 24 * 60 * 60 * 1000)
    };
  }

  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  private determineOverallStatus(riskProfile: RiskProfile): 'clear' | 'flagged' | 'under_review' | 'blocked' {
    if (riskProfile.riskLevel === 'critical') return 'blocked';
    if (riskProfile.riskLevel === 'high') return 'under_review';
    if (riskProfile.riskLevel === 'medium') return 'flagged';
    return 'clear';
  }

  // Transaction Monitoring
  async monitorTransaction(transaction: {
    userId: string;
    amount: number;
    currency: string;
    fromCountry: string;
    toCountry: string;
    transactionType: string;
  }): Promise<TransactionAlert[]> {
    const alerts: TransactionAlert[] = [];
    
    // High amount threshold
    if (transaction.amount > 10000) {
      alerts.push({
        alertId: this.generateAlertId(),
        userId: transaction.userId,
        transactionId: `txn-${Date.now()}`,
        alertType: 'unusual_volume',
        riskScore: 70,
        description: `Large transaction amount: ${transaction.currency} ${transaction.amount}`,
        status: 'open',
        createdAt: new Date()
      });
    }
    
    // High-risk countries
    const highRiskCountries = ['AF', 'IR', 'KP', 'SY'];
    if (highRiskCountries.includes(transaction.fromCountry) || 
        highRiskCountries.includes(transaction.toCountry)) {
      alerts.push({
        alertId: this.generateAlertId(),
        userId: transaction.userId,
        transactionId: `txn-${Date.now()}`,
        alertType: 'high_risk_country',
        riskScore: 80,
        description: 'Transaction involving high-risk jurisdiction',
        status: 'open',
        createdAt: new Date()
      });
    }
    
    return alerts;
  }

  // Ongoing Monitoring
  async performPeriodicReview(userId: string): Promise<AMLScreeningResult> {
    // Get user data and perform fresh screening
    // This would typically be called by a scheduled job
    const userData = await this.getUserData(userId);
    return this.performFullScreening(userData);
  }

  private async getUserData(userId: string): Promise<any> {
    // Mock user data retrieval
    return {
      firstName: 'Test',
      lastName: 'User',
      userId,
      nationality: 'IN',
      countryOfResidence: 'IN'
    };
  }

  // Utility methods
  private generateScreeningId(userId: string): string {
    return `scr_${createHash('md5').update(`${userId}_${Date.now()}`).digest('hex').substring(0, 12)}`;
  }

  private generateAlertId(): string {
    return `alt_${createHash('md5').update(`alert_${Date.now()}`).digest('hex').substring(0, 12)}`;
  }

  // Compliance Reporting
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<{
    totalScreenings: number;
    flaggedCases: number;
    blockedAccounts: number;
    falsePositiveRate: number;
    averageProcessingTime: number;
    riskDistribution: { [key: string]: number };
  }> {
    // Mock compliance report
    return {
      totalScreenings: 1250,
      flaggedCases: 45,
      blockedAccounts: 3,
      falsePositiveRate: 0.12,
      averageProcessingTime: 2.3, // seconds
      riskDistribution: {
        low: 1180,
        medium: 57,
        high: 10,
        critical: 3
      }
    };
  }

  // Enhanced Due Diligence (EDD)
  async triggerEDD(userId: string, reason: string): Promise<{
    eddId: string;
    status: 'initiated' | 'in_progress' | 'completed' | 'escalated';
    requiredDocuments: string[];
    assignedAnalyst?: string;
    dueDate: Date;
  }> {
    const eddId = `edd_${createHash('md5').update(`${userId}_${Date.now()}`).digest('hex').substring(0, 12)}`;
    
    return {
      eddId,
      status: 'initiated',
      requiredDocuments: [
        'Source of Wealth Statement',
        'Bank Statements (6 months)',
        'Business Registration Certificate',
        'Tax Returns',
        'Proof of Income'
      ],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
    };
  }
}

export default AMLService;