// @ts-nocheck
import { getZohoBooksService, ZohoBooksService } from "../zoho/services/books";
import { db } from "../db";
import { sql, eq, and, isNull, desc, gte } from "drizzle-orm";
import * as schema from "@shared/schema";

/**
 * SEBI/RBI Regulatory Compliance for Transaction Sync:
 *
 * Products where money flows DIRECTLY to AMC/Issuer (no invoice creation):
 * - Mutual Funds: Money goes directly to AMC via BSE/NSE/AMFI
 * - AIF/PMS: Money goes directly to fund manager
 * - IPO: ASBA ensures money flows directly from bank to issuer
 *
 * Products where FintekPro may handle funds (invoice/bill creation):
 * - Unlisted Shares: When escrow/settlement handled in-house
 * - Bonds: Success/brokerage fees when routed through FintekPro
 * - Loans: Processing fees when FintekPro arranges financing
 *
 * Revenue Recognition (create invoices):
 * - Distributor commissions from AMC (trail, upfront)
 * - Advisory fees charged to clients
 * - Brokerage fees on transactions
 */

export type ProductType =
	| "mutual_fund"
	| "bond"
	| "ipo"
	| "unlisted"
	| "loan"
	| "insurance"
	| "commission";
export type TransactionType = "inflow" | "outflow" | "pass_through";

interface TransactionSyncResult {
	success: boolean;
	productType: ProductType;
	transactionId: string;
	zohoInvoiceId?: string;
	zohoBillId?: string;
	syncType: "invoice" | "bill" | "compliance_only" | "skipped";
	reason?: string;
	error?: string;
}

interface SyncSummary {
	totalProcessed: number;
	successCount: number;
	failedCount: number;
	results: TransactionSyncResult[];
}

class ZohoTransactionSyncService {
	private zohoService: ZohoBooksService | null = null;

	async initialize(): Promise<boolean> {
		this.zohoService = await getZohoBooksService();
		return this.zohoService !== null;
	}

	/**
	 * SEBI/AMFI Compliance: Mutual Fund orders
	 * Money flows DIRECTLY from investor to AMC via BSE/NSE/AMFI platforms.
	 * FintekPro does NOT handle the investment amount.
	 *
	 * No invoice/bill creation - only mark transaction as synced for compliance tracking.
	 * Revenue recognition happens separately via distributor commission invoices from AMC.
	 */
	async syncMutualFundOrder(orderId: string): Promise<TransactionSyncResult> {
		try {
			const [order] = await db
				.select()
				.from(schema.mfOrders)
				.where(eq(schema.mfOrders.id, orderId))
				.limit(1);

			if (!order) {
				return {
					success: false,
					productType: "mutual_fund",
					transactionId: orderId,
					syncType: "skipped",
					error: "Order not found",
				};
			}

			// Skip if already synced (prevent duplicate processing)
			if ((order as any).zohoSyncedAt) {
				return {
					success: true,
					productType: "mutual_fund",
					transactionId: orderId,
					syncType: "skipped",
					reason: "Already synced for compliance tracking",
				};
			}

			// Mark as compliance-tracked (no Zoho invoice/bill - money goes directly to AMC)
			await db
				.update(schema.mfOrders)
				.set({
					zohoSyncedAt: new Date(),
					zohoSyncStatus: "pass_through",
				} as any)
				.where(eq(schema.mfOrders.id, orderId));

			return {
				success: true,
				productType: "mutual_fund",
				transactionId: orderId,
				syncType: "compliance_only",
				reason:
					"SEBI/AMFI: Money flows directly to AMC. No invoice required - tracked for compliance only.",
			};
		} catch (error: any) {
			return {
				success: false,
				productType: "mutual_fund",
				transactionId: orderId,
				syncType: "skipped",
				error: error.message,
			};
		}
	}

