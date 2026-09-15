/* eslint-disable no-console */
/**
 * Google Calendar Integration Service
 * Follows FintekPro Global Coding Rules (GCR v1.0):
 * - Layered architecture (/services)
 * - Strict typing and comprehensive JSDoc
 * - Observability with structured logs
 * - Self-healing retries with exponential backoff
 * - Secure credential handling via environment variables
 */

import {
	calendar as googleCalendar,
	calendar_v3,
	auth as googleAuth,
} from "@googleapis/calendar";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

type OAuth2ClientInstance = InstanceType<typeof googleAuth.OAuth2>;

/**
 * Interface for calendar event creation options
 */
export interface GoogleCalendarEventInput {
	summary: string;
	description?: string;
	location?: string;
	startTime: Date;
	endTime: Date;
	timeZone?: string;
	attendeeEmails?: string[];
	createMeetLink?: boolean;
	userId?: string | number;
	metadata?: Record<string, string>;
}

/**
 * Interface for created/updated event response
 */
export interface GoogleCalendarEventResult {
	eventId: string;
	htmlLink: string;
	status: string;
	meetUrl?: string;
	summary: string;
	startTime: string;
	endTime: string;
}

/**
 * Helper to pause execution for a given duration
 */
async function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an operation with exponential backoff on transient errors
 *
 * @param operation - The asynchronous operation to execute
 * @param operationName - Label for logging purposes
 * @param maxRetries - Maximum retry attempts (default: 3)
 */
async function withRetry<T>(
	operation: () => Promise<T>,
	operationName: string,
	maxRetries: number = MAX_RETRIES,
): Promise<T> {
	let lastError: unknown = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error: any) {
			lastError = error;
			const isTransient =
				error.code === "ECONNRESET" ||
				error.code === "ETIMEDOUT" ||
				error.code === "ENOTFOUND" ||
				(error.status >= 500 && error.status < 600) ||
				error.status === 429;

			if (!isTransient || attempt === maxRetries) {
				console.error(
					JSON.stringify({
						event: "GOOGLE_CALENDAR_OPERATION_FAILED",
						operation: operationName,
						attempt,
						error_code: error.code || error.status || "CALENDAR_ERROR",
						message: error.message || "Unknown error",
						retryable: false,
						timestamp: new Date().toISOString(),
					}),
				);
				throw error;
			}

			const delayMs = RETRY_DELAY_MS * 2 ** (attempt - 1);
			console.warn(
				JSON.stringify({
					event: "GOOGLE_CALENDAR_OPERATION_RETRY",
					operation: operationName,
					attempt,
					delay_ms: delayMs,
					message: error.message,
					timestamp: new Date().toISOString(),
				}),
			);
			await delay(delayMs);
		}
	}

	throw lastError;
}

/**
 * Service managing Google Calendar API interactions
 */
export class GoogleCalendarService {
	private oauth2Client: OAuth2ClientInstance | null = null;
	private calendarClient: calendar_v3.Calendar | null = null;
	private calendarId: string;

	constructor() {
		this.calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
		this.initializeClient();
	}

	/**
	 * Purpose: Initializes OAuth2 credentials and the Google Calendar v3 API client.
	 * Inputs: None (reads from environment variables).
	 * Outputs: void.
	 * Edge cases: Missing credentials will leave client uninitialized; methods check isConfigured().
	 */
	private initializeClient(): void {
		const clientId =
			process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
		const clientSecret =
			process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||
			process.env.GOOGLE_CLIENT_SECRET;
		const redirectUri =
			process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
			process.env.GOOGLE_REDIRECT_URI ||
			"https://developers.google.com/oauthplayground";
		const refreshToken =
			process.env.GOOGLE_CALENDAR_REFRESH_TOKEN ||
			process.env.GOOGLE_REFRESH_TOKEN;

		if (clientId && clientSecret && refreshToken) {
			this.oauth2Client = new googleAuth.OAuth2(
				clientId,
				clientSecret,
				redirectUri,
			);

			this.oauth2Client.setCredentials({
				refresh_token: refreshToken,
			});

			this.calendarClient = googleCalendar({
				version: "v3",
				auth: this.oauth2Client,
			});
		}
	}

