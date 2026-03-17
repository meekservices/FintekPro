import { Express, Request, Response } from "express";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, desc, like, gte, lte, sql } from "drizzle-orm";
import { DLMWorkflowService } from "../services/dlm-workflow-service";
import { DLMAIComplianceService } from "../services/dlm-ai-compliance-service";
import { z } from "zod";

// Validation schemas
const createDocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  entityType: z.enum(["vendor", "partner", "agent", "ca", "lender", "client", "regulator", "internal"]),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  entityPan: z.string().optional(),
  agreementType: z.enum([
    "service_agreement", "partnership_agreement", "agent_agreement", "ca_engagement_letter",
    "lender_agreement", "client_agreement", "nda", "mou", "amendment", "addendum",
    "renewal", "termination", "compliance_declaration", "kyc_document", "regulatory_filing", "other"
  ]),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
  content: z.string().optional(),
  isLegacy: z.boolean().optional(),
  legacyDeclaration: z.string().optional(),
  originalSignDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

const createVersionSchema = z.object({
  content: z.string().min(1),
  contentType: z.string().optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  fileMimeType: z.string().optional(),
  changeSummary: z.string().optional(),
});

const transitionStatusSchema = z.object({
  action: z.string().min(1),
  reason: z.string().optional(),
  comments: z.string().optional(),
  isAiOverride: z.boolean().optional(),
  aiOverrideJustification: z.string().optional(),
  checklistSnapshot: z.any().optional(),
});

const createTrackedChangeSchema = z.object({
  versionId: z.string().min(1),
  clauseId: z.string().optional(),
  operation: z.enum(["insert", "delete", "modify", "comment"]),
  oldText: z.string().optional(),
  newText: z.string().optional(),
  startPosition: z.number().optional(),
  endPosition: z.number().optional(),
});

const resolveTrackedChangeSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  resolutionComment: z.string().optional(),
});

const addCommentSchema = z.object({
  versionId: z.string().optional(),
  clauseId: z.string().optional(),
  trackedChangeId: z.string().optional(),
  parentCommentId: z.string().optional(),
  content: z.string().min(1),
  selectionStart: z.number().optional(),
  selectionEnd: z.number().optional(),
  selectedText: z.string().optional(),
});

