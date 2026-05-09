import { db } from '../../db';
import { fmpUsageLog } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const DAILY_LIMIT = 249;
const AUTO_STOP_THRESHOLD = 245;
const ALERT_THRESHOLD = 0.8;

class FmpUsageMonitor {
  private memoryCount: number = 0;
  private currentDate: string = '';

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  async getUsageCount(): Promise<number> {
    const today = this.getToday();
    if (this.currentDate === today && this.memoryCount > 0) {
      return this.memoryCount;
    }

    try {
      const [record] = await db
        .select()
        .from(fmpUsageLog)
        .where(and(
          eq(fmpUsageLog.date, today),
          eq(fmpUsageLog.provider, 'fmp')
        ))
        .limit(1);

      this.currentDate = today;
      this.memoryCount = record?.callCount ?? 0;
      return this.memoryCount;
    } catch {
      return this.memoryCount;
    }
  }

  async canMakeCall(): Promise<boolean> {
    const count = await this.getUsageCount();
    return count < AUTO_STOP_THRESHOLD;
  }

  async getRemainingCalls(): Promise<number> {
    const count = await this.getUsageCount();
    return Math.max(0, AUTO_STOP_THRESHOLD - count);
  }

  async incrementUsage(endpoint?: string): Promise<{ count: number; remaining: number; alertLevel: string | null }> {
    const today = this.getToday();
    this.memoryCount++;
    this.currentDate = today;

    let alertLevel: string | null = null;
    if (this.memoryCount >= AUTO_STOP_THRESHOLD) {
      alertLevel = 'LIMIT_REACHED';
    } else if (this.memoryCount >= DAILY_LIMIT * ALERT_THRESHOLD) {
      alertLevel = 'WARNING_80PCT';
    }

    try {
      const [existing] = await db
        .select()
        .from(fmpUsageLog)
        .where(and(
          eq(fmpUsageLog.date, today),
          eq(fmpUsageLog.provider, 'fmp')
        ))
        .limit(1);

      if (existing) {
        const currentDetails = (existing.callDetails as any[]) || [];
        await db
          .update(fmpUsageLog)
          .set({
            callCount: this.memoryCount,
            lastCallAt: new Date(),
            lastAlertLevel: alertLevel || existing.lastAlertLevel,
            callDetails: [...currentDetails.slice(-50), { endpoint, time: new Date().toISOString() }],
          })
          .where(eq(fmpUsageLog.id, existing.id));
      } else {
        await db.insert(fmpUsageLog).values({
          date: today,
          provider: 'fmp',
          callCount: this.memoryCount,
          dailyLimit: DAILY_LIMIT,
          lastCallAt: new Date(),
          lastAlertLevel: alertLevel,
          callDetails: [{ endpoint, time: new Date().toISOString() }],
        });
      }
    } catch (err: any) {
      console.warn('[FmpUsage] Failed to persist usage count:', err.message);
    }

    if (alertLevel === 'WARNING_80PCT') {
      console.warn(`[FmpUsage] ⚠️ 80% daily limit reached (${this.memoryCount}/${DAILY_LIMIT})`);
    } else if (alertLevel === 'LIMIT_REACHED') {
      console.warn(`[FmpUsage] 🛑 Auto-stop threshold reached (${this.memoryCount}/${AUTO_STOP_THRESHOLD}). No more API calls today.`);
    }

    return {
      count: this.memoryCount,
      remaining: Math.max(0, AUTO_STOP_THRESHOLD - this.memoryCount),
      alertLevel,
    };
  }

  async getDailyStats(): Promise<{
    date: string;
    count: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    alertLevel: string | null;
  }> {
    const count = await this.getUsageCount();
    return {
      date: this.getToday(),
      count,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, AUTO_STOP_THRESHOLD - count),
      percentUsed: Math.round((count / DAILY_LIMIT) * 100),
      alertLevel: count >= AUTO_STOP_THRESHOLD ? 'LIMIT_REACHED' : count >= DAILY_LIMIT * ALERT_THRESHOLD ? 'WARNING_80PCT' : null,
    };
  }
}

export const fmpUsageMonitor = new FmpUsageMonitor();
