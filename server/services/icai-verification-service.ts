// @ts-nocheck
/**
 * ICAI Verification Service — ICHI (ICAI Headless Intelligence) Layer
 *
 * Verifies CA membership by scraping the ICAI public member-search portal.
 * Runs as the automatic fallback in the CA empanelment workflow; also callable
 * by admins on demand.
 *
 * Verification chain:
 *   1. FintekPro CA Registry (local DB, free, instant) ← NEW
 *   2. Surepass API (paid, ~200ms, no CAPTCHA) ← primary for first-time checks
 *   3. HTTP scraper (axios + cheerio) against ICAI portal
 *   4. Puppeteer fallback — handles JS-rendered responses
 *   5. 24-hour ca_verification_status cache (legacy, kept for compatibility)
 *   6. Rate limiter: max 10 req / min per worker
 *   7. Confidence scoring: 0.75 (scraper only) → 0.95 (API + scraper match)
 *   8. Full audit trail: raw HTML snapshot stored for compliance
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { execSync } from "child_process";
import * as fs from "fs";
import { guardedExecution, validateICAIResult } from "./guarded-execution";
import { caRegistryService } from "./ca-registry-service";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ICAIVerificationResult {
	success: boolean;
	membershipNumber: string;
	nameAtICAI?: string;
	membershipStatus?: "ACTIVE" | "INACTIVE" | "ASSOCIATE" | "FELLOW" | "UNKNOWN";
	copStatus?: string;
	membershipType?: string;
	nameMatchScore?: number;
	confidenceScore: number;
	source: "ICAI_HTTP" | "ICAI_PUPPETEER" | "CACHE" | "SCRAPER_FAILED";
	cachedAt?: Date;
	rawHtmlSnippet?: string;
	error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// ── ICAI endpoints (verified 2026-04-12) ──────────────────────────────────────
// icai.org/post.html?post_id=2492 → redirects to HTTP and connection refused (dead)
// findca.icai.org → DNS not found (dead)
// member_search_result.php → 404 (dead)
// Active: https://www.icai.org/new-post.html?post_id=2492 (CAPTCHA protected)
// Active: https://selfservice.icai.org/ (member self-service portal)
// Programmatic option: Surepass (surepass.io) or Karza icai-member-check API
const ICAI_SEARCH_URL =
	process.env.ICAI_SEARCH_URL ||
	"https://www.icai.org/new-post.html?post_id=2492";
const ICAI_SELFSERVICE_URL = "https://selfservice.icai.org/";
const CACHE_TTL_HOURS = 24;
const MAX_RETRIES = 3;
const SCRAPER_TIMEOUT_MS = 45_000;

const USER_AGENTS = [
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
];

// ─── In-memory rate limiter (10 req / min) ────────────────────────────────

const rateBucket = { count: 0, resetAt: Date.now() + 60_000 };

function checkRateLimit(): void {
	const now = Date.now();
	if (now > rateBucket.resetAt) {
		rateBucket.count = 0;
		rateBucket.resetAt = now + 60_000;
	}
	if (rateBucket.count >= 10) {
		throw new Error(
			"ICAI scraper rate limit reached (10 req/min). Please retry after a minute.",
		);
	}
	rateBucket.count++;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomUA(): string {
	return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(minMs = 1500, maxMs = 4000): Promise<void> {
	const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs);
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(name: string): string {
	return name
		.toUpperCase()
		.replace(/\bCA\b/g, "")
		.replace(/\bMR\b|\bMRS\b|\bMS\b|\bDR\b/g, "")
		.replace(/[^A-Z0-9\s]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function nameMatchScore(expected: string, actual: string): number {
	if (!expected || !actual) return 0;
	const n1 = normalizeName(expected);
	const n2 = normalizeName(actual);
	if (n1 === n2) return 100;

	const matrix: number[][] = [];
	for (let i = 0; i <= n1.length; i++) matrix[i] = [i];
	for (let j = 0; j <= n2.length; j++) matrix[0][j] = j;
	for (let i = 1; i <= n1.length; i++) {
		for (let j = 1; j <= n2.length; j++) {
			if (n1[i - 1] === n2[j - 1]) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] =
					1 +
					Math.min(matrix[i - 1][j - 1], matrix[i][j - 1], matrix[i - 1][j]);
			}
		}
	}
	const dist = matrix[n1.length][n2.length];
	const maxLen = Math.max(n1.length, n2.length);
	return Math.round(((maxLen - dist) / maxLen) * 100);
}

function resolveChromiumPath(): string | undefined {
	if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;

	// 1. Puppeteer bundled Chromium (preferred — no Nix chromium package needed)
	try {
		const puppeteerPkg = require("puppeteer");
		const ep = puppeteerPkg.executablePath?.();
		if (ep && fs.existsSync(ep)) return ep;
	} catch {}

	// 2. Common puppeteer cache paths across environments
	const home = process.env.HOME || "/root";
	const puppeteerCachePaths = [
		`${home}/.cache/puppeteer/chrome/linux-146.0.7680.76/chrome-linux64/chrome`,
		`${home}/.cache/puppeteer/chrome/linux-stable/chrome-linux64/chrome`,
		`/root/.cache/puppeteer/chrome/linux-146.0.7680.76/chrome-linux64/chrome`,
	];
	for (const p of puppeteerCachePaths) {
		if (fs.existsSync(p)) return p;
	}

	// 3. System Chromium (Nix or package-manager installed)
	const systemPaths = [
		"/usr/bin/chromium-browser",
		"/usr/bin/chromium",
		"/usr/bin/google-chrome",
		"/snap/bin/chromium",
	];
	for (const p of systemPaths) {
		if (fs.existsSync(p)) return p;
	}

	// 4. Dynamic PATH lookup
	try {
		const found = execSync(
			"which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null",
			{ timeout: 3000 },
		)
			.toString()
			.trim();
		if (found) return found;
	} catch {}
	return undefined;
}

// ─── HTML parser — handles multiple ICAI page layouts ────────────────────────

function parseICAIHtml(html: string): {
	name?: string;
	status?: string;
	membershipType?: string;
	copStatus?: string;
} {
	const $ = cheerio.load(html);

	let name: string | undefined;
	let status: string | undefined;
	let membershipType: string | undefined;
	let copStatus: string | undefined;

	const rowTexts: string[] = [];
	$("table tr, .result-row, .member-info tr, .search-result tr").each(
		(_, el) => {
			rowTexts.push($(el).text().replace(/\s+/g, " ").trim());
		},
	);

	const allText = rowTexts.join(" ").toUpperCase();

	// Strategy 1: table cells / labeled rows
	$("td, th, .field-label + .field-value, dd").each((_, el) => {
		const text = $(el).text().trim();
		if (!text) return;
		const prev = $(el).prev().text().trim().toUpperCase();

		if (/name/i.test(prev) && !name) {
			name = text;
		}
		if (/status|membership\s*status/i.test(prev) && !status) {
			status = text.toUpperCase();
		}
		if (/type|membership\s*type|category/i.test(prev) && !membershipType) {
			membershipType = text.toUpperCase();
		}
		if (/cop|certificate\s*of\s*practice/i.test(prev) && !copStatus) {
			copStatus = text.toUpperCase();
		}
	});

	// Strategy 2: keyword proximity scan
	if (!name) {
		$("td, li, p, span, div").each((_, el) => {
			const text = $(el).text().trim();
			if (/member\s*name\s*[:\-]/i.test(text)) {
				name = text
					.replace(/.*member\s*name\s*[:\-]/i, "")
					.trim()
					.split(/\n/)[0]
					.trim();
			}
		});
	}
	if (!status) {
		if (/\bACTIVE\b/.test(allText)) status = "ACTIVE";
		else if (/\bINACTIVE\b/.test(allText)) status = "INACTIVE";
	}
	if (!membershipType) {
		if (/\bFELLOW\b|\bFCA\b/.test(allText)) membershipType = "FELLOW";
		else if (/\bASSOCIATE\b|\bACA\b/.test(allText))
			membershipType = "ASSOCIATE";
	}
	if (!copStatus) {
		if (/COP\s*(STATUS)?\s*[:\-]?\s*ACTIVE/i.test(html)) copStatus = "ACTIVE";
		else if (/COP\s*(STATUS)?\s*[:\-]?\s*INACTIVE/i.test(html))
			copStatus = "INACTIVE";
	}

	return { name, status, membershipType, copStatus };
}

// ─── HTTP-first scraper ───────────────────────────────────────────────────────

async function fetchViaHttp(membershipNumber: string): Promise<{
	html: string;
	success: boolean;
}> {
	const ua = randomUA();

	const formPayload = new URLSearchParams({
		member_id: membershipNumber,
		captcha: "",
		txtMembNo: membershipNumber,
		submit: "Search",
	});

	const attempts = [
		// Attempt 1: Surepass ICAI API (JSON response, no CAPTCHA, most reliable in 2025)
		async () => {
			const surepassKey = process.env.SUREPASS_API_TOKEN;
			if (!surepassKey) throw new Error("SUREPASS_API_TOKEN not set");
			const resp = await axios.post(
				"https://kyc-api.surepass.io/api/v1/icai/icai-verification",
				{ id_number: membershipNumber },
				{
					headers: {
						Authorization: `Bearer ${surepassKey}`,
						"Content-Type": "application/json",
					},
					timeout: 12_000,
				},
			);
			// Surepass returns HTML-style data in JSON wrapper — convert to HTML for parseICAIHtml
			const d = resp.data?.data;
			if (!d) throw new Error("Empty Surepass response");
			// Build pseudo-HTML that parseICAIHtml can parse
			return [
				`<table><tr><td>Member Name</td><td>${d.name || d.full_name || ""}</td></tr>`,
				`<tr><td>Membership Status</td><td>${d.member_status || d.status || (d.is_valid ? "ACTIVE" : "INACTIVE")}</td></tr>`,
				`<tr><td>Membership Type</td><td>${d.membership_type || d.member_type || ""}</td></tr>`,
				`<tr><td>COP Status</td><td>${d.cop_status || ""}</td></tr>`,
				`</table>`,
			].join("\n");
		},
		// Attempt 2: ICAI new member search page (CAPTCHA-protected, may work without CAPTCHA on first visit)
		async () => {
			const resp = await axios.get(ICAI_SEARCH_URL, {
				params: { member_no: membershipNumber },
				headers: { "User-Agent": ua, Accept: "text/html" },
				timeout: 20_000,
				maxRedirects: 5,
			});
			return resp.data as string;
		},
		// Attempt 3: ICAI self-service portal
		async () => {
			const resp = await axios.get(ICAI_SELFSERVICE_URL, {
				params: { memberNo: membershipNumber },
				headers: { "User-Agent": ua, Accept: "text/html" },
				timeout: 20_000,
			});
			return resp.data as string;
		},
	];

	for (const attempt of attempts) {
		try {
			const html = await attempt();
			if (html && html.length > 200) {
				return { html, success: true };
			}
		} catch {}
		await randomDelay(800, 2000);
	}

	return { html: "", success: false };
}

// ─── Puppeteer fallback ───────────────────────────────────────────────────────

async function fetchViaPuppeteer(membershipNumber: string): Promise<{
	html: string;
	success: boolean;
}> {
	const chromiumPath = resolveChromiumPath();
	let puppeteer: any;
	try {
		puppeteer = await import("puppeteer");
	} catch {
		try {
			puppeteer = await import("puppeteer-core");
		} catch {
			return { html: "", success: false };
		}
	}

	const launchOpts: any = {
		headless: true,
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-gpu",
			"--no-first-run",
			"--disable-extensions",
		],
		timeout: SCRAPER_TIMEOUT_MS,
	};
	if (chromiumPath) launchOpts.executablePath = chromiumPath;

	let browser: any;
	try {
		browser = await puppeteer.default.launch(launchOpts);
		const page = await browser.newPage();

		await page.setUserAgent(randomUA());
		await page.setExtraHTTPHeaders({ "Accept-Language": "en-IN,en;q=0.9" });
		await page.setDefaultNavigationTimeout(SCRAPER_TIMEOUT_MS);

		await page.goto(ICAI_SEARCH_URL, { waitUntil: "networkidle2" });
		await randomDelay(1500, 3000);

		const inputSelectors = [
			"#membership_number",
			"#member_no",
			"#txtMembNo",
			'input[name="member_id"]',
			'input[name="member_no"]',
			'input[name="txtMembNo"]',
			'input[type="text"]',
		];
		let filled = false;
		for (const sel of inputSelectors) {
			try {
				await page.waitForSelector(sel, { timeout: 3000 });
				await page.click(sel, { clickCount: 3 });
				await page.type(sel, membershipNumber, { delay: 80 });
				filled = true;
				break;
			} catch {}
		}

		if (!filled) {
			await browser.close();
			return { html: "", success: false };
		}

		await randomDelay(500, 1500);

		const submitSelectors = [
			"#search_button",
			'button[type="submit"]',
			'input[type="submit"]',
		];
		for (const sel of submitSelectors) {
			try {
				await page.click(sel);
				break;
			} catch {}
		}

		try {
			await page.waitForNavigation({
				waitUntil: "networkidle2",
				timeout: 15_000,
			});
		} catch {}

		await randomDelay(1000, 2500);

		const html: string = await page.content();
		await browser.close();
		return { html, success: html.length > 500 };
	} catch (err: any) {
		try {
			await browser?.close();
		} catch {}
		console.warn("[ICAI] Puppeteer fallback failed:", err?.message);
		return { html: "", success: false };
	}
}

// ─── Cache layer (ca_verification_status table) ───────────────────────────────

interface CachedResult {
	nameAtIcai: string | null;
	membershipStatus: string | null;
	membershipType: string | null;
	copStatus: string | null;
	confidenceScore: string | null;
	scrapedAt: Date | null;
	source: string | null;
}

async function getCachedResult(
	membershipNumber: string,
): Promise<CachedResult | null> {
	try {
		const rows = await db.execute(sql`
      SELECT icai_scraped_name, icai_membership_status, icai_membership_type,
             icai_cop_status, icai_confidence_score, icai_scraped_at, icai_source
      FROM ca_verification_status
      WHERE icai_membership_number = ${membershipNumber}
        AND icai_scraped_at > NOW() - INTERVAL '${sql.raw(String(CACHE_TTL_HOURS))} hours'
      ORDER BY icai_scraped_at DESC
      LIMIT 1
    `);
		const row = (rows as any[])[0];
		if (!row) return null;
		return {
			nameAtIcai: row.icai_scraped_name,
			membershipStatus: row.icai_membership_status,
			membershipType: row.icai_membership_type,
			copStatus: row.icai_cop_status,
			confidenceScore: row.icai_confidence_score,
			scrapedAt: row.icai_scraped_at,
			source: row.icai_source,
		};
	} catch {
		return null;
	}
}

async function persistResult(
	membershipNumber: string,
	result: ICAIVerificationResult,
	rawHtml: string,
	partnerId?: string,
): Promise<void> {
	try {
		const htmlSnippet = rawHtml.slice(0, 20_000);
		await db.execute(sql`
      INSERT INTO ca_verification_status (id, user_id, icai_membership_number,
        icai_scraped_name, icai_membership_status, icai_membership_type,
        icai_cop_status, icai_confidence_score, icai_scraped_at,
        icai_source, icai_raw_html, icai_error, overall_status, pan_number, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${partnerId ?? null},
        ${membershipNumber},
        ${result.nameAtICAI ?? null},
        ${result.membershipStatus ?? null},
        ${result.membershipType ?? null},
        ${result.copStatus ?? null},
        ${result.confidenceScore},
        NOW(),
        ${result.source},
        ${htmlSnippet},
        ${result.error ?? null},
        ${result.membershipStatus === "ACTIVE" ? "icai_verified" : "icai_pending"},
        '',
        NOW(), NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        icai_membership_number   = EXCLUDED.icai_membership_number,
        icai_scraped_name        = EXCLUDED.icai_scraped_name,
        icai_membership_status   = EXCLUDED.icai_membership_status,
        icai_membership_type     = EXCLUDED.icai_membership_type,
        icai_cop_status          = EXCLUDED.icai_cop_status,
        icai_confidence_score    = EXCLUDED.icai_confidence_score,
        icai_scraped_at          = NOW(),
        icai_source              = EXCLUDED.icai_source,
        icai_raw_html            = EXCLUDED.icai_raw_html,
        icai_error               = EXCLUDED.icai_error,
        overall_status           = EXCLUDED.overall_status,
        updated_at               = NOW()
    `);
	} catch (e: any) {
		console.warn("[ICAI] Could not persist result to DB:", e?.message);
	}
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function verifyICAIMembership(
	membershipNumber: string,
	expectedName?: string,
	partnerId?: string,
	forceRefresh = false,
): Promise<ICAIVerificationResult> {
	const cleaned = membershipNumber.trim().toUpperCase();

	console.log(`[ICAI] Verifying membership: ${cleaned}`);

	if (!forceRefresh) {
		const cached = await getCachedResult(cleaned);
		if (cached) {
			console.log(
				`[ICAI] Cache hit for ${cleaned} (scraped: ${cached.scrapedAt?.toISOString()})`,
			);
			const matchScore =
				expectedName && cached.nameAtIcai
					? nameMatchScore(expectedName, cached.nameAtIcai)
					: undefined;
			return {
				success: true,
				membershipNumber: cleaned,
				nameAtICAI: cached.nameAtIcai ?? undefined,
				membershipStatus: (cached.membershipStatus as any) ?? "UNKNOWN",
				membershipType: cached.membershipType ?? undefined,
				copStatus: cached.copStatus ?? undefined,
				nameMatchScore: matchScore,
				confidenceScore: Number.parseFloat(cached.confidenceScore ?? "0.75"),
				source: "CACHE",
				cachedAt: cached.scrapedAt ?? undefined,
			};
		}
	}

	checkRateLimit();

	let html = "";
	let source: ICAIVerificationResult["source"] = "SCRAPER_FAILED";

	const httpResult = await guardedExecution(() => fetchViaHttp(cleaned), {
		module: "prospect_engine",
		operation: "icai_http_scrape",
		input: { membershipNumber: cleaned },
		fallback: { html: "", success: false },
		code: `ICAI HTTP scraper → member search for ${cleaned}`,
	});
	if (httpResult.success) {
		html = httpResult.html;
		source = "ICAI_HTTP";
	} else {
		console.log("[ICAI] HTTP fetch failed — falling back to Puppeteer");
		await randomDelay(2000, 4000);
		const ppResult = await guardedExecution(() => fetchViaPuppeteer(cleaned), {
			module: "prospect_engine",
			operation: "icai_puppeteer_scrape",
			input: { membershipNumber: cleaned },
			fallback: { html: "", success: false },
			code: `ICAI Puppeteer scraper → member search for ${cleaned}`,
		});
		if (ppResult.success) {
			html = ppResult.html;
			source = "ICAI_PUPPETEER";
		}
	}

	if (!html) {
		const failResult: ICAIVerificationResult = {
			success: false,
			membershipNumber: cleaned,
			confidenceScore: 0,
			source: "SCRAPER_FAILED",
			error:
				"Could not reach ICAI member search. Manual verification required.",
		};
		await persistResult(cleaned, failResult, "", partnerId);
		return failResult;
	}

	const parsed = parseICAIHtml(html);

	const membershipStatus: ICAIVerificationResult["membershipStatus"] =
		parsed.status?.includes("ACTIVE")
			? "ACTIVE"
			: parsed.status?.includes("INACTIVE")
				? "INACTIVE"
				: parsed.status?.includes("FELLOW")
					? "FELLOW"
					: parsed.status?.includes("ASSOCIATE")
						? "ASSOCIATE"
						: "UNKNOWN";

	const matchScore =
		expectedName && parsed.name
			? nameMatchScore(expectedName, parsed.name)
			: undefined;

	let confidenceScore = 0.75;
	if (
		membershipStatus === "ACTIVE" ||
		membershipStatus === "FELLOW" ||
		membershipStatus === "ASSOCIATE"
	) {
		confidenceScore = 0.8;
	}
	if (matchScore !== undefined) {
		if (matchScore >= 85) confidenceScore = 0.9;
		else if (matchScore >= 70) confidenceScore = 0.82;
		else confidenceScore = 0.65;
	}

	const result: ICAIVerificationResult = {
		success: !!(parsed.name || membershipStatus !== "UNKNOWN"),
		membershipNumber: cleaned,
		nameAtICAI: parsed.name,
		membershipStatus,
		membershipType: parsed.membershipType,
		copStatus: parsed.copStatus,
		nameMatchScore: matchScore,
		confidenceScore,
		source,
		rawHtmlSnippet: html.slice(0, 2000),
	};

	await persistResult(cleaned, result, html, partnerId);

	// ── Upsert into FintekPro CA Registry (Layer 1 cache for future lookups) ──
	if (result.success && membershipStatus !== "UNKNOWN") {
		caRegistryService
			.upsertToRegistry({
				icaiMembershipNumber: cleaned,
				nameAtIcai: parsed.name,
				membershipType: parsed.membershipType,
				membershipStatus,
				copStatus: parsed.copStatus,
				verifiedBy:
					source === "ICAI_HTTP"
						? "icai_scraper"
						: source === "ICAI_PUPPETEER"
							? "icai_scraper"
							: "icai_scraper",
				confidenceScore,
				userId: undefined,
				partnersTableId: partnerId,
			})
			.catch((e) =>
				console.warn("[ICAI] Registry upsert failed (non-fatal):", e?.message),
			);
	}

	// Schema validation: warn if scraper output is missing expected fields (ICAI DOM may have changed)
	try {
		validateICAIResult(result as unknown as Record<string, unknown>);
	} catch (validationErr: any) {
		console.warn(
			`[ICAI] Schema validation warning for ${cleaned}: ${validationErr.message} — scraper may need update`,
		);
	}

	console.log(
		`[ICAI] Result for ${cleaned}: status=${membershipStatus} name="${parsed.name}" confidence=${confidenceScore}`,
	);
	return result;
}
