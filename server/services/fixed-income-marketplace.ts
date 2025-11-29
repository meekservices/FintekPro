import { db } from '../db';
import { 
  governmentSecurities, 
  corporateBonds, 
  bondOrders, 
  bondHoldings,
  ncdPublicIssues,
  bondCouponPayments,
  bondSuitabilityChecks,
  fixedIncomeAuditLog,
  bondWatchlist,
  sgbPrimaryIssues,
  rbiRetailDirectAccounts,
  bondNcdApplications,
  users
} from '@shared/schema';
import { eq, and, gte, lte, desc, asc, sql, or, like, ilike } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const SEVEN_YEARS_MS = 7 * 365 * 24 * 60 * 60 * 1000;

interface BondSearchFilters {
  bondType?: 'government' | 'corporate' | 'all';
  securityType?: string;
  creditRating?: string;
  minYield?: number;
  maxYield?: number;
  minTenor?: number;
  maxTenor?: number;
  issuer?: string;
  tradingStatus?: string;
  taxStatus?: string;
}

interface OrderPlacementRequest {
  userId: string;
  bondId: string;
  bondType: 'government' | 'corporate';
  isin: string;
  bondName: string;
  orderType: 'buy' | 'sell';
  quantity: number;
  faceValue: number;
  orderPrice: number;
  dematAccountNumber?: string;
}

class FixedIncomeMarketplaceService {
  
  async getMarketplaceBonds(filters: BondSearchFilters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    let governmentBonds: any[] = [];
    let corpBonds: any[] = [];
    
    if (filters.bondType === 'all' || filters.bondType === 'government' || !filters.bondType) {
      const govQuery = db.select().from(governmentSecurities);
      
      const conditions: any[] = [eq(governmentSecurities.tradingStatus, 'active')];
      
      if (filters.securityType) {
        conditions.push(eq(governmentSecurities.securityType, filters.securityType));
      }
      if (filters.minYield) {
        conditions.push(gte(governmentSecurities.yieldToMaturity, filters.minYield.toString()));
      }
      if (filters.maxYield) {
        conditions.push(lte(governmentSecurities.yieldToMaturity, filters.maxYield.toString()));
      }
      if (filters.taxStatus) {
        conditions.push(eq(governmentSecurities.taxStatus, filters.taxStatus));
      }
      
      governmentBonds = await db.select()
        .from(governmentSecurities)
        .where(and(...conditions))
        .orderBy(desc(governmentSecurities.yieldToMaturity))
        .limit(filters.bondType === 'government' ? limit : Math.floor(limit / 2))
        .offset(filters.bondType === 'government' ? offset : 0);
    }
    
    if (filters.bondType === 'all' || filters.bondType === 'corporate' || !filters.bondType) {
      const conditions: any[] = [eq(corporateBonds.tradingStatus, 'active')];
      
      if (filters.creditRating) {
        conditions.push(eq(corporateBonds.creditRating, filters.creditRating));
      }
      if (filters.minYield) {
        conditions.push(gte(corporateBonds.yieldToMaturity, filters.minYield.toString()));
      }
      if (filters.maxYield) {
        conditions.push(lte(corporateBonds.yieldToMaturity, filters.maxYield.toString()));
      }
      if (filters.issuer) {
        conditions.push(ilike(corporateBonds.issuer, `%${filters.issuer}%`));
      }
      if (filters.taxStatus) {
        conditions.push(eq(corporateBonds.taxStatus, filters.taxStatus));
      }
      
      corpBonds = await db.select()
        .from(corporateBonds)
        .where(and(...conditions))
        .orderBy(desc(corporateBonds.yieldToMaturity))
        .limit(filters.bondType === 'corporate' ? limit : Math.floor(limit / 2))
        .offset(filters.bondType === 'corporate' ? offset : 0);
    }
    
    const allBonds = [
      ...governmentBonds.map(b => ({ ...b, category: 'government' as const })),
      ...corpBonds.map(b => ({ ...b, category: 'corporate' as const }))
    ].sort((a, b) => {
      const yieldA = parseFloat(a.yieldToMaturity?.toString() || '0');
      const yieldB = parseFloat(b.yieldToMaturity?.toString() || '0');
      return yieldB - yieldA;
    });
    
    return {
      bonds: allBonds,
      pagination: {
        page,
        limit,
        total: allBonds.length,
        hasMore: allBonds.length === limit
      }
    };
  }
  
