import {
	CASHolding,
	CASTransaction,
	parseCASDate,
} from "./cas-statement-service";
import {
	holdingLotsStorageService,
	LotStorageInput,
} from "./holding-lots-storage-service";

/**
 * Epic 2: FIFO Lot Ledger Engine
 *
 * Converts CAS transactions into FIFO-compliant investment lots
 * for accurate capital gains and exit load calculations.
 */

/**
 * Epic 2.1: Normalized transaction types
 */
export type NormalizedTransactionType =
	| "purchase"
	| "sip_purchase"
	| "switch_in"
	| "bonus"
	| "reinvestment"
	| "redemption"
	| "switch_out"
	| "dividend"
	| "stt"
	| "metadata" // Non-financial rows to ignore
	| "other";

/**
 * Normalized transaction for lot processing
 */
export interface NormalizedTransaction {
	id: string;
	originalType: string;
	normalizedType: NormalizedTransactionType;
	date: Date;
	dateStr: string;
	units: number;
	nav: number;
	amount: number;
	isCredit: boolean; // true = units added, false = units removed
	description: string;
	stampDuty?: number;
	balanceAfter?: number;
}

/**
 * Investment lot created from purchase transactions
 */
export interface InvestmentLot {
	id: string;
	isin: string;
	folioNumber: string;
	schemeName: string;
	purchaseDate: Date;
	purchaseDateStr: string;
	transactionType: NormalizedTransactionType;
	originalUnits: number;
	remainingUnits: number;
	purchaseNav: number;
	costPerUnit: number;
	totalCost: number;
	stampDuty: number;
	status: "active" | "partial" | "fully_sold";
	sourceTransactionId: string;
	consumptionHistory: LotConsumption[];
}

/**
 * Record of lot consumption (for audit trail)
 */
export interface LotConsumption {
	redemptionTransactionId: string;
	redemptionDate: Date;
	unitsConsumed: number;
	saleNav: number;
	saleAmount: number;
	realizedGain: number;
	holdingPeriodDays: number;
	capitalGainsType: "stcg" | "ltcg";
}

/**
 * Lot ledger result after processing all transactions
 */
export interface LotLedgerResult {
	success: boolean;
	isin: string;
	folioNumber: string;
	schemeName: string;

	// Normalized transactions
	transactions: {
		total: number;
		purchases: number;
		redemptions: number;
		ignored: number;
	};

	// Lot summary
	lots: InvestmentLot[];
	totalActiveLots: number;
	totalRemainingUnits: number;
	totalCost: number;

	// Epic 2.3: Closing balance reconciliation
	reconciliation: {
		passed: boolean;
		expectedBalance: number; // From CAS closing balance
		calculatedBalance: number; // SUM(lot.remainingUnits)
		delta: number;
		deltaPercent: number;
		warning?: string;
	};

	warnings: string[];
	errors: string[];
}

/**
 * Metadata row patterns to ignore
 */
const METADATA_PATTERNS = [
	/address\s*update/i,
	/broker\s*change/i,
	/change\s*of\s*broker/i,
	/nominee\s*registration/i,
	/nominee\s*update/i,
	/kyc\s*update/i,
	/pan\s*update/i,
	/email\s*update/i,
	/mobile\s*update/i,
	/bank\s*mandate/i,
	/nach\s*registration/i,
	/cancellation/i,
	/rejection/i,
	/reversal/i,
	/stamp\s*duty/i, // These are fees, not transactions
	/\*{3,}/, // Footnote markers
];

class FIFOLotLedgerService {
	private static instance: FIFOLotLedgerService;

	private constructor() {
		console.log("✅ FIFO Lot Ledger Service initialized");
	}

	static getInstance(): FIFOLotLedgerService {
		if (!FIFOLotLedgerService.instance) {
			FIFOLotLedgerService.instance = new FIFOLotLedgerService();
		}
		return FIFOLotLedgerService.instance;
	}

	/**
	 * Epic 2.1: Normalize a CAS transaction
	 */
	normalizeTransaction(txn: CASTransaction): NormalizedTransaction {
		const parsedDate = parseCASDate(txn.transactionDate);
		const normalizedType = this.classifyTransactionType(
			txn.transactionType,
			txn.description,
		);

		return {
			id: txn.id,
			originalType: txn.transactionType,
			normalizedType,
			date: parsedDate || new Date(),
			dateStr: txn.transactionDate,
			units: Math.abs(txn.units),
			nav: txn.nav,
			amount: txn.amount,
			isCredit: txn.isCredit,
			description: txn.description,
			stampDuty: txn.stampDuty,
			balanceAfter: txn.balance,
		};
	}

