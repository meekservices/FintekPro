import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import crypto from "crypto";

// Document Status State Machine - Valid Transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["negotiation", "review", "rejected", "archived"],
  negotiation: ["draft", "review", "rejected", "archived"],
  review: ["negotiation", "approved", "rejected", "archived"],
  approved: ["signed", "review", "rejected", "archived"],
  signed: ["legacy", "archived"],
  legacy: ["archived"],
  expired: ["archived", "renewal"],
  rejected: ["draft", "archived"],
  archived: [],
};

// Actions that trigger transitions
const ACTION_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  submit_for_negotiation: { from: ["draft"], to: "negotiation" },
  submit_for_review: { from: ["draft", "negotiation"], to: "review" },
  approve: { from: ["review"], to: "approved" },
  reject: { from: ["review", "negotiation"], to: "rejected" },
  send_back: { from: ["review", "approved"], to: "negotiation" },
  sign: { from: ["approved"], to: "signed" },
  archive: { from: ["draft", "negotiation", "review", "approved", "signed", "legacy", "rejected"], to: "archived" },
  reopen: { from: ["rejected"], to: "draft" },
  mark_legacy: { from: ["signed"], to: "legacy" },
};

export class DLMWorkflowService {
  
  // Generate SHA-256 hash
  static generateHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  // Validate state transition
  static isValidTransition(fromStatus: string, toStatus: string): boolean {
    const allowedTransitions = VALID_TRANSITIONS[fromStatus] || [];
    return allowedTransitions.includes(toStatus);
  }

  // Get allowed actions for a document status
  static getAllowedActions(currentStatus: string): string[] {
    return Object.entries(ACTION_TRANSITIONS)
      .filter(([_, config]) => config.from.includes(currentStatus))
      .map(([action]) => action);
  }

