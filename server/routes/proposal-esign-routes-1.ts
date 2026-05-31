// @ts-nocheck
import { Router, Request, Response } from 'express';
import { proposalEsignWorkflowService, WorkflowStatus, ParticipantRole, SignatureMethod } from '../services/proposal-esign-workflow-service';
import { z } from 'zod';
import { db } from '../db';
import { proposalEsignParticipants, proposalEsignWorkflows, proposalEsignFieldEdits, prospectProposals, proposalEsignComments } from '@shared/schema';
import { eq, or, and } from 'drizzle-orm';

const router = Router();

const getAuditContext = (req: Request) => ({
  actorId: (req as any).user?.id,
  actorName: (req as any).user?.name,
  actorEmail: (req as any).user?.email,
  actorRole: (req as any).user?.role,
  actorType: 'user' as const,
  ipAddress: req.ip || req.socket.remoteAddress,
  userAgent: req.headers['user-agent'],
  deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop',
});

const ADMIN_ROLES = ['admin', 'super_admin', 'compliance_officer'];
const ELEVATED_ROLES = ['admin', 'super_admin', 'compliance_officer', 'agent', 'partner'];

async function isAuthorizedForWorkflow(userId: string, userEmail: string, userRole: string, workflowId: string): Promise<{ authorized: boolean; participant?: any; isCreator?: boolean; isAdmin?: boolean; isElevated?: boolean }> {
  const isElevated = ELEVATED_ROLES.includes(userRole);
  if (ADMIN_ROLES.includes(userRole)) {
    return { authorized: true, isAdmin: true, isElevated: true };
  }
  
  const [workflow] = await db.select().from(proposalEsignWorkflows)
    .where(eq(proposalEsignWorkflows.id, workflowId))
    .limit(1);
  
  if (!workflow) {
    return { authorized: false };
  }
  
  if (workflow.createdBy === userId) {
    return { authorized: true, isCreator: true, isElevated };
  }
  
  const [participant] = await db.select().from(proposalEsignParticipants)
    .where(
      and(
        eq(proposalEsignParticipants.workflowId, workflowId),
        or(
          eq(proposalEsignParticipants.userId, userId),
          eq(proposalEsignParticipants.email, userEmail)
        )
      )
    )
    .limit(1);
  
  if (participant) {
    return { authorized: true, participant, isElevated };
  }
  
  return { authorized: false };
}

async function requireWorkflowAccess(req: Request, res: Response, workflowId: string): Promise<{ authorized: boolean; participant?: any; isCreator?: boolean; isAdmin?: boolean; isElevated?: boolean } | null> {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  
  const auth = await isAuthorizedForWorkflow(user.id, user.email, user.role, workflowId);
  if (!auth.authorized) {
    res.status(403).json({ error: 'You do not have access to this workflow' });
    return null;
  }
  
  return auth;
}

const createWorkflowSchema = z.object({
  proposalId: z.string(),
  documentName: z.string(),
  documentUrl: z.string(),
  documentHash: z.string().optional(),
  allowEditing: z.boolean().optional(),
  isSequential: z.boolean().optional(),
  deadline: z.string().optional(),
  participants: z.array(z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    mobile: z.string().optional(),
    role: z.enum(['creator', 'editor', 'reviewer', 'approver', 'signer', 'witness', 'cc']),
    actionOrder: z.number().optional(),
    canEdit: z.boolean().optional(),
    canApprove: z.boolean().optional(),
    canSign: z.boolean().optional(),
    preferredSignatureMethod: z.enum(['zoho_sign', 'aadhaar_esign', 'dsc_token', 'otp']).optional(),
  })),
});

router.post('/workflows', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsed = createWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const workflow = await proposalEsignWorkflowService.createWorkflow({
      ...parsed.data,
      createdBy: user.id,
      createdByRole: user.role || 'agent',
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
      participants: parsed.data.participants as any,
    });

    res.json({ success: true, workflow });
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create workflow' });
  }
});

router.get('/workflows/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    
    const auth = await requireWorkflowAccess(req, res, workflowId);
    if (!auth) return;
    
    const workflow = await proposalEsignWorkflowService.getWorkflowWithDetails(workflowId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({ success: true, workflow });
  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

router.get('/workflows/proposal/:proposalId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { proposalId } = req.params;
    const workflow = await proposalEsignWorkflowService.getWorkflowByProposal(proposalId);

    if (!workflow) {
      return res.status(404).json({ error: 'No workflow found for this proposal' });
    }
    
    const auth = await requireWorkflowAccess(req, res, workflow.id);
    if (!auth) return;

    const details = await proposalEsignWorkflowService.getWorkflowWithDetails(workflow.id);
    res.json({ success: true, workflow: details });
  } catch (error) {
    console.error('Get proposal workflow error:', error);
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

router.get('/user/workflows', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workflows = await proposalEsignWorkflowService.getWorkflowsForUser(user.id, user.role);
    res.json({ success: true, ...workflows });
  } catch (error) {
    console.error('Get user workflows error:', error);
    res.status(500).json({ error: 'Failed to get workflows' });
  }
});

router.get('/user/pending-approvals', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const pending = await proposalEsignWorkflowService.getPendingApprovals(user.id);
    res.json({ success: true, pending });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ error: 'Failed to get pending approvals' });
  }
});

const addParticipantSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  mobile: z.string().optional(),
  role: z.enum(['creator', 'editor', 'reviewer', 'approver', 'signer', 'witness', 'cc']),
  actionOrder: z.number().optional(),
  canEdit: z.boolean().optional(),
  canComment: z.boolean().optional(),
  canApprove: z.boolean().optional(),
  canSign: z.boolean().optional(),
  preferredSignatureMethod: z.enum(['zoho_sign', 'aadhaar_esign', 'dsc_token', 'otp']).optional(),
  actionRequiredBy: z.string().optional(),
});

