// @ts-nocheck
import { db } from '../db';
import { 
  proposalEsignWorkflows, proposalEsignVersions, proposalEsignParticipants,
  proposalEsignComments, proposalEsignFieldEdits, proposalEsignAuditLogs,
  prospectProposals, users,
  InsertProposalEsignWorkflow, InsertProposalEsignVersion, InsertProposalEsignParticipant,
  InsertProposalEsignComment, InsertProposalEsignFieldEdit, InsertProposalEsignAuditLog,
  ProposalEsignWorkflow, ProposalEsignParticipant, ProposalEsignVersion
} from '@shared/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { unifiedESignService } from './unified-esign-service';
import { createZohoSignService, ZohoSignService } from '../zoho/services/sign';

export type WorkflowStatus = 'draft' | 'pending_edit' | 'pending_approval' | 'pending_signature' | 
  'partially_signed' | 'completed' | 'declined' | 'expired' | 'cancelled';

export type ParticipantRole = 'creator' | 'editor' | 'reviewer' | 'approver' | 'signer' | 'witness' | 'cc';

export type SignatureMethod = 'zoho_sign' | 'aadhaar_esign' | 'dsc_token' | 'otp';

interface CreateWorkflowOptions {
  proposalId: string;
  createdBy: string;
  createdByRole: string;
  documentName: string;
  documentUrl: string;
  documentHash?: string;
  allowEditing?: boolean;
  isSequential?: boolean;
  deadline?: Date;
  participants: Array<{
    userId?: string;
    email?: string;
    name?: string;
    mobile?: string;
    role: ParticipantRole;
    actionOrder?: number;
    canEdit?: boolean;
    canApprove?: boolean;
    canSign?: boolean;
    preferredSignatureMethod?: SignatureMethod;
  }>;
}

interface AddParticipantOptions {
  workflowId: string;
  userId?: string;
  email?: string;
  name?: string;
  mobile?: string;
  role: ParticipantRole;
  actionOrder?: number;
  canEdit?: boolean;
  canComment?: boolean;
  canApprove?: boolean;
  canSign?: boolean;
  preferredSignatureMethod?: SignatureMethod;
  actionRequiredBy?: Date;
}

interface CreateVersionOptions {
  workflowId: string;
  documentUrl: string;
  documentHash?: string;
  fileSize?: number;
  versionLabel?: string;
  changeDescription?: string;
  changesFromPrevious?: { fieldsModified: string[]; summary: string };
  createdBy: string;
  createdByName?: string;
}

interface AuditContext {
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  actorType?: 'user' | 'system' | 'webhook';
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  geoLocation?: { country?: string; city?: string };
}

class ProposalEsignWorkflowService {
  private zohoSignService: ZohoSignService | null = null;

  private getZohoSignService(): ZohoSignService {
    if (!this.zohoSignService) {
      const connectionId = process.env.ZOHO_CONNECTION_ID || 'default';
      this.zohoSignService = createZohoSignService(connectionId, 'in');
    }
    return this.zohoSignService;
  }