  async getBondDetails(bondId: string, bondType: 'government' | 'corporate') {
    if (bondType === 'government') {
      const [bond] = await db.select()
        .from(governmentSecurities)
        .where(eq(governmentSecurities.id, bondId));
      return bond ? { ...bond, category: 'government' } : null;
    } else {
      const [bond] = await db.select()
        .from(corporateBonds)
        .where(eq(corporateBonds.id, bondId));
      return bond ? { ...bond, category: 'corporate' } : null;
    }
  }
  
  async getBondByIsin(isin: string) {
    const [govBond] = await db.select()
      .from(governmentSecurities)
      .where(eq(governmentSecurities.isin, isin));
    
    if (govBond) {
      return { ...govBond, category: 'government' as const };
    }
    
    const [corpBond] = await db.select()
      .from(corporateBonds)
      .where(eq(corporateBonds.isin, isin));
    
    return corpBond ? { ...corpBond, category: 'corporate' as const } : null;
  }
  
  async getOpenNcdIssues() {
    const today = new Date().toISOString().split('T')[0];
    
    return db.select()
      .from(ncdPublicIssues)
      .where(
        and(
          eq(ncdPublicIssues.issueStatus, 'open'),
          lte(ncdPublicIssues.issueOpenDate, today),
          gte(ncdPublicIssues.issueCloseDate, today)
        )
      )
      .orderBy(asc(ncdPublicIssues.issueCloseDate));
  }
  
  async getUpcomingNcdIssues() {
    const today = new Date().toISOString().split('T')[0];
    
    return db.select()
      .from(ncdPublicIssues)
      .where(
        and(
          eq(ncdPublicIssues.issueStatus, 'upcoming'),
          gte(ncdPublicIssues.issueOpenDate, today)
        )
      )
      .orderBy(asc(ncdPublicIssues.issueOpenDate));
  }
  
  async getNcdIssueDetails(issueId: string) {
    const [issue] = await db.select()
      .from(ncdPublicIssues)
      .where(eq(ncdPublicIssues.id, issueId));
    return issue;
  }
  
  async getOpenSgbIssues() {
    const today = new Date().toISOString().split('T')[0];
    
    return db.select()
      .from(sgbPrimaryIssues)
      .where(
        and(
          eq(sgbPrimaryIssues.issueStatus, 'open'),
          lte(sgbPrimaryIssues.issueOpenDate, today),
          gte(sgbPrimaryIssues.issueCloseDate, today)
        )
      )
      .orderBy(asc(sgbPrimaryIssues.issueCloseDate));
  }
  
  async getUpcomingSgbIssues() {
    const today = new Date().toISOString().split('T')[0];
    
    return db.select()
      .from(sgbPrimaryIssues)
      .where(
        and(
          eq(sgbPrimaryIssues.issueStatus, 'upcoming'),
          gte(sgbPrimaryIssues.issueOpenDate, today)
        )
      )
      .orderBy(asc(sgbPrimaryIssues.issueOpenDate));
  }
  
