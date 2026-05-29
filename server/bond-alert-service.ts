import { db } from "./db";
import { bondHoldings, fixedIncomeNotificationPrefs } from "@shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import cron from "node-cron";

/**
 * Bond Alert Service
 * Handles coupon payment tracking and maturity date alerts
 */

export interface CouponPayment {
  holdingId: string;
  userId: string;
  isin: string;
  bondName: string;
  couponRate: number;
  paymentDate: Date;
  estimatedAmount: number;
  status: 'upcoming' | 'due' | 'paid';
}

export interface MaturityAlert {
  holdingId: string;
  userId: string;
  isin: string;
  bondName: string;
  maturityDate: Date;
  faceValue: number;
  quantity: number;
  maturityAmount: number;
  daysToMaturity: number;
}

/**
 * Calculate next coupon payment date based on issue date and frequency
 */
export function calculateNextCouponDate(
  lastCouponDate: Date | null,
  issueDate: Date,
  frequency: 'annual' | 'semi-annual' | 'quarterly' | 'monthly'
): Date {
  const today = new Date();
  let nextDate: Date;

  if (lastCouponDate) {
    nextDate = new Date(lastCouponDate);
  } else {
    nextDate = new Date(issueDate);
  }

  const monthsToAdd = 
    frequency === 'annual' ? 12 :
    frequency === 'semi-annual' ? 6 :
    frequency === 'quarterly' ? 3 : 1;

  // Find next coupon date after today
  while (nextDate <= today) {
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
  }

  return nextDate;
}

/**
 * Get upcoming coupon payments for a user
 */
export async function getUpcomingCoupons(userId: string, daysAhead: number = 30): Promise<CouponPayment[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);

  const holdings = await db.select()
    .from(bondHoldings)
    .where(
      and(
        eq(bondHoldings.userId, userId),
        isNotNull(bondHoldings.couponRate)
      )
    );

  const upcomingCoupons: CouponPayment[] = [];

  for (const holding of holdings) {
    const couponRate = parseFloat(holding.couponRate || '0');
    if (couponRate <= 0) continue;

    // Use nextCouponDate from holding if available, otherwise calculate from purchaseDate
    // Note: purchaseDate and nextCouponDate are string types from PostgreSQL date columns
    let nextCouponDateValue: Date;
    if (holding.nextCouponDate) {
      nextCouponDateValue = new Date(holding.nextCouponDate);
    } else {
      // Calculate next coupon from purchase date (string)
      const purchaseDateValue = new Date(holding.purchaseDate);
      nextCouponDateValue = calculateNextCouponDate(null, purchaseDateValue, 'semi-annual');
    }

    if (nextCouponDateValue >= today && nextCouponDateValue <= futureDate) {
      const faceValue = parseFloat(holding.faceValue || '1000');
      const quantity = holding.quantity || 1;
      const estimatedAmount = (faceValue * quantity * couponRate / 100) / 2; // Semi-annual

      upcomingCoupons.push({
        holdingId: holding.id,
        userId: holding.userId ?? '',
        isin: holding.isin,
        bondName: holding.bondName,
        couponRate,
        paymentDate: nextCouponDateValue,
        estimatedAmount,
        status: nextCouponDateValue <= today ? 'due' : 'upcoming'
      });
    }
  }

  return upcomingCoupons.sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime());
}

/**
 * Get maturity alerts for a user
 */
