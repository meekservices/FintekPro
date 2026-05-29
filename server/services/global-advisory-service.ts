import { db } from "../db";
import { 
  marketsMaster, 
  marketProductMatrix, 
  globalAdvisoryAcknowledgments,
  globalAdvisoryAuditLog,
  platformFeatureFlags,
  userMarketPreferences,
  type MarketMaster,
  type MarketProductMatrix,
  type PlatformFeatureFlag,
  type UserMarketPreferences,
  type InsertMarketMaster,
  type InsertMarketProductMatrix,
  type InsertPlatformFeatureFlag,
  type InsertUserMarketPreferences
} from "@shared/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import { currencyExchangeService } from "./currency-exchange-service";

// Environment detection
function getCurrentEnvironment(): string {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "staging") return "staging";
  return "development";
}

// Feature Flag Service
export async function getFeatureFlag(flagKey: string): Promise<PlatformFeatureFlag | null> {
  const [flag] = await db.select().from(platformFeatureFlags).where(eq(platformFeatureFlags.flagKey, flagKey));
  return flag || null;
}

export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const flag = await getFeatureFlag(flagKey);
  if (!flag) return false;
  
  const env = getCurrentEnvironment();
  const isKilled = flag.isKillSwitch && flag.killSwitchActivatedAt;
  const isEnabledInEnv = flag.enabledEnvironments?.includes(env);
  
  return flag.isEnabled && !isKilled && !!isEnabledInEnv;
}

export async function getAllFeatureFlags(category?: string): Promise<PlatformFeatureFlag[]> {
  if (category) {
    return db.select().from(platformFeatureFlags).where(eq(platformFeatureFlags.category, category));
  }
  return db.select().from(platformFeatureFlags);
}

export async function updateFeatureFlag(flagKey: string, updates: Partial<InsertPlatformFeatureFlag>, userId?: string): Promise<PlatformFeatureFlag | null> {
  const [updated] = await db.update(platformFeatureFlags)
    .set({ ...updates, updatedAt: new Date(), updatedBy: userId })
    .where(eq(platformFeatureFlags.flagKey, flagKey))
    .returning();
  return updated || null;
}

export async function activateKillSwitch(flagKey: string, reason: string, userId?: string): Promise<PlatformFeatureFlag | null> {
  const [updated] = await db.update(platformFeatureFlags)
    .set({
      isEnabled: false,
      killSwitchActivatedAt: new Date(),
      killSwitchReason: reason,
      updatedAt: new Date(),
      updatedBy: userId
    })
    .where(eq(platformFeatureFlags.flagKey, flagKey))
    .returning();
  return updated || null;
}

// Markets Service
export async function getEnabledMarkets(): Promise<MarketMaster[]> {
  const env = getCurrentEnvironment();
  return db.select()
    .from(marketsMaster)
    .where(
      and(
        eq(marketsMaster.isEnabled, true),
        sql`${marketsMaster.enabledEnvironments} && ARRAY[${env}]::text[]`
      )
    )
    .orderBy(marketsMaster.displayOrder);
}

export async function getAllMarkets(): Promise<MarketMaster[]> {
  return db.select().from(marketsMaster).orderBy(marketsMaster.displayOrder);
}

export async function getMarketByCode(marketCode: string): Promise<MarketMaster | null> {
  const [market] = await db.select().from(marketsMaster).where(eq(marketsMaster.marketCode, marketCode));
  return market || null;
}

export async function updateMarket(marketCode: string, updates: Partial<InsertMarketMaster>, userId?: string): Promise<MarketMaster | null> {
  const [updated] = await db.update(marketsMaster)
    .set({ ...updates, updatedAt: new Date(), updatedBy: userId })
    .where(eq(marketsMaster.marketCode, marketCode))
    .returning();
  return updated || null;
}

export async function toggleMarketEnabled(marketCode: string, isEnabled: boolean, userId?: string): Promise<MarketMaster | null> {
  return updateMarket(marketCode, { isEnabled }, userId);
}

// Market Product Matrix Service
export async function getProductsForMarket(marketCode: string): Promise<MarketProductMatrix[]> {
  return db.select()
    .from(marketProductMatrix)
    .where(and(
      eq(marketProductMatrix.marketCode, marketCode),
      eq(marketProductMatrix.isEnabled, true)
    ));
}

export async function getAllMarketProducts(): Promise<MarketProductMatrix[]> {
  return db.select().from(marketProductMatrix);
}

