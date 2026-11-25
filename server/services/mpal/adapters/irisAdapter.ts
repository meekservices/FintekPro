/**
 * MPAL — IrisAdapter
 *
 * Purpose : Bridges the MPAL IBroker interface to FintekPro's IRIS KFintech
 *           service for mutual fund, NFO, and fixed deposit operations.
 *           Capabilities: MF, NFO, FD, PMS, AIF.
 */

import {
	BrokerCapability,
	BrokerOrder,
	BrokerOrderResult,
	BrokerHealthStatus,
	NormalizedPosition,
	BrokerCapabilityError,
	BrokerError,
} from "../interfaces/IBroker";
import { BaseBroker } from "../core/BaseBroker";
import { irisKfintechService } from "../../iris-kfintech-service";
import { logger } from "../../../logger";

export class IrisAdapter extends BaseBroker {
	public readonly brokerId = "IRIS";
	public readonly capabilities: readonly BrokerCapability[] = [
		"MF",
		"NFO",
		"FD",
		"PMS",
		"AIF",
	];

	/**
	 * True when IRIS_API_KEY / IRIS_CLIENT_ID env vars are set.
	 * Delegates to irisKfintechService.isConfigured property.
	 */
	isConfigured(): boolean {
		return !!(irisKfintechService as any).isConfigured;
	}

	/**
	 * Health probe: attempts a lightweight IRIS API call.
	 * Returns { healthy: false } if unconfigured — never throws.
	 */
	async healthCheck(timeoutMs = 3000): Promise<BrokerHealthStatus> {
		const checkedAt = new Date().toISOString();
		if (!this.isConfigured()) {
			return {
				brokerId: this.brokerId,
				configured: false,
				healthy: false,
				message: "IRIS not configured",
				checkedAt,
			};
		}
		const start = Date.now();
		try {
			// Lightweight call — fetch funds list to verify API reachability
			await irisKfintechService.getAllFunds();
			return {
				brokerId: this.brokerId,
				configured: true,
				healthy: true,
				latencyMs: Date.now() - start,
				checkedAt,
			};
		} catch (err: any) {
			return {
				brokerId: this.brokerId,
				configured: true,
				healthy: false,
				latencyMs: Date.now() - start,
				message: err?.message,
				checkedAt,
			};
		}
	}

	/**
	 * IRIS investor onboarding is handled by the existing KYC/onboarding flow.
	 * This returns the existing investor ID.
	 */
	async createAccount(user: {
		id: string;
		irisInvestorId?: string;
		[key: string]: unknown;
	}): Promise<any> {
		logger.info(
			`[IrisAdapter] createAccount — handled by KYC onboarding flow`,
			{ event: "IRIS_CREATE_ACCOUNT", user_id: user.id, status: "active" },
		);
		return {
			status: "ACTIVE",
			providerAccountId: user.irisInvestorId ?? user.id,
		};
	}

	/**
	 * Returns normalised MF/FD holdings for the IRIS investor ID.
	 * TODO: Map irisKfintechService portfolio response to NormalizedPosition[].
	 */
	async getPositions(investorId: string): Promise<NormalizedPosition[]> {
		if (!this.isConfigured()) return [];
		logger.info(`[IrisAdapter] getPositions`, {
			event: "IRIS_GET_POSITIONS",
			user_id: investorId,
		});
		// TODO: const holdings = await irisKfintechService.getPortfolio(investorId);
		// return holdings.map(normalizeIrisHolding);
		return [];
	}

	/**
	 * Places an MF purchase / redemption / SIP order via IRIS.
	 * TODO: Map BrokerOrder to IRIS transaction payload.
	 */
	async placeOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
		if (!this.isConfigured()) {
			throw new BrokerError(
				this.brokerId,
				"IRIS_NOT_CONFIGURED",
				"IRIS not configured.",
				false,
			);
		}
		logger.warn(`[IrisAdapter] placeOrder blocked — adapter not wired`, {
			event: "IRIS_PLACE_ORDER_UNIMPLEMENTED",
			user_id: order.userId,
			symbol: order.symbol,
			side: order.side,
		});
		throw new BrokerError(
			this.brokerId,
			"IRIS_ADAPTER_NOT_IMPLEMENTED",
			"IRIS order placement is not yet wired to irisKfintechService.placeTransaction()",
			false,
		);
	}

	/**
	 * Notional orders are the primary mode for MF SIPs (invest ₹5000 in SCHEME_X).
	 */
	async placeNotionalOrder(
		userId: string,
		symbol: string,
		notional: number,
		side: "buy" | "sell",
	): Promise<BrokerOrderResult> {
		if (!this.isConfigured()) {
			throw new BrokerError(
				this.brokerId,
				"IRIS_NOT_CONFIGURED",
				"IRIS not configured.",
				false,
			);
		}
		logger.warn(`[IrisAdapter] placeNotionalOrder blocked — adapter not wired`, {
			event: "IRIS_NOTIONAL_ORDER_UNIMPLEMENTED",
			user_id: userId,
			symbol,
			notional,
			side,
		});
		throw new BrokerError(
			this.brokerId,
			"IRIS_ADAPTER_NOT_IMPLEMENTED",
			"IRIS notional order placement is not yet wired to irisKfintechService.placeSip()",
			false,
		);
	}
}

export const irisAdapter = new IrisAdapter();
