/**
 * MPAL — InvestmentRouter
 *
 * Purpose : Routes investment operations (orders, positions, quotes) to the
 *           correct broker using capability-based selection — no hardcoded
 *           asset-class-to-broker mapping.
 *
 * How routing works:
 *   1. Caller passes a BrokerCapability (e.g. 'EQUITY_IN', 'MF')
 *   2. Router asks ProviderRegistry for all configured+capable brokers
 *   3. Uses the first one (priority is determined by registration order in registry)
 *   4. If preferredBrokerId is supplied, that broker is tried first (user preference)
 *   5. If none available → throws BrokerUnavailableError → caller sends HTTP 503
 *
 * Adding support for a new broker (e.g. Zerodha):
 *   → Only change: add zerodhaAdapter to providerRegistry.ts.
 *   → No changes needed here.
 */

import { providerRegistry } from "./providerRegistry";
import {
	BrokerCapability,
	BrokerOrder,
	BrokerOrderResult,
	BrokerUnavailableError,
	BrokerNotFoundError,
	BrokerNotConfiguredError,
} from "../interfaces/IBroker";
import { logger } from "../../../logger";

export class InvestmentRouter {
	// ─── Capability-based broker resolution ──────────────────────────────────

	/**
	 * Resolves the best available broker for a capability.
	 *
	 * Inputs:
	 *   - capability        : what asset class is needed
	 *   - preferredBrokerId : if set and configured, use this broker first
	 *
	 * Outputs: IBroker instance ready to use
	 *
	 * Edge cases:
	 *   - Preferred broker not configured → falls back to next capable broker
	 *   - No configured broker for capability → throws BrokerUnavailableError
	 */
	private resolveBroker(
		capability: BrokerCapability,
		preferredBrokerId?: string,
	) {
		// 1. Try explicit preference first
		if (preferredBrokerId) {
			try {
				const preferred = providerRegistry.getBroker(preferredBrokerId);
				if (preferred.capabilities.includes(capability)) return preferred;
			} catch (e) {
				if (
					!(
						e instanceof BrokerNotFoundError ||
						e instanceof BrokerNotConfiguredError
					)
				)
					throw e;
				logger.warn(
					`[InvestmentRouter] Preferred broker '${preferredBrokerId}' not available for '${capability}', falling back.`,
				);
			}
		}

		// 2. Pick first configured+capable broker from registry
		const capable = providerRegistry.getCapableBrokers(capability);
		if (capable.length === 0) {
			throw new BrokerUnavailableError(capability);
		}
		return capable[0];
	}

	// ─── Public API ───────────────────────────────────────────────────────────

	/**
	 * Resolves a broker ID string for a capability.
	 * Kept for backward compatibility with routes that pass assetClass strings.
	 */
	resolveBrokerId(assetClass: string, preferredBrokerId?: string): string {
		const cap = this.normalizeCapability(assetClass);
		return this.resolveBroker(cap, preferredBrokerId).brokerId;
	}

	/**
	 * Routes an order to the appropriate broker.
	 *
	 * Inputs  : capability, orderPayload, user, preferredBrokerId
	 * Outputs : BrokerOrderResult
	 * Edge cases: throws BrokerUnavailableError → route layer sends 503
	 */
	async executeOrder(
		assetClass: string,
		orderPayload: Omit<BrokerOrder, "userId" | "capability">,
		user: { id: string; [key: string]: unknown },
		preferredBrokerId?: string,
	): Promise<BrokerOrderResult> {
		const capability = this.normalizeCapability(assetClass);
		const broker = this.resolveBroker(capability, preferredBrokerId);
		logger.info(
			`[InvestmentRouter] Routing ${capability} order to ${broker.brokerId}`,
			{
				event: "ORDER_ROUTED",
				user_id: user.id,
				capability,
				brokerId: broker.brokerId,
			},
		);
		return broker.placeOrder({
			...orderPayload,
			userId: user.id,
			capability,
		} as BrokerOrder);
	}

	/**
	 * Fetches positions from the broker that handles the given asset class.
	 */
	async getPositions(
		assetClass: string,
		user: { id: string; [key: string]: unknown },
		preferredBrokerId?: string,
	) {
		const capability = this.normalizeCapability(assetClass);
		const broker = this.resolveBroker(capability, preferredBrokerId);
		return broker.getPositions(user.id);
	}

	/**
	 * Fetches a market quote.
	 * For US equities, delegates to Alpaca's quote service.
	 * For Indian equities (IIFL), returns a stub until IIFL market data is wired.
	 */
	async getQuote(assetClass: string, symbol: string) {
		const capability = this.normalizeCapability(assetClass);
		if (capability === "EQUITY_US") {
			const { quoteService } = await import("../../alpaca/market/quoteService");
			return quoteService.getQuotes([symbol]);
		}
		return {
			symbol,
			price: null,
			message: "Quote service not yet implemented for this asset class",
		};
	}

	/**
	 * Dispatches account creation to the appropriate broker.
	 */
	async routeAccountCreation(
		assetClass: string,
		user: { id: string; [key: string]: unknown },
		preferredBrokerId?: string,
	) {
		const capability = this.normalizeCapability(assetClass);
		const broker = this.resolveBroker(capability, preferredBrokerId);
		return broker.createAccount(user);
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────

	/**
	 * Normalises legacy assetClass strings to BrokerCapability.
	 * Backward-compatible with the old 'EQUITY_US' / 'EQUITY_IN' / 'MF' strings.
	 */
	private normalizeCapability(assetClass: string): BrokerCapability {
		const map: Record<string, BrokerCapability> = {
			EQUITY_US: "EQUITY_US",
			EQUITY_IN: "EQUITY_IN",
			FNO: "FNO",
			MF: "MF",
			NFO: "NFO",
			FD: "FD",
			PMS: "PMS",
			AIF: "AIF",
			BOND: "BOND",
			CRYPTO: "CRYPTO",
			NOTIONAL_ORDER: "NOTIONAL_ORDER",
			// Legacy aliases
			mutual_fund: "MF",
			mutual_funds: "MF",
			equity_us: "EQUITY_US",
			equity_in: "EQUITY_IN",
			us_equity: "EQUITY_US",
			etf: "EQUITY_US",
		};
		const cap = map[assetClass];
		if (!cap) {
			throw new Error(
				`Unknown assetClass '${assetClass}'. Must be one of: ${Object.keys(map).join(", ")}`,
			);
		}
		return cap;
	}
}

export const investmentRouter = new InvestmentRouter();
