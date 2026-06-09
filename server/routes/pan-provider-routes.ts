import { Router, Request, Response } from "express";
import { db } from "../db";
import { adminSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const SETTINGS_KEY = "pan_active_provider";

interface PANProviderConfig {
	provider: string;
	name: string;
	description: string;
	pricePerVerification: number;
	isActive: boolean;
	isConfigured: boolean;
	requiredEnvVars: string[];
	missingEnvVars: string[];
	features: string[];
}

const PAN_PROVIDERS: Omit<
	PANProviderConfig,
	"isActive" | "isConfigured" | "missingEnvVars"
>[] = [
	{
		provider: "cashfree-pan",
		name: "Cashfree Verification Suite",
		description:
			"PAN verification via Cashfree API with name match scoring, Aadhaar seeding status, and corporate PAN support",
		pricePerVerification: 2.5,
		requiredEnvVars: [
			"CASHFREE_SECUREID_APP_ID|CASHFREE_VERIFICATION_APP_ID|CASHFREE_PG_APP_ID|CASHFREE_APP_ID",
			"CASHFREE_SECUREID_SECRET_KEY|CASHFREE_VERIFICATION_SECRET_KEY|CASHFREE_PG_SECRET_KEY|CASHFREE_SECRET_KEY",
		],
		features: [
			"Name Match Scoring",
			"Aadhaar Seeding Status",
			"Corporate PAN",
			"Real-time API",
			"Sandbox Testing",
		],
	},
	{
		provider: "sandbox-pan",
		name: "Sandbox.co.in PAN API",
		description:
			"Government-sourced PAN verification via Sandbox.co.in with detailed taxpayer info and compliance data",
		pricePerVerification: 1.8,
		requiredEnvVars: ["SANDBOX_API_KEY", "SANDBOX_API_SECRET"],
		features: [
			"Government Data Source",
			"Taxpayer Category",
			"Last Name Match",
			"Compliance Check",
			"Bulk Verification",
		],
	},
	{
		provider: "truthscreen-pan",
		name: "TruthScreen PAN Verification",
		description:
			"NSDL-backed PAN verification with comprehensive identity validation and fraud detection",
		pricePerVerification: 3.0,
		requiredEnvVars: ["TRUTHSCREEN_USERNAME", "TRUTHSCREEN_PASSWORD"],
		features: [
			"NSDL Direct",
			"Fraud Detection",
			"Identity Validation",
			"Historical Records",
			"Enterprise SLA",
		],
	},
];

const providerPricing: Record<string, number> = {
	"cashfree-pan": 2.5,
	"sandbox-pan": 1.8,
	"truthscreen-pan": 3.0,
};

let _activeProvider = "cashfree-pan";
let _loaded = false;

async function loadActiveProvider(): Promise<string> {
	if (_loaded) return _activeProvider;
	try {
		const [row] = await db
			.select({ value: adminSettings.value })
			.from(adminSettings)
			.where(eq(adminSettings.key, SETTINGS_KEY));
		if (row?.value && typeof row.value === "string") {
			_activeProvider = row.value;
		} else if (row?.value && typeof (row.value as any) === "object") {
			_activeProvider = (row.value as any).provider || "cashfree-pan";
		}
	} catch {}
	_loaded = true;
	return _activeProvider;
}

async function saveActiveProvider(provider: string): Promise<void> {
	_activeProvider = provider;
	await db
		.insert(adminSettings)
		.values({
			key: SETTINGS_KEY,
			value: provider as any,
			description: "Active PAN verification provider",
		})
		.onConflictDoUpdate({
			target: adminSettings.key,
			set: { value: provider as any, updatedAt: new Date() },
		});
}

function isGroupConfigured(group: string): boolean {
	return group.split("|").some((v) => !!process.env[v]);
}

function getProviders(active: string): PANProviderConfig[] {
	return PAN_PROVIDERS.map((p) => {
		const missingGroups = p.requiredEnvVars.filter(
			(g) => !isGroupConfigured(g),
		);
		return {
			...p,
			pricePerVerification:
				providerPricing[p.provider] ?? p.pricePerVerification,
			isActive: p.provider === active,
			isConfigured: missingGroups.length === 0,
			missingEnvVars: missingGroups,
		};
	});
}

router.get("/providers", async (_req: Request, res: Response) => {
	try {
		const active = await loadActiveProvider();
		const providers = getProviders(active);
		res.json({ success: true, activeProvider: active, providers });
	} catch (error) {
		console.error("[PAN Provider Routes] Error fetching providers:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch PAN providers" });
	}
});

router.post("/set-provider", async (req: Request, res: Response) => {
	try {
		const { provider } = req.body;
		const active = await loadActiveProvider();
		const providerDef = PAN_PROVIDERS.find((p) => p.provider === provider);
		if (!provider || !providerDef) {
			return res
				.status(400)
				.json({ success: false, error: "Invalid provider" });
		}
		const configs = getProviders(active);
		const providerConfig = configs.find((p) => p.provider === provider);
		if (!providerConfig?.isConfigured) {
			const missing = providerConfig?.missingEnvVars || [];
			return res.status(400).json({
				success: false,
				error: `Provider not configured — missing credentials: ${missing.join(", ")}`,
			});
		}
		await saveActiveProvider(provider);
		res.json({ success: true, activeProvider: provider });
	} catch (error) {
		console.error("[PAN Provider Routes] Error setting provider:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to set PAN provider" });
	}
});

router.patch("/pricing", async (req: Request, res: Response) => {
	try {
		const { provider, pricePerVerification } = req.body;
		if (!provider || !PAN_PROVIDERS.find((p) => p.provider === provider)) {
			return res
				.status(400)
				.json({ success: false, error: "Invalid provider" });
		}
		if (typeof pricePerVerification !== "number" || pricePerVerification < 0) {
			return res.status(400).json({ success: false, error: "Invalid price" });
		}
		providerPricing[provider] = pricePerVerification;
		res.json({ success: true, provider, pricePerVerification });
	} catch (error) {
		console.error("[PAN Provider Routes] Error updating pricing:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to update PAN pricing" });
	}
});

router.get("/usage", async (_req: Request, res: Response) => {
	try {
		const active = await loadActiveProvider();
		res.json({
			success: true,
			activeProvider: active,
			stats: {
				totalVerifications: 0,
				successfulVerifications: 0,
				failedVerifications: 0,
				successRate: 0,
				totalCost: 0,
				thisMonth: { verifications: 0, cost: 0 },
				byProvider: {},
			},
			note: "Usage tracking will populate as verifications are processed",
		});
	} catch (error) {
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch usage stats" });
	}
});

export { loadActiveProvider };
export default router;
