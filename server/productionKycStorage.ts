import { db } from "./db";
import { sql } from "drizzle-orm";
import { eq, and, desc } from "drizzle-orm";
import { productionKycSessions, panVerificationRecords } from "@shared/schema";
import type { ProductionKycSession, PanVerificationRecord } from "@shared/schema";

/**
 * Production KYC Storage Interface
 * Handles PAN verification cache and KYC session lifecycle
 */
export interface IProductionKycStorage {
  // PAN Cache Methods
  getUserPanDetails(userId: string, panNumber: string): Promise<PanVerificationRecord | undefined>;
  saveUserPanDetails(data: {
    userId: string;
    panNumber: string;
    fullName: string;
    dateOfBirth: string;
    panType: string;
    verified: boolean;
  }): Promise<PanVerificationRecord>;

  // Session Lifecycle Methods
  getLatestProductionKycSession(userId: string): Promise<ProductionKycSession | undefined>;
  cancelProductionKycSession(sessionId: string, userId: string): Promise<void>;
  createProductionKycSession(data: Partial<ProductionKycSession>): Promise<ProductionKycSession>;
  getProductionKycSession(sessionId: string, userId: string): Promise<ProductionKycSession | undefined>;
  updateProductionKycSession(sessionId: string, updates: Partial<ProductionKycSession>): Promise<ProductionKycSession | undefined>;
}

/**
 * Database-backed implementation of Production KYC Storage
 */
export class ProductionKycStorage implements IProductionKycStorage {
  /**
   * Get PAN details for a specific user
   * Used for database-first PAN validation
   */
  async getUserPanDetails(userId: string, panNumber: string): Promise<PanVerificationRecord | undefined> {
    const [record] = await db
      .select()
      .from(panVerificationRecords)
      .where(
        and(
          eq(panVerificationRecords.userId, userId),
          eq(panVerificationRecords.panNumber, panNumber.toUpperCase())
        )
      )
      .limit(1);

    return record;
  }

  /**
   * Save verified PAN details to database
   * Creates or updates PAN verification record
   */
  async saveUserPanDetails(data: {
    userId: string;
    panNumber: string;
    fullName: string;
    dateOfBirth: string;
    panType: string;
    verified: boolean;
  }): Promise<PanVerificationRecord> {
    const [existing] = await db
      .select()
      .from(panVerificationRecords)
      .where(
        and(
          eq(panVerificationRecords.userId, data.userId),
          eq(panVerificationRecords.panNumber, data.panNumber.toUpperCase())
        )
      )
      .limit(1);

    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(panVerificationRecords)
        .set({
          fullName: data.fullName,
          dateOfBirth: data.dateOfBirth,
          panType: data.panType,
          verified: data.verified,
          verifiedAt: new Date(),
        })
        .where(eq(panVerificationRecords.id, existing.id))
        .returning();

      return updated;
    }

    // Create new record
    const [record] = await db
      .insert(panVerificationRecords)
      .values({
        userId: data.userId,
        panNumber: data.panNumber.toUpperCase(),
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth,
        panType: data.panType,
        verified: data.verified,
        verifiedAt: new Date(),
      })
      .returning();

    return record;
  }

  /**
   * Get the most recent incomplete KYC session for a user
   * Used for session resume/cancel dialog
   */
  async getLatestProductionKycSession(userId: string): Promise<ProductionKycSession | undefined> {
    const [session] = await db
      .select()
      .from(productionKycSessions)
      .where(eq(productionKycSessions.userId, userId))
      .orderBy(desc(productionKycSessions.createdAt))
      .limit(1);

    return session;
  }

  /**
   * Cancel an existing KYC session
   * Sets session as cancelled and updates expiry
   */
  async cancelProductionKycSession(sessionId: string, userId: string): Promise<void> {
    await db
      .update(productionKycSessions)
      .set({
        currentStep: "cancelled",
        expiresAt: new Date(), // Expire immediately
      })
      .where(
        and(
          eq(productionKycSessions.id, sessionId),
          eq(productionKycSessions.userId, userId)
        )
      );
  }

  /**
   * Create a new production KYC session
   * Returns the created session with ID
   */
  async createProductionKycSession(data: Partial<ProductionKycSession>): Promise<ProductionKycSession> {
    const [session] = await db
      .insert(productionKycSessions)
      .values({
        userId: data.userId!,
        userType: data.userType || "individual",
        currentStep: data.currentStep || "pan_verification",
        panNumber: data.panNumber,
        panVerified: data.panVerified || false,
        expiresAt: data.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      })
      .returning();

    return session;
  }

  /**
   * Get a specific KYC session by ID
   * Ensures session belongs to the requesting user
   */
  async getProductionKycSession(sessionId: string, userId: string): Promise<ProductionKycSession | undefined> {
    const [session] = await db
      .select()
      .from(productionKycSessions)
      .where(
        and(
          eq(productionKycSessions.id, sessionId),
          eq(productionKycSessions.userId, userId)
        )
      )
      .limit(1);

    return session;
  }

  /**
   * Update an existing KYC session
   * Used for workflow state transitions
   */
  async updateProductionKycSession(
    sessionId: string,
    updates: Partial<ProductionKycSession>
  ): Promise<ProductionKycSession | undefined> {
    const [updated] = await db
      .update(productionKycSessions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(productionKycSessions.id, sessionId))
      .returning();

    return updated;
  }
}

// Export singleton instance
export const productionKycStorage = new ProductionKycStorage();