	/**
	 * Epic 2.1: Classify transaction into normalized type
	 */
	private classifyTransactionType(
		type: string,
		description: string,
	): NormalizedTransactionType {
		const desc = (description || "").toLowerCase();
		const txnType = (type || "").toLowerCase();

		// Check for metadata rows first
		for (const pattern of METADATA_PATTERNS) {
			if (pattern.test(desc)) {
				return "metadata";
			}
		}

		// Classify financial transactions
		if (
			txnType === "sip" ||
			/systematic investment/i.test(desc) ||
			/sip/i.test(desc)
		) {
			return "sip_purchase";
		}
		if (txnType === "purchase" || /purchase/i.test(desc)) {
			return "purchase";
		}
		if (
			txnType === "switch in" ||
			/switch[\s-]*in/i.test(desc) ||
			/transfer[\s-]*in/i.test(desc)
		) {
			return "switch_in";
		}
		if (txnType === "bonus" || /bonus/i.test(desc)) {
			return "bonus";
		}
		if (
			txnType === "reinvestment" ||
			/reinvest/i.test(desc) ||
			/dividend.*reinvest/i.test(desc)
		) {
			return "reinvestment";
		}
		if (txnType === "redemption" || /redemption/i.test(desc)) {
			return "redemption";
		}
		if (
			txnType === "switch out" ||
			/switch[\s-]*out/i.test(desc) ||
			/transfer[\s-]*out/i.test(desc)
		) {
			return "switch_out";
		}
		if (txnType === "dividend" || /dividend/i.test(desc)) {
			return "dividend";
		}
		if (txnType === "stt" || /stt/i.test(desc)) {
			return "stt";
		}

		return "other";
	}

	/**
	 * Epic 2.2: Process all transactions for a holding and build lot ledger
	 */
	buildLotLedger(holding: CASHolding): LotLedgerResult {
		const result: LotLedgerResult = {
			success: false,
			isin: holding.isin,
			folioNumber: holding.folioNumber,
			schemeName: holding.schemeName,
			transactions: { total: 0, purchases: 0, redemptions: 0, ignored: 0 },
			lots: [],
			totalActiveLots: 0,
			totalRemainingUnits: 0,
			totalCost: 0,
			reconciliation: {
				passed: false,
				expectedBalance: holding.unitBalance,
				calculatedBalance: 0,
				delta: 0,
				deltaPercent: 0,
			},
			warnings: [],
			errors: [],
		};

		try {
			// Step 1: Normalize and sort transactions by date (oldest first for FIFO)
			const normalizedTxns = holding.transactions
				.map((txn) => this.normalizeTransaction(txn))
				.filter((txn) => {
					if (txn.normalizedType === "metadata") {
						result.transactions.ignored++;
						return false;
					}
					return true;
				})
				.sort((a, b) => a.date.getTime() - b.date.getTime());

			result.transactions.total = holding.transactions.length;

			// Step 2: Process each transaction in chronological order
			const lots: InvestmentLot[] = [];
			let lotCounter = 0;

			for (const txn of normalizedTxns) {
				if (this.isPurchaseType(txn.normalizedType)) {
					// Create new lot
					const lot = this.createLotFromPurchase(txn, holding, lotCounter++);
					lots.push(lot);
					result.transactions.purchases++;
				} else if (this.isRedemptionType(txn.normalizedType)) {
					// Consume lots via FIFO
					this.consumeLotsForRedemption(txn, lots, result.warnings);
					result.transactions.redemptions++;
				}
				// Dividends and STT don't affect unit balance
			}

			result.lots = lots;

			// Step 3: Calculate summary
			result.totalActiveLots = lots.filter(
				(l) => l.status !== "fully_sold",
			).length;
			result.totalRemainingUnits = lots.reduce(
				(sum, l) => sum + l.remainingUnits,
				0,
			);
			result.totalCost = lots
				.filter((l) => l.status !== "fully_sold")
				.reduce((sum, l) => sum + l.costPerUnit * l.remainingUnits, 0);

			// Epic 2.3: Reconcile closing balance
			result.reconciliation = this.reconcileClosingBalance(
				result.totalRemainingUnits,
				holding.unitBalance,
				holding.openingUnitBalance,
			);

			result.success = true;

			console.log(
				`[FIFO Ledger] ${holding.isin}: ${lots.length} lots, ${result.totalActiveLots} active, ${result.totalRemainingUnits.toFixed(3)} units remaining`,
			);
		} catch (error: any) {
			result.errors.push(`Lot ledger build failed: ${error.message}`);
			console.error(`[FIFO Ledger] Error for ${holding.isin}:`, error);
		}

		return result;
	}