export async function updateMarketProduct(id: string, updates: Partial<InsertMarketProductMatrix>, userId?: string): Promise<MarketProductMatrix | null> {
  const [updated] = await db.update(marketProductMatrix)
    .set({ ...updates, updatedAt: new Date(), updatedBy: userId })
    .where(eq(marketProductMatrix.id, id))
    .returning();
  return updated || null;
}

export async function isProductAllowedInMarket(marketCode: string, productCategory: string): Promise<{ allowed: boolean; advisoryLevel: string; restrictions?: string }> {
  const [product] = await db.select()
    .from(marketProductMatrix)
    .where(and(
      eq(marketProductMatrix.marketCode, marketCode),
      eq(marketProductMatrix.productCategory, productCategory),
      eq(marketProductMatrix.isEnabled, true)
    ));
  
  if (!product) {
    return { allowed: false, advisoryLevel: 'NONE', restrictions: 'Product not available in this market' };
  }
  
  return {
    allowed: true,
    advisoryLevel: product.advisoryLevel,
    restrictions: product.etfOnlyRestriction ? 'ETF only' : undefined
  };
}

// User Market Preferences Service
export async function getUserMarketPreferences(userId: string): Promise<UserMarketPreferences | null> {
  const [prefs] = await db.select().from(userMarketPreferences).where(eq(userMarketPreferences.userId, userId));
  return prefs || null;
}

export async function upsertUserMarketPreferences(userId: string, updates: Partial<InsertUserMarketPreferences>): Promise<UserMarketPreferences> {
  const existing = await getUserMarketPreferences(userId);
  
  if (existing) {
    const [updated] = await db.update(userMarketPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userMarketPreferences.userId, userId))
      .returning();
    return updated;
  } else {
    const [created] = await db.insert(userMarketPreferences)
      .values({ userId, ...updates })
      .returning();
    return created;
  }
}

export async function setSelectedMarket(userId: string, marketCode: string): Promise<UserMarketPreferences> {
  const market = await getMarketByCode(marketCode);
  if (!market) {
    throw new Error(`Market ${marketCode} not found`);
  }
  
  return upsertUserMarketPreferences(userId, {
    selectedMarket: marketCode,
    displayCurrency: market.baseCurrency
  });
}

// Acknowledgment Service
export async function hasUserAcknowledged(userId: string, marketCode: string, acknowledgmentType: string): Promise<boolean> {
  const [ack] = await db.select()
    .from(globalAdvisoryAcknowledgments)
    .where(and(
      eq(globalAdvisoryAcknowledgments.userId, userId),
      eq((globalAdvisoryAcknowledgments as any).marketCode, marketCode),
      eq(globalAdvisoryAcknowledgments.acknowledgmentType, acknowledgmentType),
      eq((globalAdvisoryAcknowledgments as any).isRevoked, false)
    ))
    .orderBy(desc(globalAdvisoryAcknowledgments.acknowledgedAt))
    .limit(1);
  
  if (!ack) return false;
  if ((ack as any).expiresAt && new Date((ack as any).expiresAt) < new Date()) return false;
  
  return true;
}

export async function recordAcknowledgment(
  userId: string,
  marketCode: string,
  acknowledgmentType: string,
  disclaimerVersion: string,
  disclaimerText: string,
  context: { ipAddress?: string; userAgent?: string; sessionId?: string }
): Promise<any> {
  const [ack] = await db.insert(globalAdvisoryAcknowledgments)
    .values({
      userId,
      marketCode,
      acknowledgmentType,
      disclaimerVersion,
      disclaimerText,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId
    })
    .returning();
  
  await logAuditEvent(userId, 'acknowledgment', acknowledgmentType, {
    marketCode,
    disclaimerVersion,
    ipAddress: context.ipAddress
  });
  
  return ack;
}

export async function getUserAcknowledgments(userId: string): Promise<any[]> {
  return db.select()
    .from(globalAdvisoryAcknowledgments)
    .where(eq(globalAdvisoryAcknowledgments.userId, userId))
    .orderBy(desc(globalAdvisoryAcknowledgments.acknowledgedAt));
}

// Audit Log Service
function generateChecksum(data: object): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

