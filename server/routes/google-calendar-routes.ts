/**
 * Google Calendar Integration API Routes
 * Complies with FintekPro Global Coding Rules (GCR v1.0):
 * - Layered architecture (/api -> /services)
 * - Strict typing and input validation
 * - Standardized API responses: { success, data, meta }
 * - Never hardcode secrets; stateless architecture
 */

import { Router, Request, Response } from "express";
import { googleCalendarService } from "../services/google-calendar-service";
import { z } from "zod";

const router = Router();

/**
 * GET /api/google-calendar/status
 * Purpose: Tests and returns the connection and configuration status of Google Calendar.
 */
router.get("/status", async (req: Request, res: Response) => {
	try {
		const result = await googleCalendarService.testConnection();
		res.json({
			success: result.success,
			data: {
				isConfigured: googleCalendarService.isConfigured(),
				...result,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error_code: "CALENDAR_STATUS_CHECK_FAILED",
			message: error.message || "Failed to check calendar status",
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	}
});

/**
 * GET /api/google-calendar/oauth-url
 * Purpose: Generates the Google OAuth 2.0 authorization URL for calendar access consent.
 */
router.get("/oauth-url", async (req: Request, res: Response) => {
	try {
		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const redirectUri =
			process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
			`${baseUrl}/api/google-calendar/oauth-callback`;

		const oauthUrl = googleCalendarService.getOAuthUrl(redirectUri);

		res.json({
			success: true,
			data: {
				oauthUrl,
				redirectUri,
				instructions:
					"Open this URL in your browser to authorize Google Calendar. On consent, you will be redirected to the callback endpoint which provides the refresh token.",
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error_code: "OAUTH_URL_GENERATION_FAILED",
			message: error.message || "Failed to generate OAuth URL",
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	}
});

/**
 * GET /api/google-calendar/oauth-callback
 * Purpose: Receives the authorization code from Google OAuth redirect and exchanges it for tokens.
 */
router.get("/oauth-callback", async (req: Request, res: Response) => {
	try {
		const { code, error } = req.query;

		if (error) {
			return res.status(400).json({
				success: false,
				error_code: "OAUTH_ACCESS_DENIED",
				message: `Google OAuth denied: ${error}`,
				meta: {
					timestamp: new Date().toISOString(),
					version: "1.0.0",
				},
			});
		}

		if (!code || typeof code !== "string") {
			return res.status(400).json({
				success: false,
				error_code: "MISSING_AUTHORIZATION_CODE",
				message: "Authorization code missing in callback query params.",
				meta: {
					timestamp: new Date().toISOString(),
					version: "1.0.0",
				},
			});
		}

		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const redirectUri =
			process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
			`${baseUrl}/api/google-calendar/oauth-callback`;

		const tokens = await googleCalendarService.exchangeCodeForTokens(
			code,
			redirectUri,
		);

		res.json({
			success: true,
			message:
				"Google Calendar authorization successful! Configure GOOGLE_CALENDAR_REFRESH_TOKEN in your environment or Secret Manager with this refresh token.",
			data: {
				refreshTokenReceived: !!tokens.refreshToken,
				refreshToken: tokens.refreshToken,
				accessTokenExpiresIn: tokens.expiryDate,
				scope: tokens.scope,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error_code: "CODE_EXCHANGE_FAILED",
			message: error.message || "Failed to exchange authorization code for tokens",
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	}
});

/**
 * Schema for test event creation
 */
const testEventSchema = z.object({
	summary: z.string().min(1).default("FintekPro Client Consultation"),
	description: z.string().optional().default("Scheduled via FintekPro Advisory Platform"),
	durationMinutes: z.number().int().positive().default(30),
	createMeetLink: z.boolean().default(true),
	attendeeEmails: z.array(z.string().email()).optional(),
});

/**
 * POST /api/google-calendar/test-event
 * Purpose: Creates a verification event on the primary calendar to confirm write access and Meet generation.
 */
router.post("/test-event", async (req: Request, res: Response) => {
	try {
		const parsed = testEventSchema.parse(req.body || {});
		const startTime = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now
		const endTime = new Date(startTime.getTime() + parsed.durationMinutes * 60 * 1000);

		const result = await googleCalendarService.createEvent({
			summary: parsed.summary,
			description: parsed.description,
			startTime,
			endTime,
			attendeeEmails: parsed.attendeeEmails,
			createMeetLink: parsed.createMeetLink,
			userId: (req as any).user?.id || "admin-test",
		});

		res.json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error_code: "CREATE_EVENT_FAILED",
			message: error.message || "Failed to create Google Calendar test event",
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	}
});

/**
 * GET /api/google-calendar/events
 * Purpose: Lists upcoming events on the primary calendar.
 */
router.get("/events", async (req: Request, res: Response) => {
	try {
		const maxResults = Math.min(
			parseInt((req.query.limit as string) || "20", 10),
			50,
		);
		const events = await googleCalendarService.listUpcomingEvents(maxResults);

		res.json({
			success: true,
			data: events.map((e) => ({
				id: e.id,
				summary: e.summary,
				description: e.description,
				start: e.start?.dateTime || e.start?.date,
				end: e.end?.dateTime || e.end?.date,
				htmlLink: e.htmlLink,
				meetUrl: e.hangoutLink || undefined,
				status: e.status,
			})),
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
				total: events.length,
			},
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error_code: "FETCH_EVENTS_FAILED",
			message: error.message || "Failed to retrieve calendar events",
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	}
});

export default router;