	/**
	 * Bond Orders - Three transaction types:
	 *
	 * 1. INVENTORY SALE (inventorySale = true):
	 *    - FintekPro sells bonds from its own inventory (dealer model)
	 *    - Create revenue invoice for full sale amount
	 *    - Record COGS expense for original purchase cost
	 *    - Profit margin = sale price - cost
	 *
	 * 2. BROKERAGE (inventorySale = false, brokerageFee > 0):
	 *    - Agency transaction via exchange
	 *    - Invoice only the brokerage fee
	 *    - Principal is pass-through
	 *
	 * 3. PASS-THROUGH (no inventory, no brokerage):
	 *    - Compliance tracking only
	 */
	async syncBondOrder(orderId: string): Promise<TransactionSyncResult> {
		if (!this.zohoService) {
			await this.initialize();
		}

		try {
			const [order] = await db
				.select()
				.from(schema.bondOrders)
				.where(eq(schema.bondOrders.id, orderId))
				.limit(1);

			if (!order) {
				return {
					success: false,
					productType: "bond",
					transactionId: orderId,
					syncType: "skipped",
					error: "Order not found",
				};
			}

			// Skip if already synced (prevent duplicate invoices)
			if ((order as any).zohoSyncedAt || order.zohoInvoiceId) {
				return {
					success: true,
					productType: "bond",
					transactionId: orderId,
					syncType: "skipped",
					reason: "Already synced to Zoho Books",
				};
			}

			const saleAmount = Number.parseFloat(
				order.netAmount?.toString() || order.grossAmount?.toString() || "0",
			);
			const brokerageFee = Number.parseFloat(
				order.brokerageFee?.toString() || "0",
			);
			const isInventorySale = order.inventorySale === true;
			const purchaseCost = Number.parseFloat(
				order.totalPurchaseCost?.toString() || "0",
			);

			// Get customer info
			const [user] = await db
				.select()
				.from(schema.users)
				.where(eq(schema.users.id, order.userId))
				.limit(1);
			const customerName = user
				? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
					user.email ||
					"Unknown"
				: "Unknown";

			// SCENARIO 1: Inventory Sale (FintekPro as dealer/principal)
			if (isInventorySale && this.zohoService) {
				const quantity = order.quantity || 1;
				const unitPurchaseCost = Number.parseFloat(
					order.purchaseCost?.toString() || "0",
				);
				const unitSalePrice = saleAmount / quantity;

				// Create or get Zoho inventory item for this bond
				let itemId = order.inventoryItemId;
				if (!itemId) {
					// Create inventory item in Zoho if not exists
					const item = await this.zohoService.createItem({
						name: `${order.bondName || "Bond"} - ${order.isin}`,
						description: `ISIN: ${order.isin}, Type: ${order.bondType || "corporate"}`,
						sku: order.isin || `BOND-${order.id.substring(0, 8)}`,
						rate: unitSalePrice,
						purchase_rate: unitPurchaseCost,
						item_type: "inventory",
						product_type: "goods",
					});
					itemId = item.item_id;
				}

				// Create invoice with inventory item (Zoho will auto-deduct inventory and post COGS)
				const invoice = await this.zohoService.createInvoice({
					customer_name: customerName,
					reference_number: `BOND-INV-${order.orderNumber || order.id.substring(0, 8).toUpperCase()}`,
					date: new Date(order.createdAt || new Date())
						.toISOString()
						.split("T")[0],
					line_items: [
						{
							item_id: itemId,
							name: `${order.bondName || "Bond"} - ${order.isin || "ISIN"}`,
							description: `ISIN: ${order.isin}, Type: ${order.bondType || "corporate"}`,
							rate: unitSalePrice,
							quantity: quantity,
						},
					],
					notes: `Inventory Sale | Order: ${order.orderNumber} | ISIN: ${order.isin} | Unit Cost: ₹${unitPurchaseCost}`,
				} as any);

				// Calculate profit margin
				const profitMargin = saleAmount - purchaseCost;

				await db
					.update(schema.bondOrders)
					.set({
						zohoInvoiceId: invoice.invoice_id,
						inventoryItemId: itemId,
						zohoSyncedAt: new Date(),
						zohoSyncStatus: "inventory_sale",
						profitMargin: profitMargin.toFixed(2),
					} as any)
					.where(eq(schema.bondOrders.id, orderId));

				return {
					success: true,
					productType: "bond",
					transactionId: orderId,
					zohoInvoiceId: invoice.invoice_id,
					syncType: "invoice",
					reason: `Inventory sale: Revenue ₹${saleAmount.toLocaleString()}, COGS ₹${purchaseCost.toLocaleString()}, Profit ₹${profitMargin.toLocaleString()} (Zoho auto-adjusts inventory)`,
				};
			}

			// SCENARIO 2: Brokerage fee only (agency transaction)
			if (brokerageFee > 0 && this.zohoService) {
				const invoice = await this.zohoService.createInvoice({
					customer_name: customerName,
					reference_number: `BOND-FEE-${order.orderNumber || order.id.substring(0, 8).toUpperCase()}`,
					date: new Date(order.createdAt || new Date())
						.toISOString()
						.split("T")[0],
					line_items: [
						{
							name: `Bond Brokerage Fee - ${order.bondName || order.isin || "Bond"}`,
							description: `ISIN: ${order.isin || "N/A"}, Transaction: ₹${saleAmount.toLocaleString()}`,
							rate: brokerageFee,
							quantity: 1,
						},
					],
					notes: `Order: ${order.orderNumber} | Principal flows through exchange (pass-through)`,
				} as any);

				await db
					.update(schema.bondOrders)
					.set({
						zohoInvoiceId: invoice.invoice_id,
						zohoSyncedAt: new Date(),
						zohoSyncStatus: "fee_invoiced",
					} as any)
					.where(eq(schema.bondOrders.id, orderId));

				return {
					success: true,
					productType: "bond",
					transactionId: orderId,
					zohoInvoiceId: invoice.invoice_id,
					syncType: "invoice",
					reason: "Brokerage fee invoiced. Principal flows through exchange.",
				};
			}

			// SCENARIO 3: Pass-through (compliance tracking only)
			await db
				.update(schema.bondOrders)
				.set({
					zohoSyncedAt: new Date(),
					zohoSyncStatus: "pass_through",
				} as any)
				.where(eq(schema.bondOrders.id, orderId));

			return {
				success: true,
				productType: "bond",
				transactionId: orderId,
				syncType: "compliance_only",
				reason:
					"Principal flows through exchange. No brokerage fee to invoice.",
			};
		} catch (error: any) {
			return {
				success: false,
				productType: "bond",
				transactionId: orderId,
				syncType: "skipped",
				error: error.message,
			};
		}
	}

	/**
	 * SEBI Compliance: IPO Applications
	 * Under ASBA (Application Supported by Blocked Amount), money is blocked in investor's
	 * bank account and flows directly from bank to issuer upon allotment.
	 * FintekPro does NOT handle IPO application money.
	 *
	 * No invoice/bill creation - only mark transaction as synced for compliance tracking.
	 */
	async syncIPOApplication(
		applicationId: string,
	): Promise<TransactionSyncResult> {
		try {
			const [application] = await db
				.select()
				.from(schema.ipoApplications)
				.where(eq(schema.ipoApplications.id, applicationId))
				.limit(1);

			if (!application) {
				return {
					success: false,
					productType: "ipo",
					transactionId: applicationId,
					syncType: "skipped",
					error: "Application not found",
				};
			}

			// Skip if already synced (prevent duplicate processing)
			if ((application as any).zohoSyncedAt) {
				return {
					success: true,
					productType: "ipo",
					transactionId: applicationId,
					syncType: "skipped",
					reason: "Already synced for compliance tracking",
				};
			}

			// Mark as compliance-tracked (no Zoho invoice/bill - ASBA: money flows directly from bank to issuer)
			await db
				.update(schema.ipoApplications)
				.set({
					zohoSyncedAt: new Date(),
					zohoSyncStatus: "pass_through",
				} as any)
				.where(eq(schema.ipoApplications.id, applicationId));

			return {
				success: true,
				productType: "ipo",
				transactionId: applicationId,
				syncType: "compliance_only",
				reason:
					"SEBI ASBA: Money blocked in investor bank, flows directly to issuer. No invoice required.",
			};
		} catch (error: any) {
			return {
				success: false,
				productType: "ipo",
				transactionId: applicationId,
				syncType: "skipped",
				error: error.message,
			};
		}
	}

