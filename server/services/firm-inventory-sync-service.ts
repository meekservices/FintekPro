// @ts-nocheck
/**
 * Firm Inventory Sync Service
 *
 * Treats Fintekpro Financial Services LLP's DP holdings as Zoho Books inventory.
 * Every buy/sell at the firm level auto-creates a Bill/Invoice in Zoho Books.
 * Inbound Zoho Books webhook events create firm_transactions records here.
 *
 * Flow:
 *  FintekPro buy  → Zoho Books Bill   (firm spends cash, gains inventory)
 *  FintekPro sell → Zoho Books Invoice (firm sells inventory, gains cash)
 *  Zoho Books payment → firm_transactions "receipt" record
 *  Zoho Books expense → firm_transactions "fee" record
 */

import { db } from "../db";
import { firmDpHoldings, firmTransactions } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getZohoBooksService } from "../zoho/services/books";

const FIRM_PARTNER_ID = "platform-partner-001";
const FIRM_NAME = "Fintekpro Financial Services LLP";
const FIRM_EMAIL = "meekservices@gmail.com";

export interface FirmTxInput {
	transactionType:
		| "buy"
		| "sell"
		| "transfer_in"
		| "transfer_out"
		| "dividend"
		| "fee"
		| "adjustment";
	securityName: string;
	isin?: string;
	companyId?: string;
	quantity: number;
	pricePerShare?: number;
	totalValue: number;
	charges?: number;
	transactionDate: string;
	counterpartyName?: string;
	counterpartyId?: string;
	reference?: string;
	notes?: string;
	createdBy?: string;
}

export interface SyncResult {
	success: boolean;
	transactionId: number;
	zohoRecordId?: string;
	zohoRecordType?: "bill" | "invoice" | "skipped";
	error?: string;
}

class FirmInventorySyncService {
	private static instance: FirmInventorySyncService;

	static getInstance(): FirmInventorySyncService {
		if (!FirmInventorySyncService.instance)
			FirmInventorySyncService.instance = new FirmInventorySyncService();
		return FirmInventorySyncService.instance;
	}

	// ── Holding CRUD ──────────────────────────────────────────────────────────

	async getOrCreateHolding(
		securityName: string,
		isin?: string,
		companyId?: string,
		securityType = "unlisted_equity",
	): Promise<typeof firmDpHoldings.$inferSelect> {
		const where = isin
			? and(
					eq(firmDpHoldings.partnerId, FIRM_PARTNER_ID),
					eq(firmDpHoldings.isin, isin),
				)
			: and(
					eq(firmDpHoldings.partnerId, FIRM_PARTNER_ID),
					eq(firmDpHoldings.securityName, securityName),
				);

		const [existing] = await db
			.select()
			.from(firmDpHoldings)
			.where(where)
			.limit(1);
		if (existing) return existing;

		const [created] = await db
			.insert(firmDpHoldings)
			.values({
				partnerId: FIRM_PARTNER_ID,
				companyId: companyId ?? null,
				isin: isin ?? null,
				securityName,
				securityType,
				quantity: "0",
			})
			.returning();
		return created;
	}

	async updateHoldingPosition(
		holdingId: number,
		delta: number,
		pricePerShare?: number,
	): Promise<void> {
		const [holding] = await db
			.select()
			.from(firmDpHoldings)
			.where(eq(firmDpHoldings.id, holdingId))
			.limit(1);
		if (!holding) return;

		const currentQty = Number.parseFloat(holding.quantity ?? "0");
		const newQty = Math.max(0, currentQty + delta);

		let newAvgCost = holding.avgCostPrice
			? Number.parseFloat(holding.avgCostPrice)
			: 0;
		if (delta > 0 && pricePerShare) {
			// FIFO weighted average for buys
			const totalCost = currentQty * newAvgCost + delta * pricePerShare;
			newAvgCost = newQty > 0 ? totalCost / newQty : pricePerShare;
		}

		await db
			.update(firmDpHoldings)
			.set({
				quantity: newQty.toFixed(4),
				avgCostPrice: newAvgCost.toFixed(4),
				totalCostValue: (newQty * newAvgCost).toFixed(4),
				updatedAt: new Date(),
			})
			.where(eq(firmDpHoldings.id, holdingId));
	}

