import { useEffect } from "react";
import { usePortalMeta } from "./PortalLogo";

function hexToHsl(hex: string): string {
	const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
	const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
	const b = Number.parseInt(hex.slice(5, 7), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}

	return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function PortalThemeProvider({
	children,
}: { children: React.ReactNode }) {
	const { data: meta } = usePortalMeta();

	useEffect(() => {
		if (!meta || meta.portal_type === "main") return;

		const root = document.documentElement;
		const primaryHsl = hexToHsl(meta.primary_color);
		root.style.setProperty("--portal-primary", primaryHsl);
		root.style.setProperty("--portal-primary-hex", meta.primary_color);
		root.style.setProperty("--portal-accent-hex", meta.accent_color);
		root.style.setProperty("--portal-sidebar-bg", meta.sidebar_bg);
		root.style.setProperty("--portal-sidebar-text", meta.sidebar_text);
		root.setAttribute("data-portal", meta.portal_type);

		return () => {
			root.style.removeProperty("--portal-primary");
			root.style.removeProperty("--portal-primary-hex");
			root.style.removeProperty("--portal-accent-hex");
			root.style.removeProperty("--portal-sidebar-bg");
			root.style.removeProperty("--portal-sidebar-text");
			root.removeAttribute("data-portal");
		};
	}, [meta]);

	return <>{children}</>;
}
