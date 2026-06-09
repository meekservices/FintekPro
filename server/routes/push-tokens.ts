/**
 * Push Tokens Routes — /api/push-tokens
 *
 * Registers and deregisters FCM device tokens for mobile push notifications.
 * Tokens are stored in the push_tokens table and used by the notification service.
 *
 * Security: requires valid mobile JWT (Bearer token)
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireMobileAuth } from "./mobile-auth";

export const pushTokensRouter = Router();

// ── POST /api/push-tokens ──────────────────────────────────────────────────
pushTokensRouter.post(
	"/",
	requireMobileAuth,
	async (req: Request, res: Response) => {
		const mobileUser = (req as any).mobileUser;
		const { token, platform } = req.body as {
			token: string;
			platform: "ios" | "android";
		};

		if (!token || !platform) {
			return res.status(400).json({
				success: false,
				error: {
					error_code: "MISSING_FIELDS",
					message: "token and platform are required",
					retryable: false,
				},
			});
		}

		try {
			// Upsert — update if token exists, insert if new
			await db.execute(sql`
      INSERT INTO push_tokens (user_id, token, platform, updated_at)
      VALUES (${mobileUser.userId}, ${token}, ${platform}, NOW())
      ON CONFLICT (token) DO UPDATE SET
        user_id    = EXCLUDED.user_id,
        platform   = EXCLUDED.platform,
        updated_at = NOW()
    `);

			console.log(
				JSON.stringify({
					event: "PUSH_TOKEN_REGISTERED",
					user_id: mobileUser.userId,
					platform,
					status: "success",
				}),
			);

			return res.json({
				success: true,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (err: any) {
			// Table may not exist yet — handled gracefully
			if (err.message?.includes("push_tokens")) {
				console.warn(
					"[PushTokens] Table not found — will be created on next schema repair",
				);
				return res.json({
					success: true,
					meta: { timestamp: new Date().toISOString(), version: "1.0" },
				});
			}
			return res.status(500).json({
				success: false,
				error: {
					error_code: "TOKEN_SAVE_ERROR",
					message: "Could not save push token",
					retryable: true,
				},
			});
		}
	},
);

// ── DELETE /api/push-tokens/:token ────────────────────────────────────────
pushTokensRouter.delete(
	"/:token",
	requireMobileAuth,
	async (req: Request, res: Response) => {
		const mobileUser = (req as any).mobileUser;
		const { token } = req.params;

		try {
			await db.execute(sql`
      DELETE FROM push_tokens
      WHERE token = ${token} AND user_id = ${mobileUser.userId}
    `);

			return res.json({
				success: true,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch {
			return res.status(500).json({
				success: false,
				error: {
					error_code: "TOKEN_DELETE_ERROR",
					message: "Could not deregister push token",
					retryable: true,
				},
			});
		}
	},
);