	async getAllHoldings(): Promise<(typeof firmDpHoldings.$inferSelect)[]> {
		return db
			.select()
			.from(firmDpHoldings)
			.where(eq(firmDpHoldings.partnerId, FIRM_PARTNER_ID))
			.orderBy(desc(firmDpHoldings.updatedAt));
	}

	// ── Transaction Recording ─────────────────────────────────────────────────

	async recordTransaction(
		input: FirmTxInput,
	): Promise<{ txId: number; syncResult: SyncResult }> {
		const holding = await this.getOrCreateHolding(
			input.securityName,
			input.isin,
			input.companyId,
		);

		const netValue = (input.totalValue + (input.charges ?? 0)).toFixed(4);

		const [tx] = await db
			.insert(firmTransactions)
			.values({
				partnerId: FIRM_PARTNER_ID,
				holdingId: holding.id,
				transactionType: input.transactionType,
				securityName: input.securityName,
				isin: input.isin ?? null,
				companyId: input.companyId ?? null,
				quantity: input.quantity.toFixed(4),
				pricePerShare: input.pricePerShare?.toFixed(4) ?? null,
				totalValue: input.totalValue.toFixed(4),
				charges: (input.charges ?? 0).toFixed(4),
				netValue,
				transactionDate: input.transactionDate,
				counterpartyName: input.counterpartyName ?? null,
				counterpartyId: input.counterpartyId ?? null,
				reference: input.reference ?? null,
				notes: input.notes ?? null,
				zohoStatus: "pending",
				createdBy: input.createdBy ?? null,
			})
			.returning();

		// Update holding quantity
		const qtyDelta = ["buy", "transfer_in", "dividend"].includes(
			input.transactionType,
		)
			? input.quantity
			: -input.quantity;
		await this.updateHoldingPosition(holding.id, qtyDelta, input.pricePerShare);

		// Attempt Zoho Books sync immediately
		const syncResult = await this.syncTransactionToZohoBooks(tx.id);
		return { txId: tx.id, syncResult };
	}

	// ── Zoho Books Sync (FintekPro → Zoho) ───────────────────────────────────

	async syncTransactionToZohoBooks(txId: number): Promise<SyncResult> {
		const [tx] = await db
			.select()
			.from(firmTransactions)
			.where(eq(firmTransactions.id, txId))
			.limit(1);
		if (!tx)
			return {
				success: false,
				transactionId: txId,
				error: "Transaction not found",
			};
		if (tx.zohoStatus === "synced")
			return { success: true, transactionId: txId, zohoRecordType: "skipped" };

		const zoho = await getZohoBooksService();
		if (!zoho) {
			await this._markSyncStatus(
				txId,
				"skipped",
				undefined,
				undefined,
				"Zoho Books not configured",
			);
			return {
				success: true,
				transactionId: txId,
				zohoRecordType: "skipped",
				error: "Zoho not configured",
			};
		}

		try {
			const date = tx.transactionDate;
			const qty = Number.parseFloat(tx.quantity ?? "1");
			const rate = Number.parseFloat(tx.pricePerShare ?? tx.netValue ?? "0");
			const itemName = tx.securityName;
			const ref = tx.reference ?? `FIRM-${txId}`;

			if (
				tx.transactionType === "buy" ||
				tx.transactionType === "transfer_in"
			) {
				// BUY = Bill (firm pays, gains inventory)
				const [holding] = tx.holdingId
					? await db
							.select()
							.from(firmDpHoldings)
							.where(eq(firmDpHoldings.id, tx.holdingId))
							.limit(1)
					: [];

				const zohoItemId = holding?.zohoItemId ?? undefined;

				const bill = await zoho.createBill({
					vendor_name: tx.counterpartyName || "DP Seller",
					reference_number: ref,
					date,
					line_items: [
						{
							item_id: zohoItemId,
							name: itemName,
							description: `Firm inventory purchase — ${qty} units @ ₹${rate} | ISIN: ${tx.isin ?? "N/A"}`,
							rate,
							quantity: qty,
						},
					],
					notes: tx.notes ?? `Firm DP holding acquisition: ${tx.securityName}`,
				});

				await this._ensureZohoItemLinked(tx.holdingId, itemName, rate, zoho);
				await this._markSyncStatus(
					txId,
					"synced",
					undefined,
					bill?.bill_id,
					null,
				);
				return {
					success: true,
					transactionId: txId,
					zohoRecordId: bill?.bill_id,
					zohoRecordType: "bill",
				};
			}
			if (
				tx.transactionType === "sell" ||
				tx.transactionType === "transfer_out"
			) {
				// SELL = Invoice (firm sells, gains cash)
				const [holding] = tx.holdingId
					? await db
							.select()
							.from(firmDpHoldings)
							.where(eq(firmDpHoldings.id, tx.holdingId))
							.limit(1)
					: [];

				const zohoItemId = holding?.zohoItemId ?? undefined;

				const invoice = await zoho.createInvoice({
					customer_name: tx.counterpartyName || "DP Buyer",
					reference_number: ref,
					date,
					line_items: [
						{
							item_id: zohoItemId,
							name: itemName,
							description: `Firm inventory sale — ${qty} units @ ₹${rate} | ISIN: ${tx.isin ?? "N/A"}`,
							rate,
							quantity: qty,
						},
					],
					notes: tx.notes ?? `Firm DP holding disposal: ${tx.securityName}`,
				});

				await this._markSyncStatus(
					txId,
					"synced",
					invoice?.invoice_id,
					undefined,
					null,
				);
				return {
					success: true,
					transactionId: txId,
					zohoRecordId: invoice?.invoice_id,
					zohoRecordType: "invoice",
				};
			}
			// dividend, fee, adjustment → skip Zoho sync (informational only)
			await this._markSyncStatus(txId, "skipped", undefined, undefined, null);
			return { success: true, transactionId: txId, zohoRecordType: "skipped" };
		} catch (err: any) {
			const errMsg = err?.message ?? String(err);
			console.error(
				"[FirmInventorySync] Zoho sync failed for tx",
				txId,
				errMsg,
			);
			await this._markSyncStatus(txId, "failed", undefined, undefined, errMsg);
			return { success: false, transactionId: txId, error: errMsg };
		}
	}

