/**
 * Data Cleanup Cron Job
 * 
 * Runs daily to:
 * - Soft-delete holdings 90 days after consent revocation
 * - Send warnings 30 days before deletion
 * - Clean up orphaned data
 */

import cron from 'node-cron';
import { db } from './db';
import { comprehensiveHoldings, dataSourceConsents } from '@shared/schema';
import { eq, and, isNull, sql, lt } from 'drizzle-orm';
import { emailService } from './email-service';
import { whatsappService } from './whatsapp';

// Run daily at 3 AM IST (9:30 PM UTC previous day)
const CRON_SCHEDULE = '30 21 * * *'; // 9:30 PM UTC = 3:00 AM IST

const DATA_RETENTION_DAYS = 90; // Days to retain data after consent revocation
const WARNING_DAYS_BEFORE_DELETION = 30; // Days before deletion to send warning

class DataCleanupService {
  
  /**
   * Soft-delete holdings 90 days after consent revocation
   */
  async softDeleteExpiredHoldings(): Promise<void> {
    console.log('🗑️  Starting soft-delete of expired holdings...');
    
    try {
      // Find all revoked consents
      const revokedConsents = await db
        .select()
        .from(dataSourceConsents)
        .where(eq(dataSourceConsents.isActive, false));

      let totalDeleted = 0;

      for (const consent of revokedConsents) {
        if (!consent.revokedAt) continue;

        // Calculate deletion date (90 days after revocation)
        const revokedDate = new Date(consent.revokedAt);
        const deletionDate = new Date(revokedDate);
        deletionDate.setDate(deletionDate.getDate() + DATA_RETENTION_DAYS);

        const now = new Date();
        
        // If 90 days have passed since revocation, soft-delete the holdings
        if (now >= deletionDate) {
          const result = await db
            .update(comprehensiveHoldings)
            .set({
              deletedAt: now,
              updatedAt: now
            })
            .where(
              and(
                eq(comprehensiveHoldings.userId, consent.userId),
                eq(comprehensiveHoldings.dataSource, consent.dataSource),
                isNull(comprehensiveHoldings.deletedAt) // Only delete if not already deleted
              )
            );

          console.log(`✅ Soft-deleted holdings for user ${consent.userId}, source ${consent.dataSource}`);
          totalDeleted++;
        }
      }

      console.log(`🎯 Total holdings soft-deleted: ${totalDeleted}`);
    } catch (error) {
      console.error('❌ Error soft-deleting holdings:', error);
    }
  }

  /**
   * Send warning notifications 30 days before data deletion
   */
  async sendDeletionWarnings(): Promise<void> {
    console.log('⚠️  Sending deletion warning notifications...');
    
    try {
      // Find all revoked consents
      const revokedConsents = await db
        .select()
        .from(dataSourceConsents)
        .where(eq(dataSourceConsents.isActive, false));

      let warningsSent = 0;

      for (const consent of revokedConsents) {
        if (!consent.revokedAt) continue;

        // Calculate warning date (60 days after revocation, 30 days before deletion)
        const revokedDate = new Date(consent.revokedAt);
        const warningDate = new Date(revokedDate);
        warningDate.setDate(warningDate.getDate() + (DATA_RETENTION_DAYS - WARNING_DAYS_BEFORE_DELETION));

        const deletionDate = new Date(revokedDate);
        deletionDate.setDate(deletionDate.getDate() + DATA_RETENTION_DAYS);

        const now = new Date();
        
        // Send warning if we're at the 60-day mark (30 days before deletion)
        // Only send if warning hasn't been sent already (idempotency check)
        if (now >= warningDate && now < deletionDate && !consent.deletionWarningSentAt) {
          // Check if holdings exist for this consent
          const holdings = await db
            .select({ count: sql<number>`count(*)` })
            .from(comprehensiveHoldings)
            .where(
              and(
                eq(comprehensiveHoldings.userId, consent.userId),
                eq(comprehensiveHoldings.dataSource, consent.dataSource),
                isNull(comprehensiveHoldings.deletedAt)
              )
            );

          const holdingCount = Number(holdings[0]?.count || 0);

          if (holdingCount > 0) {
            // Get user details for notification
            const user = await db.query.users.findFirst({
              where: (users: any, { eq }: any) => eq(users.id, consent.userId)
            });

            if (user?.email) {
              try {
                await this.sendDeletionWarning(
                  user.email,
                  user.mobile,
                  consent.dataSource,
                  holdingCount,
                  deletionDate
                );
                
                // Mark warning as sent to prevent duplicate notifications
                await db
                  .update(dataSourceConsents)
                  .set({ deletionWarningSentAt: now })
                  .where(eq(dataSourceConsents.id, consent.id));
                
                warningsSent++;
              } catch (notificationError) {
                console.error(`Failed to send deletion warning to user ${consent.userId}:`, notificationError);
              }
            }
          }
        }
      }

      console.log(`📧 Total deletion warnings sent: ${warningsSent}`);
    } catch (error) {
      console.error('❌ Error sending deletion warnings:', error);
    }
  }

