import { logger } from '../../logger';
import { db } from '../../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { irisClient } from '../iris/irisClient';

export class InvestorSync {
  
  /**
   * Syncs a FintekPro user with IRIS to create an Investor Profile
   */
  async syncUserToIris(userId: string) {
    logger.info(`[InvestorSync] Starting IRIS sync for user ${userId}`);
    
    try {
      // 1. Fetch user data from DB
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.pan) {
        throw new Error('User PAN is required for IRIS sync');
      }

      // 2. Map data to IRIS payload
      const payload = {
        pan: user.pan,
        name: user.name || `${user.firstName} ${user.lastName}`,
        email: user.email,
        mobile: user.mobile,
        // ... other required fields mapping
      };

      // 3. Create investor profile in IRIS
      const response = await irisClient.createInvestorProfile(payload);

      // 4. Update local DB with mapping
      // Note: Assuming irisInvestorId field exists or will be added to users table
      if (response && response.investorId) {
        await db.update(users)
          .set({ irisInvestorId: response.investorId, updatedAt: new Date() })
          .where(eq(users.id, userId));
          
        logger.info(`[InvestorSync] Successfully synced user ${userId} to IRIS. Investor ID: ${response.investorId}`);
      }

      return {
        success: true,
        investorId: response?.investorId
      };

    } catch (error: any) {
      logger.error(`[InvestorSync] Failed to sync user ${userId} to IRIS`, { error: error.message });
      throw error;
    }
  }
}

export const investorSync = new InvestorSync();
