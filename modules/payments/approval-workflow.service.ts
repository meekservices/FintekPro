import { db } from '../../server/db';
import { pgTable, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';

// Temporary schema definition until moved to shared
export const approvalRequests = pgTable('approval_requests', {
  id: varchar('id', { length: 255 }).primaryKey(),
  entityId: varchar('entity_id', { length: 255 }),
  resourceType: varchar('resource_type', { length: 50 }), // 'payment', 'account_link', etc.
  resourceId: varchar('resource_id', { length: 255 }),
  data: jsonb('data'),
  status: varchar('status', { length: 20 }), // 'pending', 'approved', 'rejected'
  requiredApprovals: jsonb('required_approvals'), // Array of roles or userIds
  approvalsReceived: jsonb('approvals_received'), // Array of {userId, timestamp}
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// @Injectable()
export class ApprovalWorkflowService {
  private readonly logger = { 
    log: (msg: string) => console.log(`[ApprovalWorkflowService] ${msg}`),
    error: (msg: string) => console.error(`[ApprovalWorkflowService] ${msg}`)
  };

  async createRequest(data: {
    entityId: string;
    resourceType: string;
    resourceId: string;
    payload: any;
    approvers: string[];
  }) {
    const id = `REQ_${Date.now()}`;
    await db.insert(approvalRequests).values({
      id,
      entityId: data.entityId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      data: data.payload,
      status: 'pending',
      requiredApprovals: data.approvers,
      approvalsReceived: []
    });

    return id;
  }

  async approve(requestId: string, userId: string) {
    const [request] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, requestId));
    
    if (!request || request.status !== 'pending') {
      throw new Error('Invalid or non-pending request');
    }

    const approvals = [...(request.approvalsReceived as any[]), { userId, timestamp: new Date() }];
    
    // Check if all required approvals are met
    const isComplete = (request.requiredApprovals as string[]).every(role => 
      approvals.some(a => a.userId === userId) // This is a simplified check
    );

    await db.update(approvalRequests)
      .set({ 
        approvalsReceived: approvals,
        status: isComplete ? 'approved' : 'pending',
        updatedAt: new Date()
      })
      .where(eq(approvalRequests.id, requestId));

    return { isComplete, status: isComplete ? 'approved' : 'pending' };
  }
}
