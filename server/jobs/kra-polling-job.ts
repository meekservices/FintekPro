import cron from 'node-cron';
import { storage } from '../storage';
import { proteanKraService } from '../services/protean-kra-service';

/**
 * Background KRA Polling Job
 * 
 * Polls pending KRA status checks every 5 minutes
 * Handles async verification (1-48 hour window)
 * Updates workflow state when KRA becomes verified
 */

let isRunning = false;

async function pollKraStatuses() {
  if (isRunning) {
    console.log('[KRA-Polling] Previous job still running, skipping...');
    return;
  }

  isRunning = true;
  
  try {
    console.log('[KRA-Polling] Starting KRA status poll...');
    
    // Get pending KRA checks (due for polling)
    const pendingChecks = await storage.getPendingKraChecks(100);
    
    if (pendingChecks.length === 0) {
      console.log('[KRA-Polling] No pending KRA checks');
      return;
    }

    console.log(`[KRA-Polling] Found ${pendingChecks.length} pending KRA checks`);

    // Process each pending check
    for (const check of pendingChecks) {
      try {
        // Get session to retrieve PAN and DOB
        const session = await storage.getKycVerificationSession(check.sessionId);
        
        if (!session) {
          console.error(`[KRA-Polling] Session not found for check ${check.id}`);
          continue;
        }

        // Check KRA status again
        const result = await proteanKraService.checkKraStatus({
          panNumber: session.panNumber,
          dob: session.dateOfBirth || ''
        });

        // Update KRA check record
        const pollAttempt = (check.pollAttempt || 0) + 1;
        const maxAttempts = check.maxPollAttempts || 48;

        if (result.status === 'verified') {
          // Success: KRA verified
          await storage.updateKraStatusCheck(check.id, {
            status: 'verified',
            kraNumber: result.kraNumber,
            verificationDate: result.verificationDate,
            kraAgency: result.agency,
            finalizedAt: new Date(),
            pollAttempt,
            responsePayload: result.rawResponse
          });

          // Update KYC session
          await storage.updateKycVerificationSession(check.sessionId, {
            currentState: 'kra_verified',
            kraNumber: result.kraNumber,
            kycStatus: 'kra_verified'
          });

          // Log state transition
          await storage.createKycStateTransition({
            sessionId: check.sessionId,
            userId: check.userId,
            fromState: 'kra_check_pending',
            toState: 'kra_verified',
            trigger: 'background_job',
            performedBy: 'system',
            performedByRole: 'system',
            metadata: {
              kraNumber: result.kraNumber,
              pollAttempt,
              asyncVerificationCompleted: true
            }
          });

          console.log(`[KRA-Polling] ✓ KRA verified for session ${check.sessionId}, KRA: ${result.kraNumber}`);
        } else if (result.status === 'pending' && pollAttempt < maxAttempts) {
          // Still pending: schedule next poll with exponential backoff
          const backoffMinutes = Math.min(30, 5 * Math.pow(1.5, pollAttempt - 1)); // Max 30 min
          const nextPollAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await storage.updateKraStatusCheck(check.id, {
            pollAttempt,
            nextPollAt,
            responsePayload: result.rawResponse
          });

          console.log(`[KRA-Polling] → Still pending for session ${check.sessionId}, next poll in ${backoffMinutes.toFixed(0)} min`);
        } else if (pollAttempt >= maxAttempts) {
          // Timeout: exceeded max attempts (48 hours)
          await storage.updateKraStatusCheck(check.id, {
            status: 'not_found',
            finalizedAt: new Date(),
            pollAttempt,
            reasonCode: 'TIMEOUT',
            reasonMessage: `Exceeded max poll attempts (${maxAttempts})`,
            responsePayload: result.rawResponse
          });

          // Update session to fallback flow
          await storage.updateKycVerificationSession(check.sessionId, {
            currentState: 'kra_timeout',
            kycStatus: 'kra_fallback'
          });

          // Log state transition
          await storage.createKycStateTransition({
            sessionId: check.sessionId,
            userId: check.userId,
            fromState: 'kra_check_pending',
            toState: 'kra_timeout',
            trigger: 'system_timeout',
            performedBy: 'system',
            performedByRole: 'system',
            metadata: {
              pollAttempt,
              reason: 'timeout',
              fallbackToCashfree: true
            }
          });

          console.log(`[KRA-Polling] ✗ Timeout for session ${check.sessionId}, switching to fallback`);
        } else {
          // Rejected/Not Found: finalize immediately
          await storage.updateKraStatusCheck(check.id, {
            status: result.status,
            finalizedAt: new Date(),
            pollAttempt,
            reasonCode: result.reasonCode,
            reasonMessage: result.reasonMessage,
            responsePayload: result.rawResponse
          });

          // Update session to fallback flow
          await storage.updateKycVerificationSession(check.sessionId, {
            currentState: 'kra_not_found',
            kycStatus: 'kra_fallback'
          });

          // Log state transition
          await storage.createKycStateTransition({
            sessionId: check.sessionId,
            userId: check.userId,
            fromState: 'kra_check_pending',
            toState: 'kra_not_found',
            trigger: 'background_job',
            performedBy: 'system',
            performedByRole: 'system',
            metadata: {
              pollAttempt,
              kraStatus: result.status,
              fallbackToCashfree: true
            }
          });

          console.log(`[KRA-Polling] ✗ KRA ${result.status} for session ${check.sessionId}, switching to fallback`);
        }
      } catch (error: any) {
        console.error(`[KRA-Polling] Error processing check ${check.id}:`, error.message);
      }
    }

    console.log('[KRA-Polling] Completed KRA status poll');
  } catch (error: any) {
    console.error('[KRA-Polling] Job failed:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Start KRA polling cron job (every 5 minutes)
 */
export function startKraPollingJob() {
  console.log('[KRA-Polling] Starting cron job (every 5 minutes)...');
  
  // Run every 5 minutes: */5 * * * *
  cron.schedule('*/5 * * * *', () => {
    pollKraStatuses().catch(error => {
      console.error('[KRA-Polling] Unhandled error:', error);
    });
  });

  // Run once immediately on startup
  pollKraStatuses().catch(error => {
    console.error('[KRA-Polling] Initial run failed:', error);
  });
}

/**
 * Manual trigger for testing
 */
export async function triggerKraPolling() {
  await pollKraStatuses();
}
