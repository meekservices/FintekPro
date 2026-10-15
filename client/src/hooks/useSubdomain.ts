import { useState, useEffect } from "react";

const KNOWN_SUBDOMAINS = ["admin", "partner", "ca"] as const;
type KnownSubdomain = (typeof KNOWN_SUBDOMAINS)[number];

function detectSubdomain(): string {
	const hostname = window.location.hostname.toLowerCase();
	const search = window.location.search;
	const pathname = window.location.pathname;
	const parts = hostname.split(".");

	// Immediate client-side 301-equivalent redirect if landing on legacy agent domain
	if (
		typeof window !== "undefined" &&
		(hostname === "agent.fintekpro.com" ||
			hostname.startsWith("agent.fintekpro."))
	) {
		window.location.replace(
			`https://partner.fintekpro.com${window.location.pathname}${window.location.search}`,
		);
		return "partner";
	}

	const urlParams = new URLSearchParams(search);
	const isReplitEnv =
		hostname.includes("replit.dev") || hostname.includes("replit.app");
	const isDev = import.meta.env.DEV || isReplitEnv;

	// PRIORITY 1: Query params — works in ALL environments
	if (urlParams.get("admin") === "true") {
		return "admin";
	}
	if (urlParams.get("ca") === "true") {
		return "ca";
	}
	if (urlParams.get("partner") === "true" || urlParams.get("agent") === "true") {
		return "partner";
	}

	// PRIORITY 2: Path-based portal detection — DEV / REPLIT ONLY
	if (isDev) {
		if (pathname.startsWith("/ca/") || pathname === "/ca") {
			return "ca";
		}
		if (
			pathname.startsWith("/agent/") ||
			pathname === "/agent" ||
			pathname.startsWith("/partner/") ||
			pathname === "/partner"
		) {
			return "partner";
		}
		if (pathname.startsWith("/admin/") || pathname === "/admin") {
			return "admin";
		}
	}

	// PRIORITY 3: Localhost subdomain detection
	if (hostname.includes("localhost")) {
		if (parts[0] === "admin") {
			return "admin";
		}
		if (parts[0] === "ca") {
			return "ca";
		}
		if (parts[0] === "partner" || parts[0] === "agent") {
			return "partner";
		}
		return "";
	}

	// PRIORITY 4: Production subdomain detection (admin.fintekpro.com, ca.fintekpro.com, partner.fintekpro.com)
	const firstPart = parts[0] === "agent" ? "partner" : parts[0];
	if (
		parts.length >= 2 &&
		KNOWN_SUBDOMAINS.includes(firstPart as KnownSubdomain)
	) {
		return firstPart;
	}

	// PRIORITY 5: Fallback pattern matching
	if (hostname.startsWith("agent.") || hostname.startsWith("agent-")) {
		return "partner";
	}
	for (const sub of KNOWN_SUBDOMAINS) {
		if (hostname.startsWith(`${sub}.`) || hostname.startsWith(`${sub}-`)) {
			return sub;
		}
	}

	return "";
}

export function getPortalQueryParams(): string {
	const urlParams = new URLSearchParams(window.location.search);
	const adminParam = urlParams.get("admin");
	const caParam = urlParams.get("ca");
	const partnerParam = urlParams.get("partner") || urlParams.get("agent");

	if (adminParam === "true") return "?admin=true";
	if (caParam === "true") return "?ca=true";
	if (partnerParam === "true") return "?partner=true";
	return "";
}

export function withPortalParams(path: string): string {
	const portalParams = getPortalQueryParams();
	if (!portalParams) return path;

	if (path.includes("?")) {
		return path + "&" + portalParams.substring(1);
	}
	return path + portalParams;
}

export function useSubdomain() {
	// Use state to ensure re-render when subdomain is detected
	const [subdomain, setSubdomain] = useState<string>(() => detectSubdomain());
	const [currentSearch, setCurrentSearch] = useState(
		() => window.location.search,
	);

	const isDev =
		import.meta.env.DEV ||
		window.location.hostname.includes("replit.dev") ||
		window.location.hostname.includes("replit.app");
	const isLocalhost = window.location.hostname.includes("localhost");

	useEffect(() => {
		const detected = detectSubdomain();
		if (detected !== subdomain) {
			setSubdomain(detected);
		}

		// Listen for popstate events (back/forward navigation)
		const handlePopState = () => {
			const newSubdomain = detectSubdomain();
			setSubdomain(newSubdomain);
			setCurrentSearch(window.location.search);
		};

		// Polling strategy:
		// - In DEV/localhost: watch the full path+search because path-based portal detection is active.
		// - In PRODUCTION: the subdomain is determined from the hostname (e.g. agent.fintekpro.com)
		//   and never changes during navigation. We only need to watch ?admin/partner/agent query params,
		//   which can legitimately change when a user switches portals via the portal switcher.
		//   Polling the full pathname would cause /agent route on main domain to incorrectly re-trigger
		//   portal detection even with the isDev guard, if the subdomain was '' and path starts with /agent.
		const checkChange = () => {
			const newSearch = window.location.search;
			// In production on a non-subdomain host, ONLY re-detect if query params changed
			// (e.g. user clicked a portal switcher link that adds ?agent=true)
			if (isDev || isLocalhost) {
				// In dev, check path + search
				const newPath = window.location.pathname + window.location.search;
				const oldPath = window.location.pathname + currentSearch;
				if (newPath !== oldPath) {
					setCurrentSearch(newSearch);
					const newSubdomain = detectSubdomain();
					if (newSubdomain !== subdomain) {
						setSubdomain(newSubdomain);
					}
				}
			} else {
				// In production, only check search params (hostname-based subdomain never changes mid-session)
				if (newSearch !== currentSearch) {
					setCurrentSearch(newSearch);
					const newSubdomain = detectSubdomain();
					if (newSubdomain !== subdomain) {
						setSubdomain(newSubdomain);
					}
				}
			}
		};

		// Use 500ms polling interval - balances responsiveness with performance
		const interval = setInterval(checkChange, 500);

		window.addEventListener("popstate", handlePopState);
		return () => {
			window.removeEventListener("popstate", handlePopState);
			clearInterval(interval);
		};
	}, [subdomain, currentSearch, isDev, isLocalhost]);

	const isAdminPortal = subdomain === "admin";
	const isCaPortal = subdomain === "ca";
	const isPartnerPortal = subdomain === "partner";
	const isAgentPortal = isPartnerPortal; // Legacy alias mapped directly to partner portal

	return {
		subdomain,
		isAdminPortal,
		isCaPortal,
		isPartnerPortal,
		isAgentPortal,
		isClientPortal:
			!isAdminPortal && !isCaPortal && !isPartnerPortal,
		withPortalParams,
	};
}
