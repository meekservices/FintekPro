/**
 * Agent Tracker Route — BuildWealth-parity business performance tracker
 * 
 * Powered by:
 *  - Local data in comprehensive_holdings (from CAS imports)
 *  - IRIS KFintech API for live client portfolio and CAS fetch
 */

import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { comprehensiveHoldings, users, portfolios } from "@shared/schema";
import { eq, and, sql, inArray, gte, isNotNull } from "drizzle-orm";
import { irisKfintechService } from "../services/iris-kfintech-service";

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    roles?: string[];
  };
  isAuthenticated(): boolean;
}

interface SipMetadata {
  sipAmount?: string | number;
  amount?: string | number;
  mandateEndDate?: string;
}

const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;
  if (!authReq.isAuthenticated || typeof authReq.isAuthenticated !== "function" || !authReq.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

/** Estimate trail commission rate by asset type */
function estimateTrailRate(assetType: string): number {
  const t = (assetType || "").toLowerCase();
  if (t.includes("equity") || t === "mf" || t === "mutual_fund") return 0.008; // 0.8% p.a.
  if (t.includes("debt") || t.includes("bond")) return 0.001; // 0.1% p.a.
  if (t.includes("hybrid") || t.includes("balanced")) return 0.005;
  return 0.006; // default 0.6%
}

/** Classify asset into broad category */
function classifyAsset(assetType: string): "equity" | "debt" | "gold" | "alternatives" | "cash" {
  const t = (assetType || "").toLowerCase();
  if (t.includes("gold") || t.includes("silver")) return "gold";
  if (t.includes("debt") || t.includes("bond") || t.includes("fd")) return "debt";
  if (t.includes("alt") || t.includes("aif") || t.includes("pms")) return "alternatives";
  if (t.includes("cash")) return "cash";
  return "equity";
}

// ─── GET /tracker ──────────────────────────────────────────────────
// Main aggregation endpoint — all business performance metrics for this agent
router.get("/tracker", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = (req as AuthRequest).user?.id;
    if (!agentId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 1. Fetch all clients of this agent
    const agentClients = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, mobile: users.mobile, arnCode: users.arnCode })
      .from(users)
      .where(sql`${users.agentId} = ${agentId} AND 'client' = ANY(${users.roles})`);

    if (agentClients.length === 0) {
      res.json(emptyTrackerResponse());
      return;
    }

    const clientIds = agentClients.map((c) => c.id);

    // 2. Fetch all comprehensive holdings for agent's clients
    const holdings = await db
      .select()
      .from(comprehensiveHoldings)
      .where(
        inArray(comprehensiveHoldings.userId, clientIds)
      )
      .limit(5000);

    // 3. AUM aggregation
    let totalAUM = 0;
    let totalEquity = 0;
    let totalDebt = 0;
    let totalGold = 0;
    let totalAlternatives = 0;
    let totalTrailAnnual = 0;

    const amcMap = new Map<string, { aum: number; sipCount: number; trail: number }>();
    const clientAumMap = new Map<string, number>();

    for (const h of holdings) {
      const mv = parseFloat(String(h.marketValue || 0));
      if (!mv || mv <= 0) continue;
      totalAUM += mv;

      const cat = classifyAsset(h.assetType || "");
      if (cat === "equity") totalEquity += mv;
      else if (cat === "debt") totalDebt += mv;
      else if (cat === "gold") totalGold += mv;
      else if (cat === "alternatives") totalAlternatives += mv;

      totalTrailAnnual += mv * estimateTrailRate(h.assetType || "");

      // Per-AMC aggregation: use assetName prefix or a known AMC field
      const amcName = extractAmcName(h.assetName || "");
      const existing = amcMap.get(amcName) || { aum: 0, sipCount: 0, trail: 0 };
      existing.aum += mv;
      existing.trail += mv * estimateTrailRate(h.assetType || "");
      amcMap.set(amcName, existing);

      // Per-client AUM
      const uid = h.userId || "";
      clientAumMap.set(uid, (clientAumMap.get(uid) || 0) + mv);
    }

    // 4. SIP Book
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sipHoldings = holdings.filter(
      (h) => h.contributionFrequency || (h.metadata as unknown as SipMetadata)?.sipAmount
    );

    let activeSips = 0;
    let expiringSips = 0;
    let lapsedSips = 0;
    let monthlySipValue = 0;
    let netNewThisMonth = 0;

    for (const h of sipHoldings) {
      const meta = h.metadata as unknown as SipMetadata;
      const sipAmount = parseFloat(String(meta?.sipAmount || meta?.amount || 0));
      if (sipAmount > 0) monthlySipValue += sipAmount;

      const lastUpd = h.lastUpdated || h.createdAt;
      if (lastUpd && new Date(lastUpd) >= startOfMonth) netNewThisMonth++;

      if (meta?.mandateEndDate) {
        const endDate = new Date(meta.mandateEndDate);
        const daysLeft = Math.floor((endDate.getTime() - now.getTime()) / 86400000);
        if (daysLeft < 0) { lapsedSips++; continue; }
        if (daysLeft <= 30) { expiringSips++; activeSips++; continue; }
      }
      activeSips++;
    }

    // SIP count also from AMC map
    for (const h of sipHoldings) {
      const amcName = extractAmcName(h.assetName || "");
      const existing = amcMap.get(amcName);
      if (existing) { existing.sipCount++; amcMap.set(amcName, existing); }
    }

    // 5. Monthly AUM trend (last 6 months using holding_date snapshots)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await db
      .select({
        month: sql<string>`TO_CHAR(${comprehensiveHoldings.holdingDate}, 'YYYY-MM')`,
        totalAUM: sql<number>`SUM(CAST(${comprehensiveHoldings.marketValue} AS NUMERIC))`,
      })
      .from(comprehensiveHoldings)
      .where(
        and(
          inArray(comprehensiveHoldings.userId, clientIds),
          gte(comprehensiveHoldings.holdingDate, sixMonthsAgo.toISOString().split("T")[0]),
          isNotNull(comprehensiveHoldings.marketValue)
        )
      )
      .groupBy(sql`TO_CHAR(${comprehensiveHoldings.holdingDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${comprehensiveHoldings.holdingDate}, 'YYYY-MM')`);

    // Fill missing months with current AUM as best estimate
    const trendMap = new Map(monthlyTrend.map((t) => [t.month, Number(t.totalAUM)]));
    const trend: { month: string; aum: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });
      trend.push({ month: key, aum: trendMap.get(key) ?? (i === 0 ? totalAUM : 0), label });
    }

    // 6. Top AMCs sorted by AUM
    const topAmcs = Array.from(amcMap.entries())
      .map(([name, data]) => ({
        name,
        aum: Math.round(data.aum),
        sipCount: data.sipCount,
        trailMonthly: Math.round(data.trail / 12),
      }))
      .sort((a, b) => b.aum - a.aum)
      .slice(0, 10);

    // 7. Client connectivity (IRIS/KFintech capable)
    const irisConnected = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.id, clientIds),
          isNotNull(users.panNumber)
        )
      );

    // 8. KYC pending count
    const kycPendingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          inArray(users.id, clientIds),
          sql`${users.kycStatus} IS NULL OR ${users.kycStatus} NOT IN ('verified', 'completed', 'verified_kyc')`
        )
      );

    const kycPending = Number(kycPendingCount[0]?.count || 0);

    const response = {
      summary: {
        totalAUM: Math.round(totalAUM),
        totalEquity: Math.round(totalEquity),
        totalDebt: Math.round(totalDebt),
        totalGold: Math.round(totalGold),
        totalAlternatives: Math.round(totalAlternatives),
        aumChange: null as null | number, // future: compare with last month
      },
      sipBook: {
        activeSips,
        expiringSips,
        lapsedSips,
        monthlySipValue: Math.round(monthlySipValue),
        netNewThisMonth,
      },
      commission: {
        monthlyTrailEstimate: Math.round(totalTrailAnnual / 12),
        annualTrailEstimate: Math.round(totalTrailAnnual),
        note: "Estimated at 0.8% trail for equity, 0.1% for debt",
      },
      monthlyTrend: trend,
      topAmcs,
      clientConnectivity: {
        total: agentClients.length,
        withHoldings: clientAumMap.size,
        irisCapable: irisConnected.length,
      },
      pendingActions: {
        sigsExpiring: expiringSips,
        kycPending: kycPending,
        totalActions: expiringSips + kycPending,
      },
      irisEnabled: irisKfintechService.isConfigured,
      irisStatus: irisKfintechService.getStatus(),
      generatedAt: new Date().toISOString(),
    };

    res.json(response);
  } catch (err: unknown) {
    console.error("[Agent Tracker] Error:", err);
    res.status(500).json({ error: "Failed to fetch tracker data" });
  }
});

