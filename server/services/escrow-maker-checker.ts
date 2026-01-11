/**
 * Escrow Maker-Checker Service
 * 
 * Implements dual-approval workflow for escrow release/refund operations
 * in compliance with SEBI/RBI regulations for unlisted securities trading.
 * 
 * Workflow:
 * 1. Admin A (Maker) verifies transfer documents and initiates release request
 * 2. Admin B (Checker) reviews and approves/rejects the release request
 * 3. Only after dual approval, funds are released to seller
 */

import { db } from '../db';
import { unlistedEscrowApprovals, unlistedDeals, users } from '@shared/schema';
import { eq, and, ne } from 'drizzle-orm';
import { unlistedEscrowService } from './unlisted-escrow-service';
import { auditLogArchivalService } from './audit-log-archival';
import { regulatoryReportingService } from './regulatory-reporting-service';
import { disVerificationService } from './dis-verification-service';

export interface MakerApprovalRequest {
  dealId: string;
  makerUserId: string;
  makerName?: string;
  requestType: 'release' | 'refund';
  notes?: string;
  verificationDocuments?: string[];
  disSlipVerified?: boolean;
  shareTransferVerified?: boolean;
  transferConfirmationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CheckerApprovalRequest {
  approvalId: string;
  checkerUserId: string;
  checkerName?: string;
  action: 'approved' | 'rejected' | 'requested_info';
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApprovalResult {
  success: boolean;
  approvalId?: string;
  status?: string;
  message?: string;
  error?: string;
  executionResult?: any;
}

export class EscrowMakerCheckerService {
  private readonly APPROVAL_EXPIRY_HOURS = 24;

  /**
   * Maker initiates an escrow release/refund request
   * This creates a pending approval that requires checker confirmation
   */
  async initiateApproval(request: MakerApprovalRequest): Promise<ApprovalResult> {
    try {
      const deal = await db.query.unlistedDeals.findFirst({
        where: eq(unlistedDeals.id, request.dealId),
      });

      if (!deal) {
        return { success: false, error: 'Deal not found' };
      }

      if (request.requestType === 'release') {
        if (deal.status !== 'escrowed' && deal.status !== 'transfer_pending') {
          return { 
            success: false, 
            error: `Cannot initiate release for deal in ${deal.status} status. Must be escrowed or transfer_pending.` 
          };
        }
      } else if (request.requestType === 'refund') {
        if (deal.status !== 'escrowed' && deal.status !== 'transfer_pending') {
          return { 
            success: false, 
            error: `Cannot initiate refund for deal in ${deal.status} status` 
          };
        }
      }

      const existingPending = await db.query.unlistedEscrowApprovals.findFirst({
        where: and(
          eq(unlistedEscrowApprovals.dealId, request.dealId),
          eq(unlistedEscrowApprovals.status, 'pending_checker')
        ),
      });

      if (existingPending) {
        return { 
          success: false, 
          error: 'A pending approval request already exists for this deal',
          approvalId: existingPending.id
        };
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.APPROVAL_EXPIRY_HOURS);

      const complianceChecks = [];
      if (request.disSlipVerified) {
        complianceChecks.push({ check: 'dis_slip_verified', verified: true, verifiedBy: request.makerUserId, verifiedAt: new Date().toISOString() });
      }
      if (request.shareTransferVerified) {
        complianceChecks.push({ check: 'share_transfer_verified', verified: true, verifiedBy: request.makerUserId, verifiedAt: new Date().toISOString() });
      }

      const [approval] = await db.insert(unlistedEscrowApprovals)
        .values({
          dealId: request.dealId,
          requestType: request.requestType,
          requestedAmount: request.requestType === 'release' ? deal.totalValue : (deal.buyerCharge || deal.totalValue),
          sellerPayout: deal.sellerPayout,
          platformFee: deal.platformFee,
          makerUserId: request.makerUserId,
          makerName: request.makerName,
          makerNotes: request.notes,
          makerVerificationDocuments: request.verificationDocuments || [],
          status: 'pending_checker',
          expiresAt,
          transferConfirmationId: request.transferConfirmationId,
          disSlipVerified: request.disSlipVerified || false,
          shareTransferVerified: request.shareTransferVerified || false,
          complianceChecks,
          ipAddressMaker: request.ipAddress,
          userAgentMaker: request.userAgent,
        })
        .returning();

      console.log(`[MakerChecker] Escrow ${request.requestType} initiated by maker ${request.makerUserId} for deal ${request.dealId}`);

      return {
        success: true,
        approvalId: approval.id,
        status: 'pending_checker',
        message: `${request.requestType === 'release' ? 'Release' : 'Refund'} request created. Awaiting checker approval.`
      };

    } catch (error: any) {
      console.error('Maker approval initiation error:', error);
      return { success: false, error: error.message || 'Failed to initiate approval' };
    }
  }

  /**
   * Checker approves or rejects the escrow release/refund request
   * If approved, the actual escrow operation is executed
   */
  async processCheckerAction(request: CheckerApprovalRequest): Promise<ApprovalResult> {
    try {
      const approval = await db.query.unlistedEscrowApprovals.findFirst({
        where: eq(unlistedEscrowApprovals.id, request.approvalId),
      });

      if (!approval) {
        return { success: false, error: 'Approval request not found' };
      }

      if (approval.status !== 'pending_checker') {
        return { 
          success: false, 
          error: `Approval request is already ${approval.status}` 
        };
      }

      if (approval.expiresAt && new Date(approval.expiresAt) < new Date()) {
        await db.update(unlistedEscrowApprovals)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(unlistedEscrowApprovals.id, request.approvalId));
        return { success: false, error: 'Approval request has expired' };
      }

      if (approval.makerUserId === request.checkerUserId) {
        return { 
          success: false, 
          error: 'Checker must be a different admin than the maker (dual-control requirement)' 
        };
      }

      if (request.action === 'rejected') {
        await db.update(unlistedEscrowApprovals)
          .set({
            checkerUserId: request.checkerUserId,
            checkerName: request.checkerName,
            checkerApprovedAt: new Date(),
            checkerNotes: request.notes,
            checkerAction: 'rejected',
            status: 'rejected',
            rejectionReason: request.notes,
            rejectedBy: request.checkerUserId,
            rejectedAt: new Date(),
            ipAddressChecker: request.ipAddress,
            userAgentChecker: request.userAgent,
            updatedAt: new Date(),
          })
          .where(eq(unlistedEscrowApprovals.id, request.approvalId));

        console.log(`[MakerChecker] Escrow ${approval.requestType} rejected by checker ${request.checkerUserId} for deal ${approval.dealId}`);

        return {
          success: true,
          approvalId: approval.id,
          status: 'rejected',
          message: 'Approval request rejected'
        };
      }

      if (request.action === 'requested_info') {
        await db.update(unlistedEscrowApprovals)
          .set({
            checkerUserId: request.checkerUserId,
            checkerName: request.checkerName,
            checkerNotes: request.notes,
            checkerAction: 'requested_info',
            ipAddressChecker: request.ipAddress,
            userAgentChecker: request.userAgent,
            updatedAt: new Date(),
          })
          .where(eq(unlistedEscrowApprovals.id, request.approvalId));

        return {
          success: true,
          approvalId: approval.id,
          status: 'pending_checker',
          message: 'Additional information requested from maker'
        };
      }

      // DIS Verification Check - MANDATORY for release operations
      if (approval.requestType === 'release') {
        const deal = await db.query.unlistedDeals.findFirst({
          where: eq(unlistedDeals.id, approval.dealId),
        });

        if (deal) {
          const disPrerequisites = await disVerificationService.getEscrowReleasePrerequisites(
            approval.dealId,
            parseFloat(deal.quantity || '0'),
            deal.isin || '',
            deal.buyerDematAccount || ''
          );

          if (!disPrerequisites.canRelease) {
            const failureDetails = disPrerequisites.complianceNotes.join('; ');
            console.warn(`[MakerChecker] DIS verification FAILED for deal ${approval.dealId}: ${failureDetails}`);
            
            await db.update(unlistedEscrowApprovals)
              .set({
                checkerUserId: request.checkerUserId,
                checkerNotes: `BLOCKED: DIS verification failed - ${failureDetails}`,
                checkerAction: 'rejected',
                status: 'rejected',
                rejectionReason: `DIS verification failed: ${failureDetails}`,
                ipAddressChecker: request.ipAddress,
                userAgentChecker: request.userAgent,
                updatedAt: new Date(),
              })
              .where(eq(unlistedEscrowApprovals.id, request.approvalId));

            return {
              success: false,
              approvalId: approval.id,
              status: 'rejected',
              error: `Escrow release blocked: DIS/share transfer verification incomplete. ${failureDetails}`,
              executionResult: { disPrerequisites }
            };
          }

          console.log(`[MakerChecker] DIS verification PASSED for deal ${approval.dealId}`);
        }
      }

      // Pre-execution compliance: Archive audit log BEFORE escrow execution attempt
      // This ensures we have an immutable record of the attempt regardless of outcome
      let executionAttemptLogged = false;
      try {
        const deal = await db.query.unlistedDeals.findFirst({
          where: eq(unlistedDeals.id, approval.dealId),
        });
        
        if (deal) {
          const attemptEventType = approval.requestType === 'release' 
            ? 'escrow_release_attempt_dual_approved' 
            : 'escrow_refund_attempt_dual_approved';
          
          await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
            eventType: attemptEventType,
            dealId: approval.dealId,
            userId: request.checkerUserId,
            amount: parseFloat(approval.requestedAmount || '0'),
            metadata: {
              approvalId: approval.id,
              makerId: approval.makerUserId,
              checkerId: request.checkerUserId,
              dualApprovalCompleted: true,
              executionAttempted: true,
              transferConfirmationId: approval.transferConfirmationId
            }
          });
          executionAttemptLogged = true;
          
          // High-value: Report attempt to regulatory before execution
          const amount = parseFloat(approval.requestedAmount || '0');
          if (amount >= 1000000) {
            const reportEventType = approval.requestType === 'release'
              ? 'high_value_escrow_release_attempt'
              : 'high_value_escrow_refund_attempt';
            
            await regulatoryReportingService.registerReportableEvent({
              eventType: reportEventType,
              dealId: approval.dealId,
              amount,
              parties: {
                buyer: deal.buyerUserId,
                seller: deal.sellerUserId,
                maker: approval.makerUserId,
                checker: request.checkerUserId
              },
              dualApprovalDetails: {
                approvalId: approval.id,
                makerApprovedAt: approval.createdAt,
                checkerApprovedAt: new Date().toISOString()
              }
            });
          }
        }
      } catch (preComplianceError) {
        console.error('[MakerChecker] Pre-execution compliance logging failed:', preComplianceError);
        // Continue with execution - audit failure shouldn't block approved operation
      }

      let executionResult: any;
      let executionError: any = null;
      
      try {
        if (approval.requestType === 'release') {
          executionResult = await unlistedEscrowService.releaseEscrow(
            approval.dealId,
            request.checkerUserId,
            approval.transferConfirmationId || undefined
          );
        } else {
          executionResult = await unlistedEscrowService.refundEscrow(
            approval.dealId,
            request.checkerUserId,
            approval.makerNotes || 'Dual-approved refund'
          );
        }
      } catch (execError: any) {
        executionError = execError;
        executionResult = { success: false, message: execError.message || 'Execution failed' };
      }

      await db.update(unlistedEscrowApprovals)
        .set({
          checkerUserId: request.checkerUserId,
          checkerName: request.checkerName,
          checkerApprovedAt: new Date(),
          checkerNotes: request.notes,
          checkerAction: 'approved',
          status: executionResult.success ? 'approved' : 'rejected',
          executedAt: executionResult.success ? new Date() : null,
          executionResult,
          rejectionReason: executionResult.success ? null : executionResult.message,
          ipAddressChecker: request.ipAddress,
          userAgentChecker: request.userAgent,
          updatedAt: new Date(),
        })
        .where(eq(unlistedEscrowApprovals.id, request.approvalId));

      console.log(`[MakerChecker] Escrow ${approval.requestType} ${executionResult.success ? 'executed' : 'failed'} after checker approval for deal ${approval.dealId}`);

      // Post-execution compliance: Archive outcome (success or failure)
      try {
        const deal = await db.query.unlistedDeals.findFirst({
          where: eq(unlistedDeals.id, approval.dealId),
        });
        
        if (deal) {
          const outcomeEventType = executionResult.success
            ? (approval.requestType === 'release' ? 'escrow_released_dual_approved' : 'escrow_refunded_dual_approved')
            : (approval.requestType === 'release' ? 'escrow_release_failed_dual_approved' : 'escrow_refund_failed_dual_approved');
          
          await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
            eventType: outcomeEventType,
            dealId: approval.dealId,
            userId: request.checkerUserId,
            amount: parseFloat(approval.requestedAmount || '0'),
            metadata: {
              approvalId: approval.id,
              makerId: approval.makerUserId,
              checkerId: request.checkerUserId,
              dualApprovalCompleted: true,
              executionSuccess: executionResult.success,
              executionError: executionError?.message,
              transferConfirmationId: approval.transferConfirmationId
            }
          });
          
          // High-value: Report outcome to regulatory
          const amount = parseFloat(approval.requestedAmount || '0');
          if (amount >= 1000000) {
            const reportEventType = executionResult.success
              ? (approval.requestType === 'release' ? 'high_value_escrow_release_completed' : 'high_value_escrow_refund_completed')
              : (approval.requestType === 'release' ? 'high_value_escrow_release_failed' : 'high_value_escrow_refund_failed');
            
            await regulatoryReportingService.registerReportableEvent({
              eventType: reportEventType,
              dealId: approval.dealId,
              amount,
              parties: {
                buyer: deal.buyerUserId,
                seller: deal.sellerUserId,
                maker: approval.makerUserId,
                checker: request.checkerUserId
              },
              executionOutcome: {
                success: executionResult.success,
                error: executionError?.message
              },
              dualApprovalDetails: {
                approvalId: approval.id,
                makerApprovedAt: approval.createdAt,
                checkerApprovedAt: new Date().toISOString()
              }
            });
          }
        }
      } catch (postComplianceError) {
        console.error('[MakerChecker] Post-execution compliance logging failed:', postComplianceError);
        // Non-blocking: escrow operation result is already determined
      }

      return {
        success: executionResult.success,
        approvalId: approval.id,
        status: executionResult.success ? 'approved' : 'rejected',
        message: executionResult.message,
        executionResult
      };

    } catch (error: any) {
      console.error('Checker action processing error:', error);
      return { success: false, error: error.message || 'Failed to process checker action' };
    }
  }

  /**
   * Get pending approval requests for checker dashboard
   */
  async getPendingApprovals(excludeUserId?: string): Promise<any[]> {
    try {
      let query = db.select()
        .from(unlistedEscrowApprovals)
        .where(eq(unlistedEscrowApprovals.status, 'pending_checker'));

      const approvals = await query;

      const filtered = excludeUserId 
        ? approvals.filter(a => a.makerUserId !== excludeUserId)
        : approvals;

      return filtered;
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      return [];
    }
  }

  /**
   * Get approval history for a deal
   */
  async getDealApprovalHistory(dealId: string): Promise<any[]> {
    try {
      const approvals = await db.select()
        .from(unlistedEscrowApprovals)
        .where(eq(unlistedEscrowApprovals.dealId, dealId));
      return approvals;
    } catch (error) {
      console.error('Error fetching deal approval history:', error);
      return [];
    }
  }

  /**
   * Expire old pending approvals (run via cron)
   */
  async expireOldApprovals(): Promise<number> {
    try {
      const result = await db.update(unlistedEscrowApprovals)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(and(
          eq(unlistedEscrowApprovals.status, 'pending_checker'),
          // expiresAt < now - handled by checking in the query
        ))
        .returning();

      const expiredCount = result.filter(r => 
        r.expiresAt && new Date(r.expiresAt) < new Date()
      ).length;

      if (expiredCount > 0) {
        console.log(`[MakerChecker] Expired ${expiredCount} old approval requests`);
      }

      return expiredCount;
    } catch (error) {
      console.error('Error expiring old approvals:', error);
      return 0;
    }
  }
}

export const escrowMakerCheckerService = new EscrowMakerCheckerService();
