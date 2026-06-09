// @ts-nocheck
import { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or, sql } from "drizzle-orm";
import { z } from "zod";
import { unifiedOCRService } from "../services/unified-ocr-service";
import { sandboxITRService } from "../sandbox-itr-service";
import { digilockerService } from "../services/digilockerService";

const calculateCapitalGainsSchema = z.object({
	stcgAmount: z.number().min(0, "STCG amount must be positive"),
	ltcgAmount: z.number().min(0, "LTCG amount must be positive"),
	financialYear: z
		.string()
		.regex(/^\d{4}-\d{2}$/, "Financial year must be in format YYYY-YY"),
	calculationDate: z.string().optional(),
});

const calculateIncomeTaxSchema = z.object({
	income: z.number().min(0, "Income must be positive"),
	regime: z.enum(["old", "new"], {
		error: () => ({ message: "Regime must be 'old' or 'new'" }),
	}),
	deductions: z
		.object({
			section80C: z.number().min(0).optional(),
			section80D: z.number().min(0).optional(),
			standardDeduction: z.number().min(0).optional(),
			otherDeductions: z.number().min(0).optional(),
		})
		.optional(),
	financialYear: z
		.string()
		.regex(/^\d{4}-\d{2}$/, "Financial year must be in format YYYY-YY")
		.optional(),
});

const taxReminderSubscriptionSchema = z.object({
	userId: z.string().uuid("Invalid user ID format"),
	itrFormType: z.enum(
		["ITR-1", "ITR-2", "ITR-3", "ITR-4", "ITR-5", "ITR-6", "ITR-7"],
		{ error: () => ({ message: "Invalid ITR form type" }) },
	),
});