  // Create new document
  static async createDocument(data: {
    title: string;
    description?: string;
    entityType: "vendor" | "partner" | "agent" | "ca" | "lender" | "client" | "regulator" | "internal";
    entityId?: string;
    entityName?: string;
    entityPan?: string;
    agreementType: string;
    effectiveDate?: string;
    expiryDate?: string;
    createdBy: string;
    createdByRole: string;
    content?: string;
    isLegacy?: boolean;
    legacyDeclaration?: string;
    originalSignDate?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }) {
    const documentNumber = `DOC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const initialStatus = data.isLegacy ? "legacy" : "draft";
    
    // Create document
    const [document] = await db.insert(schema.documents)
      .values({
        documentNumber,
        title: data.title,
        description: data.description,
        entityType: data.entityType as any,
        entityId: data.entityId,
        entityName: data.entityName,
        entityPan: data.entityPan,
        agreementType: data.agreementType as any,
        status: initialStatus as any,
        effectiveDate: data.effectiveDate,
        expiryDate: data.expiryDate,
        createdBy: data.createdBy,
        createdByRole: data.createdByRole,
        isLegacy: data.isLegacy || false,
        legacyUploadedAt: data.isLegacy ? new Date() : undefined,
        legacyDeclaration: data.legacyDeclaration,
        originalSignDate: data.originalSignDate,
        tags: data.tags || [],
        metadata: data.metadata || {},
        versionCount: 1,
      })
      .returning();

    // Create initial version if content provided
    if (data.content) {
      const contentHash = this.generateHash(data.content);
      
      const [version] = await db.insert(schema.documentVersions)
        .values({
          documentId: document.id,
          versionNumber: 1,
          versionLabel: "v1.0",
          content: data.content,
          contentType: "text",
          contentHash,
          statusAtVersion: initialStatus as any,
          changeSummary: "Initial version",
          createdBy: data.createdBy,
          createdByRole: data.createdByRole,
          isLocked: true,
        })
        .returning();

      // Update document with current version
      await db.update(schema.documents)
        .set({ currentVersionId: version.id })
        .where(eq(schema.documents.id, document.id));

      // Create audit event
      await this.createAuditEvent({
        documentId: document.id,
        versionId: version.id,
        eventType: "document_created",
        eventCategory: "document",
        actorId: data.createdBy,
        actorRole: data.createdByRole,
        eventData: {
          title: data.title,
          entityType: data.entityType,
          agreementType: data.agreementType,
          isLegacy: data.isLegacy,
        },
        newState: { status: initialStatus },
      });
    }

    return document;
  }

  // Create new version
  static async createVersion(data: {
    documentId: string;
    content: string;
    contentType?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    fileMimeType?: string;
    changeSummary?: string;
    createdBy: string;
    createdByRole: string;
  }) {
    // Get current document
    const [document] = await db.select()
      .from(schema.documents)
      .where(eq(schema.documents.id, data.documentId))
      .limit(1);

    if (!document) {
      throw new Error("Document not found");
    }

    const newVersionNumber = (document.versionCount || 0) + 1;
    const contentHash = this.generateHash(data.content);

    // Create version
    const [version] = await db.insert(schema.documentVersions)
      .values({
        documentId: data.documentId,
        versionNumber: newVersionNumber,
        versionLabel: `v${newVersionNumber}.0`,
        content: data.content,
        contentType: data.contentType || "text",
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileMimeType: data.fileMimeType,
        contentHash,
        statusAtVersion: document.status as any,
        changeSummary: data.changeSummary || `Version ${newVersionNumber}`,
        createdBy: data.createdBy,
        createdByRole: data.createdByRole,
        isLocked: true,
      })
      .returning();

    // Update document
    await db.update(schema.documents)
      .set({
        currentVersionId: version.id,
        versionCount: newVersionNumber,
        updatedAt: new Date(),
      })
      .where(eq(schema.documents.id, data.documentId));

    // Create audit event
    await this.createAuditEvent({
      documentId: data.documentId,
      versionId: version.id,
      eventType: "version_created",
      eventCategory: "document",
      actorId: data.createdBy,
      actorRole: data.createdByRole,
      eventData: {
        versionNumber: newVersionNumber,
        changeSummary: data.changeSummary,
      },
    });

    return version;
  }

  // Transition document status
  static async transitionStatus(data: {
    documentId: string;
    action: string;
    reason?: string;
    comments?: string;
    performedBy: string;
    performedByRole: string;
    isAiOverride?: boolean;
    aiOverrideJustification?: string;
    checklistSnapshot?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Get current document
    const [document] = await db.select()
      .from(schema.documents)
      .where(eq(schema.documents.id, data.documentId))
      .limit(1);

    if (!document) {
      throw new Error("Document not found");
    }

    const currentStatus = document.status;
    const actionConfig = ACTION_TRANSITIONS[data.action];

    if (!actionConfig) {
      throw new Error(`Invalid action: ${data.action}`);
    }

    if (!actionConfig.from.includes(currentStatus)) {
      throw new Error(`Action '${data.action}' not allowed from status '${currentStatus}'`);
    }

    const newStatus = actionConfig.to;

    if (!this.isValidTransition(currentStatus, newStatus)) {
      throw new Error(`Invalid transition from '${currentStatus}' to '${newStatus}'`);
    }

    // Create transition record
    const [transition] = await db.insert(schema.documentWorkflowTransitions)
      .values({
        documentId: data.documentId,
        versionId: document.currentVersionId,
        fromStatus: currentStatus as any,
        toStatus: newStatus as any,
        performedBy: data.performedBy,
        performedByRole: data.performedByRole,
        action: data.action,
        reason: data.reason,
        comments: data.comments,
        isAiOverride: data.isAiOverride || false,
        aiOverrideJustification: data.aiOverrideJustification,
        checklistSnapshot: data.checklistSnapshot,
        checklistComplete: !!data.checklistSnapshot,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      })
      .returning();

    // Update document status
    const updateData: any = {
      status: newStatus as any,
      updatedAt: new Date(),
    };

    if (newStatus === "signed") {
      updateData.signedDate = new Date().toISOString().split("T")[0];
    }

    await db.update(schema.documents)
      .set(updateData)
      .where(eq(schema.documents.id, data.documentId));

    // Create audit event
    await this.createAuditEvent({
      documentId: data.documentId,
      versionId: document.currentVersionId || undefined,
      eventType: "status_changed",
      eventCategory: "workflow",
      actorId: data.performedBy,
      actorRole: data.performedByRole,
      eventData: {
        action: data.action,
        reason: data.reason,
      },
      previousState: { status: currentStatus },
      newState: { status: newStatus },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    return {
      transition,
      previousStatus: currentStatus,
      newStatus,
    };
  }

  // Create immutable audit event
  static async createAuditEvent(data: {
    documentId: string;
    versionId?: string;
    eventType: string;
    eventCategory?: string;
    actorId?: string;
    actorRole?: string;
    actorName?: string;
    eventData?: Record<string, any>;
    previousState?: Record<string, any>;
    newState?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }) {
    // Get previous event hash for chain
    const [lastEvent] = await db.select()
      .from(schema.documentAuditEvents)
      .where(eq(schema.documentAuditEvents.documentId, data.documentId))
      .orderBy(desc(schema.documentAuditEvents.createdAt))
      .limit(1);

    // Create event hash
    const eventPayload = JSON.stringify({
      documentId: data.documentId,
      eventType: data.eventType,
      actorId: data.actorId,
      eventData: data.eventData,
      timestamp: new Date().toISOString(),
      previousHash: lastEvent?.eventHash || "genesis",
    });
    const eventHash = this.generateHash(eventPayload);

    const [auditEvent] = await db.insert(schema.documentAuditEvents)
      .values({
        documentId: data.documentId,
        versionId: data.versionId,
        eventType: data.eventType,
        eventCategory: data.eventCategory,
        actorId: data.actorId,
        actorRole: data.actorRole,
        actorName: data.actorName,
        eventData: data.eventData || {},
        previousState: data.previousState,
        newState: data.newState,
        eventHash,
        previousEventHash: lastEvent?.eventHash,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
      })
      .returning();

    return auditEvent;
  }

  // Get document with versions
  static async getDocumentWithVersions(documentId: string) {
    const [document] = await db.select()
      .from(schema.documents)
      .where(eq(schema.documents.id, documentId))
      .limit(1);

    if (!document) {
      return null;
    }

    const versions = await db.select()
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.documentId, documentId))
      .orderBy(desc(schema.documentVersions.versionNumber));

    const transitions = await db.select()
      .from(schema.documentWorkflowTransitions)
      .where(eq(schema.documentWorkflowTransitions.documentId, documentId))
      .orderBy(desc(schema.documentWorkflowTransitions.createdAt));

    return {
      document,
      versions,
      transitions,
      allowedActions: this.getAllowedActions(document.status),
    };
  }

  // List documents with filters
  static async listDocuments(filters: {
    entityType?: string;
    status?: string;
    agreementType?: string;
    entityPan?: string;
    entityName?: string;
    expiringSoon?: boolean; // Within 90 days
    riskScoreMin?: number;
    riskScoreMax?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = db.select()
      .from(schema.documents)
      .orderBy(desc(schema.documents.createdAt));

    // Build where conditions
    const conditions: any[] = [];

    if (filters.entityType) {
      conditions.push(eq(schema.documents.entityType, filters.entityType as any));
    }
    if (filters.status) {
      conditions.push(eq(schema.documents.status, filters.status as any));
    }
    if (filters.agreementType) {
      conditions.push(eq(schema.documents.agreementType, filters.agreementType as any));
    }
    if (filters.entityPan) {
      conditions.push(eq(schema.documents.entityPan, filters.entityPan));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters.offset) {
      query = query.offset(filters.offset) as any;
    }

    const documents = await query;

    return documents;
  }

  // Get document audit trail
  static async getAuditTrail(documentId: string) {
    const events = await db.select()
      .from(schema.documentAuditEvents)
      .where(eq(schema.documentAuditEvents.documentId, documentId))
      .orderBy(desc(schema.documentAuditEvents.createdAt));

    // Verify hash chain integrity
    let isChainValid = true;
    for (let i = 0; i < events.length - 1; i++) {
      if (events[i].previousEventHash !== events[i + 1].eventHash) {
        isChainValid = false;
        break;
      }
    }

    return {
      events,
      isChainValid,
      eventCount: events.length,
    };
  }

  // Create tracked change (redline)
  static async createTrackedChange(data: {
    documentId: string;
    versionId: string;
    clauseId?: string;
    operation: "insert" | "delete" | "modify" | "comment";
    oldText?: string;
    newText?: string;
    startPosition?: number;
    endPosition?: number;
    suggestedBy: string;
    suggestedByRole: string;
  }) {
    const [change] = await db.insert(schema.documentTrackedChanges)
      .values({
        documentId: data.documentId,
        versionId: data.versionId,
        clauseId: data.clauseId,
        operation: data.operation as any,
        oldText: data.oldText,
        newText: data.newText,
        startPosition: data.startPosition,
        endPosition: data.endPosition,
        suggestedBy: data.suggestedBy,
        suggestedByRole: data.suggestedByRole,
        status: "pending",
      })
      .returning();

    // Create audit event
    await this.createAuditEvent({
      documentId: data.documentId,
      versionId: data.versionId,
      eventType: "tracked_change_created",
      eventCategory: "document",
      actorId: data.suggestedBy,
      actorRole: data.suggestedByRole,
      eventData: {
        operation: data.operation,
        changeId: change.id,
      },
    });

    return change;
  }

  // Resolve tracked change
  static async resolveTrackedChange(data: {
    changeId: string;
    status: "accepted" | "rejected";
    resolvedBy: string;
    resolvedByRole: string;
    resolutionComment?: string;
  }) {
    const [change] = await db.update(schema.documentTrackedChanges)
      .set({
        status: data.status,
        resolvedBy: data.resolvedBy,
        resolvedByRole: data.resolvedByRole,
        resolvedAt: new Date(),
        resolutionComment: data.resolutionComment,
      })
      .where(eq(schema.documentTrackedChanges.id, data.changeId))
      .returning();

    if (change) {
      await this.createAuditEvent({
        documentId: change.documentId,
        versionId: change.versionId,
        eventType: "tracked_change_resolved",
        eventCategory: "document",
        actorId: data.resolvedBy,
        actorRole: data.resolvedByRole,
        eventData: {
          changeId: change.id,
          status: data.status,
          resolution: data.resolutionComment,
        },
      });
    }

    return change;
  }

  // Get pending tracked changes for a document
  static async getPendingChanges(documentId: string) {
    const changes = await db.select()
      .from(schema.documentTrackedChanges)
      .where(and(
        eq(schema.documentTrackedChanges.documentId, documentId),
        eq(schema.documentTrackedChanges.status, "pending")
      ))
      .orderBy(schema.documentTrackedChanges.createdAt);

    return changes;
  }

  // Add comment
  static async addComment(data: {
    documentId: string;
    versionId?: string;
    clauseId?: string;
    trackedChangeId?: string;
    parentCommentId?: string;
    content: string;
    selectionStart?: number;
    selectionEnd?: number;
    selectedText?: string;
    authorId: string;
    authorRole: string;
    isAiGenerated?: boolean;
    aiConfidence?: number;
  }) {
    const threadId = data.parentCommentId || `thread-${Date.now()}`;

    const [comment] = await db.insert(schema.documentComments)
      .values({
        documentId: data.documentId,
        versionId: data.versionId,
        clauseId: data.clauseId,
        trackedChangeId: data.trackedChangeId,
        parentCommentId: data.parentCommentId,
        threadId,
        content: data.content,
        selectionStart: data.selectionStart,
        selectionEnd: data.selectionEnd,
        selectedText: data.selectedText,
        authorId: data.authorId,
        authorRole: data.authorRole,
        isAiGenerated: data.isAiGenerated || false,
        aiConfidence: data.aiConfidence,
        isResolved: false,
      })
      .returning();

    return comment;
  }

  // Get comments for document
  static async getComments(documentId: string, versionId?: string) {
    let query = db.select()
      .from(schema.documentComments)
      .where(eq(schema.documentComments.documentId, documentId))
      .orderBy(schema.documentComments.createdAt);

    if (versionId) {
      query = query.where(and(
        eq(schema.documentComments.documentId, documentId),
        eq(schema.documentComments.versionId, versionId)
      )) as any;
    }

    return await query;
  }
}

export default DLMWorkflowService;