  /**
   * Send deletion warning notification via email and WhatsApp
   */
  private async sendDeletionWarning(
    email: string,
    mobile: string | null,
    dataSource: string,
    holdingCount: number,
    deletionDate: Date
  ): Promise<void> {
    const daysUntilDeletion = Math.ceil((deletionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const formattedDate = deletionDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const subject = `⚠️ Data Deletion Warning - ${holdingCount} holdings from ${dataSource}`;
    const message = `
Dear User,

This is a reminder that you revoked consent for ${dataSource} data access.

⚠️ IMPORTANT: Your ${holdingCount} holdings from ${dataSource} will be permanently deleted in ${daysUntilDeletion} days (on ${formattedDate}).

To prevent deletion and restore access:
1. Log in to your FintekPro account
2. Go to Auto-Population Dashboard
3. Renew your consent for ${dataSource}

If you have any questions, please contact our support team.

Best regards,
FintekPro Team
    `.trim();

    // Send email notification
    try {
      await emailService.sendEmail({
        to: email,
        subject,
        html: `<pre>${message}</pre>`,
        text: message
      });
      console.log(`📧 Deletion warning email sent to ${email}`);
    } catch (error) {
      console.error(`Failed to send deletion warning email to ${email}:`, error);
    }

    // Send WhatsApp notification
    if (mobile) {
      try {
        await whatsappService.sendMessage(
          mobile,
          `⚠️ Data Deletion Warning\n\n${message}`
        );
        console.log(`📱 Deletion warning WhatsApp sent to ${mobile}`);
      } catch (error) {
        console.error(`Failed to send deletion warning WhatsApp to ${mobile}:`, error);
      }
    }
  }

  /**
   * Run all cleanup tasks
   */
  async runCleanup(): Promise<void> {
    console.log('\n🧹 ========== DATA CLEANUP JOB STARTED ==========');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    
    const startTime = Date.now();
    
    // Send warnings first (30 days before deletion)
    await this.sendDeletionWarnings();
    
    // Then perform soft-deletes (90 days after revocation)
    await this.softDeleteExpiredHoldings();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Data cleanup completed in ${duration}ms`);
    console.log('🧹 ========== DATA CLEANUP JOB COMPLETED ==========\n');
  }
}

const dataCleanupService = new DataCleanupService();

// Schedule the cron job
export const startDataCleanupCron = () => {
  cron.schedule(CRON_SCHEDULE, async () => {
    await dataCleanupService.runCleanup();
  }, {
    timezone: 'UTC'
  });

  console.log('✅ Data cleanup cron job initialized (runs daily at 3:00 AM IST)');
};

// Export for manual testing
export { dataCleanupService };
