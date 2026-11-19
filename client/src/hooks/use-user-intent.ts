/**
 * User Intent & Predictive Pre-Warming Hook
 *
 * Client-side sensor for predictive pre-warming in FintekPro.
 * Sends lightweight, non-blocking telemetry signals to /api/user-intent/signal
 * so that the server can pre-warm Golden Prices, risk suitability, and technical indicators.
 *
 * Compliance: DPDP Act 2023 (Sec 6), FASP-AI v1.0
 */

import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export type UserIntentType =
	| "SESSION_INITIALIZED"
	| "INSTRUMENT_FOCUS"
	| "PORTFOLIO_DRIFT_SCAN"
	| "TAX_HARVEST_INTENT"
	| "WATCHLIST_INTERACTION";

interface EmitIntentOptions {
	intentType: UserIntentType;
	symbol?: string;
	isin?: string;
	assetClass?: string;
	consentGranted?: boolean;
}

export function useUserIntent() {
	const emitSignal = useCallback((options: EmitIntentOptions) => {
		try {
			const payload = JSON.stringify({
				intentType: options.intentType,
				symbol: options.symbol,
				isin: options.isin,
				assetClass: options.assetClass,
				consentGranted: options.consentGranted ?? true,
			});

			// Non-blocking fire-and-forget delivery
			if (typeof window !== "undefined") {
				fetch("/api/user-intent/signal", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: payload,
					keepalive: true,
				}).catch(() => {
					/* ignore transient telemetry errors */
				});
			}
		} catch {
			/* ignore non-critical errors */
		}
	}, []);

	const notifyInstrumentFocus = useCallback(
		(symbol: string, isin?: string) => {
			if (!symbol) return;
			emitSignal({
				intentType: "INSTRUMENT_FOCUS",
				symbol,
				isin,
			});
		},
		[emitSignal]
	);

	const notifyPortfolioScan = useCallback(() => {
		emitSignal({
			intentType: "PORTFOLIO_DRIFT_SCAN",
		});
	}, [emitSignal]);

	const notifySessionInit = useCallback(() => {
		emitSignal({
			intentType: "SESSION_INITIALIZED",
		});
	}, [emitSignal]);

	// Auto-trigger SESSION_INITIALIZED once on component mount if desired
	useEffect(() => {
		notifySessionInit();
	}, [notifySessionInit]);

	return {
		emitSignal,
		notifyInstrumentFocus,
		notifyPortfolioScan,
		notifySessionInit,
	};
}

/**
 * React Query hook to consume pre-warmed context instantly on dashboards or portfolio views.
 */
export function usePrewarmedContext() {
	return useQuery({
		queryKey: ["/api/user-intent/prewarmed"],
		queryFn: async () => {
			const res = await fetch("/api/user-intent/prewarmed");
			if (!res.ok) throw new Error("Failed to load pre-warmed context");
			return res.json();
		},
		staleTime: 5 * 60 * 1000, // 5 minutes fresh
		refetchOnWindowFocus: false,
	});
}
