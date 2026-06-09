import { Router, Request, Response } from "express";
import { logger } from "../logger";
import { irisWebhookHandler } from "../services/iris/irisWebhookHandler";
import {
	alpacaWebhookHandler,
	verifyAlpacaWebhookSignature,
} from "../services/alpaca/core/alpacaWebhookHandler";

const router = Router();

// ─── IRIS Webhook ────────────────────────────────────────────────────────────

router.post("/iris", async (req: Request, res: Response) => {
	try {
		const payload = req.body;
		const signature = req.headers["x-iris-signature"] as string;

		logger.info("[Webhook] Received IRIS webhook", {
			eventType: payload?.eventType,
		});

		await irisWebhookHandler.handleWebhook(payload, signature);

		res
			.status(200)
			.json({ success: true, message: "Webhook processed successfully" });
	} catch (error: any) {
		logger.error("[Webhook] Failed to process IRIS webhook", {
			error: error.message,
		});
		if (error.message.includes("signature")) {
			res.status(401).json({ success: false, message: "Invalid signature" });
		} else {
			res
				.status(500)
				.json({ success: false, message: "Internal server error" });
		}
	}
});

// ─── Alpaca Webhook ─────────────────────────────────────────────────────────
/**
 * POST /api/webhooks/alpaca
 *
 * Receives broker events from Alpaca (trade_updates, account_updates, journal_status).
 *
 * Security:
 *  - HMAC-SHA256 signature verified using ALPACA_WEBHOOK_SECRET env var
 *  - Raw body must be captured before JSON parsing (set in express config)
 *
 * Alpaca delivers a JSON payload with { event: string, data: object }.
 * See: https://docs.alpaca.markets/reference/events
 */
router.post("/alpaca", async (req: Request, res: Response) => {
	try {
		const payload = req.body;
		const signature = (req.headers["apca-signature"] as string) ?? "";
		// rawBody is attached by the express raw-body capture middleware (see server/index.ts)
		const rawBody: Buffer | undefined = (req as any).rawBody;

		// ── HMAC verification ───────────────────────────────────────────────────
		if (rawBody) {
			const isValid = verifyAlpacaWebhookSignature(rawBody, signature);
			if (!isValid) {
				logger.warn("[Webhook] Alpaca HMAC verification failed", {
					event: "ALPACA_WEBHOOK_SIGNATURE_INVALID",
					status: "rejected",
				});
				return res
					.status(401)
					.json({ success: false, message: "Invalid signature" });
			}
		} else {
			// rawBody not captured — this means express raw-body middleware is not mounted.
			// In production this is a hard reject: we cannot verify authenticity without the raw body.
			// In development/test, emit a warning and continue (allows local dev without extra middleware).
			if (process.env.NODE_ENV === "production") {
				logger.error(
					"[Webhook] Alpaca HMAC check SKIPPED — rawBody not available. " +
						"Ensure express raw-body capture middleware is registered before webhook routes. " +
						"Rejecting request to prevent unauthenticated event injection.",
					{
						event: "ALPACA_WEBHOOK_RAWBODY_MISSING",
						status: "rejected",
					},
				);
				return res.status(403).json({
					success: false,
					message:
						"Webhook rejected: signature could not be verified (server misconfiguration)",
				});
			}
			logger.warn(
				"[Webhook] rawBody not available for Alpaca HMAC check — " +
					"configure express raw-body middleware. Skipping in non-production only.",
				{
					event: "ALPACA_WEBHOOK_RAWBODY_MISSING_DEV",
				},
			);
		}

		logger.info("[Webhook] Received Alpaca webhook", {
			event: "ALPACA_WEBHOOK_RECEIVED",
			alpacaEvent: payload?.event,
			status: "processing",
		});

		await alpacaWebhookHandler.handleEvent(payload, rawBody, signature);

		return res
			.status(200)
			.json({
				success: true,
				message: "Alpaca webhook processed successfully",
			});
	} catch (error: any) {
		logger.error("[Webhook] Failed to process Alpaca webhook", {
			event: "ALPACA_WEBHOOK_ERROR",
			error: error.message,
			retryable: !error.message.includes("signature"),
			status: "error",
		});
		if (error.message.includes("signature")) {
			return res
				.status(401)
				.json({ success: false, message: "Invalid webhook signature" });
		}
		return res
			.status(500)
			.json({ success: false, message: "Internal server error" });
	}
});

export const webhookRoutes = router;
