// @ts-nocheck
import { db } from "../db";
import { adminApprovalRequests } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class AdminApprovalService {
  /**
   * Create a new approval request (Maker)
   */
  static async createRequest(params: {
    entityType: string;
    entityId: string;
    action: string;
    requestedBy: number;
    requestData: any;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    justification?: string;
  }) {
    const [request] = await db.insert(adminApprovalRequests).values({
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      requestedBy: params.requestedBy,
      requestData: params.requestData,
      priority: params.priority || 'medium',
      justification: params.justification,
      status: 'pending'
    }).returning();
    
    return request;
  }

  /**
   * Approve or reject a request (Checker)
   */
  static async updateStatus(requestId: number, params: {
    status: 'approved' | 'rejected';
    reviewedBy: number;
    reviewComments?: string;
  }) {
    const [request] = await db.select().from(adminApprovalRequests).where(eq(adminApprovalRequests.id, requestId));
    
    if (!request) throw new Error("Approval request not found");
    if (request.status !== 'pending') throw new Error("Request already processed");
    if (request.requestedBy === params.reviewedBy) {
      throw new Error("Maker cannot be the Checker (Self-approval is forbidden)");
    }

    const [updated] = await db.update(adminApprovalRequests)
      .set({
        status: params.status,
        reviewedBy: params.reviewedBy,
        reviewedAt: new Date(),
        reviewComments: params.reviewComments
      })
      .where(eq(adminApprovalRequests.id, requestId))
      .returning();

    return updated;
  }

  static async getPendingRequests() {
    return await db.select()
      .from(adminApprovalRequests)
      .where(eq(adminApprovalRequests.status, 'pending'));
  }
}
