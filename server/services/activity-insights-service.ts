import { db } from "../db";
import { 
  users, errorLedger, immutableAuditLogs, auditTrail,
  kycAuditLogs, storeAuditLogs, aiAuditLogs, agentComplianceAuditLogs,
  knowledgeAuditLogs, bondMarketplaceAuditLogs, bondOrders, unlistedDeals,
  mfOrders, kycVerificationSessions, manualKycSubmissions, unlistedSTRFlags
} from "@shared/schema";
import { eq, sql, desc, gte, and, count, lt, isNotNull, isNull, or, notInArray, ne, inArray } from "drizzle-orm";
import { aiService } from "./ai-service";
import { complianceMonitor } from "../compliance-monitor";
import { requestLatencyTracker } from "./request-latency-tracker";

interface ActivityMetrics {
  errors: {
    total: number;
    critical: number;
    byModule: Record<string, number>;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  users: {
    activeToday: number;
    newThisWeek: number;
    dormant30Days: number;
    incompleteKyc: number;
  };
  revenue: {
    pendingOrders: number;
    abandonedCarts: number;
    completedDeals: number;
    potentialRevenue: number;
  };
  security: {
    failedLogins: number;
    rateLimitViolations: number;
    suspiciousActivity: number;
  };
  performance: {
    slowEndpoints: string[];
    highErrorRateModules: string[];
  };
  regulatory: {
    highDeviationDeals: number;
    pendingStrFlags: number;
    investorLimitAlerts: number;
    companiesNearLimit: number;
    companiesAtLimit: number;
  };
}

interface AIInsight {
  id: string;
  category: 'performance' | 'abuse' | 'revenue' | 'engagement' | 'security';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestedAction: string;
  estimatedImpact: string;
  actionType?: 'email' | 'notification' | 'config' | 'manual';
  actionPayload?: any;
  createdAt: Date;
}

class ActivityInsightsService {
  private cachedInsights: AIInsight[] = [];
  private lastAnalysisTime: Date | null = null;
  private analysisInProgress = false;

