/**
 * MPAL — ProviderRegistry
 *
 * Purpose : Central registry for all broker and credit provider adapters.
 *           Provides capability-based lookup so the router never needs to
 *           know which broker handles which asset class — brokers self-declare.
 *
 * Adding a new broker (e.g. Zerodha, Angel One, HDFC Securities):
 *   1. Create `adapters/zerodhaAdapter.ts` extending BaseBroker
 *   2. Add one line here:  this.brokers.set(zerodhaAdapter.brokerId, zerodhaAdapter);
 *   3. Add webhook case in WebhookDispatcher — done.
 *      No changes needed in InvestmentRouter or API routes.
 *
 * Edge cases:
 *   - getBroker()         throws BrokerNotFoundError if ID unknown
 *   - getBroker()         throws BrokerNotConfiguredError if env vars missing
 *   - getCapableBrokers() returns [] (not throws) if none configured
 */

import {
	IBroker,
	BrokerCapability,
	BrokerNotFoundError,
	BrokerNotConfiguredError,
} from "../interfaces/IBroker";
import { ICreditProvider } from "../interfaces/ICreditProvider";

import { alpacaAdapter } from "../adapters/alpacaAdapter";
import { iiflAdapter } from "../adapters/iiflAdapter";
import { irisAdapter } from "../adapters/irisAdapter";
import { m2pAdapter } from "../adapters/bankAdapters/m2pAdapter";
import { setuAdapter } from "../adapters/bankAdapters/setuAdapter";
import { directBankAdapter } from "../adapters/bankAdapters/directBankAdapter";

export class ProviderRegistry {
	private brokers: Map<string, IBroker> = new Map();
	private creditProviders: Map<string, ICreditProvider> = new Map();

	constructor() {
		this.registerBrokers();
		this.registerCreditProviders();
	}

	// ─── Registration ─────────────────────────────────────────────────────────

	private registerBrokers() {
		// Order matters for capability-based fallback: preferred broker first.
		// ALPACA → US equities (configured only when ALPACA_API_KEY is set)
		this.brokers.set(alpacaAdapter.brokerId, alpacaAdapter);
		// IIFL → Indian equities & F&O (configured only when IIFL_API_KEY + IIFL_CLIENT_ID set)
		this.brokers.set(iiflAdapter.brokerId, iiflAdapter);
		// IRIS → MF / NFO / FD / PMS / AIF (configured only when IRIS_API_KEY set)
		this.brokers.set(irisAdapter.brokerId, irisAdapter);

		// ── Add future brokers here — one line each ───────────────────────────
		// this.brokers.set(zerodhaAdapter.brokerId, zerodhaAdapter);
		// this.brokers.set(angelOneAdapter.brokerId, angelOneAdapter);
		// this.brokers.set(hdfcSecuritiesAdapter.brokerId, hdfcSecuritiesAdapter);
		// ────────────────────────────────────────────────────────────────────────
	}

	private registerCreditProviders() {
		this.creditProviders.set(m2pAdapter.providerId, m2pAdapter);
		this.creditProviders.set(setuAdapter.providerId, setuAdapter);
		this.creditProviders.set(directBankAdapter.providerId, directBankAdapter);
	}

	// ─── Broker Lookup ────────────────────────────────────────────────────────

	/**
	 * Returns a specific broker by ID.
	 * Throws BrokerNotFoundError    if the broker ID is unknown.
	 * Throws BrokerNotConfiguredError if the broker lacks credentials.
	 *
	 * Use getCapableBrokers() when you want capability-based routing
	 * with graceful fallback instead of hard failures.
	 */
	getBroker(brokerId: string): IBroker {
		const broker = this.brokers.get(brokerId);
		if (!broker) throw new BrokerNotFoundError(brokerId);
		if (!broker.isConfigured()) throw new BrokerNotConfiguredError(brokerId);
		return broker;
	}

	/**
	 * Returns all registered brokers that:
	 *   (a) declare the requested capability, AND
	 *   (b) are currently configured (env vars present).
	 *
	 * Returns [] (not throws) when no broker qualifies — let the caller decide
	 * whether to 503 or fall back.
	 *
	 * @param capability  e.g. 'EQUITY_IN', 'MF', 'EQUITY_US'
	 */
	getCapableBrokers(capability: BrokerCapability): IBroker[] {
		return [...this.brokers.values()].filter(
			(b) => b.capabilities.includes(capability) && b.isConfigured(),
		);
	}

	/**
	 * Returns all registered brokers regardless of configuration state.
	 * Used by the health check API to show configured/unconfigured status.
	 */
	getAllBrokers(): IBroker[] {
		return [...this.brokers.values()];
	}

	// ─── Credit Provider Lookup ───────────────────────────────────────────────

	getCreditProvider(providerId: string): ICreditProvider {
		const provider = this.creditProviders.get(providerId);
		if (!provider)
			throw new Error(`Credit Provider ${providerId} not found in registry.`);
		return provider;
	}

	getAllCreditProviders(): ICreditProvider[] {
		return Array.from(this.creditProviders.values());
	}
}

export const providerRegistry = new ProviderRegistry();