export async function logAuditEvent(
  userId: string | null,
  eventType: string,
  eventSubType?: string,
  eventData?: object,
  context?: {
    marketCode?: string;
    productCategory?: string;
    aiRationale?: string;
    ipAddress?: string;
    userAgent?: string;
    requestPath?: string;
    advisoryClassification?: string;
    disclaimerShown?: boolean;
    sessionId?: string;
  }
): Promise<any> {
  const logEntry = {
    userId,
    eventType,
    eventSubType,
    eventData,
    ...context
  };
  
  const checksumHash = generateChecksum({ ...logEntry, timestamp: new Date().toISOString() });
  
  const [log] = await db.insert(globalAdvisoryAuditLog)
    .values({
      ...logEntry,
      checksumHash
    })
    .returning();
  
  return log;
}

export async function getAuditLogs(filters: {
  userId?: string;
  marketCode?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<any[]> {
  let query = db.select().from(globalAdvisoryAuditLog);
  
  const conditions = [];
  if (filters.userId) conditions.push(eq(globalAdvisoryAuditLog.userId, filters.userId));
  if (filters.marketCode) conditions.push(eq(globalAdvisoryAuditLog.marketCode, filters.marketCode));
  if (filters.eventType) conditions.push(eq(globalAdvisoryAuditLog.eventType, filters.eventType));
  if (filters.startDate) conditions.push(sql`${globalAdvisoryAuditLog.eventTimestamp} >= ${filters.startDate}`);
  if (filters.endDate) conditions.push(sql`${globalAdvisoryAuditLog.eventTimestamp} <= ${filters.endDate}`);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  return query.orderBy(desc(globalAdvisoryAuditLog.eventTimestamp)).limit(filters.limit || 100);
}

// Execution Guard - CRITICAL: Prevents execution outside India
export async function canExecuteInMarket(marketCode: string): Promise<{ canExecute: boolean; reason?: string }> {
  const market = await getMarketByCode(marketCode);
  
  if (!market) {
    return { canExecute: false, reason: 'Market not found' };
  }
  
  if (!market.isEnabled) {
    return { canExecute: false, reason: 'Market is not enabled' };
  }
  
  if (!market.executionAllowed) {
    return { 
      canExecute: false, 
      reason: `Execution is not permitted in ${market.marketName}. Only analytics and advisory services are available.` 
    };
  }
  
  return { canExecute: true };
}

// Advisory Mode Helpers
export function getAdvisoryBadge(advisoryLevel: string): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  switch (advisoryLevel) {
    case 'FULL':
      return { label: 'Full Advisory', variant: 'default' };
    case 'ANALYTICS_ONLY':
      return { label: 'Analytics-Only Advisory', variant: 'secondary' };
    default:
      return { label: 'Limited', variant: 'outline' };
  }
}

// Currency Conversion Integration
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ convertedAmount: number; rate: number; fromCurrency: string; toCurrency: string }> {
  const convertedAmount = await currencyExchangeService.convertAmount(amount, fromCurrency, toCurrency);
  const rate = amount > 0 ? convertedAmount / amount : 0;
  
  return {
    convertedAmount,
    rate,
    fromCurrency,
    toCurrency
  };
}

export async function getExchangeRates(baseCurrency: string = "INR"): Promise<Record<string, number>> {
  return currencyExchangeService.fetchExchangeRates(baseCurrency);
}

// User Market Eligibility Service
export interface MarketEligibility {
  marketCode: string;
  marketName: string;
  isEligible: boolean;
  advisoryLevel: string;
  canExecute: boolean;
  allowedProducts: string[];
  restrictions: string[];
  baseCurrency: string;
  flagEmoji: string | null;
}

export async function getUserMarketEligibility(userId: string): Promise<{
  markets: MarketEligibility[];
  primaryMarket: string;
  isAnalyticsMode: boolean;
}> {
  const enabledMarkets = await getEnabledMarkets();
  const userPrefs = await getUserMarketPreferences(userId);
  
  const eligibilityResults: MarketEligibility[] = [];
  
  for (const market of enabledMarkets) {
    const products = await getProductsForMarket(market.marketCode);
    const allowedProducts = products.filter((p: any) => p.isEnabled).map((p: any) => p.productCategory);
    
    const restrictions: string[] = [];
    if (!market.executionAllowed) {
      restrictions.push("Analytics-only mode - execution not available");
    }
    if (products.some((p: any) => p.etfOnlyRestriction)) {
      restrictions.push("ETF-only restriction applies to some products");
    }
    if (products.some((p: any) => p.requiresAccreditedInvestor)) {
      restrictions.push("Some products require accredited investor status");
    }
    
    eligibilityResults.push({
      marketCode: market.marketCode,
      marketName: market.marketName,
      isEligible: true,
      advisoryLevel: market.advisoryLevel,
      canExecute: market.executionAllowed,
      allowedProducts,
      restrictions,
      baseCurrency: market.baseCurrency,
      flagEmoji: market.flagEmoji
    });
  }
  
  const primaryMarket = userPrefs?.selectedMarket || "IN";
  const selectedMarket = enabledMarkets.find((m: any) => m.marketCode === primaryMarket);
  const isAnalyticsMode = !selectedMarket?.executionAllowed;
  
  return {
    markets: eligibilityResults,
    primaryMarket,
    isAnalyticsMode
  };
}

