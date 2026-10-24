/**
 * SIP Renewal Trigger Scheduler
 *
 * Implements IRIS Lifecycle Trigger Initiative:
 * Automatically monitors maturing SIPs (within next 30 days) via IRIS KFintech
 * service and dispatches proactive renewal reminders to investors and advisors.
 *
 * FASP-AI & GCR v1.0 Rules:
 *   - Structured telemetry: { event, latency_ms, status }
 *   - Non-blocking error handling
 *   - FASP-AI: Decision-support only (suggests renewal, never executes autonomously)
 */

import cron, { type ScheduledTask } from "node-cron";
import { irisKfintechService } from "./iris-kfintech-service";
import { db } from "../db";
import { userNotifications } from "../../shared/schema";
import { logger } from "../logger";

export class SipRenewalScheduler {
  private cronJob: ScheduledTask | null = null;
  private isRunning = false;

  start(): void {
    if (this.cronJob) return;

    // Run every day at 09:15 AM IST (03:45 UTC)
    this.cronJob = cron.schedule("45 3 * * *", async () => {
      await this.runSipMaturityCheck();
    });

    logger.info("SIP_RENEWAL_SCHEDULER_STARTED", {
      event: "SIP_RENEWAL_SCHEDULER_STARTED",
      schedule: "45 3 * * * (09:15 IST Daily)",
      status: "active",
    });
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info("SIP_RENEWAL_SCHEDULER_STOPPED", {
        event: "SIP_RENEWAL_SCHEDULER_STOPPED",
      });
    }
  }

  async runSipMaturityCheck(): Promise<{
    checkedCount: number;
    remindersGenerated: number;
  }> {
    if (this.isRunning) {
      return { checkedCount: 0, remindersGenerated: 0 };
    }

    this.isRunning = true;
    const t0 = Date.now();
    let remindersGenerated = 0;

    try {
      if (!irisKfintechService.isConfigured) {
        logger.info("SIP_RENEWAL_CHECK_SKIPPED", {
          event: "SIP_RENEWAL_CHECK_SKIPPED",
          reason: "IRIS not configured",
          latency_ms: Date.now() - t0,
        });
        return { checkedCount: 0, remindersGenerated: 0 };
      }

      // Query IRIS SIP Maturity Calendar for next 30 days
      const maturityData: any = await irisKfintechService
        .getSipMaturityCalendar({ days: 30 })
        .catch((err) => {
          logger.warn("SIP_MATURITY_FETCH_WARNING", {
            event: "SIP_MATURITY_FETCH_WARNING",
            message: err?.message,
          });
          return null;
        });

      const maturingList: any[] = Array.isArray(maturityData)
        ? maturityData
        : maturityData?.data ?? [];

      for (const item of maturingList) {
        if (!item.userId && !item.pan) continue;

        try {
          if (item.userId) {
            await db.insert(userNotifications).values({
              userId: item.userId,
              type: "sip_maturity_warning",
              title: "SIP Renewal Reminder",
              message: `Your SIP in ${item.schemeName || "mutual fund scheme"} is scheduled to conclude soon. Contact your advisor or renew your SIP on FintekPro to maintain your compounding trajectory.`,
              isRead: false,
            });
            remindersGenerated++;
          }
        } catch {
          // Non-fatal per-item error
        }
      }

      logger.info("SIP_RENEWAL_CHECK_COMPLETED", {
        event: "SIP_RENEWAL_CHECK_COMPLETED",
        checked_count: maturingList.length,
        reminders_generated: remindersGenerated,
        latency_ms: Date.now() - t0,
        status: "success",
      });

      return {
        checkedCount: maturingList.length,
        remindersGenerated,
      };
    } catch (err: any) {
      logger.error("SIP_RENEWAL_CHECK_ERROR", {
        event: "SIP_RENEWAL_CHECK_ERROR",
        error: err.message,
        latency_ms: Date.now() - t0,
      });
      return { checkedCount: 0, remindersGenerated: 0 };
    } finally {
      this.isRunning = false;
    }
  }
}

export const sipRenewalScheduler = new SipRenewalScheduler();