	/**
	 * Check if transaction type creates new units
	 */
	private isPurchaseType(type: NormalizedTransactionType): boolean {
		return [
			"purchase",
			"sip_purchase",
			"switch_in",
			"bonus",
			"reinvestment",
		].includes(type);
	}

	/**
	 * Check if transaction type consumes units
	 */
	private isRedemptionType(type: NormalizedTransactionType): boolean {
		return ["redemption", "switch_out"].includes(type);
	}

	/**
	 * Epic 2.2: Create investment lot from purchase transaction
	 */
	private createLotFromPurchase(
		txn: NormalizedTransaction,
		holding: CASHolding,
		index: number,
	): InvestmentLot {
		const costPerUnit = txn.nav > 0 ? txn.nav : txn.amount / txn.units || 0;

		return {
			id: `lot-${holding.isin}-${holding.folioNumber}-${index}`,
			isin: holding.isin,
			folioNumber: holding.folioNumber,
			schemeName: holding.schemeName,
			purchaseDate: txn.date,
			purchaseDateStr: txn.dateStr,
			transactionType: txn.normalizedType,
			originalUnits: txn.units,
			remainingUnits: txn.units,
			purchaseNav: txn.nav,
			costPerUnit,
			totalCost: costPerUnit * txn.units,
			stampDuty: txn.stampDuty || 0,
			status: "active",
			sourceTransactionId: txn.id,
			consumptionHistory: [],
		};
	}

