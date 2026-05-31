// @ts-nocheck
import { logger } from '../logger';
import { db } from '../../db';
import { users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export class ReferralService {
  
  /**
   * Generates a unique referral code for a user
   */
  async generateReferralCode(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) throw new Error('User not found');
    if (user.referralCode) return user.referralCode;

    // Generate a short, unique code (e.g., RIBBIT_XXXX)
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const referralCode = `RIB_${randomPart}`;

    await db.update(users)
      .set({ referralCode })
      .where(eq(users.id, userId));

    return referralCode;
  }

  /**
   * Fetches public profile for a referral code
   */
  async getProfileByReferralCode(referralCode: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.referralCode, referralCode),
    });

    if (!user || !user.shareableProfileEnabled) {
      throw new Error('Profile not found or private');
    }

    // Return limited public data
    return {
      firstName: user.firstName,
      profileImageUrl: user.profileImageUrl,
      joinDate: user.createdAt,
      referralCode: user.referralCode
    };
  }
}

export const referralService = new ReferralService();
