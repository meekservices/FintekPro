/**
 * Push Notification Admin Route — /api/notifications/send
 *
 * Internal endpoint for admins and the system to trigger push notifications.
 * Also exposes a test endpoint for verifying FCM setup.
 *
 * FintekPro GCR v1.0: All sends are logged, no raw Firebase credentials exposed.
 */

import { Router, Request, Response } from "express";
import {
	sendPushToUser,
	sendPushToUsers,
	notify,
} from "../services/fcm-notification-service";

export const notificationsRouter = Router();

/** Middleware: only allow admin users or internal service calls */
function requireAdminOrService(req: Request, res: Response, next: Function) {
	// Mobile JWT path
	const mobileUser = (req as any).mobileUser;
	if (
		mobileUser?.roles?.some((r: string) => ["admin", "super_admin"].includes(r))
	) {
		return next();
	}
	// Web session path
	const sessionUser = (req as any).user;
	if (
		sessionUser?.roles?.some((r: string) =>
			["admin", "super_admin"].includes(r),
		)
	) {
		return next();
	}
	// Internal service-to-service call (from other backend processes)
	const serviceHeader = req.headers["x-fintekpro-service"];
	if (serviceHeader === process.env.INTERNAL_SERVICE_SECRET) {
		return next();
	}
	return res.status(403).json({
		success: false,
		error: {
			error_code: "FORBIDDEN",
			message: "Admin access required",
			retryable: false,
		},
	});
}

// ── POST /api/notifications/send ──────────────────────────────────────────
notificationsRouter.post(
	"/send",
	requireAdminOrService,
	async (req: Request, res: Response) => {
		const { userId, userIds, title, body, data, imageUrl } = req.body;

		if (!title || !body) {
			return res.status(400).json({
				success: false,
				error: {
					error_code: "MISSING_FIELDS",
					message: "title and body are required",
					retryable: false,
				},
			});
		}

		const payload = { title, body, data, imageUrl };

		try {
			let result;
			if (userIds && Array.isArray(userIds) && userIds.length > 0) {
				result = await sendPushToUsers(userIds, payload);
			} else if (userId) {
				result = await sendPushToUser(userId, payload);
			} else {
				return res.status(400).json({
					success: false,
					error: {
						error_code: "MISSING_TARGET",
						message: "userId or userIds required",
						retryable: false,
					},
				});
			}

			return res.json({
				success: result.success,
				data: {
					successCount: result.successCount,
					failureCount: result.failureCount,
					errors: result.errors,
				},
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (err: any) {
			return res.status(500).json({
				success: false,
				error: {
					error_code: "PUSH_ERROR",
					message: err.message,
					retryable: true,
				},
			});
		}
	},
);

// ── POST /api/notifications/test ──────────────────────────────────────────
// Admin-only: send a test push to yourself to verify FCM is working
notificationsRouter.post(
	"/test",
	requireAdminOrService,
	async (req: Request, res: Response) => {
		const sessionUser = (req as any).user;
		const mobileUser = (req as any).mobileUser;
		const userId = sessionUser?.id ?? mobileUser?.userId;

		if (!userId) {
			return res
				.status(401)
				.json({
					success: false,
					error: {
						error_code: "UNAUTHENTICATED",
						message: "Login required",
						retryable: false,
					},
				});
		}

		const result = await sendPushToUser(userId, {
			title: "🔔 FintekPro Push Test",
			body: "Firebase Cloud Messaging is working correctly!",
			data: { type: "test" },
		});

		return res.json({
			success: result.success,
			data: result,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	},
);