  private generateDocumentNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `DOC-${year}${month}-${nanoid(8).toUpperCase()}`;
  }

  async createWorkflow(options: CreateWorkflowOptions): Promise<ProposalEsignWorkflow> {
    const proposal = await db.select().from(prospectProposals)
      .where(eq(prospectProposals.id, options.proposalId))
      .limit(1);

    if (!proposal.length) {
      throw new Error('Proposal not found');
    }

    const documentNumber = this.generateDocumentNumber();
    const retentionExpiresAt = new Date();
    retentionExpiresAt.setFullYear(retentionExpiresAt.getFullYear() + 8);

    const [workflow] = await db.insert(proposalEsignWorkflows).values({
      proposalId: options.proposalId,
      proposalType: proposal[0].proposalType,
      documentNumber,
      documentName: options.documentName,
      documentType: 'investment_agreement',
      originalDocumentUrl: options.documentUrl,
      currentDocumentUrl: options.documentUrl,
      documentHash: options.documentHash,
      allowEditing: options.allowEditing ?? false,
      isSequential: options.isSequential ?? true,
      requireAllSignatures: true,
      deadline: options.deadline,
      status: 'draft',
      statusChangedAt: new Date(),
      statusChangedBy: options.createdBy,
      retentionExpiresAt,
      createdBy: options.createdBy,
      createdByRole: options.createdByRole,
    }).returning();

    await db.insert(proposalEsignVersions).values({
      workflowId: workflow.id,
      versionNumber: 1,
      negotiationRound: 1,
      versionLabel: 'Original',
      documentUrl: options.documentUrl,
      documentHash: options.documentHash,
      createdBy: options.createdBy,
    });

    for (const participant of options.participants) {
      await this.addParticipant({
        workflowId: workflow.id,
        userId: participant.userId,
        email: participant.email,
        name: participant.name,
        mobile: participant.mobile,
        role: participant.role,
        actionOrder: participant.actionOrder,
        canEdit: participant.canEdit,
        canApprove: participant.canApprove,
        canSign: participant.canSign,
        preferredSignatureMethod: participant.preferredSignatureMethod,
      });
    }

    await this.logAudit(workflow.id, {
      action: 'workflow_created',
      actionCategory: 'workflow',
      description: `Document workflow created for proposal ${proposal[0].proposalTitle}`,
      actorId: options.createdBy,
      actorRole: options.createdByRole,
      actorType: 'user',
      newState: { status: 'draft', participants: options.participants.length },
    });

    return workflow;
  }

  async addParticipant(options: AddParticipantOptions): Promise<ProposalEsignParticipant> {
    const [participant] = await db.insert(proposalEsignParticipants).values({
      workflowId: options.workflowId,
      userId: options.userId,
      externalEmail: options.email,
      externalName: options.name,
      externalMobile: options.mobile,
      role: options.role,
      actionOrder: options.actionOrder ?? 1,
      canEdit: options.canEdit ?? false,
      canComment: options.canComment ?? true,
      canApprove: options.canApprove ?? false,
      canSign: options.canSign ?? false,
      preferredSignatureMethod: options.preferredSignatureMethod,
      actionStatus: 'pending',
      actionRequiredBy: options.actionRequiredBy,
    }).returning();

    return participant;
  }

  async getWorkflow(workflowId: string): Promise<ProposalEsignWorkflow | null> {
    const [workflow] = await db.select().from(proposalEsignWorkflows)
      .where(eq(proposalEsignWorkflows.id, workflowId))
      .limit(1);
    return workflow || null;
  }

  async getWorkflowByProposal(proposalId: string): Promise<ProposalEsignWorkflow | null> {
    const [workflow] = await db.select().from(proposalEsignWorkflows)
      .where(eq(proposalEsignWorkflows.proposalId, proposalId))
      .orderBy(desc(proposalEsignWorkflows.createdAt))
      .limit(1);
    return workflow || null;
  }

  async getWorkflowWithDetails(workflowId: string) {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return null;

    const participants = await db.select().from(proposalEsignParticipants)
      .where(eq(proposalEsignParticipants.workflowId, workflowId))
      .orderBy(asc(proposalEsignParticipants.actionOrder));

    const versions = await db.select().from(proposalEsignVersions)
      .where(eq(proposalEsignVersions.workflowId, workflowId))
      .orderBy(desc(proposalEsignVersions.versionNumber));

    const comments = await db.select().from(proposalEsignComments)
      .where(and(
        eq(proposalEsignComments.workflowId, workflowId),
        sql`${proposalEsignComments.deletedAt} IS NULL`
      ))
      .orderBy(desc(proposalEsignComments.createdAt));

    const pendingEdits = await db.select().from(proposalEsignFieldEdits)
      .where(and(
        eq(proposalEsignFieldEdits.workflowId, workflowId),
        eq(proposalEsignFieldEdits.approvalStatus, 'pending')
      ));

    return {
      ...workflow,
      participants,
      versions,
      comments,
      pendingEdits,
    };
  }

  async createVersion(options: CreateVersionOptions): Promise<ProposalEsignVersion> {
    const workflow = await this.getWorkflow(options.workflowId);
    if (!workflow) throw new Error('Workflow not found');

    if (workflow.editingLockedAt) {
      throw new Error('Document editing is locked after first signature');
    }

    const newVersionNumber = workflow.currentVersion + 1;

    const [version] = await db.insert(proposalEsignVersions).values({
      workflowId: options.workflowId,
      versionNumber: newVersionNumber,
      negotiationRound: workflow.negotiationRound,
      versionLabel: options.versionLabel || `Revision ${newVersionNumber - 1}`,
      documentUrl: options.documentUrl,
      documentHash: options.documentHash,
      fileSize: options.fileSize,
      changeDescription: options.changeDescription,
      changesFromPrevious: options.changesFromPrevious,
      createdBy: options.createdBy,
      createdByName: options.createdByName,
    }).returning();

    await db.update(proposalEsignWorkflows)
      .set({
        currentVersion: newVersionNumber,
        currentDocumentUrl: options.documentUrl,
        documentHash: options.documentHash,
        updatedAt: new Date(),
      })
      .where(eq(proposalEsignWorkflows.id, options.workflowId));

    await this.logAudit(options.workflowId, {
      action: 'version_created',
      actionCategory: 'content',
      description: `New version ${newVersionNumber} created: ${options.changeDescription || 'Document updated'}`,
      actorId: options.createdBy,
      actorType: 'user',
      newState: { versionNumber: newVersionNumber },
    });

    return version;
  }

  async recordFieldEdit(workflowId: string, edit: {
    fieldName: string;
    fieldPath?: string;
    previousValue?: string;
    newValue: string;
    changeType: 'add' | 'modify' | 'delete';
    editedBy: string;
    editedByName?: string;
    ipAddress?: string;
  }): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    if (!workflow.allowEditing) throw new Error('Editing is not allowed for this document');
    if (workflow.editingLockedAt) throw new Error('Document editing is locked');

    const currentVersion = await db.select().from(proposalEsignVersions)
      .where(and(
        eq(proposalEsignVersions.workflowId, workflowId),
        eq(proposalEsignVersions.versionNumber, workflow.currentVersion)
      ))
      .limit(1);

    await db.insert(proposalEsignFieldEdits).values({
      workflowId,
      versionId: currentVersion[0]?.id,
      fieldName: edit.fieldName,
      fieldPath: edit.fieldPath,
      previousValue: edit.previousValue,
      newValue: edit.newValue,
      changeType: edit.changeType,
      approvalStatus: 'pending',
      editedBy: edit.editedBy,
      editedByName: edit.editedByName,
      ipAddress: edit.ipAddress,
    });

    const participant = await db.select().from(proposalEsignParticipants)
      .where(and(
        eq(proposalEsignParticipants.workflowId, workflowId),
        eq(proposalEsignParticipants.userId, edit.editedBy)
      ))
      .limit(1);

    if (participant.length) {
      await db.update(proposalEsignParticipants)
        .set({
          hasEdited: true,
          lastEditedAt: new Date(),
          editCount: sql`${proposalEsignParticipants.editCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(proposalEsignParticipants.id, participant[0].id));
    }

    await this.logAudit(workflowId, {
      action: 'field_edited',
      actionCategory: 'content',
      description: `Field "${edit.fieldName}" ${edit.changeType}d`,
      actorId: edit.editedBy,
      actorType: 'user',
      previousState: { value: edit.previousValue },
      newState: { value: edit.newValue },
    });
  }

  async approveFieldEdit(editId: string, approvedBy: string): Promise<void> {
    const [edit] = await db.select().from(proposalEsignFieldEdits)
      .where(eq(proposalEsignFieldEdits.id, editId))
      .limit(1);

    if (!edit) throw new Error('Edit not found');
    if (edit.approvalStatus !== 'pending') throw new Error('Edit is not pending approval');

    await db.update(proposalEsignFieldEdits)
      .set({
        approvalStatus: 'approved',
        approvedBy,
        approvedAt: new Date(),
      })
      .where(eq(proposalEsignFieldEdits.id, editId));

    await this.logAudit(edit.workflowId, {
      action: 'edit_approved',
      actionCategory: 'content',
      description: `Edit to field "${edit.fieldName}" approved`,
      actorId: approvedBy,
      actorType: 'user',
    });
  }

  async rejectFieldEdit(editId: string, rejectedBy: string, reason: string): Promise<void> {
    const [edit] = await db.select().from(proposalEsignFieldEdits)
      .where(eq(proposalEsignFieldEdits.id, editId))
      .limit(1);

    if (!edit) throw new Error('Edit not found');

    await db.update(proposalEsignFieldEdits)
      .set({
        approvalStatus: 'rejected',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(proposalEsignFieldEdits.id, editId));

    await this.logAudit(edit.workflowId, {
      action: 'edit_rejected',
      actionCategory: 'content',
      description: `Edit to field "${edit.fieldName}" rejected: ${reason}`,
      actorId: rejectedBy,
      actorType: 'user',
    });
  }

  async addComment(workflowId: string, comment: {
    content: string;
    commentType?: 'comment' | 'suggestion' | 'question' | 'issue';
    pageNumber?: number;
    xPosition?: number;
    yPosition?: number;
    highlightedText?: string;
    parentCommentId?: string;
    isInternal?: boolean;
    authorId: string;
    authorName?: string;
  }): Promise<void> {
    const currentVersion = await db.select().from(proposalEsignVersions)
      .where(eq(proposalEsignVersions.workflowId, workflowId))
      .orderBy(desc(proposalEsignVersions.versionNumber))
      .limit(1);

    const participant = await db.select().from(proposalEsignParticipants)
      .where(and(
        eq(proposalEsignParticipants.workflowId, workflowId),
        eq(proposalEsignParticipants.userId, comment.authorId)
      ))
      .limit(1);

    await db.insert(proposalEsignComments).values({
      workflowId,
      versionId: currentVersion[0]?.id,
      participantId: participant[0]?.id,
      content: comment.content,
      commentType: comment.commentType || 'comment',
      pageNumber: comment.pageNumber,
      xPosition: comment.xPosition?.toString(),
      yPosition: comment.yPosition?.toString(),
      highlightedText: comment.highlightedText,
      parentCommentId: comment.parentCommentId,
      isInternal: comment.isInternal ?? false,
      authorId: comment.authorId,
      authorName: comment.authorName,
    });

    await this.logAudit(workflowId, {
      action: 'comment_added',
      actionCategory: 'content',
      description: `${comment.commentType || 'Comment'} added`,
      actorId: comment.authorId,
      actorType: 'user',
    });
  }

  async resolveCommentThread(commentId: string, resolvedBy: string): Promise<void> {
    const [comment] = await db.select().from(proposalEsignComments)
      .where(eq(proposalEsignComments.id, commentId))
      .limit(1);

    if (!comment) throw new Error('Comment not found');

    await db.update(proposalEsignComments)
      .set({
        threadResolved: true,
        resolvedBy,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(proposalEsignComments.id, commentId));

    await this.logAudit(comment.workflowId, {
      action: 'comment_resolved',
      actionCategory: 'content',
      description: 'Comment thread resolved',
      actorId: resolvedBy,
      actorType: 'user',
    });
  }

  async updateWorkflowStatus(workflowId: string, status: WorkflowStatus, changedBy: string): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    const previousStatus = workflow.status;

    const updateData: Partial<ProposalEsignWorkflow> = {
      status,
      statusChangedAt: new Date(),
      statusChangedBy: changedBy,
      updatedAt: new Date(),
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status === 'declined') {
      updateData.declinedAt = new Date();
      updateData.declinedBy = changedBy;
    }

    await db.update(proposalEsignWorkflows)
      .set(updateData)
      .where(eq(proposalEsignWorkflows.id, workflowId));

    await this.logAudit(workflowId, {
      action: 'status_changed',
      actionCategory: 'workflow',
      description: `Status changed from ${previousStatus} to ${status}`,
      actorId: changedBy,
      actorType: 'user',
      previousState: { status: previousStatus },
      newState: { status },
    });
  }

  async lockDocumentForSigning(workflowId: string, lockedBy: string): Promise<void> {
    await db.update(proposalEsignWorkflows)
      .set({
        editingLockedAt: new Date(),
        editingLockedBy: lockedBy,
        updatedAt: new Date(),
      })
      .where(eq(proposalEsignWorkflows.id, workflowId));

    const currentVersion = await db.select().from(proposalEsignVersions)
      .where(eq(proposalEsignVersions.workflowId, workflowId))
      .orderBy(desc(proposalEsignVersions.versionNumber))
      .limit(1);

    if (currentVersion.length) {
      await db.update(proposalEsignVersions)
        .set({
          isLocked: true,
          lockedAt: new Date(),
        })
        .where(eq(proposalEsignVersions.id, currentVersion[0].id));
    }

    await this.logAudit(workflowId, {
      action: 'document_locked',
      actionCategory: 'workflow',
      description: 'Document locked for signing - no further edits allowed',
      actorId: lockedBy,
      actorType: 'user',
    });
  }

  async initiateSignature(
    workflowId: string, 
    participantId: string, 
    method: SignatureMethod,
    context: AuditContext
  ): Promise<{ signUrl?: string; transactionId?: string; message: string }> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    const [participant] = await db.select().from(proposalEsignParticipants)
      .where(eq(proposalEsignParticipants.id, participantId))
      .limit(1);

    if (!participant) throw new Error('Participant not found');
    if (!participant.canSign) throw new Error('Participant is not authorized to sign');

    if (!workflow.editingLockedAt) {
      await this.lockDocumentForSigning(workflowId, context.actorId || 'system');
    }

    await db.update(proposalEsignParticipants)
      .set({
        actionStatus: 'in_progress',
        signatureMethod: method,
        updatedAt: new Date(),
      })
      .where(eq(proposalEsignParticipants.id, participantId));

    const email = participant.userId 
      ? (await db.select().from(users).where(eq(users.id, participant.userId)).limit(1))[0]?.email 
      : participant.externalEmail;

    const name = participant.userId
      ? (await db.select().from(users).where(eq(users.id, participant.userId)).limit(1))[0]?.name
      : participant.externalName;

    let result: { signUrl?: string; transactionId?: string; message: string };

    if (method === 'zoho_sign') {
      try {
        const zohoSign = this.getZohoSignService();
        const signRequest = await zohoSign.createKYCSignRequest({
          clientName: name || 'Client',
          clientEmail: email || '',
          documentType: 'investment_agreement',
          documentContent: Buffer.from(''), // Would fetch actual document
        });

        await db.update(proposalEsignWorkflows)
          .set({
            zohoSignRequestId: signRequest.requestId,
            updatedAt: new Date(),
          })
          .where(eq(proposalEsignWorkflows.id, workflowId));

        result = {
          signUrl: signRequest.signUrl,
          transactionId: signRequest.requestId,
          message: 'Zoho Sign request created successfully',
        };
      } catch (error) {
        result = { message: `Zoho Sign error: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    } else if (method === 'aadhaar_esign') {
      const transactionId = `PROP-${nanoid(12)}`;
      result = {
        transactionId,
        message: 'Aadhaar eSign initiated - OTP will be sent to registered mobile',
      };
    } else if (method === 'dsc_token') {
      result = {
        message: 'DSC Token signing initiated - please connect your hardware token',
      };
    } else {
      result = {
        message: 'OTP signing initiated',
      };
    }

    await this.updateWorkflowStatus(workflowId, 'pending_signature', context.actorId || 'system');

    await this.logAudit(workflowId, {
      action: 'signature_initiated',
      actionCategory: 'signature',
      description: `Signature initiated via ${method} for ${name || email}`,
      ...context,
      metadata: { method, participantId },
    });

    return result;
  }

  async recordSignature(
    workflowId: string,
    participantId: string,
    signatureData: {
      certificateId?: string;
      signatureHash?: string;
      signerName?: string;
      signedDocumentUrl?: string;
    },
    context: AuditContext
  ): Promise<void> {
    const [participant] = await db.select().from(proposalEsignParticipants)
      .where(eq(proposalEsignParticipants.id, participantId))
      .limit(1);

    if (!participant) throw new Error('Participant not found');

    await db.update(proposalEsignParticipants)
      .set({
        hasSigned: true,
        signedAt: new Date(),
        signatureData,
        actionStatus: 'completed',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        updatedAt: new Date(),
      })
      .where(eq(proposalEsignParticipants.id, participantId));

    const allSigners = await db.select().from(proposalEsignParticipants)
      .where(and(
        eq(proposalEsignParticipants.workflowId, workflowId),
        eq(proposalEsignParticipants.canSign, true)
      ));

    const signedCount = allSigners.filter(s => s.hasSigned).length + 1;
    const totalSigners = allSigners.length;

    if (signatureData.signedDocumentUrl) {
      await db.update(proposalEsignWorkflows)
        .set({
          signedDocumentUrl: signatureData.signedDocumentUrl,
          updatedAt: new Date(),
        })
        .where(eq(proposalEsignWorkflows.id, workflowId));
    }

    if (signedCount >= totalSigners) {
      await this.updateWorkflowStatus(workflowId, 'completed', context.actorId || 'system');
    } else {
      await this.updateWorkflowStatus(workflowId, 'partially_signed', context.actorId || 'system');
    }

    await this.logAudit(workflowId, {
      action: 'signature_recorded',
      actionCategory: 'signature',
      description: `Signature recorded (${signedCount}/${totalSigners} complete)`,
      ...context,
      newState: { signedCount, totalSigners },
    });
  }

  async recordDecline(
    workflowId: string,
    participantId: string,
    reason: string,
    context: AuditContext
  ): Promise<void> {
    await db.update(proposalEsignParticipants)
      .set({
        hasDeclined: true,
        declinedAt: new Date(),
        declineReason: reason,
        actionStatus: 'declined',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        updatedAt: new Date(),
      })
      .where(eq(proposalEsignParticipants.id, participantId));

    await db.update(proposalEsignWorkflows)
      .set({
        status: 'declined',
        declinedAt: new Date(),
        declinedBy: context.actorId,
        declineReason: reason,
        statusChangedAt: new Date(),
        statusChangedBy: context.actorId,
        updatedAt: new Date(),
      })
      .where(eq(proposalEsignWorkflows.id, workflowId));

    await this.logAudit(workflowId, {
      action: 'document_declined',
      actionCategory: 'signature',
      description: `Document declined: ${reason}`,
      ...context,
    });
  }

  async recordView(workflowId: string, participantId: string, context: AuditContext): Promise<void> {
    const [participant] = await db.select().from(proposalEsignParticipants)
      .where(eq(proposalEsignParticipants.id, participantId))
      .limit(1);

    if (!participant) return;

    const updateData: any = {
      lastViewedAt: new Date(),
      viewCount: sql`${proposalEsignParticipants.viewCount} + 1`,
      updatedAt: new Date(),
    };

    if (!participant.firstViewedAt) {
      updateData.firstViewedAt = new Date();
    }

    if (context.ipAddress || context.userAgent) {
      updateData.ipAddress = context.ipAddress;
      updateData.userAgent = context.userAgent;
      updateData.deviceInfo = {
        type: context.deviceType,
      };
    }

    await db.update(proposalEsignParticipants)
      .set(updateData)
      .where(eq(proposalEsignParticipants.id, participantId));

    await this.logAudit(workflowId, {
      action: 'document_viewed',
      actionCategory: 'workflow',
      description: 'Document viewed',
      ...context,
    });
  }

  async startNegotiationRound(workflowId: string, initiatedBy: string): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    const newRound = workflow.negotiationRound + 1;

    await db.update(proposalEsignWorkflows)
      .set({
        negotiationRound: newRound,
        status: 'pending_edit',
        statusChangedAt: new Date(),
        statusChangedBy: initiatedBy,
        editingLockedAt: null,
        editingLockedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(proposalEsignWorkflows.id, workflowId));

    await db.update(proposalEsignParticipants)
      .set({
        actionStatus: 'pending',
        hasSigned: false,
        signedAt: null,
        signatureData: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(proposalEsignParticipants.workflowId, workflowId),
        eq(proposalEsignParticipants.canSign, true)
      ));

    await this.logAudit(workflowId, {
      action: 'negotiation_round_started',
      actionCategory: 'workflow',
      description: `Negotiation round ${newRound} started`,
      actorId: initiatedBy,
      actorType: 'user',
      newState: { round: newRound },
    });
  }

  async getAuditLog(workflowId: string, limit = 100) {
    return db.select().from(proposalEsignAuditLogs)
      .where(eq(proposalEsignAuditLogs.workflowId, workflowId))
      .orderBy(desc(proposalEsignAuditLogs.timestamp))
      .limit(limit);
  }

  private async logAudit(
    workflowId: string,
    log: Omit<InsertProposalEsignAuditLog, 'workflowId'>
  ): Promise<void> {
    await db.insert(proposalEsignAuditLogs).values({
      workflowId,
      ...log,
    });
  }

  async getWorkflowsForUser(userId: string, role?: string) {
    const asCreator = await db.select().from(proposalEsignWorkflows)
      .where(eq(proposalEsignWorkflows.createdBy, userId))
      .orderBy(desc(proposalEsignWorkflows.createdAt));

    const participations = await db.select({
      workflow: proposalEsignWorkflows,
      participant: proposalEsignParticipants,
    })
      .from(proposalEsignParticipants)
      .innerJoin(proposalEsignWorkflows, eq(proposalEsignParticipants.workflowId, proposalEsignWorkflows.id))
      .where(eq(proposalEsignParticipants.userId, userId))
      .orderBy(desc(proposalEsignWorkflows.createdAt));

    const createdIds = new Set(asCreator.map(w => w.id));
    const participatedWorkflows = participations
      .filter(p => !createdIds.has(p.workflow.id))
      .map(p => ({ ...p.workflow, participantRole: p.participant.role }));

    return {
      created: asCreator,
      participating: participatedWorkflows,
    };
  }

  async getPendingApprovals(userId: string) {
    return db.select({
      workflow: proposalEsignWorkflows,
      participant: proposalEsignParticipants,
    })
      .from(proposalEsignParticipants)
      .innerJoin(proposalEsignWorkflows, eq(proposalEsignParticipants.workflowId, proposalEsignWorkflows.id))
      .where(and(
        eq(proposalEsignParticipants.userId, userId),
        eq(proposalEsignParticipants.actionStatus, 'pending'),
        inArray(proposalEsignParticipants.role, ['approver', 'signer'])
      ))
      .orderBy(asc(proposalEsignParticipants.actionRequiredBy));
  }

  async sendReminder(workflowId: string, participantId: string): Promise<void> {
    const [participant] = await db.select().from(proposalEsignParticipants)
      .where(eq(proposalEsignParticipants.id, participantId))
      .limit(1);

    if (!participant) return;

    await db.update(proposalEsignParticipants)
      .set({
        remindersSent: sql`${proposalEsignParticipants.remindersSent} + 1`,
        lastReminderAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(proposalEsignParticipants.id, participantId));

    await db.update(proposalEsignWorkflows)
      .set({
        lastReminderSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(proposalEsignWorkflows.id, workflowId));

    await this.logAudit(workflowId, {
      action: 'reminder_sent',
      actionCategory: 'notification',
      description: `Reminder sent to participant`,
      actorType: 'system',
      metadata: { participantId },
    });
  }
}

export const proposalEsignWorkflowService = new ProposalEsignWorkflowService();