  async getActivityMetrics(): Promise<ActivityMetrics> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const [
        errorStats,
        criticalErrors,
        activeUsers,
        newUsers,
        dormantUsers,
        incompleteKycUsers,
        pendingBondOrders,
        pendingUnlistedDeals,
        yesterdayErrors,
        completedBondOrders,
        completedUnlistedDeals,
        completedMfOrders,
        cancelledBondOrders,
        cancelledMfOrders,
        cancelledUnlistedDeals,
        pendingMfOrders,
        pendingBondValue,
        pendingUnlistedValue,
        authSecurityEvents,
        highDeviationDeals,
        pendingStrFlags,
        investorCounts
      ] = await Promise.all([
        db.select({ count: count() }).from(errorLedger).where(gte(errorLedger.createdAt, oneDayAgo)).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(errorLedger).where(and(
          gte(errorLedger.createdAt, oneDayAgo),
          eq(errorLedger.severity, 'critical')
        )).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(users).where(gte(users.lastLoginAt, oneDayAgo)).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(users).where(gte(users.createdAt, oneWeekAgo)).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(users).where(and(
          lt(users.lastLoginAt, thirtyDaysAgo),
          eq(users.isActive, true)
        )).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(users).where(
          sql`"is_active" = true AND ("kyc_status" IS NULL OR "kyc_status" NOT IN ('verified', 'approved'))`
        ).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(bondOrders).where(eq(bondOrders.orderStatus, 'pending')).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(unlistedDeals).where(eq(unlistedDeals.status, 'pending')).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(errorLedger).where(and(
          gte(errorLedger.createdAt, twoDaysAgo),
          lt(errorLedger.createdAt, oneDayAgo)
        )).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(bondOrders).where(and(
          eq(bondOrders.orderStatus, 'executed'),
          gte(bondOrders.createdAt, oneWeekAgo)
        )).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(unlistedDeals).where(and(
          eq(unlistedDeals.status, 'completed'),
          gte(unlistedDeals.createdAt, oneWeekAgo)
        )).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(mfOrders).where(and(
          inArray(mfOrders.status, ['settled', 'reconciled']),
          gte(mfOrders.createdAt, oneWeekAgo)
        )).catch(() => [{ count: 0 }]),
        db.select({ 
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(CAST("gross_amount" AS numeric)), 0)`
        }).from(bondOrders).where(and(
          eq(bondOrders.orderStatus, 'cancelled'),
          gte(bondOrders.createdAt, oneWeekAgo)
        )).catch(() => [{ count: 0, totalValue: 0 }]),
        db.select({ 
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(CAST("amount" AS numeric)), 0)`
        }).from(mfOrders).where(and(
          inArray(mfOrders.status, ['cancelled', 'failed']),
          gte(mfOrders.createdAt, oneWeekAgo)
        )).catch(() => [{ count: 0, totalValue: 0 }]),
        db.select({ 
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(CAST("total_value" AS numeric)), 0)`
        }).from(unlistedDeals).where(and(
          inArray(unlistedDeals.status, ['cancelled', 'failed']),
          gte(unlistedDeals.createdAt, oneWeekAgo)
        )).catch(() => [{ count: 0, totalValue: 0 }]),
        db.select({ 
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(CAST("amount" AS numeric)), 0)`
        }).from(mfOrders).where(
          inArray(mfOrders.status, ['created', 'pending_payment'])
        ).catch(() => [{ count: 0, totalValue: 0 }]),
        db.select({ 
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(CAST("gross_amount" AS numeric)), 0)`
        }).from(bondOrders).where(
          eq(bondOrders.orderStatus, 'pending')
        ).catch(() => [{ count: 0, totalValue: 0 }]),
        db.select({ 
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(CAST("total_value" AS numeric)), 0)`
        }).from(unlistedDeals).where(
          eq(unlistedDeals.status, 'pending')
        ).catch(() => [{ count: 0, totalValue: 0 }]),
        db.select({
          eventType: immutableAuditLogs.eventType,
          action: immutableAuditLogs.action
        }).from(immutableAuditLogs).where(and(
          gte(immutableAuditLogs.timestamp, oneDayAgo),
          sql`${immutableAuditLogs.eventType} IN ('security', 'authentication', 'authorization', 'login')`
        )).catch(() => []),
        