	// ── Zoho Books → FintekPro (inbound webhook handler) ─────────────────────

	async processZohoBooksBillPaid(
		zohoEventId: string,
		bill: {
			bill_id: string;
			vendor_name?: string;
			reference_number?: string;
			date: string;
			total: number;
			line_items?: Array<{ name: string; quantity: number; rate: number }>;
		},
	): Promise<void> {
		const exists = await db
			.select({ id: firmTransactions.id })
			.from(firmTransactions)
			.where(eq(firmTransactions.zohoBillId, bill.bill_id))
			.limit(1);
		if (exists.length > 0) return; // already recorded

		const firstItem = bill.line_items?.[0];
		if (!firstItem) return;

		await db.insert(firmTransactions).values({
			partnerId: FIRM_PARTNER_ID,
			transactionType: "buy",
			securityName: firstItem.name,
			quantity: firstItem.quantity.toFixed(4),
			pricePerShare: firstItem.rate.toFixed(4),
			totalValue: bill.total.toFixed(4),
			charges: "0",
			netValue: bill.total.toFixed(4),
			transactionDate: bill.date,
			counterpartyName: bill.vendor_name ?? "Unknown Vendor",
			reference: bill.reference_number ?? bill.bill_id,
			notes: "Imported from Zoho Books bill payment webhook",
			zohoStatus: "synced",
			zohoBillId: bill.bill_id,
			zohoSyncedAt: new Date(),
			zohoSourceEventId: zohoEventId,
		});
		console.log(
			`[FirmInventorySync] Created FintekPro tx from Zoho Bill ${bill.bill_id}`,
		);
	}

	async processZohoBooksInvoicePaid(
		zohoEventId: string,
		invoice: {
			invoice_id: string;
			customer_name?: string;
			reference_number?: string;
			date: string;
			total: number;
			line_items?: Array<{ name: string; quantity: number; rate: number }>;
		},
	): Promise<void> {
		const exists = await db
			.select({ id: firmTransactions.id })
			.from(firmTransactions)
			.where(eq(firmTransactions.zohoInvoiceId, invoice.invoice_id))
			.limit(1);
		if (exists.length > 0) return;

		const firstItem = invoice.line_items?.[0];
		if (!firstItem) return;

		await db.insert(firmTransactions).values({
			partnerId: FIRM_PARTNER_ID,
			transactionType: "sell",
			securityName: firstItem.name,
			quantity: firstItem.quantity.toFixed(4),
			pricePerShare: firstItem.rate.toFixed(4),
			totalValue: invoice.total.toFixed(4),
			charges: "0",
			netValue: invoice.total.toFixed(4),
			transactionDate: invoice.date,
			counterpartyName: invoice.customer_name ?? "Unknown Customer",
			reference: invoice.reference_number ?? invoice.invoice_id,
			notes: "Imported from Zoho Books invoice payment webhook",
			zohoStatus: "synced",
			zohoInvoiceId: invoice.invoice_id,
			zohoSyncedAt: new Date(),
			zohoSourceEventId: zohoEventId,
		});
		console.log(
			`[FirmInventorySync] Created FintekPro tx from Zoho Invoice ${invoice.invoice_id}`,
		);
	}