export function registerDLMRoutes(app: Express) {
  // Middleware to check admin access (reuse existing)
  const requireAdmin = (req: any, res: Response, next: Function) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    const adminRoles = ["admin", "superadmin", "compliance_officer", "legal"];
    if (!adminRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }
    next();
  };

  // ===== DOCUMENT CRUD =====

  // List documents with filters
  app.get("/api/dlm/documents", requireAdmin, async (req: any, res: Response) => {
    try {
      const { entityType, status, agreementType, entityPan, entityName, limit, offset } = req.query;

      const documents = await DLMWorkflowService.listDocuments({
        entityType: entityType as string,
        status: status as string,
        agreementType: agreementType as string,
        entityPan: entityPan as string,
        entityName: entityName as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({ success: true, data: documents, count: documents.length });
    } catch (error: any) {
      console.error("Error listing documents:", error);
      res.status(500).json({ success: false, error: "Failed to list documents" });
    }
  });

  // Get single document with versions and history
  app.get("/api/dlm/documents/:documentId", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      
      const result = await DLMWorkflowService.getDocumentWithVersions(documentId);
      
      if (!result) {
        return res.status(404).json({ success: false, error: "Document not found" });
      }

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Error fetching document:", error);
      res.status(500).json({ success: false, error: "Failed to fetch document" });
    }
  });

  // Create new document
  app.post("/api/dlm/documents", requireAdmin, async (req: any, res: Response) => {
    try {
      const validated = createDocumentSchema.parse(req.body);
      
      const document = await DLMWorkflowService.createDocument({
        ...validated,
        createdBy: req.user?.id || "system",
        createdByRole: req.user?.role || "admin",
      });

      res.status(201).json({ success: true, data: document });
    } catch (error: any) {
      console.error("Error creating document:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ success: false, error: "Failed to create document" });
    }
  });

  // Update document metadata (not content - use versions for that)
  app.patch("/api/dlm/documents/:documentId", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      const {
        title, description, effectiveDate, expiryDate,
        tags, metadata, assignedToUserId, assignedToRole,
      } = req.body;

      const updates: any = {};
      if (title !== undefined)            updates.title            = title;
      if (description !== undefined)      updates.description      = description;
      if (effectiveDate !== undefined)    updates.effectiveDate    = effectiveDate;
      if (expiryDate !== undefined)       updates.expiryDate       = expiryDate;
      if (tags !== undefined)             updates.tags             = tags;
      if (metadata !== undefined)         updates.metadata         = metadata;
      if (assignedToUserId !== undefined) updates.assignedToUserId = assignedToUserId;
      if (assignedToRole !== undefined)   updates.assignedToRole   = assignedToRole;
      updates.updatedAt = new Date();

      const [updated] = await db.update(schema.documents)
        .set(updates)
        .where(eq(schema.documents.id, documentId))
        .returning();

      if (!updated) {
        return res.status(404).json({ success: false, error: "Document not found" });
      }

      // Audit event
      await DLMWorkflowService.createAuditEvent({
        documentId,
        eventType: "document_updated",
        eventCategory: "document",
        actorId: req.user?.id,
        actorRole: req.user?.role,
        eventData: { updatedFields: Object.keys(updates) },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error("Error updating document:", error);
      res.status(500).json({ success: false, error: "Failed to update document" });
    }
  });

  // ===== VERSION MANAGEMENT =====

  // Create new version
  app.post("/api/dlm/documents/:documentId/versions", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      const validated = createVersionSchema.parse(req.body);

      const version = await DLMWorkflowService.createVersion({
        documentId,
        ...validated,
        createdBy: req.user?.id || "system",
        createdByRole: req.user?.role || "admin",
      });

      res.status(201).json({ success: true, data: version });
    } catch (error: any) {
      console.error("Error creating version:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ success: false, error: "Failed to create version" });
    }
  });

  // Get version content
  app.get("/api/dlm/documents/:documentId/versions/:versionId", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId, versionId } = req.params;

      const [version] = await db.select()
        .from(schema.documentVersions)
        .where(and(
          eq(schema.documentVersions.id, versionId),
          eq(schema.documentVersions.documentId, documentId)
        ))
        .limit(1);

      if (!version) {
        return res.status(404).json({ success: false, error: "Version not found" });
      }

      // Log view event
      await DLMWorkflowService.createAuditEvent({
        documentId,
        versionId,
        eventType: "version_viewed",
        eventCategory: "document",
        actorId: req.user?.id,
        actorRole: req.user?.role,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({ success: true, data: version });
    } catch (error: any) {
      console.error("Error fetching version:", error);
      res.status(500).json({ success: false, error: "Failed to fetch version" });
    }
  });

  // ===== WORKFLOW TRANSITIONS =====

  // Transition document status
  app.post("/api/dlm/documents/:documentId/transition", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      const validated = transitionStatusSchema.parse(req.body);

      const result = await DLMWorkflowService.transitionStatus({
        documentId,
        ...validated,
        performedBy: req.user?.id || "system",
        performedByRole: req.user?.role || "admin",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Error transitioning document:", error);
      if (error.message.includes("not allowed") || error.message.includes("Invalid")) {
        return res.status(400).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: "Failed to transition document" });
    }
  });

  // Get allowed actions for document
  app.get("/api/dlm/documents/:documentId/allowed-actions", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;

      const [document] = await db.select()
        .from(schema.documents)
        .where(eq(schema.documents.id, documentId))
        .limit(1);

      if (!document) {
        return res.status(404).json({ success: false, error: "Document not found" });
      }

      const actions = DLMWorkflowService.getAllowedActions(document.status);

      res.json({ success: true, data: { currentStatus: document.status, allowedActions: actions } });
    } catch (error: any) {
      console.error("Error getting allowed actions:", error);
      res.status(500).json({ success: false, error: "Failed to get allowed actions" });
    }
  });

  // ===== AUDIT TRAIL =====

  // Get document audit trail
  app.get("/api/dlm/documents/:documentId/audit", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;

      const auditTrail = await DLMWorkflowService.getAuditTrail(documentId);

      res.json({ success: true, data: auditTrail });
    } catch (error: any) {
      console.error("Error fetching audit trail:", error);
      res.status(500).json({ success: false, error: "Failed to fetch audit trail" });
    }
  });

  // ===== TRACKED CHANGES (REDLINING) =====

  // Create tracked change
  app.post("/api/dlm/documents/:documentId/changes", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      const validated = createTrackedChangeSchema.parse(req.body);

      const change = await DLMWorkflowService.createTrackedChange({
        documentId,
        ...validated,
        suggestedBy: req.user?.id || "system",
        suggestedByRole: req.user?.role || "admin",
      });

      res.status(201).json({ success: true, data: change });
    } catch (error: any) {
      console.error("Error creating tracked change:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ success: false, error: "Failed to create tracked change" });
    }
  });

  // Get pending changes
  app.get("/api/dlm/documents/:documentId/changes", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      const { status } = req.query;

      let changes;
      if (status === "pending") {
        changes = await DLMWorkflowService.getPendingChanges(documentId);
      } else {
        changes = await db.select()
          .from(schema.documentTrackedChanges)
          .where(eq(schema.documentTrackedChanges.documentId, documentId))
          .orderBy(desc(schema.documentTrackedChanges.createdAt));
      }

      res.json({ success: true, data: changes });
    } catch (error: any) {
      console.error("Error fetching tracked changes:", error);
      res.status(500).json({ success: false, error: "Failed to fetch tracked changes" });
    }
  });

  // Resolve tracked change
  app.patch("/api/dlm/changes/:changeId", requireAdmin, async (req: any, res: Response) => {
    try {
      const { changeId } = req.params;
      const validated = resolveTrackedChangeSchema.parse(req.body);

      const change = await DLMWorkflowService.resolveTrackedChange({
        changeId,
        ...validated,
        resolvedBy: req.user?.id || "system",
        resolvedByRole: req.user?.role || "admin",
      });

      if (!change) {
        return res.status(404).json({ success: false, error: "Change not found" });
      }

      res.json({ success: true, data: change });
    } catch (error: any) {
      console.error("Error resolving tracked change:", error);
      res.status(500).json({ success: false, error: "Failed to resolve tracked change" });
    }
  });

  // ===== COMMENTS =====

  // Add comment
  app.post("/api/dlm/documents/:documentId/comments", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      const validated = addCommentSchema.parse(req.body);

      const comment = await DLMWorkflowService.addComment({
        documentId,
        ...validated,
        authorId: req.user?.id || "system",
        authorRole: req.user?.role || "admin",
      });

      res.status(201).json({ success: true, data: comment });
    } catch (error: any) {
      console.error("Error adding comment:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ success: false, error: "Failed to add comment" });
    }
  });

  // Get comments
  app.get("/api/dlm/documents/:documentId/comments", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      const { versionId } = req.query;

      const comments = await DLMWorkflowService.getComments(documentId, versionId as string);

      res.json({ success: true, data: comments });
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ success: false, error: "Failed to fetch comments" });
    }
  });

  // Resolve comment
  app.patch("/api/dlm/comments/:commentId/resolve", requireAdmin, async (req: any, res: Response) => {
    try {
      const { commentId } = req.params;

      const [comment] = await db.update(schema.documentComments)
        .set({
          isResolved: true,
          resolvedBy: req.user?.id,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.documentComments.id, commentId))
        .returning();

      if (!comment) {
        return res.status(404).json({ success: false, error: "Comment not found" });
      }

      res.json({ success: true, data: comment });
    } catch (error: any) {
      console.error("Error resolving comment:", error);
      res.status(500).json({ success: false, error: "Failed to resolve comment" });
    }
  });

  // ===== DASHBOARD STATS =====

  // Get DLM dashboard stats
  app.get("/api/dlm/stats", requireAdmin, async (req: any, res: Response) => {
    try {
      // Get counts by status
      const statusCounts = await db.select({
        status: schema.documents.status,
        count: sql<number>`count(*)::int`,
      })
        .from(schema.documents)
        .groupBy(schema.documents.status);

      // Get counts by entity type
      const entityCounts = await db.select({
        entityType: schema.documents.entityType,
        count: sql<number>`count(*)::int`,
      })
        .from(schema.documents)
        .groupBy(schema.documents.entityType);

      // Get expiring soon (next 90 days)
      const today = new Date();
      const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

      const expiringDocuments = await db.select()
        .from(schema.documents)
        .where(and(
          gte(schema.documents.expiryDate, today.toISOString().split("T")[0]),
          lte(schema.documents.expiryDate, ninetyDaysFromNow.toISOString().split("T")[0])
        ))
        .limit(10);

      // Get high risk documents
      const highRiskDocuments = await db.select()
        .from(schema.documents)
        .where(gte(schema.documents.riskScore, 70))
        .orderBy(desc(schema.documents.riskScore))
        .limit(10);

      // Get recent activity
      const recentActivity = await db.select()
        .from(schema.documentAuditEvents)
        .orderBy(desc(schema.documentAuditEvents.createdAt))
        .limit(20);

      res.json({
        success: true,
        data: {
          statusCounts: Object.fromEntries(statusCounts.map(s => [s.status, s.count])),
          entityCounts: Object.fromEntries(entityCounts.map(e => [e.entityType, e.count])),
          expiringDocuments,
          highRiskDocuments,
          recentActivity,
          totalDocuments: statusCounts.reduce((sum, s) => sum + s.count, 0),
        },
      });
    } catch (error: any) {
      console.error("Error fetching DLM stats:", error);
      res.status(500).json({ success: false, error: "Failed to fetch stats" });
    }
  });

  // ===== AI COMPLIANCE REVIEW =====

  // Trigger AI compliance analysis
  app.post("/api/dlm/documents/:documentId/ai-review", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      const { versionId } = req.body;

      // Get document and version
      const [document] = await db.select()
        .from(schema.documents)
        .where(eq(schema.documents.id, documentId))
        .limit(1);

      if (!document) {
        return res.status(404).json({ success: false, error: "Document not found" });
      }

      const targetVersionId = versionId || document.currentVersionId;
      
      let content = "";
      if (targetVersionId) {
        const [version] = await db.select()
          .from(schema.documentVersions)
          .where(eq(schema.documentVersions.id, targetVersionId))
          .limit(1);
        content = version?.content || "";
      }

      if (!content) {
        return res.status(400).json({ success: false, error: "No document content available for analysis" });
      }

      // Run AI analysis
      const result = await DLMAIComplianceService.analyzeDocument({
        documentId,
        versionId: targetVersionId,
        content,
        entityType: document.entityType,
        agreementType: document.agreementType,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Error running AI compliance review:", error);
      res.status(500).json({ success: false, error: "Failed to run AI compliance review" });
    }
  });

  // Get AI review for document
  app.get("/api/dlm/documents/:documentId/ai-review", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      const { versionId } = req.query;

      const review = await DLMAIComplianceService.getReview(documentId, versionId as string);

      if (!review) {
        return res.status(404).json({ success: false, error: "No AI review found" });
      }

      res.json({ success: true, data: review });
    } catch (error: any) {
      console.error("Error fetching AI review:", error);
      res.status(500).json({ success: false, error: "Failed to fetch AI review" });
    }
  });

  // Acknowledge AI review (admin confirmation required before proceeding)
  app.post("/api/dlm/ai-reviews/:reviewId/acknowledge", requireAdmin, async (req: any, res: Response) => {
    try {
      const { reviewId } = req.params;
      const { notes } = req.body;

      const review = await DLMAIComplianceService.acknowledgeReview({
        reviewId,
        acknowledgedBy: req.user?.id || "system",
        notes,
      });

      if (!review) {
        return res.status(404).json({ success: false, error: "Review not found" });
      }

      res.json({ success: true, data: review });
    } catch (error: any) {
      console.error("Error acknowledging AI review:", error);
      res.status(500).json({ success: false, error: "Failed to acknowledge review" });
    }
  });

  // Compare two document versions
  app.post("/api/dlm/documents/:documentId/compare-versions", requireAdmin, async (req: any, res: Response) => {
    try {
      const { documentId } = req.params;
      const { versionId1, versionId2 } = req.body;

      if (!versionId1 || !versionId2) {
        return res.status(400).json({ success: false, error: "Both version IDs required" });
      }

      const comparison = await DLMAIComplianceService.compareVersions({
        documentId,
        versionId1,
        versionId2,
      });

      res.json({ success: true, data: comparison });
    } catch (error: any) {
      console.error("Error comparing versions:", error);
      res.status(500).json({ success: false, error: "Failed to compare versions" });
    }
  });

  // Get AI suggested clause text
  app.post("/api/dlm/suggest-clause", requireAdmin, async (req: any, res: Response) => {
    try {
      const { clauseCategory, entityType, agreementType, existingText } = req.body;

      if (!clauseCategory || !entityType || !agreementType) {
        return res.status(400).json({ success: false, error: "clauseCategory, entityType, and agreementType are required" });
      }

      const suggestion = await DLMAIComplianceService.suggestClauseText({
        clauseCategory,
        entityType,
        agreementType,
        existingText,
      });

      res.json({ success: true, data: suggestion });
    } catch (error: any) {
      console.error("Error generating clause suggestion:", error);
      res.status(500).json({ success: false, error: "Failed to generate clause suggestion" });
    }
  });

  console.log("DLM routes registered successfully");
}

export default registerDLMRoutes;