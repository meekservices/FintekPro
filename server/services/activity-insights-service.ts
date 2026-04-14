import { db } from "../db";
import { 
  users, errorLedger, immutableAuditLogs, auditTrail,
  kycAuditLogs, storeAuditLogs, aiAuditLogs, agentComplianceAuditLogs,
  knowledgeAuditLogs, bondMarketplaceAuditLogs, bondOrders, unlistedDeals,
  mfOrders
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
        authSecurityEvents
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
        )).catch(() => [])
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
        }
      };
    } catch (error: any) {
      console.error("[ActivityInsights] Error fetching metrics:", error?.message || error);
      return {
        errors: { total: 0, critical: 0, byModule: {}, trend: 'stable' as const },
        users: { activeToday: 0, newThisWeek: 0, dormant30Days: 0, incompleteKyc: 0 },
        revenue: { pendingOrders: 0, abandonedCarts: 0, completedDeals: 0, potentialRevenue: 0 },
        security: { failedLogins: 0, rateLimitViolations: 0, suspiciousActivity: 0 },
        performance: { slowEndpoints: [], highErrorRateModules: [] }
      };
    }
  }

  async generateAIInsights(metrics: ActivityMetrics): Promise<AIInsight[]> {
    if (this.analysisInProgress) {
      return this.cachedInsights;
    }

    this.analysisInProgress = true;

    try {
      const prompt = `You are FintekPro's AI business analyst. Analyze these platform metrics and provide actionable insights.

METRICS:
${JSON.stringify(metrics, null, 2)}

Generate exactly 5-8 insights in the following JSON format. Focus on:
1. PERFORMANCE: Identify slow modules, high error rates, optimization opportunities
2. SECURITY/ABUSE: Detect unusual patterns, potential abuse, security risks
3. REVENUE: Cart abandonment recovery, incomplete KYC follow-ups, dormant user re-engagement, upsell opportunities
4. ENGAGEMENT: User behavior patterns, drop-off points, feature adoption

Return a JSON array of insights:
[
  {
    "category": "performance|abuse|revenue|engagement|security",
    "priority": "critical|high|medium|low",
    "title": "Short actionable title",
    "description": "2-3 sentence explanation of the insight",
    "suggestedAction": "Specific action to take",
    "estimatedImpact": "Expected outcome (e.g., '15% error reduction', '₹50,000 potential recovery')",
    "actionType": "email|notification|config|manual"
  }
]

IMPORTANT: 
- Be specific with numbers from the metrics
- Prioritize revenue-generating and security insights
- Make suggestions actionable and measurable
- For dormant users (${metrics.users.dormant30Days}), suggest re-engagement campaigns
- For incomplete KYC users (${metrics.users.incompleteKyc}), suggest follow-up strategies
- For pending orders (${metrics.revenue.pendingOrders}), suggest conversion tactics
- For high-error modules, suggest specific fixes`;

      const aiResponse = await aiService.chat([
        { role: 'user', content: prompt }
      ], { model: 'gemini-2.5-flash', maxTokens: 2000 });
      
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
}

export const activityInsightsService = new ActivityInsightsService();