	/**
	 * Unlisted Share Deals - Supports 4 Transaction Scenarios:
	 *
	 * SCENARIO 1: INVENTORY SALE (Primary Market - Dealer Model)
	 * - FintekPro sells from own pre-IPO stock purchased directly from company/promoters
	 * - Creates revenue invoice with Zoho inventory item linkage (auto COGS/inventory reduction)
	 * - Typical margin: 5-15% on pre-IPO shares
	 *
	 * SCENARIO 2: BROKERAGE (Secondary Market - Agency Model)
	 * - P2P transaction between investors, FintekPro acts as facilitator
	 * - Invoice only the brokerage/facilitation fee (typically 1-3%)
	 * - Principal exchanged directly between parties
	 *
	 * SCENARIO 3: ESCROW MANAGED (Secondary Market with Escrow)
	 * - FintekPro holds funds in escrow during share transfer
	 * - Full transaction value flows through FintekPro temporarily
	 * - Invoice to buyer, bill to seller
	 *
	 * SCENARIO 4: PASS-THROUGH (Compliance Tracking Only)
	 * - Direct P2P deal, no FintekPro involvement in money flow
	 * - Track for regulatory compliance only
	 */
	async syncUnlistedDeal(dealId: string): Promise<TransactionSyncResult> {
		if (!this.zohoService) {
			await this.initialize();
		}

		try {
			const [deal] = await db
				.select()
				.from(schema.unlistedDeals)
				.where(eq(schema.unlistedDeals.id, dealId))
				.limit(1);

			if (!deal) {
				return {
					success: false,
					productType: "unlisted",
					transactionId: dealId,
					syncType: "skipped",
					error: "Deal not found",
				};
			}

			// Skip if already synced (prevent duplicate invoices/bills)
			if ((deal as any).zohoSyncedAt || deal.zohoInvoiceId || deal.zohoBillId) {
				return {
					success: true,
					productType: "unlisted",
					transactionId: dealId,
					syncType: "skipped",
					reason: "Already synced to Zoho Books",
				};
			}

			const totalValue = Number.parseFloat(deal.totalValue?.toString() || "0");
			const brokerageFee = Number.parseFloat(
				deal.brokerageFee?.toString() || "0",
			);
			const escrowManaged = deal.escrowManaged === true;
			const isInventorySale = deal.inventorySale === true;
			const purchaseCost = Number.parseFloat(
				deal.totalPurchaseCost?.toString() || "0",
			);
			const quantity = deal.quantity || 1;
			const pricePerShare = Number.parseFloat(
				deal.pricePerShare?.toString() || (totalValue / quantity).toString(),
			);

			// Get company info for SKU
			let companyInfo: { name: string; cin?: string | null } = {
				name: deal.companyName || "Unknown Company",
			};
			if (deal.companyId) {
				const [company] = await db
					.select({
						name: schema.unlistedCompanies.name,
						cin: schema.unlistedCompanies.cin,
					})
					.from(schema.unlistedCompanies)
					.where(eq(schema.unlistedCompanies.id, deal.companyId))
					.limit(1);
				if (company) companyInfo = company;
			}

			// SCENARIO 1: Inventory Sale (Primary Market - FintekPro as Dealer)
			if (isInventorySale && this.zohoService) {
				const unitPurchaseCost = Number.parseFloat(
					deal.purchaseCost?.toString() || "0",
				);

				// Create or get Zoho inventory item for this company's shares
				let itemId = deal.inventoryItemId;
				if (!itemId) {
					const item = await this.zohoService.createItem({
						name: `Unlisted Shares - ${companyInfo.name}`,
						description: `Pre-IPO/Unlisted shares. CIN: ${companyInfo.cin || "N/A"}`,
						sku:
							companyInfo.cin ||
							`UNL-${deal.companyId?.substring(0, 8) || deal.id.substring(0, 8)}`,
						rate: pricePerShare,
						purchase_rate: unitPurchaseCost,
						item_type: "inventory",
						product_type: "goods",
					});
					itemId = item.item_id;
				}

				// Create invoice with inventory item (Zoho auto-deducts inventory and posts COGS)
				const invoice = await this.zohoService.createInvoice({
					customer_name: deal.buyerName || "Buyer",
					reference_number: `UNL-INV-${deal.id.substring(0, 8).toUpperCase()}`,
					date: new Date(deal.createdAt || new Date())
						.toISOString()
						.split("T")[0],
					line_items: [
						{
							item_id: itemId,
							name: `Unlisted Shares - ${companyInfo.name}`,
							description: `CIN: ${companyInfo.cin || "N/A"}, Market: Primary`,
							rate: pricePerShare,
							quantity: quantity,
						},
					],
					notes: `Primary Market Sale | Deal ID: ${deal.id} | Unit Cost: ₹${unitPurchaseCost}`,
				} as any);

				// Calculate profit margin
				const profitMargin = totalValue - purchaseCost;

				await db
					.update(schema.unlistedDeals)
					.set({
						zohoInvoiceId: invoice.invoice_id,
						inventoryItemId: itemId,
						zohoSyncedAt: new Date(),
						zohoSyncStatus: "inventory_sale",
						profitMargin: profitMargin.toFixed(2),
					} as any)
					.where(eq(schema.unlistedDeals.id, dealId));

				return {
					success: true,
					productType: "unlisted",
					transactionId: dealId,
					zohoInvoiceId: invoice.invoice_id,
					syncType: "invoice",
					reason: `Primary market inventory sale: Revenue ₹${totalValue.toLocaleString()}, COGS ₹${purchaseCost.toLocaleString()}, Profit ₹${profitMargin.toLocaleString()} (Zoho auto-adjusts inventory)`,
				};
			}

			// SCENARIO 2: Escrow Managed (Secondary Market with Escrow)
			if (escrowManaged && this.zohoService) {
				const isBuyer = deal.dealType === "buy";

				if (isBuyer) {
					const invoice = await this.zohoService.createInvoice({
						customer_name: deal.buyerName || "Buyer",
						reference_number: `UNL-ESC-${deal.id.substring(0, 8).toUpperCase()}`,
						date: new Date(deal.createdAt || new Date())
							.toISOString()
							.split("T")[0],
						line_items: [
							{
								name: `Unlisted Shares (Escrow) - ${companyInfo.name}`,
								description: `Quantity: ${quantity}, Price: ₹${pricePerShare}, Market: Secondary`,
								rate: totalValue,
								quantity: 1,
							},
						],
						notes: `Secondary Market Escrow | Deal ID: ${deal.id}`,
					} as any);

					await db
						.update(schema.unlistedDeals)
						.set({
							zohoInvoiceId: invoice.invoice_id,
							zohoSyncedAt: new Date(),
							zohoSyncStatus: "escrow_invoiced",
						} as any)
						.where(eq(schema.unlistedDeals.id, dealId));

					return {
						success: true,
						productType: "unlisted",
						transactionId: dealId,
						zohoInvoiceId: invoice.invoice_id,
						syncType: "invoice",
						reason:
							"Escrow-managed secondary market deal. Full transaction invoiced to buyer.",
					};
				}
				const bill = await this.zohoService.createBill({
					vendor_name: deal.sellerName || "Seller",
					reference_number: `UNL-ESC-${deal.id.substring(0, 8).toUpperCase()}`,
					date: new Date(deal.createdAt || new Date())
						.toISOString()
						.split("T")[0],
					line_items: [
						{
							name: `Unlisted Shares Payment (Escrow) - ${companyInfo.name}`,
							description: `Quantity: ${quantity}, Price: ₹${pricePerShare}, Market: Secondary`,
							rate: totalValue,
							quantity: 1,
						},
					],
				} as any);

				await db
					.update(schema.unlistedDeals)
					.set({
						zohoBillId: bill.bill_id,
						zohoSyncedAt: new Date(),
						zohoSyncStatus: "escrow_billed",
					} as any)
					.where(eq(schema.unlistedDeals.id, dealId));

				return {
					success: true,
					productType: "unlisted",
					transactionId: dealId,
					zohoBillId: bill.bill_id,
					syncType: "bill",
					reason:
						"Escrow-managed secondary market deal. Seller payment billed.",
				};
			}

			// SCENARIO 3: Brokerage Fee Only (Secondary Market - Agency Model)
			if (brokerageFee > 0 && this.zohoService) {
				const invoice = await this.zohoService.createInvoice({
					customer_name: deal.buyerName || deal.sellerName || "Client",
					reference_number: `UNL-FEE-${deal.id.substring(0, 8).toUpperCase()}`,
					date: new Date(deal.createdAt || new Date())
						.toISOString()
						.split("T")[0],
					line_items: [
						{
							name: `Unlisted Share Facilitation Fee - ${companyInfo.name}`,
							description: `Deal Value: ₹${totalValue.toLocaleString()}, Qty: ${quantity}, Market: Secondary`,
							rate: brokerageFee,
							quantity: 1,
						},
					],
					notes: `Secondary Market Brokerage | Deal ID: ${deal.id} | Principal exchanged directly between parties`,
				} as any);

				await db
					.update(schema.unlistedDeals)
					.set({
						zohoInvoiceId: invoice.invoice_id,
						zohoSyncedAt: new Date(),
						zohoSyncStatus: "fee_invoiced",
					} as any)
					.where(eq(schema.unlistedDeals.id, dealId));

				return {
					success: true,
					productType: "unlisted",
					transactionId: dealId,
					zohoInvoiceId: invoice.invoice_id,
					syncType: "invoice",
					reason: `Secondary market brokerage: Fee ₹${brokerageFee.toLocaleString()} invoiced. Principal exchanged directly between parties.`,
				};
			}

			// SCENARIO 4: Pass-through (Compliance Tracking Only)
			await db
				.update(schema.unlistedDeals)
				.set({
					zohoSyncedAt: new Date(),
					zohoSyncStatus: "pass_through",
				} as any)
				.where(eq(schema.unlistedDeals.id, dealId));

			return {
				success: true,
				productType: "unlisted",
				transactionId: dealId,
				syncType: "compliance_only",
				reason:
					"No escrow, inventory, or fees. Direct P2P transaction tracked for compliance.",
			};
		} catch (error: any) {
			return {
				success: false,
				productType: "unlisted",
				transactionId: dealId,
				syncType: "skipped",
				error: error.message,
			};
		}
	}