// ─── POST /iris/initiate ─────────────────────────────────────
// Initiate IRIS KFintech CAS fetch for a specific client (sends OTP)
router.post("/iris/initiate", requireAuth, async (req, res): Promise<void> => {
  try {
    const { pan, mobile } = req.body;
    if (!pan) {
      res.status(400).json({ error: "PAN is required" });
      return;
    }

    if (!irisKfintechService.isConfigured) {
      res.status(503).json({
        error: "IRIS KFintech not configured",
        message: "Set IRIS_USERNAME and IRIS_PASSWORD to enable live data fetch.",
      });
      return;
    }

    // IRIS sendOtp can take mobile, but often uses the one registered with PAN
    const result = await irisKfintechService.sendOtp(mobile);
    res.json({ success: true, requestId: result.success ? "iris-otp-sent" : null, message: result.message });
  } catch (err: unknown) {
    console.error("[IRIS Initiate] Error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to initiate IRIS request", detail: msg });
  }
});

// ─── POST /iris/verify ──────────────────────────────────────
// Validate OTP and import CAS data from KFintech Registry
router.post("/iris/verify", requireAuth, async (req, res): Promise<void> => {
  try {
    const { pan, otp } = req.body;
    if (!pan || !otp) {
      res.status(400).json({ error: "PAN and otp are required" });
      return;
    }

    // 1. Verify OTP
    const verifyResult = await irisKfintechService.submitOtp(otp);
    if (!verifyResult.success) {
      res.status(400).json({ error: verifyResult.message || "OTP verification failed" });
      return;
    }

    // 2. Fetch CAS from Registry
    const casData = await irisKfintechService.fetchCasFromRegistry(pan);

    if (!casData) {
      res.status(400).json({ error: "CAS fetch from IRIS failed" });
      return;
    }

    res.json({
      success: true,
      investor: {
        pan: pan.toUpperCase(),
        data: casData,
      },
      message: "CAS data fetched and synced from KFintech Registry",
    });
  } catch (err: unknown) {
    console.error("[IRIS Verify] Error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "IRIS OTP verification failed", detail: msg });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyTrackerResponse() {
  return {
    summary: { totalAUM: 0, totalEquity: 0, totalDebt: 0, totalGold: 0, totalAlternatives: 0, aumChange: null },
    sipBook: { activeSips: 0, expiringSips: 0, lapsedSips: 0, monthlySipValue: 0, netNewThisMonth: 0 },
    commission: { monthlyTrailEstimate: 0, annualTrailEstimate: 0, note: "" },
    monthlyTrend: [],
    topAmcs: [],
    clientConnectivity: { total: 0, withHoldings: 0, irisCapable: 0 },
    pendingActions: { sigsExpiring: 0, kycPending: 0, totalActions: 0 },
    irisEnabled: irisKfintechService.isConfigured,
    generatedAt: new Date().toISOString(),
  };
}

/** Extract AMC name from scheme name (first part before space/hyphen) */
function extractAmcName(schemeName: string): string {
  if (!schemeName) return "Unknown AMC";
  const known = [
    "HDFC", "ICICI", "SBI", "Nippon", "Axis", "Kotak", "Mirae", "UTI",
    "Franklin", "IDFC", "Aditya Birla", "DSP", "Tata", "Invesco", "PGIM",
    "Canara", "Edelweiss", "Motilal", "L&T", "LIC", "Mahindra Manulife",
  ];
  const upper = schemeName.toUpperCase();
  for (const amc of known) {
    if (upper.includes(amc.toUpperCase())) return amc + " MF";
  }
  const parts = schemeName.split(/[\s\-]/);
  return parts.length >= 2 ? `${parts[0]} ${parts[1]} MF` : `${parts[0]} MF`;
}

export default router;
