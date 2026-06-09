import { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or, desc, gte, lte, sql, count } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";

export function registerKYCAdminSupporPart3Routes(app: Express): void {
	app.put(
		"/api/admin/store/categories/:id",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { name, description, icon, displayOrder } = req.body;
				const existingCategory = await storage.getStoreCategoryById(
					req.params.id,
				);

				if (!existingCategory) {
					return res.status(404).json({ message: "Category not found" });
				}

				const category = await storage.updateStoreCategory(req.params.id, {
					name,
					description,
					icon,
					displayOrder,
				});

				// Log audit
				await storage.createStoreAuditLog({
					adminId: req.user.id,
					adminEmail: req.user.email,
					action: "update",
					targetType: "category",
					targetId: category.id,
					targetName: category.name,
					beforeValue: existingCategory,
					afterValue: category,
				});

				res.json({ success: true, category });
			} catch (error) {
				console.error("Error updating category:", error);
				res.status(500).json({ message: "Failed to update category" });
			}
		},
	);

	// Toggle category (with cascading to subcategories and products)
	app.post(
		"/api/admin/store/categories/:id/toggle",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { isActive } = req.body;

				if (typeof isActive !== "boolean") {
					return res
						.status(400)
						.json({ message: "isActive must be a boolean" });
				}

				const result = await storage.toggleCategoryWithCascade(
					req.params.id,
					isActive,
					req.user.id,
					req.user.email,
				);

				res.json({
					success: true,
					message:
						"Category " +
						(isActive ? "enabled" : "disabled") +
						" successfully with " +
						result.subcategories.length +
						" subcategories and " +
						result.products.length +
						" products",
					...result,
				});
			} catch (error) {
				console.error("Error toggling category:", error);
				res
					.status(500)
					.json({
						message:
							error instanceof Error
								? error.message
								: "Failed to toggle category",
					});
			}
		},
	);

	// Delete category
	app.delete(
		"/api/admin/store/categories/:id",
		requireAdmin,
		async (req: any, res) => {
			try {
				const category = await storage.getStoreCategoryById(req.params.id);
				if (!category) {
					return res.status(404).json({ message: "Category not found" });
				}

				const subcategories = await storage.getStoreSubcategoriesByCategory(
					req.params.id,
				);
				if (subcategories.length > 0) {
					return res
						.status(400)
						.json({
							message:
								"Cannot delete category with existing subcategories. Delete subcategories first.",
						});
				}

				const products = await storage.getStoreProductsByCategory(
					req.params.id,
				);
				if (products.length > 0) {
					return res
						.status(400)
						.json({
							message:
								"Cannot delete category with existing products. Delete products first.",
						});
				}

				await storage.deleteStoreCategory(req.params.id);

				await storage.createStoreAuditLog({
					adminId: req.user.id,
					adminEmail: req.user.email,
					action: "delete",
					targetType: "category",
					targetId: category.id,
					targetName: category.name,
					beforeValue: category,
				});

				res.json({ success: true, message: "Category deleted" });
			} catch (error) {
				console.error("Error deleting category:", error);
				res.status(500).json({ message: "Failed to delete category" });
			}
		},
	);

	// Get all subcategories
	app.get("/api/admin/store/subcategories", requireAdmin, async (req, res) => {
		try {
			const { categoryId } = req.query;

			let subcategories;
			if (categoryId) {
				subcategories = await storage.getStoreSubcategoriesByCategory(
					categoryId as string,
				);
			} else {
				subcategories = await storage.getAllStoreSubcategories();
			}

			res.json({ subcategories });
		} catch (error) {
			console.error("Error fetching subcategories:", error);
			res.status(500).json({ message: "Failed to fetch subcategories" });
		}
	});

	// Get single subcategory
	app.get(
		"/api/admin/store/subcategories/:id",
		requireAdmin,
		async (req, res) => {
			try {
				const subcategory = await storage.getStoreSubcategoryById(
					req.params.id,
				);
				if (!subcategory) {
					return res.status(404).json({ message: "Subcategory not found" });
				}
				res.json({ subcategory });
			} catch (error) {
				console.error("Error fetching subcategory:", error);
				res.status(500).json({ message: "Failed to fetch subcategory" });
			}
		},
	);

	// Create subcategory
	app.post(
		"/api/admin/store/subcategories",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { categoryId, name, description, icon, displayOrder } = req.body;

				if (!categoryId || !name) {
					return res
						.status(400)
						.json({ message: "Category ID and name are required" });
				}

				const category = await storage.getStoreCategoryById(categoryId);
				if (!category) {
					return res.status(404).json({ message: "Parent category not found" });
				}

				const subcategory = await storage.createStoreSubcategory({
					categoryId,
					name,
					description,
					icon: icon || "folder",
					displayOrder: displayOrder || 0,
					isActive: category.isActive,
				});

				await storage.createStoreAuditLog({
					adminId: req.user.id,
					adminEmail: req.user.email,
					action: "create",
					targetType: "subcategory",
					targetId: subcategory.id,
					targetName: subcategory.name,
					afterValue: subcategory,
				});

				res.json({ success: true, subcategory });
			} catch (error) {
				console.error("Error creating subcategory:", error);
				res.status(500).json({ message: "Failed to create subcategory" });
			}
		},
	);

	// Toggle subcategory
	app.post(
		"/api/admin/store/subcategories/:id/toggle",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { isActive } = req.body;

				if (typeof isActive !== "boolean") {
					return res
						.status(400)
						.json({ message: "isActive must be a boolean" });
				}

				const subcategory = await storage.getStoreSubcategoryById(
					req.params.id,
				);
				if (!subcategory) {
					return res.status(404).json({ message: "Subcategory not found" });
				}

				const category = await storage.getStoreCategoryById(
					subcategory.categoryId,
				);
				if (!category?.isActive && isActive) {
					return res
						.status(400)
						.json({
							message:
								"Cannot enable subcategory when parent category is disabled",
						});
				}

				const result = await storage.toggleSubcategoryWithCascade(
					req.params.id,
					isActive,
					req.user.id,
					req.user.email,
				);

				res.json({
					success: true,
					message:
						"Subcategory " +
						(isActive ? "enabled" : "disabled") +
						" successfully with " +
						result.products.length +
						" products",
					...result,
				});
			} catch (error) {
				console.error("Error toggling subcategory:", error);
				res
					.status(500)
					.json({
						message:
							error instanceof Error
								? error.message
								: "Failed to toggle subcategory",
					});
			}
		},
	);

	// Delete subcategory
	app.delete(
		"/api/admin/store/subcategories/:id",
		requireAdmin,
		async (req: any, res) => {
			try {
				const subcategory = await storage.getStoreSubcategoryById(
					req.params.id,
				);
				if (!subcategory) {
					return res.status(404).json({ message: "Subcategory not found" });
				}

				const products = await storage.getStoreProductsBySubcategory(
					req.params.id,
				);
				if (products.length > 0) {
					return res
						.status(400)
						.json({
							message: "Cannot delete subcategory with existing products",
						});
				}

				await storage.deleteStoreSubcategory(req.params.id);

				await storage.createStoreAuditLog({
					adminId: req.user.id,
					adminEmail: req.user.email,
					action: "delete",
					targetType: "subcategory",
					targetId: subcategory.id,
					targetName: subcategory.name,
					beforeValue: subcategory,
				});

				res.json({ success: true, message: "Subcategory deleted" });
			} catch (error) {
				console.error("Error deleting subcategory:", error);
				res.status(500).json({ message: "Failed to delete subcategory" });
			}
		},
	);

	// Get all products
	app.get("/api/admin/store/products", requireAdmin, async (req, res) => {
		try {
			const { categoryId, subcategoryId } = req.query;

			let products;
			if (subcategoryId) {
				products = await storage.getStoreProductsBySubcategory(
					subcategoryId as string,
				);
			} else if (categoryId) {
				products = await storage.getStoreProductsByCategory(
					categoryId as string,
				);
			} else {
				products = await storage.getAllStoreProducts();
			}

			res.json({ products });
		} catch (error) {
			console.error("Error fetching products:", error);
			res.status(500).json({ message: "Failed to fetch products" });
		}
	});

	// Get single product
	app.get("/api/admin/store/products/:id", requireAdmin, async (req, res) => {
		try {
			const product = await storage.getStoreProductById(req.params.id);
			if (!product) {
				return res.status(404).json({ message: "Product not found" });
			}
			res.json({ product });
		} catch (error) {
			console.error("Error fetching product:", error);
			res.status(500).json({ message: "Failed to fetch product" });
		}
	});

	// Toggle single product
	app.post(
		"/api/admin/store/products/:id/toggle",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { isActive } = req.body;

				if (typeof isActive !== "boolean") {
					return res
						.status(400)
						.json({ message: "isActive must be a boolean" });
				}

				const product = await storage.getStoreProductById(req.params.id);
				if (!product) {
					return res.status(404).json({ message: "Product not found" });
				}

				const category = await storage.getStoreCategoryById(product.categoryId);
				if (!category?.isActive && isActive) {
					return res
						.status(400)
						.json({
							message: "Cannot enable product when parent category is disabled",
						});
				}

				if (product.subcategoryId) {
					const subcategory = await storage.getStoreSubcategoryById(
						product.subcategoryId,
					);
					if (!subcategory?.isActive && isActive) {
						return res
							.status(400)
							.json({
								message:
									"Cannot enable product when parent subcategory is disabled",
							});
					}
				}

				await storage.createStoreAuditLog({
					adminId: req.user.id,
					adminEmail: req.user.email,
					action: "toggle",
					targetType: "product",
					targetId: product.id,
					targetName: product.name,
					beforeValue: { isActive: product.isActive },
					afterValue: { isActive },
				});

				const updated = await storage.updateStoreProductStatus(
					req.params.id,
					isActive,
				);

				res.json({
					success: true,
					message:
						"Product " + (isActive ? "enabled" : "disabled") + " successfully",
					product: updated,
				});
			} catch (error) {
				console.error("Error toggling product:", error);
				res.status(500).json({ message: "Failed to toggle product" });
			}
		},
	);

	// Get store audit logs
	app.get("/api/admin/store/audit-logs", requireAdmin, async (req, res) => {
		try {
			const { targetType, targetId, adminId, limit } = req.query;

			const logs = await storage.getStoreAuditLogs({
				targetType: targetType as string,
				targetId: targetId as string,
				adminId: adminId as string,
				limit: limit ? Number.parseInt(limit as string) : 100,
			});

			res.json({ logs });
		} catch (error) {
			console.error("Error fetching audit logs:", error);
			res.status(500).json({ message: "Failed to fetch audit logs" });
		}
	});

	// Submit product inquiry (client-side)
	app.post("/api/store/inquiries", async (req: any, res) => {
		try {
			const {
				productId,
				categoryId,
				subcategoryId,
				userId,
				name,
				email,
				mobile,
				message,
			} = req.body;

			if (!name || !email || !message) {
				return res
					.status(400)
					.json({ message: "Name, email, and message are required" });
			}

			const inquiry = await storage.createStoreProductInquiry({
				productId: productId || null,
				categoryId: categoryId || null,
				subcategoryId: subcategoryId || null,
				userId: userId || req.user?.id || null,
				name,
				email,
				mobile: mobile || null,
				message,
				status: "pending",
			});

			res.json({ success: true, inquiry });
		} catch (error) {
			console.error("Error creating inquiry:", error);
			res.status(500).json({ message: "Failed to submit inquiry" });
		}
	});

	// Get all inquiries (admin)
	app.get("/api/admin/store/inquiries", requireAdmin, async (req, res) => {
		try {
			const { status, productId, categoryId } = req.query;

			const inquiries = await storage.getStoreProductInquiries({
				status: status as string,
				productId: productId as string,
				categoryId: categoryId as string,
			});

			res.json({ inquiries });
		} catch (error) {
			console.error("Error fetching inquiries:", error);
			res.status(500).json({ message: "Failed to fetch inquiries" });
		}
	});

	// Update inquiry status (admin) - PUT method
	app.put(
		"/api/admin/store/inquiries/:id",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { status, adminNotes } = req.body;

				const updated = await storage.updateStoreProductInquiry(req.params.id, {
					status,
					adminNotes,
					respondedBy: req.user.id,
					respondedAt: new Date(),
				});

				if (!updated) {
					return res.status(404).json({ message: "Inquiry not found" });
				}

				res.json({ success: true, inquiry: updated });
			} catch (error) {
				console.error("Error updating inquiry:", error);
				res.status(500).json({ message: "Failed to update inquiry" });
			}
		},
	);

	// Update inquiry status (admin) - PATCH method (for partial updates)
	app.patch(
		"/api/admin/store/inquiries/:id/status",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { status, adminNotes } = req.body;

				const updated = await storage.updateStoreProductInquiry(req.params.id, {
					status,
					adminNotes,
					respondedBy: req.user?.id,
					respondedAt: new Date(),
				});

				if (!updated) {
					return res.status(404).json({ message: "Inquiry not found" });
				}

				res.json({ success: true, inquiry: updated });
			} catch (error) {
				console.error("Error updating inquiry status:", error);
				res.status(500).json({ message: "Failed to update inquiry status" });
			}
		},
	);

	// Get public store catalog (for client portal)
}
