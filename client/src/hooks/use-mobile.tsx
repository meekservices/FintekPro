import { useState, useEffect } from "react";

/**
 * Breakpoint for mobile detection.
 * Set to 1024px (lg) so PWA windows on Mac (which default to ~800–1024px)
 * still receive the full desktop layout.
 */
const MOBILE_BREAKPOINT = 1024;

/**
 * Returns true if the app is running as an installed PWA in standalone mode.
 * In standalone mode we always want the desktop layout, regardless of window width,
 * because the user intentionally installed the app as a desktop application.
 */
function isPwaStandalone(): boolean {
	return (
		window.matchMedia("(display-mode: standalone)").matches ||
		window.matchMedia("(display-mode: window-controls-overlay)").matches ||
		(window.navigator as any).standalone === true
	);
}

export function useIsMobile() {
	const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

	useEffect(() => {
		const evaluate = () => {
			// PWA standalone mode → always desktop layout
			if (isPwaStandalone()) {
				setIsMobile(false);
				return;
			}
			setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		};

		const widthMql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const standaloneMql = window.matchMedia("(display-mode: standalone)");

		widthMql.addEventListener("change", evaluate);
		standaloneMql.addEventListener("change", evaluate);

		evaluate();

		return () => {
			widthMql.removeEventListener("change", evaluate);
			standaloneMql.removeEventListener("change", evaluate);
		};
	}, []);

	return !!isMobile;
}
