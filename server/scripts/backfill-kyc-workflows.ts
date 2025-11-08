/**
 * Backfill KYC Workflows for Existing Users
 * 
 * This script creates kyc_workflows entries for users who completed KYC before
 * the Priority Workflow system was implemented.
 * 
 * Users with smartKycCompletedAt set are given 'verified' workflow status
 * with method='basic_kyc' to indicate they used the old wizard flow.
 * 
 * Usage: tsx server/scripts/backfill-kyc-workflows.ts
 */

import { db } from '../db';
import { users, kycWorkflows, kycVerificationAttempts } from '@shared/schema';
import { isNotNull, sql } from 'drizzle-orm';
import { logger } from '../services/logger';

async function backfillKYCWorkflows() {
  logger.info('Starting KYC workflows backfill for existing users');

  try {
    // Find all users who have completed Smart KYC
    const verifiedUsers = await db
      .select()
      .from(users)
      .where(isNotNull(users.smartKycCompletedAt));

    logger.info(`Found ${verifiedUsers.length} users with completed Smart KYC`);

    if (verifiedUsers.length === 0) {
      logger.info('No users to backfill, exiting');
      return;
    }

    // Create workflow entries for each verified user
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const user of verifiedUsers) {
      try {
        // Check if workflow already exists for this user
        const existingWorkflow = await db
          .select()
          .from(kycWorkflows)
          .where(sql`${kycWorkflows.userId} = ${user.id}`)
          .limit(1);

        if (existingWorkflow.length > 0) {
          logger.info(`Workflow already exists for user ${user.id}, skipping`);
          skipCount++;
          continue;
        }

        // Create workflow entry - preserve user's actual KYC tier
        // Type cast to access kycTier (TypeScript inference limitation with select())
        const userWithTier = user as any;
        
        const [workflow] = await db.insert(kycWorkflows).values({
          userId: user.id,
          status: 'verified',
          currentMethod: 'basic_kyc', // Old wizard flow
          successfulMethod: 'basic_kyc',
          attemptedMethods: ['basic_kyc'],
          verificationLevel: userWithTier.kycTier || 'basic', // Preserve user's actual tier
          panNumber: user.panNumber || undefined,
          initiatedAt: user.smartKycCompletedAt!,
          verifiedAt: user.smartKycCompletedAt!,
          completedAt: user.smartKycCompletedAt!,
          stepTimestamps: {
            basic_kyc_started: user.smartKycCompletedAt!,
            basic_kyc_completed: user.smartKycCompletedAt!,
          },
          verifiedData: {
            method: 'basic_kyc',
            completedAt: user.smartKycCompletedAt!,
            source: 'legacy_wizard',
            kycTier: userWithTier.kycTier,
          },
          dataSource: 'legacy_wizard',
        }).returning();

        // Create corresponding verification attempt for audit completeness
        await db.insert(kycVerificationAttempts).values({
          workflowId: workflow.id,
          userId: user.id,
          verificationMethod: 'basic_kyc',
          provider: 'legacy_wizard',
          correlationId: `legacy-backfill-${user.id}`,
          outcome: 'success',
          responseCode: '200',
          attemptedAt: user.smartKycCompletedAt!,
          latencyMs: 0, // Not applicable for backfilled data
          dataCompleteness: 100,
          metadata: {
            backfilled: true,
            originalCompletionDate: user.smartKycCompletedAt!,
          },
        });

        logger.info(`Created workflow for user ${user.id}`);
        successCount++;
      } catch (error: any) {
        logger.error(`Error creating workflow for user ${user.id}`, {
          error: error.message,
          userId: user.id,
        });
        errorCount++;
      }
    }

    logger.info('KYC workflows backfill completed', {
      total: verifiedUsers.length,
      success: successCount,
      skipped: skipCount,
      errors: errorCount,
    });

    // Summary report
    console.log('\n=== Backfill Summary ===');
    console.log(`Total verified users found: ${verifiedUsers.length}`);
    console.log(`Workflows created: ${successCount}`);
    console.log(`Workflows skipped (already exist): ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('========================\n');
  } catch (error: any) {
    logger.error('Fatal error during backfill', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Run the backfill
backfillKYCWorkflows()
  .then(() => {
    logger.info('Backfill script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Backfill script failed', { error: error.message });
    process.exit(1);
  });