	async syncPendingTransactions(options?: {
		productTypes?: ProductType[];
		limit?: number;
		fromDate?: Date;
	}): Promise<SyncSummary> {
		const initialized = await this.initialize();
		if (!initialized) {
			return {
				totalProcessed: 0,
				successCount: 0,
				failedCount: 0,
				results: [
					{
						success: false,
						productType: "mutual_fund",
						transactionId: "",
						error: "Zoho Books not configured",
					},
				],
			};
		}

		const results: TransactionSyncResult[] = [];
		const limit = options?.limit || 100;
		const fromDate =
			options?.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const productTypes = options?.productTypes || [
			"mutual_fund",
			"bond",
			"ipo",
			"unlisted",
		];

		if (productTypes.includes("mutual_fund")) {
			// MF orders - mark for compliance tracking (no invoices per SEBI/AMFI)
			const mfOrders = await db
				.select({ id: schema.mfOrders.id })
				.from(schema.mfOrders)
				.where(
					and(
						isNull(schema.mfOrders.zohoSyncedAt),
						eq(schema.mfOrders.status, "completed"),
						gte(schema.mfOrders.createdAt, fromDate),
					),
				)
				.orderBy(desc(schema.mfOrders.createdAt))
				.limit(limit);

			for (const order of mfOrders) {
				results.push(await this.syncMutualFundOrder(order.id));
			}
		}

		if (productTypes.includes("bond")) {
			// Bonds - sync for compliance and fee invoicing
			const bondOrders = await db
				.select({ id: schema.bondOrders.id })
				.from(schema.bondOrders)
				.where(
					and(
						isNull(schema.bondOrders.zohoSyncedAt),
						eq((schema.bondOrders as any).status, "completed"),
						gte(schema.bondOrders.createdAt, fromDate),
					),
				)
				.orderBy(desc(schema.bondOrders.createdAt))
				.limit(limit);

			for (const order of bondOrders) {
				results.push(await this.syncBondOrder(order.id));
			}
		}

		if (productTypes.includes("ipo")) {
			// IPO - mark for compliance tracking (ASBA: no invoices)
			const ipoApplications = await db
				.select({ id: schema.ipoApplications.id })
				.from(schema.ipoApplications)
				.where(
					and(
						isNull((schema.ipoApplications as any).zohoSyncedAt),
						sql`LOWER(${(schema.ipoApplications as any).status}) = 'allotted'`,
						gte((schema.ipoApplications as any).appliedAt, fromDate),
					),
				)
				.orderBy(desc((schema.ipoApplications as any).appliedAt))
				.limit(limit);

			for (const app of ipoApplications) {
				results.push(await this.syncIPOApplication(app.id));
			}
		}

		if (productTypes.includes("unlisted")) {
			// Unlisted - sync based on escrow/fee status
			const unlistedDeals = await db
				.select({ id: schema.unlistedDeals.id })
				.from(schema.unlistedDeals)
				.where(
					and(
						isNull(schema.unlistedDeals.zohoSyncedAt),
						eq(schema.unlistedDeals.status, "completed"),
						gte(schema.unlistedDeals.createdAt, fromDate),
					),
				)
				.orderBy(desc(schema.unlistedDeals.createdAt))
				.limit(limit);

			for (const deal of unlistedDeals) {
				results.push(await this.syncUnlistedDeal(deal.id));
			}
		}

		const successCount = results.filter((r: any) => r.success).length;

		return {
			totalProcessed: results.length,
			successCount,
			failedCount: results.length - successCount,
			results,
		};
	}

	async getSyncStatus(): Promise<{
		configured: boolean;
		pendingSync: {
			mutualFunds: number;
			bonds: number;
			ipos: number;
			unlisted: number;
			total: number;
		};
		syncedCounts: {
			passThrough: number;
			invoiced: number;
			billed: number;
		};
		lastSyncedAt?: Date;
	}> {
		const zohoService = await getZohoBooksService();
		const configured = zohoService !== null;

		// Count pending transactions (not yet synced)
		const mfResult = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM mf_orders 
      WHERE zoho_synced_at IS NULL AND status = 'completed'
    `);

		const bondResult = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM bond_orders 
      WHERE zoho_synced_at IS NULL AND order_status = 'completed'
    `);