	// ── Book Balance Pull (Zoho → FintekPro) ─────────────────────────────────

	async getZohoBooksBalance(): Promise<{
		totalReceivables: number;
		totalPayables: number;
		netPosition: number;
		lastRefreshed: string;
	}> {
		const zoho = await getZohoBooksService();
		if (!zoho) {
			return {
				totalReceivables: 0,
				totalPayables: 0,
				netPosition: 0,
				lastRefreshed: new Date().toISOString(),
			};
		}
		const summary = await zoho.getDashboardSummary();
		return {
			totalReceivables: summary.totalReceivables,
			totalPayables: summary.totalPayables,
			netPosition: summary.totalReceivables - summary.totalPayables,
			lastRefreshed: new Date().toISOString(),
		};
	}

	// ── Pending Sync Retry ────────────────────────────────────────────────────

	async retryPendingSync(
		limit = 20,
	): Promise<{ retried: number; succeeded: number; failed: number }> {
		const pending = await db
			.select()
			.from(firmTransactions)
			.where(sql`${firmTransactions.zohoStatus} IN ('pending', 'failed')`)
			.orderBy(firmTransactions.createdAt)
			.limit(limit);

		let succeeded = 0,
			failed = 0;
		for (const tx of pending) {
			const result = await this.syncTransactionToZohoBooks(tx.id);
			if (result.success) succeeded++;
			else failed++;
		}
		return { retried: pending.length, succeeded, failed };
	}

	// ── Get transactions ──────────────────────────────────────────────────────

	async getTransactions(
		page = 1,
		limit = 50,
	): Promise<(typeof firmTransactions.$inferSelect)[]> {
		const offset = (page - 1) * limit;
		return db
			.select()
			.from(firmTransactions)
			.where(eq(firmTransactions.partnerId, FIRM_PARTNER_ID))
			.orderBy(desc(firmTransactions.createdAt))
			.limit(limit)
			.offset(offset);
	}

	// ── Private helpers ───────────────────────────────────────────────────────

	private async _markSyncStatus(
		txId: number,
		status: string,
		invoiceId?: string,
		billId?: string,
		error?: string | null,
	) {
		await db
			.update(firmTransactions)
			.set({
				zohoStatus: status,
				zohoInvoiceId: invoiceId ?? undefined,
				zohoBillId: billId ?? undefined,
				zohoSyncedAt: status === "synced" ? new Date() : undefined,
				zohoSyncError: error ?? null,
				updatedAt: new Date(),
			})
			.where(eq(firmTransactions.id, txId));
	}

	private async _ensureZohoItemLinked(
		holdingId: number | null | undefined,
		name: string,
		rate: number,
		zoho: Awaited<ReturnType<typeof getZohoBooksService>>,
	) {
		if (!holdingId || !zoho) return;
		const [holding] = await db
			.select()
			.from(firmDpHoldings)
			.where(eq(firmDpHoldings.id, holdingId))
			.limit(1);
		if (!holding || holding.zohoItemId) return;

		try {
			const item = await zoho.createItem({
				name,
				description: `Firm inventory — ${name}`,
				rate,
				sku: holding.isin ?? `FIRM-${holdingId}`,
				item_type: "inventory",
				product_type: "goods",
				initial_stock: Number.parseFloat(holding.quantity ?? "0"),
				initial_stock_rate: rate,
				purchase_rate: rate,
			});
			if (item?.item_id) {
				await db
					.update(firmDpHoldings)
					.set({
						zohoItemId: item.item_id,
						zohoItemSku: item.sku,
						lastZohoSyncAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(firmDpHoldings.id, holdingId));
			}
		} catch (e) {
			console.warn(
				"[FirmInventorySync] Could not create Zoho item for holding",
				holdingId,
				e,
			);
		}
	}
}

export const firmInventorySyncService = FirmInventorySyncService.getInstance();