router.post('/workflows/:workflowId/participants', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    
    const auth = await requireWorkflowAccess(req, res, workflowId);
    if (!auth) return;
    
    if (!auth.isCreator && !auth.isAdmin) {
      return res.status(403).json({ error: 'Only workflow creator or admin can add participants' });
    }
    
    const parsed = addParticipantSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const participant = await proposalEsignWorkflowService.addParticipant({
      workflowId,
      ...parsed.data,
      actionRequiredBy: parsed.data.actionRequiredBy ? new Date(parsed.data.actionRequiredBy) : undefined,
    } as any);

    res.json({ success: true, participant });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to add participant' });
  }
});

const createVersionSchema = z.object({
  documentUrl: z.string(),
  documentHash: z.string().optional(),
  fileSize: z.number().optional(),
  versionLabel: z.string().optional(),
  changeDescription: z.string().optional(),
  changesFromPrevious: z.object({
    fieldsModified: z.array(z.string()),
    summary: z.string(),
  }).optional(),
});

router.post('/workflows/:workflowId/versions', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { workflowId } = req.params;
    
    const auth = await requireWorkflowAccess(req, res, workflowId);
    if (!auth) return;
    
    if (!auth.isCreator && !auth.isAdmin && !(auth.participant?.canEdit)) {
      return res.status(403).json({ error: 'You do not have permission to create versions for this workflow' });
    }
    
    const parsed = createVersionSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const version = await proposalEsignWorkflowService.createVersion({
      workflowId,
      ...parsed.data,
      createdBy: user.id,
      createdByName: user.name,
    });

    res.json({ success: true, version });
  } catch (error) {
    console.error('Create version error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create version' });
  }
});

const fieldEditSchema = z.object({
  fieldName: z.string(),
  fieldPath: z.string().optional(),
  previousValue: z.string().optional(),
  newValue: z.string(),
  changeType: z.enum(['add', 'modify', 'delete']),
});

router.post('/workflows/:workflowId/edits', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { workflowId } = req.params;
    
    const auth = await requireWorkflowAccess(req, res, workflowId);
    if (!auth) return;
    
    if (!auth.isCreator && !auth.isAdmin && !(auth.participant?.canEdit)) {
      return res.status(403).json({ error: 'You do not have permission to edit this workflow' });
    }
    
    const parsed = fieldEditSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    await proposalEsignWorkflowService.recordFieldEdit(workflowId, {
      ...parsed.data,
      editedBy: user.id,
      editedByName: user.name,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Edit recorded for approval' });
  } catch (error) {
    console.error('Record edit error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to record edit' });
  }
});

router.post('/edits/:editId/approve', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { editId } = req.params;
    
    const [edit] = await db.select().from(proposalEsignFieldEdits)
      .where(eq(proposalEsignFieldEdits.id, editId))
      .limit(1);
    
    if (!edit) {
      return res.status(404).json({ error: 'Edit not found' });
    }
    
    const auth = await requireWorkflowAccess(req, res, edit.workflowId);
    if (!auth) return;
    
    if (!auth.isElevated) {
      return res.status(403).json({ error: 'Only admin, agent, or partner can approve edits' });
    }
    
    await proposalEsignWorkflowService.approveFieldEdit(editId, user.id);

    res.json({ success: true, message: 'Edit approved' });
  } catch (error) {
    console.error('Approve edit error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to approve edit' });
  }
});

router.post('/edits/:editId/reject', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { editId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    
    const [edit] = await db.select().from(proposalEsignFieldEdits)
      .where(eq(proposalEsignFieldEdits.id, editId))
      .limit(1);
    
    if (!edit) {
      return res.status(404).json({ error: 'Edit not found' });
    }
    
    const auth = await requireWorkflowAccess(req, res, edit.workflowId);
    if (!auth) return;
    
    if (!auth.isElevated) {
      return res.status(403).json({ error: 'Only admin, agent, or partner can reject edits' });
    }

    await proposalEsignWorkflowService.rejectFieldEdit(editId, user.id, reason);

    res.json({ success: true, message: 'Edit rejected' });
  } catch (error) {
    console.error('Reject edit error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to reject edit' });
  }
});

const addCommentSchema = z.object({
  content: z.string(),
  commentType: z.enum(['comment', 'suggestion', 'question', 'issue']).optional(),
  pageNumber: z.number().optional(),
  xPosition: z.number().optional(),
  yPosition: z.number().optional(),
  highlightedText: z.string().optional(),
  parentCommentId: z.string().optional(),
  isInternal: z.boolean().optional(),
});

router.post('/workflows/:workflowId/comments', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { workflowId } = req.params;
    
    const auth = await requireWorkflowAccess(req, res, workflowId);
    if (!auth) return;
    
    const parsed = addCommentSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    await proposalEsignWorkflowService.addComment(workflowId, {
      ...parsed.data,
      authorId: user.id,
      authorName: user.name,
    });

    res.json({ success: true, message: 'Comment added' });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to add comment' });
  }
});

router.post('/comments/:commentId/resolve', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { commentId } = req.params;
    
    const [comment] = await db.select().from(proposalEsignComments)
      .where(eq(proposalEsignComments.id, commentId))
      .limit(1);
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const auth = await requireWorkflowAccess(req, res, comment.workflowId);
    if (!auth) return;
    
    await proposalEsignWorkflowService.resolveCommentThread(commentId, user.id);

    res.json({ success: true, message: 'Comment thread resolved' });
  } catch (error) {
    console.error('Resolve comment error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to resolve comment' });
  }
});


export default router;
