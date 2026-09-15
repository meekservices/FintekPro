/* eslint-disable no-console */
/**
 * Unified Video Conferencing Service
 * Orchestrates Google Meet, Zoho Meeting, and Microsoft Teams.
 * Complies with FintekPro Global Coding Rules (GCR v1.0):
 * - Layered architecture (/services)
 * - Self-healing fallback: Primary provider -> Secondary fallback
 * - Provider switcher between: Google Meet, Zoho Meeting, Microsoft Teams
 * - Structured logs and strict TypeScript typing
 */

import { googleCalendarService } from "./google-calendar-service";
import { zohoMeetingService } from "./zoho-meeting-service";
import { teamsMeetingService } from "./teams-meeting-service";

export type VideoPlatform = "google" | "zoho" | "teams" | "auto";

export interface CreateVideoMeetingParams {
	topic: string;
	description?: string;
	startTime: Date;
	duration: number; // in minutes
	timezone?: string;
	participantEmails?: string[];
	platform?: VideoPlatform;
	userId?: string | number;
}

export interface VideoMeetingSessionResult {
	platform: "google" | "zoho" | "teams";
	meetingId: string;
	joinLink: string;
	startLink: string;
	topic: string;
	startTime: string;
	providerFallbackOccurred?: boolean;
}

export interface VideoProviderStatus {
	provider: "google" | "zoho" | "teams";
	displayName: string;
	isConfigured: boolean;
	description: string;
}

export class VideoConferencingService {
	/**
	 * Purpose: Inspects and returns the configuration health of all supported video platforms.
	 * Inputs: None.
	 * Outputs: VideoProviderStatus[] list of providers with status.
	 * Edge cases: None.
	 */
	public getAvailableProviders(): VideoProviderStatus[] {
		return [
			{
				provider: "google",
				displayName: "Google Meet",
				isConfigured: googleCalendarService.isConfigured(),
				description: "Google Calendar & Meet integration (OAuth 2.0)",
			},
			{
				provider: "zoho",
				displayName: "Zoho Meeting",
				isConfigured: !!(
					process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET
				),
				description: "Zoho Meeting API integration",
			},
			{
				provider: "teams",
				displayName: "Microsoft Teams",
				isConfigured: teamsMeetingService.isConfigured(),
				description: "Microsoft Graph onlineMeetings integration",
			},
		];
	}

	/**
	 * Purpose: Schedules a video meeting using the preferred or auto-selected provider with self-healing fallback.
	 * Inputs: CreateVideoMeetingParams (topic, description, startTime, duration, timezone, participantEmails, platform, userId).
	 * Outputs: Promise<VideoMeetingSessionResult> with joinLink, startLink, platform, and meetingId.
	 * Edge cases: Falls back to secondary provider if primary fails or is unconfigured.
	 */
	public async createMeeting(
		params: CreateVideoMeetingParams,
	): Promise<VideoMeetingSessionResult> {
		const platformChoice = params.platform || "auto";
		const startTimeMs = Date.now();

		// 1. Explicit or Auto Google Meet
		if (
			platformChoice === "google" ||
			(platformChoice === "auto" && googleCalendarService.isConfigured())
		) {
			try {
				const endTime = new Date(
					params.startTime.getTime() + (params.duration || 30) * 60 * 1000,
				);

				const event = await googleCalendarService.createEvent({
					summary: params.topic,
					description: params.description,
					startTime: params.startTime,
					endTime,
					timeZone: params.timezone || "Asia/Kolkata",
					attendeeEmails: params.participantEmails,
					createMeetLink: true,
					userId: params.userId,
				});

				const joinLink = event.meetUrl || event.htmlLink;
				const startLink = event.htmlLink || joinLink;

				console.log(
					JSON.stringify({
						event: "VIDEO_MEETING_CREATED",
						provider: "google",
						user_id: params.userId || "system",
						latency_ms: Date.now() - startTimeMs,
						status: "SUCCESS",
						meeting_id: event.eventId,
						timestamp: new Date().toISOString(),
					}),
				);

				return {
					platform: "google",
					meetingId: event.eventId,
					joinLink,
					startLink,
					topic: event.summary,
					startTime: event.startTime,
				};
			} catch (error: any) {
				console.warn(
					JSON.stringify({
						event: "VIDEO_MEETING_PROVIDER_FAILED",
						provider: "google",
						error: error.message,
						timestamp: new Date().toISOString(),
					}),
				);

				if (platformChoice === "google") {
					throw error;
				}
			}
		}

		// 2. Explicit Microsoft Teams
		if (platformChoice === "teams") {
			try {
				const teamsSession = await teamsMeetingService.createMeeting({
					topic: params.topic,
					description: params.description,
					startTime: params.startTime,
					duration: params.duration || 30,
					timezone: params.timezone,
					participantEmails: params.participantEmails,
					userId: params.userId,
				});

				return {
					platform: "teams",
					meetingId: teamsSession.meetingId,
					joinLink: teamsSession.joinLink,
					startLink: teamsSession.startLink,
					topic: teamsSession.topic,
					startTime: teamsSession.startTime,
				};
			} catch (error: any) {
				console.error(
					JSON.stringify({
						event: "VIDEO_MEETING_PROVIDER_FAILED",
						provider: "teams",
						error: error.message,
						timestamp: new Date().toISOString(),
					}),
				);
				throw error;
			}
		}

		// 3. Zoho Meeting (or Auto fallback)
		const zohoRes = await zohoMeetingService.createMeeting({
			topic: params.topic,
			agenda: params.description,
			startTime: params.startTime,
			duration: params.duration || 30,
			timezone: params.timezone,
			participantEmails: params.participantEmails,
		});

		console.log(
			JSON.stringify({
				event: "VIDEO_MEETING_CREATED",
				provider: "zoho",
				user_id: params.userId || "system",
				latency_ms: Date.now() - startTimeMs,
				status: "SUCCESS",
				meeting_id: zohoRes.meetingId,
				timestamp: new Date().toISOString(),
			}),
		);

		return {
			platform: "zoho",
			meetingId: zohoRes.meetingId,
			joinLink: zohoRes.joinLink,
			startLink: zohoRes.startLink,
			topic: zohoRes.topic,
			startTime: zohoRes.startTime,
			providerFallbackOccurred: platformChoice === "auto",
		};
	}

	/**
	 * Purpose: Cancels a video meeting across whichever platform it was created on.
	 * Inputs: meetingId (string), platformHint (optional "google" | "zoho" | "teams"), userId (optional).
	 * Outputs: Promise<boolean>.
	 * Edge cases: Gracefully ignores already cancelled or deleted meetings.
	 */
	public async cancelMeeting(
		meetingId: string,
		platformHint?: "google" | "zoho" | "teams",
		userId?: string | number,
	): Promise<boolean> {
		if (!meetingId) return true;

		// Route based on hint or ID format
		if (platformHint === "teams" || meetingId.startsWith("teams-")) {
			return await teamsMeetingService.cancelMeeting(meetingId);
		}

		const isGoogle =
			platformHint === "google" ||
			(!platformHint && /^[a-v0-9]{20,}$/i.test(meetingId));

		if (isGoogle) {
			try {
				await googleCalendarService.deleteEvent(meetingId, userId);
				return true;
			} catch (err: any) {
				console.error("Failed to delete Google Calendar event:", err.message);
			}
		}

		return await zohoMeetingService.cancelMeeting(meetingId);
	}
}

export const videoConferencingService = new VideoConferencingService();