export function registerTaxFilingPart1Routes(app: Express): void {
	app.post("/api/tax/documents", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const {
				documentType,
				financialYear,
				fileName,
				fileFormat,
				documentUrl,
				metadata,
			} = req.body;

			if (!documentType || !financialYear || !fileName) {
				return res.status(400).json({
					error:
						"Missing required fields: documentType, financialYear, fileName",
				});
			}

			const document = await storage.createTaxDocument({
				userId: req.user!.id,
				documentType,
				financialYear,
				fileName,
				fileFormat: fileFormat || "pdf",
				documentUrl,
				uploadedAt: new Date(),
				processingStatus: "pending",
				metadata,
			});

			// Log document upload
			await storage.createTaxDocumentAccessLog({
				documentId: document.id,
				userId: req.user!.id,
				action: "upload",
				ipAddress: req.ip || req.connection.remoteAddress,
				userAgent: req.get("User-Agent"),
				accessedAt: new Date(),
			});

			res.json({ success: true, document });
		} catch (error) {
			console.error("Error uploading tax document:", error);
			res.status(500).json({ error: "Failed to upload tax document" });
		}
	});

	// Get user's tax documents
	app.get("/api/tax/documents", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { financialYear } = req.query;
			const documents = await storage.getTaxDocuments(
				req.user.id,
				financialYear as string,
			);

			res.json(documents);
		} catch (error) {
			console.error("Error fetching tax documents:", error);
			res.status(500).json({ error: "Failed to fetch tax documents" });
		}
	});

	// Get specific tax document
	app.get("/api/tax/documents/:documentId", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { documentId } = req.params;
			const document = await storage.getTaxDocument(documentId);

			if (!document) {
				return res.status(404).json({ error: "Document not found" });
			}

			// Verify user owns this document
			if (document.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			// Log document access
			await storage.createTaxDocumentAccessLog({
				documentId: document.id,
				userId: req.user!.id,
				action: "view",
				ipAddress: req.ip || req.connection.remoteAddress,
				userAgent: req.get("User-Agent"),
				accessedAt: new Date(),
			});

			res.json(document);
		} catch (error) {
			console.error("Error fetching tax document:", error);
			res.status(500).json({ error: "Failed to fetch document" });
		}
	});

	// Process tax document for data extraction
	app.post("/api/tax/documents/:documentId/process", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { documentId } = req.params;
			const document = await storage.getTaxDocument(documentId);

			if (!document) {
				return res.status(404).json({ error: "Document not found" });
			}

			// Verify user owns this document
			if (document.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			const result = await storage.processTaxDocument(documentId);

			// Log document processing
			await storage.createTaxDocumentAccessLog({
				documentId: document.id,
				userId: req.user!.id,
				action: "process",
				ipAddress: req.ip || req.connection.remoteAddress,
				userAgent: req.get("User-Agent"),
				accessedAt: new Date(),
			});

			res.json(result);
		} catch (error) {
			console.error("Error processing tax document:", error);
			res.status(500).json({ error: "Failed to process document" });
		}
	});

	// Get structured tax data for a document
	app.get("/api/tax/documents/:documentId/data", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { documentId } = req.params;
			const document = await storage.getTaxDocument(documentId);

			if (!document) {
				return res.status(404).json({ error: "Document not found" });
			}

			// Verify user owns this document
			if (document.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			const structuredData = await storage.getStructuredTaxData(documentId);
			res.json(structuredData);
		} catch (error) {
			console.error("Error fetching structured tax data:", error);
			res.status(500).json({ error: "Failed to fetch structured tax data" });
		}
	});

	// Get all structured tax data for user by financial year
	app.get("/api/tax/data", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { financialYear } = req.query;
			const structuredData = await storage.getStructuredTaxDataByUser(
				req.user.id,
				financialYear as string,
			);

			res.json(structuredData);
		} catch (error) {
			console.error("Error fetching user tax data:", error);
			res.status(500).json({ error: "Failed to fetch tax data" });
		}
	});

	// Validate tax data for a document
	app.post("/api/tax/documents/:documentId/validate", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { documentId } = req.params;
			const document = await storage.getTaxDocument(documentId);

			if (!document) {
				return res.status(404).json({ error: "Document not found" });
			}

			// Verify user owns this document
			if (document.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			const validation = await storage.validateTaxData(documentId);
			res.json(validation);
		} catch (error) {
			console.error("Error validating tax data:", error);
			res.status(500).json({ error: "Failed to validate tax data" });
		}
	});

	// Calculate tax liability
	app.post("/api/tax/calculate", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { financialYear, taxRegime } = req.body;

			if (!financialYear || !taxRegime) {
				return res.status(400).json({
					error: "Missing required fields: financialYear, taxRegime",
				});
			}

			if (!["old", "new"].includes(taxRegime)) {
				return res.status(400).json({
					error: "Invalid tax regime. Must be 'old' or 'new'",
				});
			}

			const calculation = await storage.calculateTaxLiability(
				req.user.id,
				financialYear,
				taxRegime,
			);
			res.json(calculation);
		} catch (error) {
			console.error("Error calculating tax liability:", error);
			res.status(500).json({ error: "Failed to calculate tax liability" });
		}
	});

	// Get tax calculations for user
	app.get("/api/tax/calculations", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { financialYear } = req.query;
			const calculations = await storage.getTaxCalculations(
				req.user.id,
				financialYear as string,
			);

			res.json(calculations);
		} catch (error) {
			console.error("Error fetching tax calculations:", error);
			res.status(500).json({ error: "Failed to fetch tax calculations" });
		}
	});

	// Generate ITR JSON
	app.post("/api/tax/generate-itr", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { financialYear } = req.body;

			if (!financialYear) {
				return res.status(400).json({
					error: "Missing required field: financialYear",
				});
			}

			const itrResult = await storage.generateITRJson(
				req.user.id,
				financialYear,
			);

			// Set appropriate headers for file download
			res.setHeader("Content-Type", "application/json");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="ITR_${financialYear}_${req.user.id}.json"`,
			);

			res.json({
				success: true,
				itrJson: itrResult.itrJson,
				warnings: itrResult.warnings,
				downloadUrl: `/api/tax/download-itr/${financialYear}`,
			});
		} catch (error) {
			console.error("Error generating ITR JSON:", error);
			res.status(500).json({ error: "Failed to generate ITR JSON" });
		}
	});

	// Download ITR JSON file
	app.get("/api/tax/download-itr/:financialYear", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { financialYear } = req.params;
			const itrResult = await storage.generateITRJson(
				req.user.id,
				financialYear,
			);

			// Set headers for file download
			res.setHeader("Content-Type", "application/json");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="ITR_${financialYear}_${req.user.id}.json"`,
			);
			res.setHeader("Content-Length", Buffer.byteLength(itrResult.itrJson));

			res.send(itrResult.itrJson);
		} catch (error) {
			console.error("Error downloading ITR JSON:", error);
			res.status(500).json({ error: "Failed to download ITR JSON" });
		}
	});

	// Delete tax document
	app.delete("/api/tax/documents/:documentId", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { documentId } = req.params;
			const document = await storage.getTaxDocument(documentId);

			if (!document) {
				return res.status(404).json({ error: "Document not found" });
			}

			// Verify user owns this document
			if (document.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			// Delete related structured data first
			const structuredData = await storage.getStructuredTaxData(documentId);
			for (const data of structuredData) {
				await storage.deleteStructuredTaxData(data.id);
			}

			// Delete the document
			const deleted = await storage.deleteTaxDocument(documentId);

			if (!deleted) {
				return res.status(500).json({ error: "Failed to delete document" });
			}

			// Log document deletion
			await storage.createTaxDocumentAccessLog({
				documentId: document.id,
				userId: req.user!.id,
				action: "delete",
				ipAddress: req.ip || req.connection.remoteAddress,
				userAgent: req.get("User-Agent"),
				accessedAt: new Date(),
			});

			res.json({ success: true, message: "Document deleted successfully" });
		} catch (error) {
			console.error("Error deleting tax document:", error);
			res.status(500).json({ error: "Failed to delete tax document" });
		}
	});

	// Get tax document access logs
}
