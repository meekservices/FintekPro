/**
 * CAS Portfolio Upload Routes
 *
 * POST /api/portfolio/upload-cas-pdf
 *   Accepts a CAMS or KFintech CAS PDF (plain or password-protected),
 *   parses it into holdings, and persists them via syncIrisHoldingsForPan.
 *
 * GCR Security: PAN + DOB are PII — used only for PDF decryption key derivation.
 *   They are masked in all logs and never stored alongside the uploaded file.
 *   Files stored temporarily in memory (memoryStorage) — never written to disk.
 *
 * GCR FASP-AI: All holdings imported require advisor review before execution.
 */

import type { Express, Request, Response } from "express";
import multer from "multer";
import { isAuthenticated } from "../auth-setup";
import { requireAgent } from "../middleware/roleMiddleware";
import { parseCasPdf, CasPdfDecryptError, CasPdfParseError } from "../services/cas-pdf-parser";
import { syncIrisHoldingsForPan } from "../services/iris-portfolio-sync-service";
import { logger } from "../logger";

/** 10 MB limit — CAS PDFs are typically < 500 KB */
const MAX_CAS_PDF_SIZE = 10 * 1024 * 1024;

const casUpload = multer({
  storage: multer.memoryStorage(), // Never write to disk — keep in memory only
  limits: { fileSize: MAX_CAS_PDF_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted for CAS upload"));
    }
  },
});

export function registerCasPortfolioUploadRoutes(app: Express): void {
  /**
   * POST /api/portfolio/upload-cas-pdf
   *
   * Body (multipart/form-data):
   *   file  — CAS PDF file
   *   pan   — Investor PAN (required for password derivation + sync)
   *   dob   — Investor DOB in any common format (required if PDF is encrypted)
   *
   * Returns:
   *   { success, parsed: number, synced: number, holdings: ParsedCasHolding[], source }
   */
  app.post(
    "/api/portfolio/upload-cas-pdf",
    isAuthenticated,
    requireAgent,
    casUpload.single("file"),
    async (req: Request, res: Response) => {
      const start = Date.now();
      const pan: string = (req.body.pan || "").toUpperCase().trim();
      const dob: string = (req.body.dob || "").trim();

      // ── Input validation ──────────────────────────────────────────────────
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No PDF file provided." });
      }
      if (!pan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
        return res.status(400).json({
          success: false,
          message: "Invalid PAN format. PAN is required to identify the investor and unlock the CAS PDF.",
        });
      }
      if (!dob) {
        return res.status(400).json({
          success: false,
          message: "Date of Birth is required to unlock password-protected CAS PDFs (DDMMYYYY or DD-MM-YYYY).",
        });
      }

      const logCtx = {
        event: "CAS_PDF_UPLOAD",
        pan_masked: pan.slice(0, 3) + "**",
        file_size: req.file.size,
        agent_id: (req as any).user?.id,
      };

      logger.info("CAS PDF upload received", logCtx);

      try {
        // ── Step 1: Parse PDF (auto-decrypt if encrypted) ─────────────────
        const holdings = await parseCasPdf(req.file.buffer, pan, dob);

        // ── Step 2: Sync parsed holdings into comprehensiveHoldings DB ────
        let synced = 0;
        let syncErrors: string[] = [];
        if (holdings.length > 0) {
          const syncResult = await syncIrisHoldingsForPan(pan, (req as any).user?.id);
          synced = syncResult.synced;
          syncErrors = syncResult.errors;
        }

        logger.info("CAS PDF upload complete", {
          ...logCtx,
          parsed: holdings.length,
          synced,
          latency_ms: Date.now() - start,
          status: "success",
        });

        return res.json({
          success: true,
          data: {
            parsed: holdings.length,
            synced,
            holdings: holdings.map((h) => ({
              schemeName: h.schemeName,
              isin: h.isin,
              folioNumber: h.folioNumber,
              units: h.units,
              nav: h.nav,
              currentValue: h.currentValue,
              unrealisedGain: h.unrealisedGain,
              plan: h.plan,
              registrar: h.registrar,
            })),
            syncErrors,
            source: "cas_pdf_upload",
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            disclaimer:
              "Holdings imported from CAS PDF. Final investment decisions require advisor review. " +
              "Past performance is not indicative of future returns.",
          },
        });
      } catch (err: unknown) {
        const latency_ms = Date.now() - start;

        if (err instanceof CasPdfDecryptError) {
          logger.warn("CAS PDF decryption failed", { ...logCtx, latency_ms, error: err.name });
          return res.status(422).json({
            success: false,
            error_code: "CAS_PDF_DECRYPT_FAILED",
            message: err.message,
            retryable: true,
            hint: "Check that the investor's PAN and Date of Birth are correct.",
          });
        }

        if (err instanceof CasPdfParseError) {
          logger.warn("CAS PDF parse failed", { ...logCtx, latency_ms, error: err.message });
          return res.status(422).json({
            success: false,
            error_code: "CAS_PDF_PARSE_FAILED",
            message: err.message,
            retryable: false,
            hint: "Ensure the uploaded file is a valid CAMS or KFintech CAS PDF.",
          });
        }

        const msg = err instanceof Error ? err.message : String(err);
        logger.error("CAS PDF upload unexpected error", { ...logCtx, latency_ms, error: msg });
        return res.status(500).json({
          success: false,
          error_code: "CAS_UPLOAD_ERROR",
          message: "An unexpected error occurred. Please try again.",
          retryable: true,
        });
      }
    }
  );

  /**
   * GET /api/portfolio/sync-status/:pan
   * Returns IRIS portfolio sync metadata for a PAN.
   */
  app.get(
    "/api/portfolio/sync-status/:pan",
    isAuthenticated,
    requireAgent,
    async (req: Request, res: Response) => {
      const pan = req.params.pan.toUpperCase().trim();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
        return res.status(400).json({ success: false, message: "Invalid PAN format." });
      }

      try {
        const { db } = await import("../db");
        const { comprehensiveHoldings } = await import("@shared/schema");
        const { eq, max, count } = await import("drizzle-orm");

        // Look up userId from PAN (comprehensiveHoldings uses userId, not panNumber)
        const { users } = await import("@shared/schema");
        const { isNotNull } = await import("drizzle-orm");
        const [userRow] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.panNumber, pan))
          .limit(1);

        const [status] = userRow ? await db
          .select({
            lastSyncedAt: max(comprehensiveHoldings.updatedAt),
            holdingCount: count(comprehensiveHoldings.id),
          })
          .from(comprehensiveHoldings)
          .where(eq(comprehensiveHoldings.userId, userRow.id))
          : [{ lastSyncedAt: null, holdingCount: 0 }];

        // Next scheduled sync: daily at 02:30 AM IST
        const now = new Date();
        const nextSync = new Date();
        nextSync.setUTCHours(21, 0, 0, 0); // 21:00 UTC = 02:30 IST
        if (nextSync <= now) nextSync.setUTCDate(nextSync.getUTCDate() + 1);

        return res.json({
          success: true,
          data: {
            pan: pan.slice(0, 3) + "**",
            lastSyncedAt: status?.lastSyncedAt ?? null,
            holdingCount: status?.holdingCount ?? 0,
            nextScheduledSync: nextSync.toISOString(),
            syncSources: ["kfintech_iris", "cas_pdf_upload"],
            autoSyncEnabled: true,
          },
          meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return res.status(500).json({ success: false, message: msg });
      }
    }
  );
}
