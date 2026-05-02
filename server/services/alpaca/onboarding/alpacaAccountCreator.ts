import { logger } from '../../../../logger';
import { db } from '../../../../db';
import { users } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { alpacaClient } from '../core/alpacaClient';
import { alpacaKycMapper } from './alpacaKycMapper';

export class AlpacaAccountCreator {
  
  /**
   * Orchestrates the creation of an Alpaca account from a local FintekPro user
   */
  async createAccountForUser(userId: string) {
    logger.info(`[AlpacaAccountCreator] Initiating Alpaca onboarding for user: ${userId}`);

    // Fetch user and profile from DB
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    const profileRecord = await db.query.userProfiles.findFirst({
      where: eq(users.userId, userId)
    });

    if (!userRecord || !profileRecord) {
      throw new Error(`User or Profile not found for ID: ${userId}`);
    }

    if (userRecord.alpacaAccountId) {
      logger.info(`[AlpacaAccountCreator] User ${userId} already has an Alpaca Account: ${userRecord.alpacaAccountId}`);
      return userRecord.alpacaAccountId;
    }

    // Map KYC
    const payload = alpacaKycMapper.mapToAlpacaSchema(userRecord as any, profileRecord as any);

    try {
      // Call Alpaca API
      const alpacaAccount = await alpacaClient.createAccount(payload);
      
      logger.info(`[AlpacaAccountCreator] Successfully created Alpaca Account ${alpacaAccount.id} for user ${userId}`);

      // Link in DB
      await db.update(users)
        .set({ alpacaAccountId: alpacaAccount.id })
        .where(eq(users.id, userId));

      return alpacaAccount.id;

    } catch (error: any) {
      logger.error(`[AlpacaAccountCreator] Alpaca onboarding failed for user ${userId}`, error.response?.data || error.message);
      // Fallback: If creation fails due to strict rules, flag for manual review
      // In a real system, you might trigger an admin alert here
      throw new Error(`Alpaca Onboarding Failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

export const alpacaAccountCreator = new AlpacaAccountCreator();
