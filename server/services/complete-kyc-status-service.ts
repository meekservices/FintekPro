/**
 * Complete KYC Status Service
 * 
 * Unified service that aggregates tier status and re-KYC status
 * into a single cohesive response for frontend components.
 */

import { getUserTierStatus } from './kyc-tier-service';
import { getKYCStatus as getRekycStatus } from '../rekyc-service';
import { db } from '../db';
import { eq } from 'drizzle-orm';

export interface CompleteKYCStatus {
  // Tier Information
  currentTier: string;
  currentTierName: string;
  currentTierDescription: string;
  eligibleForUpgrade: boolean;
  nextTier: string | null;
  nextTierName: string | null;
  nextTierDescription: string | null;
  completedVerifications: Array<{code: string; name: string; completed: boolean}>;
  missingVerifications: Array<{code: string; name: string; completed: boolean}>;
  unlockedFeatures: string[];
  productsUnlockedAtCurrentTier: string[];
  productsAccessible: number;
  productsLocked: number;
  upgradeRequestedAt: string | null;
  upgradedAt: string | null;

  // Re-KYC & Compliance Status
  isActive: boolean;
  dueDate: string | null;
  daysUntilExpiry: number | null;
  requiresReKYC: boolean;
  remindersSent: number;
  
  // Transaction Permissions (derived from tier)
  canTradeMutualFunds: boolean;
  canTradeBroking: boolean;
  canTradeInternational: boolean;
  
  // Metadata
  riskCategory: string;
  reviewFrequency: string;
  lastUpdated: string | null;
  pendingActions: string[];
}

/**
 * Get complete KYC status by aggregating tier status and re-KYC compliance data
 */
export async function getCompleteKYCStatus(userId: string): Promise<CompleteKYCStatus> {
  // Fetch tier status from tier service
  const tierStatus = await getUserTierStatus(userId);
  
  // Fetch re-KYC compliance status from rekyc service
  const rekycStatus = await getRekycStatus(userId);

  // Merge pending actions from both sources
  const pendingActions: string[] = [...rekycStatus.pendingActions];
  
  if (tierStatus.missingVerifications.length > 0 && tierStatus.eligibleForUpgrade) {
    pendingActions.push(`Complete ${tierStatus.missingVerifications.length} verification(s) to upgrade to ${tierStatus.nextTierName}`);
  }

  // Override transaction permissions with tier-based logic
  // Tier system is more restrictive and takes precedence
  const canTradeMutualFunds = ['basic', 'enhanced', 'accredited_investor'].includes(tierStatus.currentTier) && rekycStatus.canTradeMutualFunds;
  const canTradeBroking = ['enhanced', 'accredited_investor'].includes(tierStatus.currentTier) && rekycStatus.canTradeBroking;
  const canTradeInternational = tierStatus.currentTier === 'accredited_investor' && rekycStatus.canTradeInternational;

  // Aggregate into complete status
  const completeStatus: CompleteKYCStatus = {
    // Tier data from tier service
    currentTier: tierStatus.currentTier,
    currentTierName: tierStatus.currentTierName,
    currentTierDescription: tierStatus.currentTierDescription,
    eligibleForUpgrade: tierStatus.eligibleForUpgrade,
    nextTier: tierStatus.nextTier,
    nextTierName: tierStatus.nextTierName,
    nextTierDescription: tierStatus.nextTierDescription,
    completedVerifications: tierStatus.completedVerifications,
    missingVerifications: tierStatus.missingVerifications,
    unlockedFeatures: tierStatus.unlockedFeatures,
    productsUnlockedAtCurrentTier: tierStatus.productsUnlockedAtCurrentTier,
    productsAccessible: tierStatus.productsAccessible,
    productsLocked: tierStatus.productsLocked,
    upgradeRequestedAt: tierStatus.upgradeRequestedAt ? tierStatus.upgradeRequestedAt.toISOString() : null,
    upgradedAt: tierStatus.upgradedAt ? tierStatus.upgradedAt.toISOString() : null,

    // Re-KYC & compliance data from rekyc service
    isActive: rekycStatus.isActive,
    dueDate: rekycStatus.dueDate ? rekycStatus.dueDate.toISOString() : null,
    daysUntilExpiry: rekycStatus.daysUntilExpiry,
    requiresReKYC: rekycStatus.requiresReKYC,
    remindersSent: rekycStatus.remindersSent,

    // Combined tier-based permissions (tier AND rekyc must both allow)
    canTradeMutualFunds,
    canTradeBroking,
    canTradeInternational,

    // Metadata from rekyc service
    riskCategory: rekycStatus.riskCategory,
    reviewFrequency: rekycStatus.reviewFrequency,
    lastUpdated: rekycStatus.lastUpdated ? rekycStatus.lastUpdated.toISOString() : null,
    
    // Merged pending actions
    pendingActions
  };

  return completeStatus;
}
