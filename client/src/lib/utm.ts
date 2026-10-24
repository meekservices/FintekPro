/**
 * UTM & Marketing Attribution Tracker v1.0
 *
 * Captures, persists, and attaches marketing parameters:
 *   - utm_source, utm_medium, utm_campaign, utm_term, utm_content
 *   - ref (referral code)
 *   - gclid, fbclid (ad click IDs)
 *
 * Persists in sessionStorage & localStorage to attribute signups, leads, and forms.
 */

export interface MarketingAttribution {
	utm_source?: string;
	utm_medium?: string;
	utm_campaign?: string;
	utm_term?: string;
	utm_content?: string;
	ref?: string;
	gclid?: string;
	fbclid?: string;
	landing_page?: string;
	first_seen_at?: string;
}

const STORAGE_KEY = "fintekpro_marketing_attribution";

export function initMarketingAttribution(): MarketingAttribution {
	if (typeof window === "undefined") return {};

	try {
		const params = new URLSearchParams(window.location.search);
		const current: MarketingAttribution = {};

		const keys: (keyof MarketingAttribution)[] = [
			"utm_source",
			"utm_medium",
			"utm_campaign",
			"utm_term",
			"utm_content",
			"ref",
			"gclid",
			"fbclid",
		];

		let hasNewParams = false;
		for (const key of keys) {
			const val = params.get(key);
			if (val) {
				current[key] = val;
				hasNewParams = true;
			}
		}

		if (hasNewParams) {
			current.landing_page = window.location.pathname;
			current.first_seen_at = new Date().toISOString();

			// Store in both session and local storage
			const serialized = JSON.stringify(current);
			sessionStorage.setItem(STORAGE_KEY, serialized);
			localStorage.setItem(STORAGE_KEY, serialized);
			return current;
		}

		// Fallback to existing stored attribution
		const stored =
			sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (e) {
		console.warn("[Attribution] Error capturing UTM params:", e);
	}

	return {};
}

export function getMarketingAttribution(): MarketingAttribution {
	if (typeof window === "undefined") return {};
	try {
		const stored =
			sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored);
	} catch {}
	return {};
}

/**
 * Helper to attach UTM parameters to registration/lead payload
 */
export function attachAttributionToPayload<T extends Record<string, any>>(
	payload: T,
): T & MarketingAttribution {
	const attr = getMarketingAttribution();
	return {
		...payload,
		...attr,
	};
}