	/**
	 * Purpose: Verifies whether Google Calendar credentials are fully configured in the environment.
	 * Inputs: None.
	 * Outputs: boolean indicating readiness.
	 * Edge cases: None.
	 */
	public isConfigured(): boolean {
		return !!(this.calendarClient && this.oauth2Client);
	}

	/**
	 * Purpose: Creates a new Google Calendar event, optionally with a Google Meet conference link.
	 * Inputs: GoogleCalendarEventInput containing event metadata, dates, attendees.
	 * Outputs: Promise<GoogleCalendarEventResult> with event ID, HTML link, and Meet URL if requested.
	 * Edge cases: Unconfigured client throws descriptive error; handles invalid emails and API quota limits.
	 */
	public async createEvent(
		input: GoogleCalendarEventInput,
	): Promise<GoogleCalendarEventResult> {
		const startTimeMs = Date.now();

		if (!this.isConfigured() || !this.calendarClient) {
			const error = {
				error_code: "CALENDAR_NOT_CONFIGURED",
				message:
					"Google Calendar credentials are not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.",
				retryable: false,
			};
			console.error(
				JSON.stringify({
					event: "GOOGLE_CALENDAR_CONFIG_ERROR",
					user_id: input.userId || "anonymous",
					...error,
				}),
			);
			throw new Error(error.message);
		}

		const timeZone =
			input.timeZone ||
			Intl.DateTimeFormat().resolvedOptions().timeZone ||
			"Asia/Kolkata";

		const requestBody: calendar_v3.Schema$Event = {
			summary: input.summary,
			description: input.description,
			location: input.location,
			start: {
				dateTime: input.startTime.toISOString(),
				timeZone,
			},
			end: {
				dateTime: input.endTime.toISOString(),
				timeZone,
			},
			attendees: input.attendeeEmails?.map((email) => ({ email })),
			reminders: {
				useDefault: false,
				overrides: [
					{ method: "email", minutes: 24 * 60 },
					{ method: "popup", minutes: 15 },
				],
			},
		};

		if (input.createMeetLink) {
			requestBody.conferenceData = {
				createRequest: {
					requestId: `fintekpro-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
					conferenceSolutionKey: {
						type: "hangoutsMeet",
					},
				},
			};
		}

		if (input.metadata) {
			requestBody.extendedProperties = {
				private: input.metadata,
			};
		}

		const eventResult = await withRetry(async () => {
			const response = await this.calendarClient!.events.insert({
				calendarId: this.calendarId,
				conferenceDataVersion: input.createMeetLink ? 1 : 0,
				requestBody,
			});
			return response.data;
		}, "events.insert");

		const latencyMs = Date.now() - startTimeMs;
		console.log(
			JSON.stringify({
				event: "GOOGLE_CALENDAR_EVENT_CREATED",
				user_id: input.userId || "system",
				latency_ms: latencyMs,
				status: "SUCCESS",
				event_id: eventResult.id,
				timestamp: new Date().toISOString(),
			}),
		);

		let meetUrl: string | undefined;
		if (eventResult.conferenceData?.entryPoints) {
			const videoEntry = eventResult.conferenceData.entryPoints.find(
				(ep) => ep.entryPointType === "video",
			);
			meetUrl = videoEntry?.uri || undefined;
		}

		return {
			eventId: eventResult.id || "",
			htmlLink: eventResult.htmlLink || "",
			status: eventResult.status || "confirmed",
			meetUrl,
			summary: eventResult.summary || input.summary,
			startTime: eventResult.start?.dateTime || input.startTime.toISOString(),
			endTime: eventResult.end?.dateTime || input.endTime.toISOString(),
		};
	}

	/**
	 * Purpose: Updates an existing event on Google Calendar.
	 * Inputs: eventId (string), partial input updates (summary, description, startTime, endTime, etc.).
	 * Outputs: Promise<GoogleCalendarEventResult>.
	 * Edge cases: Returns 404 if event does not exist; handles time updates without changing meeting URL.
	 */
	public async updateEvent(
		eventId: string,
		updates: Partial<GoogleCalendarEventInput>,
	): Promise<GoogleCalendarEventResult> {
		const startTimeMs = Date.now();

		if (!this.isConfigured() || !this.calendarClient) {
			throw new Error("Google Calendar credentials are not configured");
		}

		const patchBody: calendar_v3.Schema$Event = {};
		if (updates.summary) patchBody.summary = updates.summary;
		if (updates.description) patchBody.description = updates.description;
		if (updates.location) patchBody.location = updates.location;
		if (updates.startTime) {
			patchBody.start = {
				dateTime: updates.startTime.toISOString(),
				timeZone: updates.timeZone || "Asia/Kolkata",
			};
		}
		if (updates.endTime) {
			patchBody.end = {
				dateTime: updates.endTime.toISOString(),
				timeZone: updates.timeZone || "Asia/Kolkata",
			};
		}
		if (updates.attendeeEmails) {
			patchBody.attendees = updates.attendeeEmails.map((email) => ({ email }));
		}

		const eventResult = await withRetry(async () => {
			const response = await this.calendarClient!.events.patch({
				calendarId: this.calendarId,
				eventId,
				requestBody: patchBody,
			});
			return response.data;
		}, "events.patch");

		const latencyMs = Date.now() - startTimeMs;
		console.log(
			JSON.stringify({
				event: "GOOGLE_CALENDAR_EVENT_UPDATED",
				user_id: updates.userId || "system",
				latency_ms: latencyMs,
				status: "SUCCESS",
				event_id: eventId,
				timestamp: new Date().toISOString(),
			}),
		);

		return {
			eventId: eventResult.id || eventId,
			htmlLink: eventResult.htmlLink || "",
			status: eventResult.status || "confirmed",
			summary: eventResult.summary || "",
			startTime: eventResult.start?.dateTime || "",
			endTime: eventResult.end?.dateTime || "",
		};
	}

	/**
	 * Purpose: Deletes an event from Google Calendar.
	 * Inputs: eventId (string), optional userId for observability.
	 * Outputs: Promise<boolean> indicating success.
	 * Edge cases: Gracefully handles already deleted events (410 / 404).
	 */
	public async deleteEvent(
		eventId: string,
		userId?: string | number,
	): Promise<boolean> {
		const startTimeMs = Date.now();

		if (!this.isConfigured() || !this.calendarClient) {
			throw new Error("Google Calendar credentials are not configured");
		}

		try {
			await withRetry(async () => {
				await this.calendarClient!.events.delete({
					calendarId: this.calendarId,
					eventId,
				});
			}, "events.delete");

			const latencyMs = Date.now() - startTimeMs;
			console.log(
				JSON.stringify({
					event: "GOOGLE_CALENDAR_EVENT_DELETED",
					user_id: userId || "system",
					latency_ms: latencyMs,
					status: "SUCCESS",
					event_id: eventId,
					timestamp: new Date().toISOString(),
				}),
			);
			return true;
		} catch (error: any) {
			if (error.status === 404 || error.status === 410) {
				return true; // Already deleted
			}
			throw error;
		}
	}

	/**
	 * Purpose: Retrieves details of a specific Google Calendar event.
	 * Inputs: eventId (string).
	 * Outputs: Promise<calendar_v3.Schema$Event | null>.
	 * Edge cases: Returns null if event is not found.
	 */
	public async getEvent(
		eventId: string,
	): Promise<calendar_v3.Schema$Event | null> {
		if (!this.isConfigured() || !this.calendarClient) {
			throw new Error("Google Calendar credentials are not configured");
		}

		try {
			const res = await withRetry(async () => {
				return await this.calendarClient!.events.get({
					calendarId: this.calendarId,
					eventId,
				});
			}, "events.get");
			return res.data;
		} catch (error: any) {
			if (error.status === 404) {
				return null;
			}
			throw error;
		}
	}
}

export const googleCalendarService = new GoogleCalendarService();
