/**
 * Accredited Investor Service (Task 5)
 * 
 * SEBI-compliant accredited investor management with:
 * - 12-month expiry tracking
 * - Auto-lock of advanced products on expiry
 * - Renewal reminders
 */

interface AccreditedInvestor {
  userId: string;
  accreditationType: 'income' | 'networth' | 'professional';
  accreditedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  documents: {
    type: 'itr' | 'ca_certificate' | 'nism_certificate' | 'cfa_certificate';
    documentId: string;
    uploadedAt: Date;
    verifiedAt?: Date;
    verifiedBy?: string;
  }[];
  incomeDetails?: {
    financialYear1: string;
    income1: number;
    financialYear2: string;
    income2: number;
  };
  networthDetails?: {
    certificationDate: Date;
    networth: number;
    caName: string;
    caRegistrationNumber: string;
  };
  professionalDetails?: {
    qualification: string;
    certificateNumber: string;
    annualIncome: number;
  };
  auditTrail: {
    action: string;
    timestamp: Date;
    performedBy: string;
    details?: string;
  }[];
}

interface ProductAccessResult {
  hasAccess: boolean;
  reason?: string;
  daysUntilExpiry?: number;
  renewalRequired: boolean;
}

class AccreditedInvestorService {
  private investors: Map<string, AccreditedInvestor> = new Map();
  
  private readonly EXPIRY_MONTHS = 12;
  private readonly RENEWAL_WARNING_DAYS = 30;

  private readonly ADVANCED_PRODUCTS = [
    'aif',
    'pms',
    'fno',
    'structured_products',
    'offshore_funds',
    'alternative_investments',
    'private_equity',
    'venture_capital'
  ];

  /**
   * Grant accredited investor status
   */
  grantAccreditation(
    userId: string,
    type: AccreditedInvestor['accreditationType'],
    documents: AccreditedInvestor['documents'],
    details: {
      incomeDetails?: AccreditedInvestor['incomeDetails'];
      networthDetails?: AccreditedInvestor['networthDetails'];
      professionalDetails?: AccreditedInvestor['professionalDetails'];
    },
    grantedBy: string
  ): AccreditedInvestor {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + this.EXPIRY_MONTHS);

    const investor: AccreditedInvestor = {
      userId,
      accreditationType: type,
      accreditedAt: now,
      expiresAt,
      isActive: true,
      documents,
      incomeDetails: details.incomeDetails,
      networthDetails: details.networthDetails,
      professionalDetails: details.professionalDetails,
      auditTrail: [{
        action: 'accreditation_granted',
        timestamp: now,
        performedBy: grantedBy,
        details: `Accreditation type: ${type}`
      }]
    };

    this.investors.set(userId, investor);
    console.log(`✅ [Accredited Investor] Granted to user ${userId.substring(0, 8)}..., expires: ${expiresAt.toISOString()}`);

