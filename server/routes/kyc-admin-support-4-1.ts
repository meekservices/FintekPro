// @ts-nocheck
import { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or, desc, gte, lte, sql, count } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";

export function registerKYCAdminSupporPart4Part1Routes(app: Express): void {
	app.get("/api/store/catalog", async (req, res) => {
		try {
			const categories = await storage.getAllStoreCategories();
			const subcategories = await storage.getAllStoreSubcategories();
			const products = await storage.getAllStoreProducts();

			const activeCategories = categories.filter((c) => c.isActive);
			const activeSubcategories = subcategories.filter(
				(s) =>
					s.isActive && activeCategories.some((c) => c.id === s.categoryId),
			);
			const activeProducts = products.filter((p) => p.isActive);

			const catalog = activeCategories.map((cat) => ({
				...cat,
				subcategories: activeSubcategories
					.filter((sub) => sub.categoryId === cat.id)
					.map((sub) => ({
						...sub,
						products: activeProducts.filter(
							(prod) => prod.subcategoryId === sub.id,
						),
					})),
				products: activeProducts.filter(
					(prod) => prod.categoryId === cat.id && !prod.subcategoryId,
				),
			}));

			res.json({ catalog });
		} catch (error) {
			console.error("Error fetching store catalog:", error);
			res.status(500).json({ message: "Failed to fetch catalog" });
		}
	});

	// ========== CA Support System Routes ==========

	// Get all support templates (for partner/CA)
	app.get("/api/support/templates", requireAuth, async (req, res) => {
		try {
			const { category } = req.query;
			const templates = await storage.getSupportTemplates(
				category as string | undefined,
			);
			res.json({ templates });
		} catch (error) {
			console.error("Error fetching support templates:", error);
			res.status(500).json({ message: "Failed to fetch support templates" });
		}
	});

	// Get single support template with steps
	app.get("/api/support/templates/:id", requireAuth, async (req, res) => {
		try {
			const template = await storage.getSupportTemplateById(req.params.id);
			if (!template) {
				return res.status(404).json({ message: "Template not found" });
			}
			const steps = await storage.getSupportStepsByTemplateId(req.params.id);
			res.json({ template, steps });
		} catch (error) {
			console.error("Error fetching support template:", error);
			res.status(500).json({ message: "Failed to fetch support template" });
		}
	});

	// Create new support template (admin/partner only)
	app.post("/api/support/templates", requireAuth, async (req, res) => {
		try {
			const {
				name,
				description,
				category,
				estimatedTime,
				requiredDocuments,
				steps,
			} = req.body;

			const template = await storage.createSupportTemplate({
				name,
				description,
				category,
				estimatedTime,
				requiredDocuments: requiredDocuments || [],
				isActive: true,
				createdBy: req.user!.id,
			});

			// Create steps if provided
			if (steps && Array.isArray(steps)) {
				for (let i = 0; i < steps.length; i++) {
					await storage.createSupportStep({
						templateId: template.id,
						title: steps[i].title,
						description: steps[i].description,
						order: i + 1,
						status: "pending",
						isRequired: steps[i].isRequired !== false,
					});
				}
			}

			const createdSteps = await storage.getSupportStepsByTemplateId(
				template.id,
			);
			res.json({ template, steps: createdSteps });
		} catch (error) {
			console.error("Error creating support template:", error);
			res.status(500).json({ message: "Failed to create support template" });
		}
	});

	// Update support template
	app.patch("/api/support/templates/:id", requireAuth, async (req, res) => {
		try {
			const updated = await storage.updateSupportTemplate(
				req.params.id,
				req.body,
			);
			if (!updated) {
				return res.status(404).json({ message: "Template not found" });
			}
			res.json({ template: updated });
		} catch (error) {
			console.error("Error updating support template:", error);
			res.status(500).json({ message: "Failed to update support template" });
		}
	});

	// Delete support template
	app.delete("/api/support/templates/:id", requireAuth, async (req, res) => {
		try {
			const deleted = await storage.deleteSupportTemplate(req.params.id);
			if (!deleted) {
				return res.status(404).json({ message: "Template not found" });
			}
			res.json({ success: true });
		} catch (error) {
			console.error("Error deleting support template:", error);
			res.status(500).json({ message: "Failed to delete support template" });
		}
	});

	// Get steps for a ticket
	app.get(
		"/api/support/tickets/:ticketId/steps",
		requireAuth,
		async (req, res) => {
			try {
				const steps = await storage.getSupportStepsByTicketId(
					req.params.ticketId,
				);
				res.json({ steps });
			} catch (error) {
				console.error("Error fetching ticket steps:", error);
				res.status(500).json({ message: "Failed to fetch ticket steps" });
			}
		},
	);

	// Create step for a ticket (from template or custom)
	app.post(
		"/api/support/tickets/:ticketId/steps",
		requireAuth,
		async (req, res) => {
			try {
				const { title, description, order, isRequired } = req.body;
				const step = await storage.createSupportStep({
					ticketId: req.params.ticketId,
					title,
					description,
					order,
					status: "pending",
					isRequired: isRequired !== false,
				});
				res.json({ step });
			} catch (error) {
				console.error("Error creating ticket step:", error);
				res.status(500).json({ message: "Failed to create ticket step" });
			}
		},
	);

	// Apply template steps to a ticket
}
