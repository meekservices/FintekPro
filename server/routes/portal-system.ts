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
			display: "standalone",
			background_color: "#ffffff",
			theme_color: config.primaryColor,
			orientation: "portrait-primary",
			scope: "/",
			lang: "en-IN",
			categories: ["finance", "business", "utilities"],
			icons: [
				{
					src: icon,
					sizes: "192x192",
					type: "image/png",
					purpose: "any maskable",
				},
				{
					src: icon,
					sizes: "512x512",
					type: "image/png",
					purpose: "any maskable",
				},
			],
			screenshots: [],
			related_applications: [],
			prefer_related_applications: false,
			shortcuts: [
				{
					name: "Portfolio",
					short_name: "Portfolio",
					description: "View your investment portfolio",
					url: "/portfolio",
					icons: [{ src: icon, sizes: "192x192" }],
				},
				{
					name: "Markets",
					short_name: "Markets",
					description: "View market data and trends",
					url: "/markets",
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
			console.error("[PortalAccessLog] Error:", error);
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
			console.error("[PortalAccessLog] Fetch error:", error);
			res.status(500).json({ error: "Failed to fetch portal access logs" });
		}
	},
);

export function registerPortalSystemRoutes(app: any) {
	app.use(router);
	console.log(
		"✅ Portal System routes registered (portal-meta, portal-logo, portal-access-log)",
	);
}
