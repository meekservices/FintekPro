import { Router, Request, Response } from "express";
import multer from "multer";
import { documentUploadService } from "../services/document-upload-service";
import { db } from "../db";
import { proposalEsignWorkflows } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/pdf",
    ];
    const allowedExtensions = [".docx", ".pdf"];
    
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf("."));
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .docx and .pdf files are allowed"));
    }
  },
});

router.post("/upload", upload.single("document"), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { proposalId, workflowId } = req.body;

    const validation = await documentUploadService.validateFile(req.file.buffer, req.file.originalname);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await documentUploadService.uploadDocument(req.file.buffer, {
      userId: user.id,
      fileName: req.file.originalname,
      proposalId,
      workflowId,
    });

    if (workflowId) {
      await db.update(proposalEsignWorkflows)
        .set({
          originalDocumentUrl: result.originalUrl,
          currentDocumentUrl: result.displayUrl,
          documentHash: result.documentHash,
          documentSource: "uploaded",
          originalFileFormat: result.originalFormat,
          uploadedByUserId: user.id,
          uploadedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(proposalEsignWorkflows.id, workflowId));
    }

    res.json({
      success: true,
      document: {
        originalUrl: result.originalUrl,
        displayUrl: result.displayUrl,
        documentHash: result.documentHash,
        originalFormat: result.originalFormat,
        convertedFormat: result.convertedFormat,
        fileName: req.file.originalname,
      },
    });
  } catch (error) {
    console.error("Document upload error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload document" });
  }
});

router.post("/upload/for-signing", upload.single("document"), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const ELEVATED_ROLES = ["agent", "admin", "super_admin", "compliance_officer", "partner"];
    if (!ELEVATED_ROLES.includes(user.role)) {
      return res.status(403).json({ error: "Only agents, partners, and admins can upload documents for signing" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { proposalId } = req.body;

    const validation = await documentUploadService.validateFile(req.file.buffer, req.file.originalname);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await documentUploadService.uploadDocument(req.file.buffer, {
      userId: user.id,
      fileName: req.file.originalname,
      proposalId: proposalId || undefined,
    });

    res.json({
      success: true,
      document: {
        originalUrl: result.originalUrl,
        displayUrl: result.displayUrl,
        documentHash: result.documentHash,
        originalFormat: result.originalFormat,
        convertedFormat: result.convertedFormat,
        htmlContent: result.htmlContent,
        fileName: req.file.originalname,
      },
      message: "Document uploaded successfully. You can now initiate a signing workflow.",
    });
  } catch (error) {
    console.error("Document upload for signing error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload document" });
  }
});

router.get("/preview/:workflowId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workflowId } = req.params;

    const [workflow] = await db.select().from(proposalEsignWorkflows)
      .where(eq(proposalEsignWorkflows.id, workflowId))
      .limit(1);

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    const documentUrl = workflow.currentDocumentUrl || workflow.originalDocumentUrl;
    if (!documentUrl) {
      return res.status(404).json({ error: "No document found for this workflow" });
    }

    const dataUrl = await documentUploadService.getDocumentUrl(documentUrl);

    res.json({
      success: true,
      document: {
        url: dataUrl,
        source: workflow.documentSource || "generated",
        originalFormat: workflow.originalFileFormat,
        documentName: workflow.documentName,
      },
    });
  } catch (error) {
    console.error("Document preview error:", error);
    res.status(500).json({ error: "Failed to load document preview" });
  }
});

router.get("/download/:workflowId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workflowId } = req.params;
    const { format } = req.query; // 'original' or 'pdf'

    const [workflow] = await db.select().from(proposalEsignWorkflows)
      .where(eq(proposalEsignWorkflows.id, workflowId))
      .limit(1);

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    let documentPath: string | null;
    let fileName: string;
    let contentType: string;

    if (format === "original" && workflow.originalDocumentUrl) {
      documentPath = workflow.originalDocumentUrl;
      const ext = workflow.originalFileFormat || "docx";
      fileName = `${workflow.documentName}.${ext}`;
      contentType = ext === "pdf" ? "application/pdf" : 
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else {
      documentPath = workflow.currentDocumentUrl || workflow.originalDocumentUrl;
      fileName = `${workflow.documentName}.pdf`;
      contentType = "application/pdf";
    }

    if (!documentPath) {
      return res.status(404).json({ error: "No document found" });
    }

    const buffer = await documentUploadService.downloadDocument(documentPath);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Document download error:", error);
    res.status(500).json({ error: "Failed to download document" });
  }
});

router.post("/extract-content", upload.single("document"), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const ext = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf("."));
    if (ext !== ".docx") {
      return res.status(400).json({ error: "Only DOCX files can be extracted" });
    }

    const result = await documentUploadService.extractDocxContent(req.file.buffer);

    res.json({
      success: true,
      content: {
        html: result.html,
        text: result.text,
        warnings: result.messages,
      },
    });
  } catch (error) {
    console.error("Content extraction error:", error);
    res.status(500).json({ error: "Failed to extract document content" });
  }
});

export default router;