  async performSuitabilityCheck(userId: string, ipAddress?: string, userAgent?: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)) as any[];
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const kycLevelValue = user.kycLevel || user.kycTier || '0';
    const kycVerified = kycLevelValue !== '0' && !!user.panNumber;
    const kycLevelMap: Record<string, string> = { '0': 'basic', '1': 'full', '2': 'enhanced' };
    const kycLevel = kycLevelMap[kycLevelValue] || 'basic';
    
    const suitabilityData = {
      userId,
      checkType: 'pre_purchase' as const,
      kycLevel,
      kycVerified,
      ckycNumber: null as string | null,
      kraStatus: null as string | null,
      dematVerified: false,
      dematAccountNumber: null as string | null,
      investorRiskProfile: user.riskTolerance || 'moderate',
      maxCreditRatingAllowed: kycLevel === 'enhanced' ? 'BBB-' : 'AA-',
      suitabilityResult: 'approved' as 'approved' | 'conditional' | 'rejected',
      restrictionLevel: 'none' as string,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };
    
    if (!kycVerified) {
      suitabilityData.suitabilityResult = 'rejected';
      suitabilityData.restrictionLevel = 'blocked';
    } else if (kycLevel === 'basic') {
      suitabilityData.suitabilityResult = 'conditional';
      suitabilityData.restrictionLevel = 'rating_restricted';
    }
    
    const [check] = await db.insert(bondSuitabilityChecks)
      .values(suitabilityData)
      .returning();
    
    await this.logAuditEvent({
      userId,
      eventType: 'suitability_check',
      eventCategory: 'compliance',
      eventData: { checkId: check.id, result: check.suitabilityResult },
      eventResult: 'success',
      eventSource: 'web',
      ipAddress,
      userAgent
    });
    
    return check;
  }
  
  async placeOrder(request: OrderPlacementRequest, ipAddress?: string, userAgent?: string) {
    const suitability = await this.getUserLatestSuitability(request.userId);
    
    if (!suitability || suitability.suitabilityResult === 'rejected') {
      throw new Error('Please complete suitability check before placing order');
    }
    
    const orderNumber = `BO${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const grossAmount = request.quantity * request.orderPrice;
    const accruedInterest = 0;
    const netAmount = grossAmount + accruedInterest;
    
    const orderData = {
      orderNumber,
      userId: request.userId,
      bondId: request.bondId,
      bondType: request.bondType,
      isin: request.isin,
      bondName: request.bondName,
      orderType: request.orderType,
      orderCategory: 'market' as const,
      quantity: request.quantity,
      faceValue: request.faceValue.toString(),
      totalFaceValue: (request.quantity * request.faceValue).toString(),
      orderPrice: request.orderPrice.toString(),
      grossAmount: grossAmount.toString(),
      accruedInterest: accruedInterest.toString(),
      netAmount: netAmount.toString(),
      orderStatus: 'pending' as const,
      paymentStatus: 'pending' as const,
      dematAccountNumber: request.dematAccountNumber,
      kycLevel: suitability.kycLevel,
      kycValidated: suitability.kycVerified,
      orderPlacedBy: 'client' as const,
      orderDate: new Date(),
    };
    
    const [order] = await db.insert(bondOrders)
      .values(orderData)
      .returning();
    
    await this.logAuditEvent({
      userId: request.userId,
      eventType: 'order_placed',
      eventCategory: 'trading',
      entityType: 'order',
      entityId: order.id,
      isin: request.isin,
      bondName: request.bondName,
      eventData: {
        orderNumber: order.orderNumber,
        orderType: request.orderType,
        quantity: request.quantity,
        amount: netAmount
      },
      amount: netAmount.toString(),
      eventResult: 'success',
      eventSource: 'web',
      ipAddress,
      userAgent
    });
    
    return order;
  }
  
  async getUserOrders(userId: string, status?: string) {
    const conditions = [eq(bondOrders.userId, userId)];
    
    if (status) {
      conditions.push(eq(bondOrders.orderStatus, status));
    }
    
    return db.select()
      .from(bondOrders)
      .where(and(...conditions))
      .orderBy(desc(bondOrders.orderDate));
  }
  
  async getUserHoldings(userId: string) {
    return db.select()
      .from(bondHoldings)
      .where(eq(bondHoldings.userId, userId))
      .orderBy(desc(bondHoldings.purchaseDate));
  }
  
  async getUserCouponPayments(userId: string, status?: string) {
    const conditions = [eq(bondCouponPayments.userId, userId)];
    
    if (status) {
      conditions.push(eq(bondCouponPayments.paymentStatus, status));
    }
    
    return db.select()
      .from(bondCouponPayments)
      .where(and(...conditions))
      .orderBy(asc(bondCouponPayments.paymentDate));
  }
  
  async getUpcomingCouponPayments(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return db.select()
      .from(bondCouponPayments)
      .where(
        and(
          eq(bondCouponPayments.userId, userId),
          eq(bondCouponPayments.paymentStatus, 'scheduled'),
          gte(bondCouponPayments.paymentDate, today),
          lte(bondCouponPayments.paymentDate, threeMonthsLater)
        )
      )
      .orderBy(asc(bondCouponPayments.paymentDate));
  }
  
  async getUserWatchlist(userId: string) {
    return db.select()
      .from(bondWatchlist)
      .where(
        and(
          eq(bondWatchlist.userId, userId),
          eq(bondWatchlist.isActive, true)
        )
      )
      .orderBy(desc(bondWatchlist.addedAt));
  }
  
  async addToWatchlist(userId: string, bondData: {
    bondId?: string;
    bondType: string;
    isin?: string;
    issueId?: string;
    bondName: string;
    issuer: string;
  }) {
    const [item] = await db.insert(bondWatchlist)
      .values({
        userId,
        ...bondData,
        alertOnPriceChange: true,
        alertOnRatingChange: true,
        alertOnIssueOpen: true,
        isActive: true,
      })
      .returning();
    
    return item;
  }
  
  async removeFromWatchlist(userId: string, watchlistId: string) {
    await db.update(bondWatchlist)
      .set({ isActive: false })
      .where(
        and(
          eq(bondWatchlist.id, watchlistId),
          eq(bondWatchlist.userId, userId)
        )
      );
  }
  
  async getUserLatestSuitability(userId: string) {
    const [check] = await db.select()
      .from(bondSuitabilityChecks)
      .where(
        and(
          eq(bondSuitabilityChecks.userId, userId),
          gte(bondSuitabilityChecks.validUntil, new Date())
        )
      )
      .orderBy(desc(bondSuitabilityChecks.validFrom))
      .limit(1);
    
    return check;
  }
  
  async logAuditEvent(data: {
    userId: string;
    eventType: string;
    eventCategory: string;
    entityType?: string;
    entityId?: string;
    isin?: string;
    bondName?: string;
    eventData?: any;
    previousState?: any;
    newState?: any;
    amount?: string;
    eventResult: string;
    eventSource: string;
    exchangeOrderId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const retentionExpiresAt = new Date(Date.now() + SEVEN_YEARS_MS);
    
    await db.insert(fixedIncomeAuditLog)
      .values({
        ...data,
        eventData: data.eventData || {},
        retentionExpiresAt,
        eventTimestamp: new Date(),
      });
  }
  
  async getPortfolioSummary(userId: string) {
    const holdings = await this.getUserHoldings(userId);
    
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalFaceValue = 0;
    let upcomingCoupons = 0;
    
    const maturityBuckets = {
      shortTerm: [] as any[],
      mediumTerm: [] as any[],
      longTerm: [] as any[],
    };
    
    const today = new Date();
    
    for (const holding of holdings) {
      const invested = parseFloat(holding.totalInvestedAmount?.toString() || '0');
      const faceValue = parseFloat(holding.totalFaceValue?.toString() || '0');
      
      totalInvested += invested;
      totalFaceValue += faceValue;
      totalCurrentValue += faceValue;
      
      if (holding.maturityDate) {
        const maturityDate = new Date(holding.maturityDate);
        const yearsToMaturity = (maturityDate.getTime() - today.getTime()) / (365 * 24 * 60 * 60 * 1000);
        
        if (yearsToMaturity <= 2) {
          maturityBuckets.shortTerm.push(holding);
        } else if (yearsToMaturity <= 5) {
          maturityBuckets.mediumTerm.push(holding);
        } else {
          maturityBuckets.longTerm.push(holding);
        }
      }
    }
    
    const upcomingPayments = await this.getUpcomingCouponPayments(userId);
    for (const payment of upcomingPayments) {
      upcomingCoupons += parseFloat(payment.netAmount?.toString() || '0');
    }
    
    return {
      totalHoldings: holdings.length,
      totalInvested,
      totalCurrentValue,
      totalFaceValue,
      unrealizedGainLoss: totalCurrentValue - totalInvested,
      upcomingCoupons,
      maturityBuckets: {
        shortTerm: maturityBuckets.shortTerm.length,
        mediumTerm: maturityBuckets.mediumTerm.length,
        longTerm: maturityBuckets.longTerm.length,
      },
      holdings,
      upcomingPayments,
    };
  }
  
  async applyNcdIssue(userId: string, applicationData: {
    issueId: string;
    investorCategory: string;
    seriesOptions: any[];
    totalQuantity: number;
    faceValue: number;
    totalAmount: number;
    paymentMethod: string;
    dematAccountNumber: string;
    dpId: string;
    clientId: string;
  }) {
    const applicationNumber = `NCD${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const [application] = await db.insert(bondNcdApplications)
      .values({
        userId,
        issueId: applicationData.issueId,
        applicationNumber,
        investorCategory: applicationData.investorCategory,
        seriesOptions: applicationData.seriesOptions,
        totalQuantity: applicationData.totalQuantity,
        faceValue: applicationData.faceValue.toString(),
        totalAmount: applicationData.totalAmount.toString(),
        paymentMethod: applicationData.paymentMethod,
        dematAccountNumber: applicationData.dematAccountNumber,
        dpId: applicationData.dpId,
        clientId: applicationData.clientId,
        applicationStatus: 'submitted',
        paymentStatus: 'pending',
      })
      .returning();
    
    await this.logAuditEvent({
      userId,
      eventType: 'ncd_application_submitted',
      eventCategory: 'trading',
      entityType: 'ncd_application',
      entityId: application.id,
      eventData: {
        applicationNumber,
        issueId: applicationData.issueId,
        totalAmount: applicationData.totalAmount,
      },
      amount: applicationData.totalAmount.toString(),
      eventResult: 'success',
      eventSource: 'web',
    });
    
    return application;
  }
  
  async getUserNcdApplications(userId: string) {
    return db.select({
      application: bondNcdApplications,
      issue: ncdPublicIssues,
    })
      .from(bondNcdApplications)
      .leftJoin(ncdPublicIssues, eq(bondNcdApplications.issueId, ncdPublicIssues.id))
      .where(eq(bondNcdApplications.userId, userId))
      .orderBy(desc(bondNcdApplications.applicationDate));
  }
  
  async calculateYieldToMaturity(faceValue: number, currentPrice: number, couponRate: number, yearsToMaturity: number): Promise<number> {
    const annualCoupon = faceValue * (couponRate / 100);
    let ytm = couponRate / 100;
    
    for (let i = 0; i < 100; i++) {
      let presentValue = 0;
      
      for (let t = 1; t <= yearsToMaturity; t++) {
        presentValue += annualCoupon / Math.pow(1 + ytm, t);
      }
      presentValue += faceValue / Math.pow(1 + ytm, yearsToMaturity);
      
      const error = presentValue - currentPrice;
      
      if (Math.abs(error) < 0.01) {
        break;
      }
      
      ytm = ytm + (error / (yearsToMaturity * currentPrice)) * 0.1;
    }
    
    return ytm * 100;
  }
  
  async getAuditLogs(userId: string, filters?: {
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const conditions = [eq(fixedIncomeAuditLog.userId, userId)];
    
    if (filters?.eventType) {
      conditions.push(eq(fixedIncomeAuditLog.eventType, filters.eventType));
    }
    if (filters?.startDate) {
      conditions.push(gte(fixedIncomeAuditLog.eventTimestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(fixedIncomeAuditLog.eventTimestamp, filters.endDate));
    }
    
    return db.select()
      .from(fixedIncomeAuditLog)
      .where(and(...conditions))
      .orderBy(desc(fixedIncomeAuditLog.eventTimestamp))
      .limit(filters?.limit || 100);
  }

  // Admin Methods
  async getAllOrders(limit: number = 100) {
    return db.select()
      .from(bondOrders)
      .orderBy(desc(bondOrders.createdAt))
      .limit(limit);
  }

  async getAllAuditLogs(filters?: {
    eventType?: string;
    limit?: number;
  }) {
    const conditions: any[] = [];
    
    if (filters?.eventType) {
      conditions.push(eq(fixedIncomeAuditLog.eventType, filters.eventType));
    }
    
    return db.select()
      .from(fixedIncomeAuditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(fixedIncomeAuditLog.eventTimestamp))
      .limit(filters?.limit || 100);
  }

  async createBond(data: any) {
    const [bond] = await db.insert(governmentSecurities).values({
      isin: data.isin,
      securityName: data.securityName,
      issuer: data.issuer,
      couponRate: parseFloat(data.couponRate),
      yieldToMaturity: data.yieldToMaturity ? parseFloat(data.yieldToMaturity) : null,
      faceValue: parseFloat(data.faceValue),
      currentPrice: data.currentPrice ? parseFloat(data.currentPrice) : null,
      maturityDate: new Date(data.maturityDate),
      securityType: data.securityType,
      creditRating: data.creditRating || null,
      taxStatus: data.taxStatus || 'taxable',
      isActive: data.isActive !== false,
    }).returning();
    return bond;
  }

  async updateBond(bondId: string, data: any) {
    const [bond] = await db.update(governmentSecurities)
      .set({
        securityName: data.securityName,
        issuer: data.issuer,
        couponRate: parseFloat(data.couponRate),
        yieldToMaturity: data.yieldToMaturity ? parseFloat(data.yieldToMaturity) : null,
        currentPrice: data.currentPrice ? parseFloat(data.currentPrice) : null,
        creditRating: data.creditRating || null,
        taxStatus: data.taxStatus,
        isActive: data.isActive,
        updatedAt: new Date(),
      })
      .where(eq(governmentSecurities.id, bondId))
      .returning();
    return bond;
  }

  async createNcdIssue(data: any) {
    const [issue] = await db.insert(ncdPublicIssues).values({
      issueCode: data.issueCode,
      issuer: data.issuer,
      issueSize: parseFloat(data.issueSize),
      pricePerNcd: parseFloat(data.pricePerNcd),
      couponRate: parseFloat(data.couponRate),
      tenure: parseInt(data.tenure),
      tenureUnit: data.tenureUnit || 'years',
      creditRating: data.creditRating,
      issueOpenDate: new Date(data.issueOpenDate),
      issueCloseDate: new Date(data.issueCloseDate),
      minApplicationAmount: parseFloat(data.minApplicationAmount) || 10000,
      interestPaymentFrequency: data.interestPaymentFrequency || 'annual',
      status: data.status || 'upcoming',
      listingExchange: data.listingExchange || 'NSE',
    }).returning();
    return issue;
  }

  async updateNcdIssue(issueId: string, data: any) {
    const [issue] = await db.update(ncdPublicIssues)
      .set({
        issuer: data.issuer,
        issueSize: parseFloat(data.issueSize),
        pricePerNcd: parseFloat(data.pricePerNcd),
        couponRate: parseFloat(data.couponRate),
        tenure: parseInt(data.tenure),
        tenureUnit: data.tenureUnit,
        creditRating: data.creditRating,
        issueOpenDate: new Date(data.issueOpenDate),
        issueCloseDate: new Date(data.issueCloseDate),
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(ncdPublicIssues.id, issueId))
      .returning();
    return issue;
  }
}

export const fixedIncomeMarketplace = new FixedIncomeMarketplaceService();