        // Regulatory metrics
        db.select({ count: count() }).from(unlistedDeals).where(sql`CAST(valuation_deviation AS NUMERIC) > 20`).catch(() => [{ count: 0 }]),
        db.select({ count: count() }).from(unlistedSTRFlags).where(eq(unlistedSTRFlags.status, 'pending')).catch(() => [{ count: 0 }]),
        db.select({ 
          companyId: unlistedDeals.companyId, 
          investorCount: sql<number>`count(distinct ${unlistedDeals.buyerUserId})`
        })
        .from(unlistedDeals)
        .groupBy(unlistedDeals.companyId)
        .catch(() => [])
      ]);

      const errorsByModule = await db.select({
        module: errorLedger.module,
        count: count()
      })
      .from(errorLedger)
      .where(gte(errorLedger.createdAt, oneDayAgo))
      .groupBy(errorLedger.module)
      .catch(() => []);

      const moduleErrors: Record<string, number> = {};
      errorsByModule.forEach(e => {
        moduleErrors[e.module] = e.count;
      });

      const highErrorModules = Object.entries(moduleErrors)
        .filter(([_, count]) => count > 10)
        .map(([module]) => module);

      const todayCount = errorStats[0]?.count || 0;
      const yesterdayCount = yesterdayErrors[0]?.count || 0;
      let errorTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (yesterdayCount > 0) {
        const changePercent = ((todayCount - yesterdayCount) / yesterdayCount) * 100;
        if (changePercent > 20) errorTrend = 'increasing';
        else if (changePercent < -20) errorTrend = 'decreasing';
      } else if (todayCount > 5) {
        errorTrend = 'increasing';
      }

      const complianceReport = complianceMonitor.getComplianceReport('day');
      const complianceAlerts = complianceMonitor.getAlerts();

      const auditFailedLogins = (authSecurityEvents as any[]).filter(
        (e: any) => (e.eventType === 'authentication' || e.eventType === 'login') && 
        (e.action?.toLowerCase().includes('fail') || e.action?.toLowerCase().includes('denied'))
      ).length;
      const complianceFailedLogins = complianceReport.summary.failedLogins || 0;
      const failedLogins = Math.max(auditFailedLogins, complianceFailedLogins);

      const auditRateLimitEvents = (authSecurityEvents as any[]).filter(
        (e: any) => e.action?.toLowerCase().includes('rate') || e.action?.toLowerCase().includes('throttl') || e.action?.toLowerCase().includes('blocked')
      ).length;
      const complianceRateLimits = complianceAlerts.filter(
        a => a.alertType === 'suspicious_ip' || a.description?.toLowerCase().includes('rate limit')
      ).length;
      const rateLimitViolations = auditRateLimitEvents + complianceRateLimits;

      const auditSuspicious = (authSecurityEvents as any[]).filter(
        (e: any) => e.eventType === 'security' && (e.action?.toLowerCase().includes('suspicious') || e.action?.toLowerCase().includes('breach') || e.action?.toLowerCase().includes('unauthorized'))
      ).length;
      const complianceSuspicious = complianceAlerts.filter(
        a => !a.resolved && (a.severity === 'high' || a.severity === 'critical')
      ).length;
      const suspiciousActivity = auditSuspicious + complianceSuspicious;

      const abandonedCarts = (cancelledBondOrders[0]?.count || 0) + (cancelledMfOrders[0]?.count || 0) + (cancelledUnlistedDeals[0]?.count || 0);
      const completedDeals = (completedBondOrders[0]?.count || 0) + (completedUnlistedDeals[0]?.count || 0) + (completedMfOrders[0]?.count || 0);
      const pendingMfValue = Number(pendingMfOrders[0]?.totalValue || 0);
      const pendingBondVal = Number(pendingBondValue[0]?.totalValue || 0);
      const pendingUnlistedVal = Number(pendingUnlistedValue[0]?.totalValue || 0);
      const cancelledBondVal = Number(cancelledBondOrders[0]?.totalValue || 0);
      const cancelledMfVal = Number(cancelledMfOrders[0]?.totalValue || 0);
      const cancelledUnlistedVal = Number(cancelledUnlistedDeals[0]?.totalValue || 0);
      const potentialRevenue = pendingMfValue + pendingBondVal + pendingUnlistedVal + cancelledBondVal + cancelledMfVal + cancelledUnlistedVal;

      const slowEndpoints = requestLatencyTracker.getSlowEndpoints();

      // Calculate companies near investor limit (SEBI mandate for private companies is 200)
      const nearLimitThreshold = 150;
      const atLimitThreshold = 195; // Close to 200

      const companiesNearLimit = (investorCounts as any[]).filter(
        (c: any) => c.investorCount >= nearLimitThreshold && c.investorCount < atLimitThreshold
      ).length;

      const companiesAtLimit = (investorCounts as any[]).filter(
        (c: any) => c.investorCount >= atLimitThreshold
      ).length;

      const investorLimitAlerts = companiesNearLimit + companiesAtLimit;

      return {
        errors: {
          total: todayCount,
          critical: criticalErrors[0]?.count || 0,
          byModule: moduleErrors,
          trend: errorTrend
        },
        users: {
          activeToday: activeUsers[0]?.count || 0,
          newThisWeek: newUsers[0]?.count || 0,
          dormant30Days: dormantUsers[0]?.count || 0,
          incompleteKyc: incompleteKycUsers[0]?.count || 0
        },
        revenue: {
          pendingOrders: (pendingBondOrders[0]?.count || 0) + (pendingUnlistedDeals[0]?.count || 0) + (pendingMfOrders[0]?.count || 0),
          abandonedCarts,
          completedDeals,
          potentialRevenue: Math.round(potentialRevenue)
        },
        security: {
          failedLogins,
          rateLimitViolations,
          suspiciousActivity
        },
        performance: {
          slowEndpoints,
          highErrorRateModules: highErrorModules
        },
        regulatory: {
          highDeviationDeals: Number(highDeviationDeals[0]?.count || 0),
          pendingStrFlags: Number(pendingStrFlags[0]?.count || 0),
          investorLimitAlerts,
          companiesNearLimit,
          companiesAtLimit
        }
      };
    } catch (error: any) {
      console.error("[ActivityInsights] Error fetching metrics:", error?.message || error);
      return {
        errors: { total: 0, critical: 0, byModule: {}, trend: 'stable' as const },
        users: { activeToday: 0, newThisWeek: 0, dormant30Days: 0, incompleteKyc: 0 },
        revenue: { pendingOrders: 0, abandonedCarts: 0, completedDeals: 0, potentialRevenue: 0 },
        security: { failedLogins: 0, rateLimitViolations: 0, suspiciousActivity: 0 },
        performance: { slowEndpoints: [], highErrorRateModules: [] },
        regulatory: { highDeviationDeals: 0, pendingStrFlags: 0, investorLimitAlerts: 0, companiesNearLimit: 0, companiesAtLimit: 0 }
      };
    }
  }

  async generateAIInsights(metrics: ActivityMetrics): Promise<AIInsight[]> {
    if (this.analysisInProgress) {
      return this.cachedInsights;
    }

    // Circuit-breaker: skip AI call if all providers are currently rate-limited/unhealthy.
    // This prevents burning retry cycles on guaranteed 429 failures during quota exhaustion.
    const providerStatus = (aiService as any).providerStatus as Record<string, { healthy: boolean; lastErrorTime: number }>;
    const COOL_DOWN_MS = (aiService as any).COOL_DOWN_MS as number ?? 5 * 60 * 1000;
    const allUnhealthy = providerStatus &&
      Object.values(providerStatus).every(
        s => !s.healthy && (Date.now() - s.lastErrorTime) < COOL_DOWN_MS
      );

    if (allUnhealthy) {
      console.warn('[ActivityInsights] All AI providers are in cool-down — skipping scan to preserve quota. Serving cached/default insights.');
      return this.cachedInsights.length > 0 ? this.cachedInsights : this.getDefaultInsights(metrics);
    }

    this.analysisInProgress = true;

    try {
      const [securityAlerts, recentActivity] = await Promise.all([
        this.getSecurityAlerts(),
        this.getRecentActivity(20)
      ]);

      const prompt = `You are FintekPro's AI forensic business analyst. Analyze these platform metrics and actual activity logs to provide deep actionable insights.

METRICS SUMMARY:
${JSON.stringify(metrics, null, 2)}

RECENT SECURITY ALERTS:
${JSON.stringify(securityAlerts, null, 2)}

RECENT PLATFORM ACTIVITY:
${JSON.stringify(recentActivity, null, 2)}

Generate exactly 5-8 insights in the following JSON format. Focus on:
1. SECURITY FORENSICS: Identify malicious patterns in the logs (brute force, scraping, suspicious IPs, or internal policy violations).
2. PERFORMANCE: Identify slow modules or modules with high error rates from the logs.
4. REGULATORY GOVERNANCE (Unlisted): Monitor for SEBI/Income Tax risks (valuation deviations >20%, companies with >150 investors approaching 200 limit, pending STR flags).
5. OPERATIONAL EFFICIENCY: Suggestions for optimizing system performance based on slow endpoints.

Return a JSON array of insights:
[
  {
    "category": "performance|abuse|revenue|engagement|security",
    "priority": "critical|high|medium|low",
    "title": "Short forensic title",
    "description": "2-3 sentence technical and business explanation",
    "suggestedAction": "Specific action (e.g. 'Block IP X', 'Notify user Y', 'Fix module Z')",
    "estimatedImpact": "Expected outcome",
    "actionType": "email|notification|config|manual"
  }
]

IMPORTANT:
- Use specific User IDs, IPs, and Error Codes found in the logs to make your insights precise.
- Detect "unaccepted activity" (unauthorized access attempts, policy breaches).
- For unlisted shares, prioritize flagging tax risks (Section 56(2)(x)) if valuation deviation is high.
- Prioritize revenue-critical and security-critical items.`;

      const aiResponse = await aiService.chat([
        { role: 'user', content: prompt }
      ], { model: 'gemini-3.1-flash-lite', maxTokens: 2500 });
      
      if (!aiResponse?.content) {
        console.error('[ActivityInsights] No AI response received');
        return this.getDefaultInsights(metrics);
      }

      try {
        const jsonMatch = aiResponse.content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error('[ActivityInsights] Could not parse AI response as JSON');
          return this.getDefaultInsights(metrics);
        }

        const insights: any[] = JSON.parse(jsonMatch[0]);
        
        this.cachedInsights = insights.map((insight, index) => ({
          id: `insight-${Date.now()}-${index}`,
          category: insight.category || 'engagement',
          priority: insight.priority || 'medium',
          title: insight.title || 'Insight',
          description: insight.description || '',
          suggestedAction: insight.suggestedAction || '',
          estimatedImpact: insight.estimatedImpact || 'Unknown',
          actionType: insight.actionType,
          actionPayload: insight.actionPayload,
          createdAt: new Date()
        }));

        this.lastAnalysisTime = new Date();
        console.log(`[ActivityInsights] Generated ${this.cachedInsights.length} AI insights`);
        
        return this.cachedInsights;
      } catch (parseError) {
        console.error('[ActivityInsights] Failed to parse AI response:', parseError);
        return this.getDefaultInsights(metrics);
      }
    } finally {
      this.analysisInProgress = false;
    }
  }

  private getDefaultInsights(metrics: ActivityMetrics): AIInsight[] {
    const insights: AIInsight[] = [];

    if (metrics.errors.critical > 0) {
      insights.push({
        id: `insight-critical-${Date.now()}`,
        category: 'performance',
        priority: 'critical',
        title: `${metrics.errors.critical} Critical Errors Detected`,
        description: `There are ${metrics.errors.critical} critical errors in the last 24 hours that need immediate attention.`,
        suggestedAction: 'Review and resolve critical errors in the Error tab immediately.',
        estimatedImpact: 'Prevent user-facing issues and potential data loss',
        actionType: 'manual',
        createdAt: new Date()
      });
    }

    if (metrics.users.incompleteKyc > 0) {
      insights.push({
        id: `insight-kyc-${Date.now()}`,
        category: 'revenue',
        priority: metrics.users.incompleteKyc > 10 ? 'high' : 'medium',
        title: `${metrics.users.incompleteKyc} Users with Incomplete KYC`,
        description: `These users started registration but haven't completed KYC verification, blocking them from trading.`,
        suggestedAction: 'Send reminder emails with KYC completion incentives.',
        estimatedImpact: `Potential ₹${(metrics.users.incompleteKyc * 5000).toLocaleString()} in first-time investments`,
        actionType: 'email',
        createdAt: new Date()
      });
    }

    if (metrics.users.dormant30Days > 0) {
      insights.push({
        id: `insight-dormant-${Date.now()}`,
        category: 'engagement',
        priority: 'medium',
        title: `${metrics.users.dormant30Days} Dormant Users (30+ Days)`,
        description: `These users haven't logged in for over 30 days but have active accounts.`,
        suggestedAction: 'Launch re-engagement campaign with personalized investment opportunities.',
        estimatedImpact: '20-30% user reactivation rate expected',
        actionType: 'email',
        createdAt: new Date()
      });
    }

    if (metrics.revenue.pendingOrders > 0) {
      insights.push({
        id: `insight-pending-${Date.now()}`,
        category: 'revenue',
        priority: 'high',
        title: `${metrics.revenue.pendingOrders} Pending Orders Awaiting Action`,
        description: `Orders are pending completion which could convert to revenue.`,
        suggestedAction: 'Send payment reminders and follow-up with agents.',
        estimatedImpact: `Accelerate ₹${(metrics.revenue.pendingOrders * 10000).toLocaleString()} in pending transactions`,
        actionType: 'notification',
        createdAt: new Date()
      });
    }

    if (metrics.performance.highErrorRateModules.length > 0) {
      insights.push({
        id: `insight-errors-${Date.now()}`,
        category: 'performance',
        priority: 'high',
        title: `High Error Rate in ${metrics.performance.highErrorRateModules.join(', ')}`,
        description: `These modules have unusually high error rates that may affect user experience.`,
        suggestedAction: 'Review error logs and deploy fixes for these modules.',
        estimatedImpact: 'Improved reliability and user satisfaction',
        actionType: 'manual',
        createdAt: new Date()
      });
    }

    if (metrics.regulatory.highDeviationDeals > 0) {
      insights.push({
        id: `insight-reg-dev-${Date.now()}`,
        category: 'security',
        priority: 'high',
        title: `${metrics.regulatory.highDeviationDeals} High-Deviation Deals`,
        description: `Transactions detected with >20% deviation from FMV, posing Section 56(2)(x) tax risks.`,
        suggestedAction: 'Review compliance notes and audit the valuation source for these deals.',
        estimatedImpact: 'Avoid regulatory penalties and tax notices',
        actionType: 'manual',
        createdAt: new Date()
      });
    }

    if (metrics.regulatory.investorLimitAlerts > 0) {
      insights.push({
        id: `insight-reg-limit-${Date.now()}`,
        category: 'security',
        priority: 'critical',
        title: `${metrics.regulatory.investorLimitAlerts} Companies Near Investor Limit`,
        description: `Some companies are approaching or at the 200-investor limit for private companies.`,
        suggestedAction: 'Halt new buy orders for these companies to avoid forced public listing compliance.',
        estimatedImpact: 'Ensure MCA compliance for private placements',
        actionType: 'manual',
        createdAt: new Date()
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: `insight-status-${Date.now()}`,
        category: 'engagement',
        priority: 'low',
        title: 'Platform Operating Normally',
        description: `Current metrics show healthy platform activity: ${metrics.users.activeToday} active users today, ${metrics.users.newThisWeek} new users this week.`,
        suggestedAction: 'Continue monitoring for optimization opportunities.',
        estimatedImpact: 'Maintain operational excellence',
        actionType: 'manual',
        createdAt: new Date()
      });
    }

    return insights;
  }

  async getRecentActivity(limit: number = 50): Promise<any[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Fetch from multiple sources to show "all activities"
    const [immutableLogs, trailLogs, kycLogs, errorLogs] = await Promise.all([
      db.select({
        id: immutableAuditLogs.id,
        timestamp: immutableAuditLogs.timestamp,
        eventType: immutableAuditLogs.eventType,
        action: immutableAuditLogs.action,
        userId: immutableAuditLogs.userId,
        userRole: immutableAuditLogs.userRole,
        entityType: immutableAuditLogs.entityType,
        entityId: immutableAuditLogs.entityId
      })
      .from(immutableAuditLogs)
      .where(gte(immutableAuditLogs.timestamp, oneDayAgo))
      .orderBy(desc(immutableAuditLogs.timestamp))
      .limit(limit),

      db.select({
        id: auditTrail.id,
        timestamp: auditTrail.createdAt,
        eventType: auditTrail.category,
        action: auditTrail.action,
        userId: auditTrail.userId,
        userRole: sql<string>`'user'`,
        entityType: sql<string>`'general'`,
        entityId: sql<string>`NULL`
      })
      .from(auditTrail)
      .where(gte(auditTrail.createdAt, oneDayAgo))
      .orderBy(desc(auditTrail.createdAt))
      .limit(limit),

      db.select({
        id: kycAuditLogs.id,
        timestamp: kycAuditLogs.accessedAt,
        eventType: kycAuditLogs.accessType,
        action: kycAuditLogs.purpose,
        userId: kycAuditLogs.userId,
        userRole: sql<string>`'kyc_processor'`,
        entityType: sql<string>`'kyc'`,
        entityId: kycAuditLogs.requestId
      })
      .from(kycAuditLogs)
      .where(gte(kycAuditLogs.accessedAt, oneDayAgo))
      .orderBy(desc(kycAuditLogs.accessedAt))
      .limit(limit),
      
      db.select({
        id: errorLedger.id,
        timestamp: errorLedger.createdAt,
        eventType: sql<string>`'error'`,
        action: errorLedger.errorCode,
        userId: errorLedger.clientId,
        userRole: sql<string>`'system'`,
        entityType: errorLedger.module,
        entityId: errorLedger.transactionId
      })
      .from(errorLedger)
      .where(gte(errorLedger.createdAt, oneDayAgo))
      .orderBy(desc(errorLedger.createdAt))
      .limit(limit)
    ]);

    const combined = [...immutableLogs, ...trailLogs, ...kycLogs, ...errorLogs]
      .filter(log => log.timestamp)
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
      .slice(0, limit);

    return combined;
  }

  async getSecurityAlerts(): Promise<any[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const securityEvents = await db.select()
      .from(immutableAuditLogs)
      .where(and(
        gte(immutableAuditLogs.timestamp, oneHourAgo),
        sql`${immutableAuditLogs.eventType} IN ('security', 'authentication', 'authorization')`
      ))
      .orderBy(desc(immutableAuditLogs.timestamp))
      .limit(20);

    return securityEvents;
  }

  getCachedInsights(): AIInsight[] {
    return this.cachedInsights;
  }

  getLastAnalysisTime(): Date | null {
    return this.lastAnalysisTime;
  }

  async getStuckKycUsers(): Promise<any[]> {
    try {
      // Find users who are not verified/approved and have some KYC activity
      // Using raw SQL for a complex join between users, sessions and manual submissions
      const rows = await db.execute(sql`
        SELECT 
          u.id as "userId",
          u.first_name as "firstName",
          u.last_name as "lastName",
          u.company_name as "companyName",
          u.email,
          u.kyc_status as "kycStatus",
          u.last_login_at as "lastLoginAt",
          u.created_at as "userCreatedAt",
          kvs.current_step as "smartKycStep",
          kvs.session_outcome as "smartKycOutcome",
          kvs.updated_at as "smartKycLastActive",
          mks.status as "manualKycStatus",
          mks.updated_at as "manualKycLastActive",
          mks.id as "manualSubmissionId"
        FROM users u
        LEFT JOIN (
          SELECT DISTINCT ON (user_id) * 
          FROM kyc_verification_sessions 
          ORDER BY user_id, updated_at DESC
        ) kvs ON kvs.user_id = u.id
        LEFT JOIN (
          SELECT DISTINCT ON (user_id) *
          FROM manual_kyc_submissions
          ORDER BY user_id, updated_at DESC
        ) mks ON mks.user_id = u.id
        WHERE u.is_active = true 
          AND (u.kyc_status IS NULL OR u.kyc_status NOT IN ('verified', 'approved'))
          AND (kvs.id IS NOT NULL OR mks.id IS NOT NULL)
        ORDER BY COALESCE(kvs.updated_at, mks.updated_at, u.created_at) DESC
        LIMIT 50
      `);

      return (rows.rows || []).map((row: any) => ({
        ...row,
        userName: row.companyName || [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email,
        recommendation: this.getKycActionRecommendation(row)
      }));
    } catch (error) {
      console.error("[ActivityInsights] Error fetching stuck KYC users:", error);
      return [];
    }
  }

  private getKycActionRecommendation(user: any): { action: string, priority: string, helperText: string } {
    // Logic to determine priority and helper text
    if (user.manualKycStatus === 'pending') {
      return { 
        action: 'REVIEW_MANUAL', 
        priority: 'high', 
        helperText: 'Manual KYC documents are pending your review.' 
      };
    }
    
    if (user.smartKycStep === 'completed' && user.smartKycOutcome === 'failed') {
      return { 
        action: 'STUCK_IN_SMART', 
        priority: 'high', 
        helperText: 'Smart KYC failed. Check documentation or aml risk level.' 
      };
    }

    if (user.smartKycStep) {
      const stepNames: Record<string, string> = {
        'pan_verification': 'PAN Verification',
        'aadhaar_otp': 'Aadhaar OTP',
        'aadhaar_verification': 'Aadhaar Verification',
        'data_collection': 'Profile Completion'
      };
      return { 
        action: 'ASSIST_USER', 
        priority: 'medium', 
        helperText: `User is stuck at ${stepNames[user.smartKycStep] || user.smartKycStep} step.` 
      };
    }

    return { 
      action: 'NUDGE_USER', 
      priority: 'low', 
      helperText: 'User has not started the KYC process recently.' 
    };
  }

  /**
   * Start background monitoring for unaccepted activities and regulatory breaches.
   *
   * Scan interval: 60 minutes (down from 15) to reduce daily AI token consumption by 75%.
   * Startup delay: 60 seconds so the first scan doesn't race with boot-time quota pressure
   * from PickOfTheDay, ForensicAudit, and other schedulers that fire within the first 30s.
   *
   * A circuit-breaker in generateAIInsights() automatically skips scans when all providers
   * are in cool-down, preventing retry-loop token burns during quota exhaustion.
   */
  startAutomatedMonitoring() {
    console.log('[ActivityInsights] Starting automated regulatory monitoring...');
    
    // Run every 60 minutes with jitter to prevent concurrent spikes across instances
    const SCAN_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes
    const runScan = async () => {
      try {
        // Add random jitter up to 60 seconds to stagger restarts across revisions
        const jitter = Math.random() * 60000;
        await new Promise(resolve => setTimeout(resolve, jitter));

        console.log('[ActivityInsights] Running periodic compliance scan...');
        const metrics = await this.getActivityMetrics();
        const insights = await this.generateAIInsights(metrics);
        
        // Dispatch alerts for critical insights
        const criticalInsights = insights.filter(i => i.priority === 'critical' || i.priority === 'high');
        
        for (const insight of criticalInsights) {
          const { adminParallelNotifier } = await import('./admin-parallel-notifier');
          
          let taskType: any = 'UNLISTED_REGULATORY_BREACH';
          if (insight.title.toLowerCase().includes('valuation') || insight.title.toLowerCase().includes('fmv')) {
            taskType = 'VALUATION_DEVIATION_ALERT';
          }

          adminParallelNotifier.dispatch({
            taskType,
            title: insight.title,
            body: insight.description + '\n\nSuggested Action: ' + insight.suggestedAction,
            priority: insight.priority as any,
            metadata: { insightId: insight.id, category: insight.category }
          });
        }
      } catch (error) {
        console.error('[ActivityInsights] Automated monitoring error:', error);
      }
    };

    setInterval(runScan, SCAN_INTERVAL_MS);
    // Delay the first startup scan by 60s to avoid racing with boot-time scheduler pressure
    setTimeout(runScan, 60 * 1000);
  }
}

export const activityInsightsService = new ActivityInsightsService();
