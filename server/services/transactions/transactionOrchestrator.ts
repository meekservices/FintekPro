import { logger } from '../../logger';
import { db } from '../../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { irisTransactionEngine } from '../iris/irisTransactionEngine';
import { productEligibilityEngine } from '../products/productEligibilityEngine';

export class TransactionOrchestrator {
  
  /**
   * Orchestrates the end-to-end flow for placing a new order
   */
  async placeOrder(userId: string, orderPayload: any) {
    logger.info(`[TransactionOrchestrator] Initiating order for user ${userId}`, { productType: orderPayload.productType });
    
    try {
      // 1. Get User Profile
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) throw new Error('User not found');
      if (!user.pan) throw new Error('User PAN is required for transactions');

      // 2. Validate Eligibility (Simplified payload mapping)
      const userProfile = {
        kycStatus: user.kycStatus || 'UNVERIFIED',
        riskProfile: (user.riskTolerance || 'MODERATE') as any,
        netWorthCategory: 'RETAIL' as any // Placeholder
      };
      
      const productProfile = {
        assetClass: orderPayload.productType,
        riskLevel: orderPayload.productRisk || 'MEDIUM',
        minInvestment: orderPayload.amount
      };

      const eligibility = productEligibilityEngine.evaluateEligibility(userProfile, productProfile);
      if (!eligibility.eligible) {
        logger.warn(`[TransactionOrchestrator] User ineligible for order`, { reasons: eligibility.reasons });
        throw new Error(`Ineligible: ${eligibility.reasons.join(', ')}`);
      }

      // 3. Construct Final IRIS Payload
      const irisPayload = {
        pan: user.pan,
        ...orderPayload
      };

      // 4. Execute via IRIS
      const result = await irisTransactionEngine.executeOrder(irisPayload);

      // 5. Local DB Tracking (Assuming 'orders' or 'transactions' table exists)
      // await db.insert(orders).values({...})
      
      logger.info(`[TransactionOrchestrator] Order successfully initiated`, { orderId: result.orderId });

      return {
        success: true,
        orderId: result.orderId,
        paymentUrl: result.paymentUrl
      };

    } catch (error: any) {
      logger.error(`[TransactionOrchestrator] Order placement failed`, { error: error.message });
      throw error;
    }
  }
}

export const transactionOrchestrator = new TransactionOrchestrator();
