import cron from "node-cron";
import { db } from "./db";
import { dataSourceConsents } from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { autoPopulationOrchestrator } from "./services/auto-population-orchestrator";

/**
 * Auto-Population Scheduled Sync Cron Job
 * Runs every 6 hours to automatically sync portfolio data for users with due syncs
 * Based on user's sync frequency preference (daily/weekly/monthly)
 */

const BATCH_SIZE = 50; // Max users to process per run
const USER_DELAY_MS = 3000; // 3 seconds delay between each user (avoid API throttling)

/**
 * Calculate delay between user processing to prevent API throttling
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main cron job function to process scheduled syncs
 */
async function processScheduledSyncs(): Promise<void> {
  const startTime = Date.now();
  console.log(`🔄 [Auto-Population Cron] Starting scheduled sync check at ${new Date().toISOString()}`);

  try {
    // Find all users with active consents where next sync is due
    const dueConsents = await db
      .select({
        userId: dataSourceConsents.userId,
        dataSource: dataSourceConsents.dataSource,
        lastSyncedAt: dataSourceConsents.lastSyncedAt,
        syncFrequency: dataSourceConsents.syncFrequency,
        nextSyncDue: dataSourceConsents.nextSyncDue,
      })
      .from(dataSourceConsents)
      .where(
        and(
          eq(dataSourceConsents.isActive, true),
          eq(dataSourceConsents.consentGiven, true),
          lte(dataSourceConsents.nextSyncDue, new Date())
        )
      )
      .limit(1000); // Safety limit

    if (dueConsents.length === 0) {
      console.log(`✅ [Auto-Population Cron] No syncs due. Checked ${dueConsents.length} consents.`);
      return;
    }

    // Group consents by userId (each user may have multiple data source consents due)
    const userSyncMap = new Map<string, number>();
    dueConsents.forEach(consent => {
      const count = userSyncMap.get(consent.userId) || 0;
      userSyncMap.set(consent.userId, count + 1);
    });

    const usersToSync = Array.from(userSyncMap.keys());
    const totalUsers = usersToSync.length;
    const batchedUsers = usersToSync.slice(0, BATCH_SIZE);

    console.log(`📊 [Auto-Population Cron] Found ${totalUsers} users with due syncs`);
    console.log(`🎯 [Auto-Population Cron] Processing batch of ${batchedUsers.length} users`);

    let successCount = 0;
    let failureCount = 0;

    // Process users with rate limiting
    for (let i = 0; i < batchedUsers.length; i++) {
      const userId = batchedUsers[i];
      const userDueSources = userSyncMap.get(userId) || 0;

      try {
        console.log(`🔄 [Auto-Population Cron] [${i + 1}/${batchedUsers.length}] Syncing user ${userId} (${userDueSources} sources due)`);
        
        // Trigger auto-population for this user
        await autoPopulationOrchestrator.initiateFromKYC(userId, 'scheduled_sync');
        
        successCount++;
        
        // Rate limiting: Wait before processing next user (except for the last one)
        if (i < batchedUsers.length - 1) {
          await delay(USER_DELAY_MS);
        }
      } catch (error) {
        console.error(`❌ [Auto-Population Cron] Failed to sync user ${userId}:`, error);
        failureCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [Auto-Population Cron] Completed scheduled sync check in ${duration}s`);
    console.log(`📈 [Auto-Population Cron] Results: ${successCount} success, ${failureCount} failures out of ${batchedUsers.length} users`);
    
    if (totalUsers > BATCH_SIZE) {
      console.log(`⚠️  [Auto-Population Cron] ${totalUsers - BATCH_SIZE} users deferred to next run`);
    }
  } catch (error) {
    console.error(`❌ [Auto-Population Cron] Critical error in scheduled sync:`, error);
  }
}

/**
 * Initialize the auto-population scheduled sync cron job
 * Runs every 6 hours: 2 AM, 8 AM, 2 PM, 8 PM IST
 */
export function initAutoPopulationSyncCron(): void {
  // Run every 6 hours at minute 0 of hours 2, 8, 14, 20 (IST: 2 AM, 8 AM, 2 PM, 8 PM)
  cron.schedule("0 2,8,14,20 * * *", async () => {
    await processScheduledSyncs();
  }, {
    timezone: "Asia/Kolkata" // IST timezone
  });

  console.log("✅ Auto-population scheduled sync cron job initialized (runs every 6 hours at 2 AM, 8 AM, 2 PM, 8 PM IST)");
}
