import { logger } from "../logger";
import { Router, Request, Response } from "express";
import {
	PortalType,
	PORTAL_BRAND_CONFIG,
	resolvePortalType,
} from "@shared/portal";
import { db } from "../db";
import { portalAccessLog } from "@shared/schema";
import { sql } from "drizzle-orm";

const router = Router();

function generatePortalSvg(portalType: PortalType): string {
	const config = PORTAL_BRAND_CONFIG[portalType];
	const primary = config.primaryColor;
	const label = config.label;
	const tagline = config.tagline;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 64" width="280" height="64">
  <defs>
    <linearGradient id="grad-${portalType}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${primary};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${config.accentColor};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect x="2" y="8" width="44" height="44" rx="10" fill="url(#grad-${portalType})" />
  <text x="24" y="38" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="700" fill="white" text-anchor="middle">FP</text>
  <text x="56" y="32" font-family="system-ui,-apple-system,sans-serif" font-size="20" font-weight="700" fill="${primary}">${escapeXml(label)}</text>
  <text x="56" y="50" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="400" fill="#94A3B8">${escapeXml(tagline)}</text>
</svg>`;
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

router.get("/api/system/portal-meta", (req: Request, res: Response) => {
	const subdomain = req.subdomain || "";
	const portalType = resolvePortalType(subdomain);
	const config = PORTAL_BRAND_CONFIG[portalType];

	res.json({
		portal_type: config.portalType,
		label: config.label,
		logo_path: config.logoPath,
		tagline: config.tagline,
		primary_color: config.primaryColor,
		accent_color: config.accentColor,
		sidebar_bg: config.sidebarBg,
		sidebar_text: config.sidebarText,
	});
});

router.get("/api/system/portal-logo/:type", (req: Request, res: Response) => {
	const type = req.params.type as PortalType;
	const validTypes: string[] = Object.values(PortalType);
	const portalType = validTypes.includes(type)
		? (type as PortalType)
		: PortalType.MAIN;

	const svg = generatePortalSvg(portalType);
	res.setHeader("Content-Type", "image/svg+xml");
	res.setHeader("Cache-Control", "public, max-age=86400");
	res.send(svg);
});

const PORTAL_ICON_MAP: Record<string, string> = {
	main: "/icon-192.png",
	partner: "/icon-partner.png",
	agent: "/icon-agent.png",
	admin: "/icon-admin.png",
};

router.get(
	"/api/system/portal-manifest.json",
	(req: Request, res: Response) => {
		const subdomain = req.subdomain || "";
		const portalType = resolvePortalType(subdomain);
		const config = PORTAL_BRAND_CONFIG[portalType];
		const icon = PORTAL_ICON_MAP[portalType] || "/icon-192.png";

		const manifest = {
			name: `${config.label} - Financial Services Platform`,
			short_name: config.label,
			description: `A comprehensive SEBI-compliant financial services platform - ${config.tagline}`,
			start_url: "/",
			scope: "/",
			// Desktop-first display: window-controls-overlay gives a native app title bar
			// with the PWA URL bar replaced by the app title. Falls back to standalone.
			display: "standalone",
			display_override: [
				"window-controls-overlay",
				"standalone",
			],
			// Single-window mode: reuse existing PWA window instead of opening new tabs
			launch_handler: {
				client_mode: "navigate-existing",
			},
			background_color: "#0f172a",
			theme_color: config.primaryColor,
			// 'any' allows landscape/portrait and resizing — required for desktop
			orientation: "any",
			lang: "en-IN",
			categories: ["finance", "business", "utilities"],
			// Minimum window size — prevents Chrome from launching the PWA at a
			// width narrower than the desktop breakpoint (1024px), which would
			// trigger mobile layout even on a Mac/desktop machine.
			min_width: 1024,
			min_height: 768,
			icons: [
				{
					src: icon,
					sizes: "192x192",
					type: "image/png",
					purpose: "any",
				},
				{
					src: icon,
					sizes: "192x192",
					type: "image/png",
					purpose: "maskable",
				},
				{
					src: icon,
					sizes: "512x512",
					type: "image/png",
					purpose: "any",
				},
				{
					src: icon,
					sizes: "512x512",
					type: "image/png",
					purpose: "maskable",
				},
			],
			// Wide screenshot triggers Chrome's desktop install UI prompt
			screenshots: [
				{
					src: icon,
					sizes: "1280x800",
					type: "image/png",
					form_factor: "wide",
					label: `${config.label} - Desktop Dashboard`,
				},
				{
					src: icon,
					sizes: "1920x1080",
					type: "image/png",
					form_factor: "wide",
					label: `${config.label} - Portfolio & Market Insights`,
				},
			],
			related_applications: [],
			prefer_related_applications: false,
			shortcuts: [
				{
					name: "Dashboard",
					short_name: "Dashboard",
					description: "Open financial dashboard",
					url: "/",
					icons: [{ src: icon, sizes: "192x192" }],
				},
				{
					name: "Pick of the Day",
					short_name: "Picks",
					description: "View AI stock and fund picks",
					url: "/agent/picks",
					icons: [{ src: icon, sizes: "192x192" }],
				},
				{
					name: "Leads & CRM",
					short_name: "CRM",
					description: "Manage client leads",
					url: "/leads",
					icons: [{ src: icon, sizes: "192x192" }],
				},
				{
					name: "Clients",
					short_name: "Clients",
					description: "View and manage clients",
					url: "/clients",
					icons: [{ src: icon, sizes: "192x192" }],
				},
			],
		};

		res.setHeader("Content-Type", "application/manifest+json");
		res.setHeader("Cache-Control", "public, max-age=3600");
		res.json(manifest);
	},
);

router.post(
	"/api/system/portal-access-log",
	async (req: Request, res: Response) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const subdomain = req.subdomain || "";
			const portalType = resolvePortalType(subdomain);
			const ipAddress =
				(req.headers["x-forwarded-for"] as string) ||
				req.socket.remoteAddress ||
				"unknown";

			await db.insert(portalAccessLog).values({
				userId: req.user.id,
				portalType: portalType,
				ipAddress: ipAddress.split(",")[0].trim(),
				userAgent: req.headers["user-agent"] || "unknown",
			});

			res.json({ status: "logged" });
		} catch (error) {
			logger.error("[PortalAccessLog] Error:", error instanceof Error ? error : new Error(String(error)));
			res.status(500).json({ error: "Failed to log portal access" });
		}
	},
);

router.get(
	"/api/admin/portal-access-logs",
	async (req: Request, res: Response) => {
		try {
			if (
				!req.user?.roles?.includes("admin") &&
				!req.user?.roles?.includes("super_admin")
			) {
				return res.status(403).json({ error: "Admin access required" });
			}

			const limit = Math.min(
				Number.parseInt(req.query.limit as string) || 100,
				500,
			);
			const offset = Number.parseInt(req.query.offset as string) || 0;

			const logs = await db
				.select()
				.from(portalAccessLog)
				.orderBy(sql`${portalAccessLog.accessedAt} DESC`)
				.limit(limit)
				.offset(offset);

			const total = await db
				.select({ count: sql<number>`count(*)` })
				.from(portalAccessLog);

			res.json({
				logs,
				total: Number(total[0]?.count || 0),
				limit,
				offset,
			});
		} catch (error) {
			logger.error("[PortalAccessLog] Fetch error:", error instanceof Error ? error : new Error(String(error)));
			res.status(500).json({ error: "Failed to fetch portal access logs" });
		}
	},
);

export function registerPortalSystemRoutes(app: any) {
	app.use(router);
	logger.info(
		"✅ Portal System routes registered (portal-meta, portal-logo, portal-access-log)",
	);
}