	/**
	 * Epic 2.2: FIFO consumption of lots for redemption
	 */
	private consumeLotsForRedemption(
		txn: NormalizedTransaction,
		lots: InvestmentLot[],
		warnings: string[],
	): void {
		let unitsToRedeem = txn.units;

		// Get active lots sorted by purchase date (FIFO order)
		const activeLots = lots
			.filter((l) => l.status !== "fully_sold" && l.remainingUnits > 0)
			.sort((a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime());

		for (const lot of activeLots) {
			if (unitsToRedeem <= 0) break;

			const unitsFromThisLot = Math.min(lot.remainingUnits, unitsToRedeem);

			// Calculate holding period
			const holdingPeriodDays = Math.floor(
				(txn.date.getTime() - lot.purchaseDate.getTime()) /
					(1000 * 60 * 60 * 24),
			);

			// Determine capital gains type (equity: 365 days for LTCG)
			const capitalGainsType: "stcg" | "ltcg" =
				holdingPeriodDays >= 365 ? "ltcg" : "stcg";

			// Calculate realized gain
			const costBasis = lot.costPerUnit * unitsFromThisLot;
			const saleProceeds = txn.nav * unitsFromThisLot;
			const realizedGain = saleProceeds - costBasis;

			// Record consumption
			lot.consumptionHistory.push({
				redemptionTransactionId: txn.id,
				redemptionDate: txn.date,
				unitsConsumed: unitsFromThisLot,
				saleNav: txn.nav,
				saleAmount: saleProceeds,
				realizedGain,
				holdingPeriodDays,
				capitalGainsType,
			});

			// Update lot
			lot.remainingUnits -= unitsFromThisLot;
			unitsToRedeem -= unitsFromThisLot;

			if (lot.remainingUnits <= 0.001) {
				// Small tolerance for floating point
				lot.remainingUnits = 0;
				lot.status = "fully_sold";
			} else {
				lot.status = "partial";
			}
		}

		// Check if we couldn't fully redeem (units from before CAS period)
		if (unitsToRedeem > 0.001) {
			warnings.push(
				`Redemption ${txn.id}: Could not find lots for ${unitsToRedeem.toFixed(3)} units - may be from before CAS period`,
			);
		}
	}

	/**
	 * Epic 2.3: Reconcile calculated balance with CAS closing balance
	 */
	private reconcileClosingBalance(
		calculatedBalance: number,
		expectedBalance: number,
		openingBalance: number,
	): LotLedgerResult["reconciliation"] {
		const delta = Math.abs(calculatedBalance - expectedBalance);
		const deltaPercent =
			expectedBalance > 0 ? (delta / expectedBalance) * 100 : 0;

		// If opening balance exists and calculated is 0, we don't have full transaction history
		const hasPartialHistory =
			openingBalance > 0 && calculatedBalance < expectedBalance;

		let passed = true;
		let warning: string | undefined;

		if (hasPartialHistory) {
			// Opening balance exists - we don't have full history, but that's expected
			passed = true;
			warning = `Opening balance ${openingBalance.toFixed(3)} indicates partial transaction history`;
		} else if (deltaPercent > 1) {
			passed = false;
			warning = `LOT_RECONCILIATION_WARNING: Calculated ${calculatedBalance.toFixed(3)} vs Expected ${expectedBalance.toFixed(3)} (${deltaPercent.toFixed(2)}% delta)`;
		} else if (delta > 0.01) {
			warning = `Minor reconciliation delta: ${delta.toFixed(6)} units`;
		}

		console.log(
			`[FIFO Ledger] Reconciliation: Calculated ${calculatedBalance.toFixed(3)} vs Expected ${expectedBalance.toFixed(3)} (delta: ${delta.toFixed(6)})`,
		);

		return {
			passed,
			expectedBalance,
			calculatedBalance,
			delta,
			deltaPercent,
			warning,
		};
	}

	/**
	 * Process all holdings and build complete lot ledger
	 */
	processAllHoldings(holdings: CASHolding[]): {
		results: LotLedgerResult[];
		summary: {
			totalHoldings: number;
			successfulLedgers: number;
			totalLots: number;
			reconciledCount: number;
			warnings: string[];
		};
	} {
		const results: LotLedgerResult[] = [];
		const warnings: string[] = [];
		let totalLots = 0;
		let reconciledCount = 0;

		for (const holding of holdings) {
			const result = this.buildLotLedger(holding);
			results.push(result);
			totalLots += result.lots.length;

			if (result.reconciliation.passed) {
				reconciledCount++;
			}

			warnings.push(...result.warnings);
		}

		return {
			results,
			summary: {
				totalHoldings: holdings.length,
				successfulLedgers: results.filter((r) => r.success).length,
				totalLots,
				reconciledCount,
				warnings,
			},
		};
	}

	/**
	 * Convert lot ledger results to storage format for persistence
	 */
	convertToStorageFormat(
		result: LotLedgerResult,
		userId: string,
		portfolioId: string,
	): LotStorageInput[] {
		return result.lots
			.filter((lot) => lot.status !== "fully_sold") // Only persist active lots
			.map((lot) => ({
				portfolioId,
				userId,
				isin: lot.isin,
				folioNumber: lot.folioNumber,
				schemeName: lot.schemeName,
				purchaseDate: lot.purchaseDateStr,
				purchaseDateSource: "cas_transaction",
				purchaseDateConfidence: 1.0,
				transactionType: lot.transactionType,
				transactionId: lot.sourceTransactionId,
				units: lot.originalUnits,
				costPerUnit: lot.costPerUnit,
				totalCost: lot.totalCost,
				stampDuty: lot.stampDuty,
				purchaseNav: lot.purchaseNav,
				status: lot.status,
				remainingUnits: lot.remainingUnits,
			}));
	}

	/**
	 * Persist lot ledger to database
	 */
	async persistLotLedger(
		results: LotLedgerResult[],
		userId: string,
		portfolioId: string,
	): Promise<{ inserted: number; errors: string[] }> {
		const allLots: LotStorageInput[] = [];

		for (const result of results) {
			if (result.success) {
				const storageLots = this.convertToStorageFormat(
					result,
					userId,
					portfolioId,
				);
				allLots.push(...storageLots);
			}
		}

		if (allLots.length === 0) {
			return { inserted: 0, errors: [] };
		}

		console.log(`[FIFO Ledger] Persisting ${allLots.length} lots to database`);
		return holdingLotsStorageService.insertLots(allLots);
	}
}

export const fifoLotLedgerService = FIFOLotLedgerService.getInstance();