export async function getMaturityAlerts(userId: string, daysAhead: number = 90): Promise<MaturityAlert[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);

  const holdings = await db.select()
    .from(bondHoldings)
    .where(
      and(
        eq(bondHoldings.userId, userId),
        isNotNull(bondHoldings.maturityDate)
      )
    );

  const alerts: MaturityAlert[] = [];

  for (const holding of holdings) {
    if (!holding.maturityDate) continue;
    
    const maturityDate = new Date(holding.maturityDate);
    if (maturityDate >= today && maturityDate <= futureDate) {
      const faceValue = parseFloat(holding.faceValue || '1000');
      const quantity = holding.quantity || 1;
      const daysToMaturity = Math.ceil((maturityDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      alerts.push({
        holdingId: holding.id,
        userId: holding.userId ?? '',
        isin: holding.isin,
        bondName: holding.bondName,
        maturityDate,
        faceValue,
        quantity,
        maturityAmount: faceValue * quantity,
        daysToMaturity
      });
    }
  }

  return alerts.sort((a, b) => a.daysToMaturity - b.daysToMaturity);
}

/**
 * Get all bond alerts for a user (coupons + maturities)
 */
export async function getBondAlerts(userId: string): Promise<{
  coupons: CouponPayment[];
  maturities: MaturityAlert[];
  summary: {
    upcomingCoupons: number;
    upcomingMaturities: number;
    totalUpcomingCouponAmount: number;
    totalMaturityAmount: number;
    nextCouponDate: Date | null;
    nextMaturityDate: Date | null;
  };
}> {
  const coupons = await getUpcomingCoupons(userId, 60);
  const maturities = await getMaturityAlerts(userId, 180);

  const totalUpcomingCouponAmount = coupons.reduce((sum, c) => sum + c.estimatedAmount, 0);
  const totalMaturityAmount = maturities.reduce((sum, m) => sum + m.maturityAmount, 0);

  return {
    coupons,
    maturities,
    summary: {
      upcomingCoupons: coupons.length,
      upcomingMaturities: maturities.length,
      totalUpcomingCouponAmount,
      totalMaturityAmount,
      nextCouponDate: coupons[0]?.paymentDate || null,
      nextMaturityDate: maturities[0]?.maturityDate || null
    }
  };
}

/**
 * Create alert preferences for user
 */
export async function createAlertPreferences(userId: string, preferences: {
  couponAlert?: boolean;
  maturityAlert?: boolean;
  settlementAlert?: boolean;
  alertDaysBefore?: number;
  alertChannel?: 'email' | 'sms' | 'push' | 'all';
}): Promise<void> {
  const existing = await db.select()
    .from(fixedIncomeNotificationPrefs)
    .where(eq(fixedIncomeNotificationPrefs.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db.update(fixedIncomeNotificationPrefs)
      .set({
        couponPaymentReminder: preferences.couponAlert,
        maturityReminder: preferences.maturityAlert,
        settlementNotification: preferences.settlementAlert,
        reminderDaysBefore: preferences.alertDaysBefore,
        preferredChannel: preferences.alertChannel,
        updatedAt: new Date(),
      } as any)
      .where(eq(fixedIncomeNotificationPrefs.userId, userId));
  } else {
    await (db.insert(fixedIncomeNotificationPrefs) as any).values({
      id: `ALP-${Date.now()}`,
      userId,
      couponPaymentReminder: preferences.couponAlert ?? true,
      maturityReminder: preferences.maturityAlert ?? true,
      settlementNotification: preferences.settlementAlert ?? true,
      reminderDaysBefore: preferences.alertDaysBefore ?? 7,
      preferredChannel: preferences.alertChannel ?? 'email',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

/**
 * Send alerts to users (called by cron job)
 */
async function sendPendingAlerts(): Promise<void> {
  console.log('[Alert Service] Checking for pending alerts...');

  // Get all users with alert preferences
  const alertPrefs = await db.select().from(fixedIncomeNotificationPrefs) as any[];

  for (const pref of alertPrefs) {
    if (!pref.userId) continue;

    try {
      // Check coupon alerts
      if (pref.couponPaymentReminder) {
        const coupons = await getUpcomingCoupons(pref.userId, pref.reminderDaysBefore || 7);
        for (const coupon of coupons) {
          console.log(`[Alert] Coupon due for ${pref.userId}: ${coupon.bondName} - ₹${coupon.estimatedAmount.toLocaleString()}`);
          // In production: Send email/SMS/push notification
        }
      }

      // Check maturity alerts
      if (pref.maturityReminder) {
        const maturities = await getMaturityAlerts(pref.userId, pref.reminderDaysBefore || 30);
        for (const maturity of maturities) {
          if (maturity.daysToMaturity <= (pref.reminderDaysBefore || 30)) {
            console.log(`[Alert] Maturity in ${maturity.daysToMaturity} days for ${pref.userId}: ${maturity.bondName}`);
            // In production: Send email/SMS/push notification
          }
        }
      }
    } catch (error) {
      console.error(`[Alert Service] Error processing alerts for user ${pref.userId}:`, error);
    }
  }
}

/**
 * Initialize alert cron jobs
 */
export function initializeAlertCronJobs(): void {
  // Run coupon/maturity alerts daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[Alert Cron] Running daily alert check...');
    await sendPendingAlerts();
  });

  console.log('✅ Bond alert cron jobs initialized (daily at 9:00 AM)');
}

/**
 * Manual trigger for testing
 */
export async function triggerAlertCheck(): Promise<void> {
  await sendPendingAlerts();
}