    return investor;
  }

  /**
   * Check if user has valid accreditation
   */
  isAccredited(userId: string): boolean {
    const investor = this.investors.get(userId);
    if (!investor) return false;
    
    return investor.isActive && new Date() < investor.expiresAt;
  }

  /**
   * Get accreditation status
   */
  getStatus(userId: string): {
    isAccredited: boolean;
    accreditationType?: string;
    expiresAt?: Date;
    daysUntilExpiry?: number;
    needsRenewal: boolean;
    isExpired: boolean;
  } {
    const investor = this.investors.get(userId);
    
    if (!investor) {
      return { isAccredited: false, needsRenewal: false, isExpired: false };
    }

    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (investor.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    const isExpired = now >= investor.expiresAt;

    return {
      isAccredited: investor.isActive && !isExpired,
      accreditationType: investor.accreditationType,
      expiresAt: investor.expiresAt,
      daysUntilExpiry: isExpired ? 0 : daysUntilExpiry,
      needsRenewal: daysUntilExpiry <= this.RENEWAL_WARNING_DAYS,
      isExpired
    };
  }

  /**
   * Check product access (Task 5 - Auto-lock)
   */
  checkProductAccess(userId: string, productType: string): ProductAccessResult {
    const isAdvancedProduct = this.ADVANCED_PRODUCTS.includes(productType.toLowerCase());
    
    if (!isAdvancedProduct) {
      return { hasAccess: true, renewalRequired: false };
    }

    const status = this.getStatus(userId);

    if (!status.isAccredited) {
      if (status.isExpired) {
        return {
          hasAccess: false,
          reason: 'Your accredited investor status has expired. Please renew to access this product.',
          renewalRequired: true
        };
      }
      return {
        hasAccess: false,
        reason: 'This product requires accredited investor status. Please complete accreditation to proceed.',
        renewalRequired: false
      };
    }

    return {
      hasAccess: true,
      daysUntilExpiry: status.daysUntilExpiry,
      renewalRequired: status.needsRenewal
    };
  }

  /**
   * Expire accreditation (called by cron or on check)
   */
  expireAccreditation(userId: string, reason: string = 'Accreditation period expired'): void {
    const investor = this.investors.get(userId);
    if (!investor) return;

    investor.isActive = false;
    investor.auditTrail.push({
      action: 'accreditation_expired',
      timestamp: new Date(),
      performedBy: 'system',
      details: reason
    });

    this.investors.set(userId, investor);
    console.log(`⚠️ [Accredited Investor] Expired for user ${userId.substring(0, 8)}...: ${reason}`);
  }

  /**
   * Renew accreditation
   */
  renewAccreditation(
    userId: string,
    documents: AccreditedInvestor['documents'],
    renewedBy: string
  ): AccreditedInvestor | null {
    const investor = this.investors.get(userId);
    if (!investor) return null;

    const now = new Date();
    const newExpiresAt = new Date(now);
    newExpiresAt.setMonth(newExpiresAt.getMonth() + this.EXPIRY_MONTHS);

    investor.expiresAt = newExpiresAt;
    investor.isActive = true;
    investor.documents = [...investor.documents, ...documents];
    investor.auditTrail.push({
      action: 'accreditation_renewed',
      timestamp: now,
      performedBy: renewedBy,
      details: `Renewed until ${newExpiresAt.toISOString()}`
    });

    this.investors.set(userId, investor);
    console.log(`🔄 [Accredited Investor] Renewed for user ${userId.substring(0, 8)}..., new expiry: ${newExpiresAt.toISOString()}`);

    return investor;
  }

  /**
   * Get users needing renewal (for cron job - Task 12)
   */
  getUsersNeedingRenewal(): Array<{
    userId: string;
    daysUntilExpiry: number;
    accreditationType: string;
    expiresAt: Date;
  }> {
    const needingRenewal: Array<{
      userId: string;
      daysUntilExpiry: number;
      accreditationType: string;
      expiresAt: Date;
    }> = [];

    const now = new Date();

    for (const [userId, investor] of this.investors.entries()) {
      if (!investor.isActive) continue;

      const daysUntilExpiry = Math.ceil(
        (investor.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (daysUntilExpiry <= this.RENEWAL_WARNING_DAYS && daysUntilExpiry > 0) {
        needingRenewal.push({
          userId,
          daysUntilExpiry,
          accreditationType: investor.accreditationType,
          expiresAt: investor.expiresAt
        });
      }
    }

    return needingRenewal;
  }

  /**
   * Get expired accreditations (for cleanup)
   */
  getExpiredAccreditations(): string[] {
    const expired: string[] = [];
    const now = new Date();

    for (const [userId, investor] of this.investors.entries()) {
      if (investor.isActive && now >= investor.expiresAt) {
        expired.push(userId);
      }
    }

    return expired;
  }

  /**
   * Process expired accreditations (cron job)
   */
  processExpiredAccreditations(): number {
    const expired = this.getExpiredAccreditations();
    
    for (const userId of expired) {
      this.expireAccreditation(userId, 'Automatic expiry after 12 months');
    }

    if (expired.length > 0) {
      console.log(`⏰ [Accredited Investor] Processed ${expired.length} expired accreditations`);
    }

    return expired.length;
  }

  /**
   * Get full investor details for audit
   */
  getInvestorDetails(userId: string): AccreditedInvestor | null {
    return this.investors.get(userId) || null;
  }

  /**
   * Export compliance report
   */
  exportComplianceReport(): {
    totalAccredited: number;
    activeAccredited: number;
    expiredAccredited: number;
    byType: { [key: string]: number };
    needingRenewal: number;
  } {
    let active = 0;
    let expired = 0;
    const byType: { [key: string]: number } = {};
    const now = new Date();

    for (const investor of this.investors.values()) {
      if (investor.isActive && now < investor.expiresAt) {
        active++;
        byType[investor.accreditationType] = (byType[investor.accreditationType] || 0) + 1;
      } else {
        expired++;
      }
    }

    return {
      totalAccredited: this.investors.size,
      activeAccredited: active,
      expiredAccredited: expired,
      byType,
      needingRenewal: this.getUsersNeedingRenewal().length
    };
  }
}

export const accreditedInvestorService = new AccreditedInvestorService();
export type { AccreditedInvestor, ProductAccessResult };