		const ipoResult = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM ipo_applications 
      WHERE zoho_synced_at IS NULL AND LOWER(allotment_status) = 'allotted'
    `);

		const unlistedResult = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM unlisted_deals 
      WHERE zoho_synced_at IS NULL AND status = 'completed'
    `);

		// Count synced transactions by type
		const passThroughResult = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM (
        SELECT 1 FROM mf_orders WHERE zoho_sync_status = 'pass_through'
        UNION ALL
        SELECT 1 FROM bond_orders WHERE zoho_sync_status = 'pass_through'
        UNION ALL
        SELECT 1 FROM ipo_applications WHERE zoho_sync_status = 'pass_through'
        UNION ALL
        SELECT 1 FROM unlisted_deals WHERE zoho_sync_status = 'pass_through'
      ) combined
    `);

		const invoicedResult = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM (
        SELECT 1 FROM bond_orders WHERE zoho_invoice_id IS NOT NULL
        UNION ALL
        SELECT 1 FROM unlisted_deals WHERE zoho_invoice_id IS NOT NULL
      ) combined
    `);

		const billedResult = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM unlisted_deals WHERE zoho_bill_id IS NOT NULL
    `);

		const mfCount = mfResult.rows?.[0] as any;
		const bondCount = bondResult.rows?.[0] as any;
		const ipoCount = ipoResult.rows?.[0] as any;
		const unlistedCount = unlistedResult.rows?.[0] as any;
		const passThroughCount = passThroughResult.rows?.[0] as any;
		const invoicedCount = invoicedResult.rows?.[0] as any;
		const billedCount = billedResult.rows?.[0] as any;

		const mutualFunds = Number(mfCount?.count || 0);
		const bonds = Number(bondCount?.count || 0);
		const ipos = Number(ipoCount?.count || 0);
		const unlisted = Number(unlistedCount?.count || 0);

		return {
			configured,
			pendingSync: {
				mutualFunds,
				bonds,
				ipos,
				unlisted,
				total: mutualFunds + bonds + ipos + unlisted,
			},
			syncedCounts: {
				passThrough: Number(passThroughCount?.count || 0),
				invoiced: Number(invoicedCount?.count || 0),
				billed: Number(billedCount?.count || 0),
			},
		};
	}

	/**
	 * Sync store transaction logs with Zoho Books
	 * Creates invoice entries for completed purchases and tracks commissions
	 */
	async syncStoreTransaction(transactionId: string): Promise<{
		success: boolean;
		zohoInvoiceId?: string;
		zohoBillId?: string;
		error?: string;
	}> {
		const zohoService = await getZohoBooksService();
		if (!zohoService) {
			return { success: false, error: "Zoho Books not configured" };
		}

		try {
			// Fetch transaction from store_transaction_logs
			const [transaction] = (
				await db.execute(sql`
        SELECT * FROM store_transaction_logs 
        WHERE id = ${transactionId}
      `)
			).rows as unknown as any[];

			if (!transaction) {
				return { success: false, error: "Transaction not found" };
			}

			const txn = transaction as any;

			// Only sync completed purchases
			if (txn.action !== "purchase" || txn.status !== "completed") {
				return { success: false, error: "Transaction not eligible for sync" };
			}

			// Get user info for Zoho contact
			const userResult = await db.execute(sql`
        SELECT id, email, full_name FROM users WHERE id = ${txn.user_id}
      `);
			const userRows = (userResult as any)?.rows || userResult;
			const user = Array.isArray(userRows) ? userRows[0] : null;
			if (!user) {
				// Continue without user info - create invoice without contact
				console.warn("[ZohoSync] User not found for transaction:", txn.user_id);
			}

			// Create or get Zoho contact
			let contactId: string | undefined;
			if (user) {
				try {
					const contact = await (zohoService as any).createOrUpdateContact({
						contact_name: user.full_name || user.email,
						email: user.email,
						company_name: "Individual Client",
						contact_type: "customer",
					});
					contactId = contact.contact_id;
				} catch (err) {
					console.warn(
						"[ZohoSync] Contact creation failed, continuing without:",
						err,
					);
				}
			}

			// Parse transaction metadata
			const metadata =
				typeof txn.metadata === "string"
					? JSON.parse(txn.metadata)
					: txn.metadata || {};

			// Create Zoho invoice for the purchase
			const invoiceData = {
				customer_id: contactId,
				date: new Date(txn.created_at).toISOString().split("T")[0],
				due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
					.toISOString()
					.split("T")[0],
				line_items: [
					{
						name:
							metadata.productName ||
							`Store Product: ${txn.product_id || "Unknown"}`,
						description: `${txn.category || "Store"} - ${txn.source || "Direct Purchase"}`,
						rate: Number.parseFloat(txn.amount) || 0,
						quantity: metadata.quantity || 1,
					},
				],
				notes: `Transaction ID: ${txn.transaction_id}\nPAN: ${txn.masked_pan || "N/A"}\nCategory: ${txn.category}`,
				reference_number: txn.transaction_id,
			};

			const invoice = await zohoService.createInvoice(invoiceData);
			const zohoInvoiceId =
				(invoice as any)?.invoice?.invoice_id ?? (invoice as any)?.invoice_id;

			// Update transaction with Zoho sync info
			await db.execute(sql`
        UPDATE store_transaction_logs 
        SET zoho_invoice_id = ${zohoInvoiceId},
            zoho_synced_at = NOW()
        WHERE id = ${transactionId}
      `);

			// Create bill for commissions if applicable
			let zohoBillId: string | undefined;
			if (metadata.agentId || metadata.partnerId) {
				const commissionRate = metadata.commissionRate || 0.02; // 2% default
				const commissionAmount = Number.parseFloat(txn.amount) * commissionRate;

				const billData = {
					vendor_id: metadata.agentId || metadata.partnerId,
					date: new Date().toISOString().split("T")[0],
					due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
						.toISOString()
						.split("T")[0],
					line_items: [
						{
							name: "Sales Commission",
							description: `Commission for ${metadata.productName || txn.product_id}`,
							rate: commissionAmount,
							quantity: 1,
						},
					],
					notes: `Transaction ID: ${txn.transaction_id}\nOriginal Sale: ₹${txn.amount}`,
					reference_number: `COMM-${txn.transaction_id}`,
				};

				try {
					const bill = await zohoService.createBill(billData);
					zohoBillId = (bill as any)?.bill?.bill_id ?? (bill as any)?.bill_id;

					await db.execute(sql`
            UPDATE store_transaction_logs 
            SET zoho_bill_id = ${zohoBillId}
            WHERE id = ${transactionId}
          `);
				} catch (err) {
					console.warn("[ZohoSync] Commission bill creation failed:", err);
				}
			}

			return {
				success: true,
				zohoInvoiceId,
				zohoBillId,
			};
		} catch (error: any) {
			console.error("[ZohoSync] Store transaction sync error:", error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Bulk sync pending store transactions with Zoho Books
	 */
	async syncPendingStoreTransactions(limit: number = 50): Promise<{
		total: number;
		synced: number;
		failed: number;
		errors: string[];
	}> {
		const results = {
			total: 0,
			synced: 0,
			failed: 0,
			errors: [] as string[],
		};

		try {
			// Get pending transactions (completed purchases not yet synced)
			const pending = await db.execute(sql`
        SELECT id FROM store_transaction_logs 
        WHERE action = 'purchase' 
          AND status = 'completed' 
          AND zoho_invoice_id IS NULL
        ORDER BY created_at ASC
        LIMIT ${limit}
      `);

			const transactions = pending as unknown as any[];
			results.total = transactions.length;

			for (const txn of transactions) {
				const result = await this.syncStoreTransaction(txn.id);
				if (result.success) {
					results.synced++;
				} else {
					results.failed++;
					results.errors.push(`${txn.id}: ${result.error}`);
				}
			}
		} catch (error: any) {
			results.errors.push(`Batch sync error: ${error.message}`);
		}

		return results;
	}

	/**
	 * Get reconciliation items for commission matching
	 */
	async getReconciliationItems(
		options: {
			productType?: string;
			syncStatus?: string;
			limit?: number;
		} = {},
	): Promise<
		Array<{
			id: string;
			transactionType: string;
			productType: string;
			productName: string;
			amount: string;
			status: string;
			createdAt: string;
			zohoSyncedAt?: string;
			zohoInvoiceId?: string;
			zohoBillId?: string;
			zohoSyncStatus?: string;
			matchStatus: "matched" | "pending" | "failed" | "skipped";
			commissionAmount?: string;
			commissionPaid?: boolean;
		}>
	> {
		const { productType, syncStatus, limit = 100 } = options;

		try {
			// Query using Drizzle ORM for type safety
			const transactions = await db
				.select({
					id: schema.storeTransactionLogs.id,
					transactionType: schema.storeTransactionLogs.transactionType,
					productCategory: schema.storeTransactionLogs.productCategory,
					productName: schema.storeTransactionLogs.productName,
					amount: schema.storeTransactionLogs.amount,
					status: schema.storeTransactionLogs.status,
					createdAt: schema.storeTransactionLogs.createdAt,
					zohoSyncedAt: schema.storeTransactionLogs.zohoSyncedAt,
					zohoInvoiceId: schema.storeTransactionLogs.zohoInvoiceId,
					zohoBillId: schema.storeTransactionLogs.zohoBillId,
					zohoSyncStatus: schema.storeTransactionLogs.zohoSyncStatus,
					commissionAmount: schema.storeTransactionLogs.commissionAmount,
				})
				.from(schema.storeTransactionLogs)
				.orderBy(desc(schema.storeTransactionLogs.createdAt))
				.limit(limit);

			const items = transactions
				.map((row) => {
					let matchStatus: "matched" | "pending" | "failed" | "skipped" =
						"pending";

					if (row.zohoInvoiceId || row.zohoBillId) {
						matchStatus = "matched";
					} else if (
						row.zohoSyncStatus === "pass_through" ||
						row.zohoSyncStatus === "compliance_only" ||
						row.zohoSyncStatus === "not_applicable"
					) {
						matchStatus = "skipped";
					} else if (row.zohoSyncStatus === "failed") {
						matchStatus = "failed";
					}

					// Apply product type filter
					if (
						productType &&
						productType !== "all" &&
						row.productCategory !== productType
					) {
						return null;
					}

					// Apply sync status filter if provided
					if (
						syncStatus &&
						syncStatus !== "all" &&
						matchStatus !== syncStatus
					) {
						return null;
					}

					return {
						id: row.id,
						transactionType: row.transactionType || "unknown",
						productType: row.productCategory || "unknown",
						productName: row.productName || "",
						amount: row.amount?.toString() || "0",
						status: row.status || "pending",
						createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
						zohoSyncedAt: (row as any).zohoSyncedAt?.toISOString(),
						zohoInvoiceId: row.zohoInvoiceId || undefined,
						zohoBillId: row.zohoBillId || undefined,
						zohoSyncStatus: row.zohoSyncStatus || undefined,
						matchStatus,
						commissionAmount: row.commissionAmount?.toString(),
					};
				})
				.filter(Boolean) as unknown as any[];

			return items;
		} catch (error: any) {
			console.error("[ZohoSync] Error fetching reconciliation items:", error);
			return [];
		}
	}

	/**
	 * Get commission payouts for reconciliation
	 */
	async getCommissionPayouts(): Promise<
		Array<{
			id: string;
			agentId: string;
			agentName: string;
			agentRole: string;
			productType: string;
			transactionId: string;
			transactionDate: string;
			commissionAmount: string;
			tdsAmount: string;
			netAmount: string;
			status: "pending" | "approved" | "paid" | "rejected";
			zohoBillId?: string;
			payoutDate?: string;
		}>
	> {
		try {
			// Query agent commissions using Drizzle ORM
			const commissions = await db
				.select({
					id: schema.agentCommissions.id,
					agentId: schema.agentCommissions.agentId,
					productType: schema.agentCommissions.productType,
					orderId: schema.agentCommissions.orderId,
					transactionDate: schema.agentCommissions.transactionDate,
					agentCommissionAmount: schema.agentCommissions.agentCommissionAmount,
					agentTdsAmount: schema.agentCommissions.agentTdsAmount,
					agentNetCommission: schema.agentCommissions.agentNetCommission,
					agentSettlementStatus: schema.agentCommissions.agentSettlementStatus,
					agentSettledAt: schema.agentCommissions.agentSettledAt,
				})
				.from(schema.agentCommissions)
				.orderBy(desc(schema.agentCommissions.createdAt))
				.limit(100);

			return commissions.map((row) => {
				// Map settlement status to payout status
				// Agent commissions schema: pending/settled/cancelled
				// UI expects: pending/approved/paid/rejected
				let status: "pending" | "approved" | "paid" | "rejected" = "pending";
				if (row.agentSettlementStatus === "settled")
					status = "paid"; // settled = paid/approved
				else if (row.agentSettlementStatus === "cancelled") status = "rejected";
				// 'pending' stays as 'pending'

				return {
					id: row.id,
					agentId: row.agentId || "",
					agentName: "Agent",
					agentRole: "Agent",
					productType: row.productType || "unknown",
					transactionId: row.orderId || "",
					transactionDate:
						row.transactionDate?.toISOString() || new Date().toISOString(),
					commissionAmount: row.agentCommissionAmount?.toString() || "0",
					tdsAmount: row.agentTdsAmount?.toString() || "0",
					netAmount: row.agentNetCommission?.toString() || "0",
					status,
					payoutDate: row.agentSettledAt?.toISOString(),
				};
			});
		} catch (error: any) {
			console.error("[ZohoSync] Error fetching commission payouts:", error);

			// If agent_commissions table doesn't exist or query fails, try partner_commissions
			try {
				const partnerCommissions = await db
					.select({
						id: schema.partnerCommissions.id,
						partnerId: schema.partnerCommissions.partnerId,
						productType: schema.partnerCommissions.productType,
						transactionId: (schema.partnerCommissions as any).transactionId,
						createdAt: schema.partnerCommissions.createdAt,
						commissionAmount: schema.partnerCommissions.commissionAmount,
						tdsAmount: schema.partnerCommissions.tdsAmount,
						netCommission: schema.partnerCommissions.netCommission,
						status: schema.partnerCommissions.status,
						zohoBillId: (schema.partnerCommissions as any).zohoBillId,
					})
					.from(schema.partnerCommissions)
					.orderBy(desc(schema.partnerCommissions.createdAt))
					.limit(100);

				return partnerCommissions.map((row) => {
					// Map status correctly
					let status: "pending" | "approved" | "paid" | "rejected" = "pending";
					if (row.status === "settled" || row.status === "paid")
						status = "paid";
					else if (row.status === "approved") status = "approved";
					else if (row.status === "rejected" || row.status === "cancelled")
						status = "rejected";

					return {
						id: row.id,
						agentId: row.partnerId || "",
						agentName: "Partner",
						agentRole: "Partner",
						productType: row.productType || "unknown",
						transactionId: row.transactionId || "",
						transactionDate:
							row.createdAt?.toISOString() || new Date().toISOString(),
						commissionAmount: row.commissionAmount?.toString() || "0",
						tdsAmount: row.tdsAmount?.toString() || "0",
						netAmount: row.netCommission?.toString() || "0",
						status,
						zohoBillId: row.zohoBillId || undefined,
					};
				});
			} catch (innerError) {
				console.error(
					"[ZohoSync] Error fetching partner commissions:",
					innerError,
				);
				return [];
			}
		}
	}

	/**
	 * ITR Self-File Fee Sync
	 *
	 * When a user pays for self-filing their ITR:
	 * - Create revenue invoice for the self-file fee
	 * - ITR pricing is admin-configurable (ITR-1: ₹499, ITR-2: ₹999, etc.)
	 * - No CA involved - 100% revenue to FintekPro
	 */
	async syncITRSelfFileFee(
		filingRecordId: string,
	): Promise<TransactionSyncResult> {
		if (!this.zohoService) {
			await this.initialize();
		}

		try {
			const [filing] = await db
				.select()
				.from(schema.filingRecords)
				.where(eq(schema.filingRecords.id, filingRecordId))
				.limit(1);

			if (!filing) {
				return {
					success: false,
					productType: "commission",
					transactionId: filingRecordId,
					syncType: "skipped",
					error: "Filing record not found",
				};
			}

			// Skip if already synced
			if ((filing as any).zohoSyncedAt || filing.zohoInvoiceId) {
				return {
					success: true,
					productType: "commission",
					transactionId: filingRecordId,
					syncType: "skipped",
					reason: "Already synced",
				};
			}

			// Get user info
			const [user] = await db
				.select()
				.from(schema.users)
				.where(eq(schema.users.id, filing.userId))
				.limit(1);
			const customerName = user
				? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email
				: "Unknown";

			// Get ITR pricing
			const [pricing] = await db
				.select()
				.from(schema.itrPricingConfig)
				.where(
					eq(
						schema.itrPricingConfig.itrFormType,
						filing.itrFormType || "ITR-1",
					),
				)
				.limit(1);
			const selfFileFee = pricing
				? Number.parseFloat(pricing.selfFileFee.toString())
				: 499;

			// Create invoice
			if (this.zohoService) {
				const invoiceData = {
					customer_name: customerName,
					date: new Date().toISOString().split("T")[0],
					line_items: [
						{
							name: `ITR Self-Filing Fee - ${filing.itrFormType || "ITR-1"}`,
							description: `Assessment Year: ${filing.assessmentYear || "2024-25"}`,
							rate: selfFileFee,
							quantity: 1,
						},
					],
					reference_number: `ITR-SELF-${filingRecordId}`,
					notes: `ITR Form: ${filing.itrFormType}, PAN: ${filing.panNumber || "N/A"}`,
				};

				const invoice = await this.zohoService.createInvoice(invoiceData);
				await db
					.update(schema.filingRecords)
					.set({
						zohoSyncedAt: new Date(),
						zohoInvoiceId: invoice.invoice_id,
						zohoSyncStatus: "synced",
					} as any)
					.where(eq(schema.filingRecords.id, filingRecordId));

				return {
					success: true,
					productType: "commission",
					transactionId: filingRecordId,
					syncType: "invoice",
					zohoInvoiceId: invoice.invoice_id,
				};
			}

			// Mark as local-only if Zoho not configured
			await db
				.update(schema.filingRecords)
				.set({ zohoSyncedAt: new Date(), zohoSyncStatus: "local_only" } as any)
				.where(eq(schema.filingRecords.id, filingRecordId));

			return {
				success: true,
				productType: "commission",
				transactionId: filingRecordId,
				syncType: "compliance_only",
				reason: "Zoho not configured",
			};
		} catch (error: any) {
			return {
				success: false,
				productType: "commission",
				transactionId: filingRecordId,
				syncType: "skipped",
				error: error.message,
			};
		}
	}

	/**
	 * ITR CA-Assisted Filing Sync
	 *
	 * When a user pays for CA-assisted ITR filing:
	 * - Create revenue invoice for full CA-assisted fee
	 * - Create bill (expense) for CA revenue share (50-80% based on config)
	 * - Net revenue = CA fee - CA share
	 */
	async syncITRCaAssistedFiling(
		caseId: string,
	): Promise<TransactionSyncResult> {
		if (!this.zohoService) {
			await this.initialize();
		}

		try {
			const [itrCase] = await db
				.select()
				.from(schema.agentItrCases)
				.where(eq(schema.agentItrCases.id, caseId))
				.limit(1);

			if (!itrCase) {
				return {
					success: false,
					productType: "commission",
					transactionId: caseId,
					syncType: "skipped",
					error: "ITR case not found",
				};
			}

			// Skip if already synced
			if ((itrCase as any).zohoSyncedAt || itrCase.zohoInvoiceId) {
				return {
					success: true,
					productType: "commission",
					transactionId: caseId,
					syncType: "skipped",
					reason: "Already synced",
				};
			}

			// Get user info
			const [user] = await db
				.select()
				.from(schema.users)
				.where(eq(schema.users.id, itrCase.clientId))
				.limit(1);
			const customerName = user
				? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email
				: "Unknown";

			// Get ITR pricing with CA revenue share
			const [pricing] = await db
				.select()
				.from(schema.itrPricingConfig)
				.where(
					eq(
						schema.itrPricingConfig.itrFormType,
						itrCase.itrFormType || "ITR-1",
					),
				)
				.limit(1);
			const caAssistedFee = pricing
				? Number.parseFloat(pricing.caAssistedFee.toString())
				: 999;
			const caRevenueSharePercent = pricing?.caRevenueSharePercent || 50;
			const caShare = caAssistedFee * (caRevenueSharePercent / 100);

			let zohoInvoiceId: string | undefined;
			let zohoBillId: string | undefined;

			if (this.zohoService) {
				// Create customer invoice for full CA-assisted fee
				const invoiceData = {
					customer_name: customerName,
					date: new Date().toISOString().split("T")[0],
					line_items: [
						{
							name: `ITR CA-Assisted Filing - ${itrCase.itrFormType || "ITR-1"}`,
							description: `Assessment Year: ${itrCase.assessmentYear || "2024-25"}, Case ID: ${caseId}`,
							rate: caAssistedFee,
							quantity: 1,
						},
					],
					reference_number: `ITR-CA-${caseId}`,
					notes: `ITR Form: ${itrCase.itrFormType}, CA Revenue Share: ${caRevenueSharePercent}%`,
				};
				const invoice = await this.zohoService.createInvoice(invoiceData);
				zohoInvoiceId = invoice.invoice_id;

				// Get CA vendor info
				const caAgentId = itrCase.agentId?.toString() || "";
				const [caAgent] = caAgentId
					? await db
							.select()
							.from(schema.users)
							.where(eq(schema.users.id, Number.parseInt(caAgentId)))
							.limit(1)
					: [];
				const vendorName = caAgent
					? `${caAgent.firstName || ""} ${caAgent.lastName || ""}`.trim() ||
						caAgent.email
					: "CA Partner";

				// Create bill for CA revenue share
				const billData = {
					vendor_name: vendorName,
					date: new Date().toISOString().split("T")[0],
					line_items: [
						{
							name: `CA Revenue Share - ITR ${itrCase.itrFormType || "ITR-1"}`,
							description: `Case: ${caseId}, Client: ${customerName}, Share: ${caRevenueSharePercent}%`,
							rate: caShare,
							quantity: 1,
						},
					],
					reference_number: `CASHARE-${caseId}`,
					notes: `Linked Invoice: ${zohoInvoiceId}`,
				};
				const bill = await this.zohoService.createBill(billData);
				zohoBillId = bill.bill_id;

				// Update case with sync info
				await db
					.update(schema.agentItrCases)
					.set({
						zohoSyncedAt: new Date(),
						zohoInvoiceId,
						zohoBillId,
						zohoSyncStatus: "synced",
					} as any)
					.where(eq(schema.agentItrCases.id, caseId));

				return {
					success: true,
					productType: "commission",
					transactionId: caseId,
					syncType: "invoice",
					zohoInvoiceId,
					zohoBillId,
				};
			}

			// Mark as local-only if Zoho not configured
			await db
				.update(schema.agentItrCases)
				.set({ zohoSyncedAt: new Date(), zohoSyncStatus: "local_only" } as any)
				.where(eq(schema.agentItrCases.id, caseId));

			return {
				success: true,
				productType: "commission",
				transactionId: caseId,
				syncType: "compliance_only",
				reason: "Zoho not configured",
			};
		} catch (error: any) {
			return {
				success: false,
				productType: "commission",
				transactionId: caseId,
				syncType: "skipped",
				error: error.message,
			};
		}
	}
	/**
	 * Approve a commission payout and optionally create Zoho Bill
	 * Status flow: pending → settled (for agent) or pending → approved → paid (for partner)
	 *
	 * Behavior:
	 * - If Zoho is NOT configured: Approve locally (offline mode)
	 * - If Zoho IS configured: Only approve if Zoho bill creation succeeds
	 */
	async approveCommissionPayout(
		payoutId: string,
		options?: {
			forceLocalApproval?: boolean;
		},
	): Promise<{
		success: boolean;
		zohoBillId?: string;
		error?: string;
		requiresZohoSync?: boolean;
	}> {
		try {
			const zohoService = await getZohoBooksService();
			const zohoConfigured = zohoService !== null;

			// Try agent_commissions first
			let payout: any = null;
			let tableName = "agent_commissions";

			try {
				const [agentPayout] = await db
					.select()
					.from(schema.agentCommissions)
					.where(eq(schema.agentCommissions.id, payoutId))
					.limit(1);

				if (agentPayout) {
					payout = agentPayout;
				}
			} catch (e) {
				console.warn("[ZohoSync] Agent commissions query failed:", e);
			}

			if (!payout) {
				try {
					const [partnerPayout] = await db
						.select()
						.from(schema.partnerCommissions)
						.where(eq(schema.partnerCommissions.id, payoutId))
						.limit(1);

					if (partnerPayout) {
						payout = partnerPayout;
						tableName = "partner_commissions";
					}
				} catch (e) {
					console.warn("[ZohoSync] Partner commissions query failed:", e);
				}
			}

			if (!payout) {
				return { success: false, error: "Payout not found" };
			}

			// Check if already settled/approved
			const currentStatus =
				tableName === "agent_commissions"
					? payout.agentSettlementStatus
					: payout.status;

			if (
				currentStatus === "settled" ||
				currentStatus === "approved" ||
				currentStatus === "paid"
			) {
				return { success: true, error: "Payout already approved" };
			}

			// Attempt Zoho Bill creation if Zoho is connected
			let zohoBillId: string | undefined;
			let zohoBillError: string | undefined;

			if (zohoConfigured && zohoService) {
				try {
					const netAmount =
						payout.agentNetCommission || payout.netCommission || "0";
					const vendorRef = `Agent-${(payout.agentId || payout.partnerId || "Unknown").substring(0, 8)}`;

					const bill = await zohoService.createBill({
						vendor_name: vendorRef,
						reference_number: `COMM-${payoutId.substring(0, 8)}`,
						date: new Date().toISOString().split("T")[0],
						line_items: [
							{
								name: "Commission Payout",
								description: `Commission for ${payout.productType || "transaction"} - Order: ${payout.orderId || payout.transactionId || "N/A"}`,
								rate: Number.parseFloat(netAmount.toString()),
								quantity: 1,
							},
						],
						notes: `Payout ID: ${payoutId}\nTransaction: ${payout.orderId || payout.transactionId || ""}`,
					} as any);
					zohoBillId = bill?.bill?.bill_id || bill?.bill_id;

					if (!zohoBillId) {
						zohoBillError = "Zoho bill created but no bill ID returned";
						console.warn("[ZohoSync] Bill created but no ID returned:", bill);
					}
				} catch (err: any) {
					zohoBillError = err.message || "Zoho bill creation failed";
					console.error("[ZohoSync] Bill creation failed:", err);

					// If Zoho is configured but bill creation fails, don't approve unless forced
					if (!options?.forceLocalApproval) {
						return {
							success: false,
							error: `Zoho bill creation failed: ${zohoBillError}. Use force approval for local-only mode.`,
							requiresZohoSync: true,
						};
					}
				}
			}

			// Update the payout status using Drizzle ORM
			// Agent commissions: pending → settled (schema only supports pending/settled/cancelled)
			// Partner commissions: pending → approved (with zohoBillId if available)
			if (tableName === "agent_commissions") {
				await db
					.update(schema.agentCommissions)
					.set({
						agentSettlementStatus: "settled", // Use 'settled' as the approved/paid state
						agentSettledAt: new Date(),
					})
					.where(eq(schema.agentCommissions.id, payoutId));

				console.log(
					`[ZohoSync] Agent commission ${payoutId} marked as settled${zohoBillId ? ` (Zoho Bill: ${zohoBillId})` : " (local only)"}`,
				);
			} else {
				// Partner commissions table has zohoBillId field
				const updateData: Record<string, any> = {
					status: "approved",
				};
				if (zohoBillId) {
					updateData.zohoBillId = zohoBillId;
				}

				await db
					.update(schema.partnerCommissions)
					.set(updateData)
					.where(eq(schema.partnerCommissions.id, payoutId));

				console.log(
					`[ZohoSync] Partner commission ${payoutId} approved${zohoBillId ? ` with Zoho Bill ${zohoBillId}` : " (local only)"}`,
				);
			}

			// Return success with sync status
			const syncMessage = zohoConfigured
				? zohoBillId
					? undefined
					: `Approved locally - Zoho sync pending: ${zohoBillError}`
				: "Approved locally (Zoho not configured)";

			return {
				success: true,
				zohoBillId,
				error: syncMessage,
				requiresZohoSync: zohoConfigured && !zohoBillId,
			};
		} catch (error: any) {
			console.error("[ZohoSync] Error approving payout:", error);
			return { success: false, error: error.message };
		}
	}
}

export const zohoTransactionSyncService = new ZohoTransactionSyncService();
console.log("✅ Zoho Transaction Sync Service initialized");