export async function getMarketEligibilityForUser(userId: string, marketCode: string): Promise<MarketEligibility | null> {
  const market = await getMarketByCode(marketCode);
  if (!market) return null;
  
  const products = await getProductsForMarket(marketCode);
  const allowedProducts = products.filter((p: any) => p.isEnabled).map((p: any) => p.productCategory);
  
  const restrictions: string[] = [];
  if (!market.executionAllowed) {
    restrictions.push("Analytics-only mode - execution not available");
  }
  if (products.some((p: any) => p.etfOnlyRestriction)) {
    restrictions.push("ETF-only restriction applies to some products");
  }
  if (products.some((p: any) => p.requiresAccreditedInvestor)) {
    restrictions.push("Some products require accredited investor status");
  }
  
  return {
    marketCode: market.marketCode,
    marketName: market.marketName,
    isEligible: market.isEnabled,
    advisoryLevel: market.advisoryLevel,
    canExecute: market.executionAllowed,
    allowedProducts,
    restrictions,
    baseCurrency: market.baseCurrency,
    flagEmoji: market.flagEmoji
  };
}

// Jurisdiction-based Feature Flags
export interface JurisdictionFeatureFlags {
  canExecuteTrades: boolean;
  canViewAnalytics: boolean;
  canAccessRealTimeData: boolean;
  canAccessResearch: boolean;
  canAccessAlerts: boolean;
  hasEtfOnlyRestriction: boolean;
  requiresAccreditedStatus: boolean;
  requiredAcknowledgments: string[];
}

export async function getJurisdictionFeatureFlags(marketCode: string): Promise<JurisdictionFeatureFlags> {
  const market = await getMarketByCode(marketCode);
  const products = await getProductsForMarket(marketCode);
  
  const requiredAcknowledgments: string[] = [];
  if (marketCode !== "IN") {
    requiredAcknowledgments.push("global_advisory_disclaimer");
  }
  
  return {
    canExecuteTrades: market?.executionAllowed ?? false,
    canViewAnalytics: market?.isEnabled ?? false,
    canAccessRealTimeData: market?.advisoryLevel === "FULL",
    canAccessResearch: market?.isEnabled ?? false,
    canAccessAlerts: market?.isEnabled ?? false,
    hasEtfOnlyRestriction: products.some((p: any) => p.etfOnlyRestriction),
    requiresAccreditedStatus: products.some((p: any) => p.requiresAccreditedInvestor),
    requiredAcknowledgments
  };
}

// SEBI Inspection Export
export async function generateSEBIExport(userId: string, startDate: Date, endDate: Date): Promise<{
  advisoryViews: any[];
  acknowledgments: any[];
  summary: {
    totalViews: number;
    marketBreakdown: Record<string, number>;
    eventTypeBreakdown: Record<string, number>;
  };
}> {
  const advisoryViews = await getAuditLogs({
    userId,
    startDate,
    endDate,
    limit: 10000
  });
  
  const acknowledgments = await db.select()
    .from(globalAdvisoryAcknowledgments)
    .where(and(
      eq(globalAdvisoryAcknowledgments.userId, userId),
      sql`${globalAdvisoryAcknowledgments.acknowledgedAt} >= ${startDate}`,
      sql`${globalAdvisoryAcknowledgments.acknowledgedAt} <= ${endDate}`
    ));
  
  const marketBreakdown: Record<string, number> = {};
  const eventTypeBreakdown: Record<string, number> = {};
  
  for (const view of advisoryViews) {
    if (view.marketCode) {
      marketBreakdown[view.marketCode] = (marketBreakdown[view.marketCode] || 0) + 1;
    }
    eventTypeBreakdown[view.eventType] = (eventTypeBreakdown[view.eventType] || 0) + 1;
  }
  
  return {
    advisoryViews,
    acknowledgments,
    summary: {
      totalViews: advisoryViews.length,
      marketBreakdown,
      eventTypeBreakdown
    }
  };
}
