import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function walkTs(dir: string): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...walkTs(fullPath));
		} else if (entry.name.endsWith(".ts")) {
			results.push(fullPath);
		}
	}
	return results;
}

/**
 * Ratchet allowlist of legacy/pending route files in server/routes/ that are
 * not yet wired into server/routes.ts or server/index.ts.
 *
 * RULE: This list may ONLY shrink over time. Adding a new route file without
 * mounting it in server/ will fail this test.
 */
const KNOWN_LEGACY_OR_PENDING_ROUTES = new Set([
	"server/routes/aa-consent-routes.ts",
	"server/routes/ai-proposal-routes.ts",
	"server/routes/ai-treasury-routes.ts",
	"server/routes/asset-allocation-routes.ts",
	"server/routes/bank-accounts-demat.ts",
	"server/routes/bond-recommendations.ts",
	"server/routes/ca-routes.ts",
	"server/routes/cache-admin.ts",
	"server/routes/cas-statement-routes.ts",
	"server/routes/cashfree-vrs-routes.ts",
	"server/routes/ckyc-provider-routes.ts",
	"server/routes/client-documents-routes.ts",
	"server/routes/commodity-recommendations.ts",
	"server/routes/deal-prospect-match-routes.ts",
	"server/routes/developer-finance-routes.ts",
	"server/routes/dsc-esign-routes.ts",
	"server/routes/easyleadz-callback-routes.ts",
	"server/routes/excel-addin-routes.ts",
	"server/routes/exchange-filings-routes.ts",
	"server/routes/exchange-stock-sync.ts",
	"server/routes/explainability-routes.ts",
	"server/routes/financial-metrics-admin.ts",
	"server/routes/financial-metrics-routes.ts",
	"server/routes/goal-planning-routes.ts",
	"server/routes/investable-surplus-routes.ts",
	"server/routes/investment-advisory-compliance-routes.ts",
	"server/routes/kyc-engine-routes.ts",
	"server/routes/listed-stocks-admin.ts",
	"server/routes/mca-direct-payment-routes.ts",
	"server/routes/mca-financial-backfill-routes.ts",
	"server/routes/pan-provider-routes.ts",
	"server/routes/parser-admin.ts",
	"server/routes/platform-fees.ts",
	"server/routes/portfolio-staging-routes.ts",
	"server/routes/proposal-esign-routes.ts",
	"server/routes/proposal-execution-routes.ts",
	"server/routes/return-forecasting-routes.ts",
	"server/routes/risk-profiles-partner-apps.ts",
	"server/routes/risk-suitability-routes.ts",
	"server/routes/sebi-risk-profiling-routes.ts",
	"server/routes/stock-enrichment-routes.ts",
	"server/routes/store-mld.ts",
	"server/routes/tax-services-routes.ts",
	"server/routes/treasury-copilot-routes-v2.ts",
]);

describe("Server Route Wiring Contract", () => {
	const projectRoot = path.resolve(__dirname, "../..");
	const routesDir = path.join(projectRoot, "server/routes");
	const serverDir = path.join(projectRoot, "server");

	it("mounts core admin and advisory routers in server/routes.ts", () => {
		const routesTs = fs.readFileSync(
			path.join(serverDir, "routes.ts"),
			"utf8",
		);
		const requiredRouters = [
			"activity-centre-routes",
			"task-oversight-routes",
			"self-healing-routes",
			"ai-recommendation-tracking-routes",
			"unified-advisory-routes",
		];

		for (const routerName of requiredRouters) {
			expect(routesTs).toContain(routerName);
		}
	});

	it("does not introduce any new unmounted route files in server/routes/", () => {
		const routeFiles = walkTs(routesDir);
		const serverFiles = walkTs(serverDir).filter(
			(f) => !f.includes(`${path.sep}tests${path.sep}`),
		);
		const serverContents = serverFiles.map((filePath) => ({
			filePath,
			content: fs.readFileSync(filePath, "utf8"),
		}));

		const unexpectedUnmounted: string[] = [];

		for (const rf of routeFiles) {
			const base = path.basename(rf, ".ts");
			if (base === "index") continue;

			const relPath = path.relative(projectRoot, rf).replace(/\\/g, "/");
			const isReferenced = serverContents.some(
				(entry) => entry.filePath !== rf && entry.content.includes(base),
			);

			if (!isReferenced && !KNOWN_LEGACY_OR_PENDING_ROUTES.has(relPath)) {
				unexpectedUnmounted.push(relPath);
			}
		}

		expect(unexpectedUnmounted).toEqual([]);
	});
});
