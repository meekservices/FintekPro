// @ts-nocheck
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { proposalEsignWorkflows, proposalEsignParticipants, users } from '@shared/schema';
import { eq, or, and, desc, sql } from 'drizzle-orm';

const router = Router();

router.get('/my-documents', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userEmail = user.email;
    const userId = user.id;

    const participantRecords = await db
      .select({
        participantId: proposalEsignParticipants.id,
        workflowId: proposalEsignParticipants.workflowId,
        role: proposalEsignParticipants.role,
        actionStatus: proposalEsignParticipants.actionStatus,
        canSign: proposalEsignParticipants.canSign,
        hasSigned: proposalEsignParticipants.hasSigned,
        signedAt: proposalEsignParticipants.signedAt,
        signatureMethod: proposalEsignParticipants.signatureMethod,
        hasDeclined: proposalEsignParticipants.hasDeclined,
        declinedAt: proposalEsignParticipants.declinedAt,
        declineReason: proposalEsignParticipants.declineReason,
        firstViewedAt: proposalEsignParticipants.firstViewedAt,
        preferredSignatureMethod: proposalEsignParticipants.preferredSignatureMethod,
      })
      .from(proposalEsignParticipants)
      .where(
        or(
          eq(proposalEsignParticipants.userId, userId),
          eq(proposalEsignParticipants.externalEmail, userEmail)
        )
      );

    if (participantRecords.length === 0) {
      return res.json({ 
        documents: [],
        pendingCount: 0,
        completedCount: 0,
        totalCount: 0
      });
    }

    const workflowIds = participantRecords.map(p => p.workflowId);

    const workflows = await db
      .select({
        id: proposalEsignWorkflows.id,
        documentNumber: proposalEsignWorkflows.documentNumber,
        documentName: proposalEsignWorkflows.documentName,
        documentType: proposalEsignWorkflows.documentType,
        status: proposalEsignWorkflows.status,
        currentDocumentUrl: proposalEsignWorkflows.currentDocumentUrl,
        signedDocumentUrl: proposalEsignWorkflows.signedDocumentUrl,
        deadline: proposalEsignWorkflows.deadline,
        createdAt: proposalEsignWorkflows.createdAt,
        completedAt: proposalEsignWorkflows.completedAt,
        createdBy: proposalEsignWorkflows.createdBy,
      })
      .from(proposalEsignWorkflows)
      .where(sql`${proposalEsignWorkflows.id} IN (${sql.join(workflowIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(proposalEsignWorkflows.createdAt));

    const creatorIds = workflows.map(w => w.createdBy).filter(Boolean) as string[];
    let creatorMap: Record<string, string> = {};
    
    if (creatorIds.length > 0) {
      const creators = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(creatorIds.map(id => sql`${id}`), sql`, `)})`);
      
      creatorMap = creators.reduce((acc, c) => {
        acc[c.id] = c.name || 'Unknown';
        return acc;
      }, {} as Record<string, string>);
    }

    const participantMap = participantRecords.reduce((acc, p) => {
      acc[p.workflowId] = p;
      return acc;
    }, {} as Record<string, typeof participantRecords[0]>);

    const documents = workflows.map(workflow => {
      const participant = participantMap[workflow.id];
      const isPending = participant?.actionStatus === 'pending' || participant?.actionStatus === 'waiting';
      const isCompleted = participant?.hasSigned || workflow.status === 'completed' || workflow.status === 'signed';
      const isDeclined = participant?.hasDeclined;

      let clientStatus: 'pending' | 'completed' | 'declined' | 'expired' = 'pending';
      if (isDeclined) {
        clientStatus = 'declined';
      } else if (isCompleted) {
        clientStatus = 'completed';
      } else if (workflow.deadline && new Date(workflow.deadline) < new Date()) {
        clientStatus = 'expired';
      }

      return {
        id: workflow.id,
        documentNumber: workflow.documentNumber,
        documentName: workflow.documentName,
        documentType: workflow.documentType,
        workflowStatus: workflow.status,
        clientStatus,
        documentUrl: workflow.signedDocumentUrl || workflow.currentDocumentUrl,
        signedDocumentUrl: workflow.signedDocumentUrl,
        deadline: workflow.deadline,
        createdAt: workflow.createdAt,
        completedAt: workflow.completedAt,
        createdByName: workflow.createdBy ? creatorMap[workflow.createdBy] : 'System',
        participantRole: participant?.role,
        canSign: participant?.canSign,
        hasSigned: participant?.hasSigned,
        signedAt: participant?.signedAt,
        signatureMethod: participant?.signatureMethod,
        preferredSignatureMethod: participant?.preferredSignatureMethod,
        declineReason: participant?.declineReason,
      };
    });

    const pendingCount = documents.filter(d => d.clientStatus === 'pending').length;
    const completedCount = documents.filter(d => d.clientStatus === 'completed').length;

    res.json({
      documents,
      pendingCount,
      completedCount,
      totalCount: documents.length,
    });
  } catch (error) {
    console.error('Failed to fetch client documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.get('/my-documents/:workflowId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { workflowId } = req.params;
    const userEmail = user.email;
    const userId = user.id;

    const [participant] = await db
      .select()
      .from(proposalEsignParticipants)
      .where(
        and(
          eq(proposalEsignParticipants.workflowId, workflowId),
          or(
            eq(proposalEsignParticipants.userId, userId),
            eq(proposalEsignParticipants.externalEmail, userEmail)
          )
        )
      )
      .limit(1);

    if (!participant) {
      return res.status(403).json({ error: 'You do not have access to this document' });
    }

    const [workflow] = await db
      .select()
      .from(proposalEsignWorkflows)
      .where(eq(proposalEsignWorkflows.id, workflowId))
      .limit(1);

    if (!workflow) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!participant.firstViewedAt) {
      await db
        .update(proposalEsignParticipants)
        .set({ firstViewedAt: new Date() })
        .where(eq(proposalEsignParticipants.id, participant.id));
    }

    res.json({
      workflow,
      participant,
    });
  } catch (error) {
    console.error('Failed to fetch document details:', error);
    res.status(500).json({ error: 'Failed to fetch document details' });
  }
});

export default router;
