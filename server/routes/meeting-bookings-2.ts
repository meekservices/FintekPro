/* eslint-disable no-console */
import { Router } from "express";
import { db } from "../db";
import { meetingBookings, users, agentLeads, prospectClients, leadActivities } from "@shared/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { zohoMeetingService } from "../services/zoho-meeting-service";
import { videoConferencingService, VideoPlatform } from "../services/video-conferencing-service";
import { meetingNotificationService } from "../services/meeting-notification-service";
import { z } from "zod";

const router = Router();

router.get("/available-agents", async (req, res) => {
	try {
		const agents = await db
			.select({
				id: users.id,
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
				roles: users.roles,
			})
			.from(users);

		const filteredAgents = agents
			.filter((a) => a.roles?.includes("partner") || a.roles?.includes("agent"))
			.map((a) => ({
				id: a.id,
				fullName: `${a.firstName || ""} ${a.lastName || ""}`.trim() || "Partner",
				email: a.email,
				role: "partner",
			}));

		res.json({ agents: filteredAgents });
	} catch (error: any) {
		console.error("Fetch agents error:", error);
		res.status(500).json({ error: "Failed to fetch agents" });
	}
});

async function resolveOrCreateContactUser(
	name: string,
	email: string,
	mobile?: string | null,
	role: "lead" | "prospect" | "guest" = "lead",
): Promise<string> {
	// 1. Check if user exists by email
	if (email && email.trim()) {
		const existingByEmail = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, email.toLowerCase().trim()))
			.limit(1);

		if (existingByEmail.length > 0) {
			return existingByEmail[0].id;
		}
	}

	// 2. Check if user exists by mobile
	if (mobile && mobile.trim()) {
		const cleanPhone = mobile.replace(/\D/g, "").slice(-10);
		if (cleanPhone.length === 10) {
			const existingByPhone = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.mobile, cleanPhone))
				.limit(1);

			if (existingByPhone.length > 0) {
				return existingByPhone[0].id;
			}
		}
	}

	// 3. Create lightweight contact user to satisfy foreign key constraint
	const parts = (name || "Contact").trim().split(" ");
	const firstName = parts[0] || "Contact";
	const lastName = parts.slice(1).join(" ") || "";
	const safeEmail = email && email.trim()
		? email.toLowerCase().trim()
		: `${role}_${Date.now()}@fintekpro.internal`;
	const safeUserId = `${role}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

	const [created] = await db
		.insert(users)
		.values({
			userId: safeUserId,
			firstName,
			lastName,
			email: safeEmail,
			mobile: mobile || undefined,
			password: sql`gen_random_uuid()`,
			roles: ["user", role],
		})
		.returning({ id: users.id });

	return created.id;
}

const agentBookMeetingSchema = z.object({
	attendeeType: z.enum(["client", "lead", "prospect", "guest"]).default("client").optional(),
	clientId: z.string().optional(),
	leadId: z.string().optional(),
	prospectId: z.string().optional(),
	guestName: z.string().optional(),
	guestEmail: z.string().optional(),
	topic: z.string().min(3, "Topic must be at least 3 characters"),
	description: z.string().optional(),
	scheduledAt: z.string().transform((val) => new Date(val)),
	duration: z.number().min(15).max(120).default(30),
	timezone: z.string().default("Asia/Kolkata"),
	platform: z.enum(["google", "zoho", "teams", "auto"]).default("auto").optional(),
	agentNotes: z.string().optional(),
});

router.get("/providers", (req, res) => {
	res.json({
		success: true,
		providers: videoConferencingService.getAvailableProviders(),
		defaultProvider: "google",
	});
});

router.post("/agent-book", async (req, res) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const data = agentBookMeetingSchema.parse(req.body);

		const agent = await db
			.select()
			.from(users)
			.where(eq(users.id, agentId))
			.limit(1);

		const agentRoles = agent[0].roles || [];
		if (
			agent.length === 0 ||
			!agentRoles.some((r: string) => ["agent", "admin", "partner"].includes(r))
		) {
			return res
				.status(403)
				.json({ error: "Only agents can schedule meetings" });
		}

		let attendeeName = "";
		let attendeeEmail = "";
		let resolvedUserId = "";
		const attendeeType = data.attendeeType || "client";

		if (attendeeType === "client" && data.clientId) {
			const client = await db
				.select()
				.from(users)
				.where(eq(users.id, data.clientId))
				.limit(1);

			if (client.length === 0) {
				return res.status(404).json({ error: "Client not found" });
			}
			resolvedUserId = client[0].id;
			attendeeName = `${client[0].firstName || ""} ${client[0].lastName || ""}`.trim() || client[0].userId;
			attendeeEmail = client[0].email || "";
		} else if (attendeeType === "lead" && data.leadId) {
			const leadRecord = await db
				.select()
				.from(agentLeads)
				.where(eq(agentLeads.id, data.leadId))
				.limit(1);

			if (leadRecord.length === 0) {
				return res.status(404).json({ error: "Lead not found" });
			}
			attendeeName = leadRecord[0].name;
			attendeeEmail = leadRecord[0].email || "";
			resolvedUserId = await resolveOrCreateContactUser(attendeeName, attendeeEmail, leadRecord[0].phone, "lead");

			// Log touchpoint in leadActivities
			try {
				await db.insert(leadActivities).values({
					leadId: data.leadId,
					activityType: "meeting",
					subject: `Video Meeting: ${data.topic}`,
					description: `Scheduled for ${data.scheduledAt.toLocaleString()}`,
					outcome: "confirmed",
					performedBy: agentId,
				});
			} catch (_logErr) {
				// non-blocking
			}
		} else if (attendeeType === "prospect" && data.prospectId) {
			const prospect = await db
				.select()
				.from(prospectClients)
				.where(eq(prospectClients.id, data.prospectId))
				.limit(1);

			if (prospect.length === 0) {
				return res.status(404).json({ error: "Prospect not found" });
			}
			attendeeName = prospect[0].name;
			attendeeEmail = prospect[0].email || "";
			resolvedUserId = await resolveOrCreateContactUser(attendeeName, attendeeEmail, prospect[0].mobile, "prospect");
		} else if (attendeeType === "guest") {
			if (!data.guestName || !data.guestEmail) {
				return res.status(400).json({ error: "Guest name and email are required" });
			}
			attendeeName = data.guestName;
			attendeeEmail = data.guestEmail;
			resolvedUserId = await resolveOrCreateContactUser(attendeeName, attendeeEmail, undefined, "guest");
		} else if (data.clientId) {
			const client = await db
				.select()
				.from(users)
				.where(eq(users.id, data.clientId))
				.limit(1);

			if (client.length > 0) {
				resolvedUserId = client[0].id;
				attendeeName = `${client[0].firstName || ""} ${client[0].lastName || ""}`.trim() || client[0].userId;
				attendeeEmail = client[0].email || "";
			}
		}

		if (!resolvedUserId) {
			return res.status(400).json({ error: "Unable to resolve meeting attendee" });
		}

		const participantEmails = [attendeeEmail, agent[0].email].filter(
			Boolean,
		) as string[];

		const meetingSession = await videoConferencingService.createMeeting({
			topic: data.topic,
			description: data.description,
			startTime: data.scheduledAt,
			duration: data.duration,
			timezone: data.timezone,
			participantEmails,
			platform: (data.platform as VideoPlatform) || "auto",
			userId: agentId,
		});

		const [booking] = await db
			.insert(meetingBookings)
			.values({
				clientId: resolvedUserId,
				agentId: agentId,
				topic: data.topic,
				description: data.description,
				scheduledAt: data.scheduledAt,
				duration: data.duration,
				timezone: data.timezone,
				zohoMeetingId: meetingSession.meetingId,
				joinLink: meetingSession.joinLink,
				startLink: meetingSession.startLink,
				status: "confirmed",
				agentNotes: data.agentNotes,
				confirmedAt: new Date(),
			})
			.returning();

		res.json({
			success: true,
			booking: {
				...booking,
				clientName: attendeeName,
				clientEmail: attendeeEmail,
				attendeeType,
			},
		});
	} catch (error: any) {
		console.error("Agent meeting booking error:", error);
		if (error instanceof z.ZodError) {
			return res.status(400).json({ error: error.issues[0].message });
		}
		res.status(500).json({ error: error.message || "Failed to book meeting" });
	}
});

router.get("/agent-clients", async (req, res) => {
	try {
		const user = (req as any).user;
		if (!user?.id) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const userRoles = user.roles || [];
		if (
			!userRoles.some((r: string) => ["agent", "admin", "partner"].includes(r))
		) {
			return res
				.status(403)
				.json({ error: "Access denied. Agent role required." });
		}

		// 1. Registered Clients
		const allUsers = await db
			.select({
				id: users.id,
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
				userId: users.userId,
				roles: users.roles,
			})
			.from(users);

		const clients = allUsers
			.filter((u) => u.roles?.includes("user"))
			.map((u) => ({
				id: u.id,
				fullName: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.userId,
				email: u.email || "",
				attendeeType: "client" as const,
			}));

		// 2. Leads from Pipeline
		let leads: Array<{ id: string; leadId: string; fullName: string; email: string; attendeeType: "lead"; tier?: string; stage?: string }> = [];
		try {
			const leadRows = await db
				.select()
				.from(agentLeads)
				.where(eq(agentLeads.agentId, user.id));

			leads = leadRows.map((l) => ({
				id: `lead_${l.id}`,
				leadId: l.id,
				fullName: l.name,
				email: l.email || "",
				attendeeType: "lead" as const,
				tier: l.score ? `Score ${l.score}` : undefined,
				stage: l.stage || undefined,
			}));
		} catch (err) {
			console.warn("Could not fetch agent leads for meetings:", err);
		}

		// 3. Prospects from HNI Prospects
		let prospects: Array<{ id: string; prospectId: string; fullName: string; email: string; attendeeType: "prospect"; tier?: string }> = [];
		try {
			const prospectRows = await db
				.select()
				.from(prospectClients);

			prospects = prospectRows.map((p) => ({
				id: `prospect_${p.id}`,
				prospectId: p.id,
				fullName: p.name,
				email: p.email || "",
				attendeeType: "prospect" as const,
				tier: p.clientType ? `${p.clientType.toUpperCase()} HNI` : "👑 HNI",
			}));
		} catch (err) {
			console.warn("Could not fetch prospects for meetings:", err);
		}

		res.json({
			clients,
			leads,
			prospects,
			allAttendees: [...clients, ...leads, ...prospects],
		});
	} catch (error: any) {
		console.error("Fetch clients error:", error);
		res.status(500).json({ error: "Failed to fetch clients" });
	}
});

// Client request meeting (pending status - needs agent approval)
const requestMeetingSchema = z.object({
	agentId: z.string().optional(), // Optional - can be auto-assigned
	topic: z.string().min(3, "Topic must be at least 3 characters"),
	description: z.string().optional(),
	preferredDate: z.string().transform((val) => new Date(val)),
	preferredTime: z.string().optional(),
	duration: z.number().min(15).max(120).default(30),
	clientNotes: z.string().optional(),
});

router.post("/request", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const data = requestMeetingSchema.parse(req.body);

		// If no agent specified, try to find an available agent
		let agentId = data.agentId;
		if (!agentId) {
			const availableAgents = await db
				.select({ id: users.id, roles: users.roles })
				.from(users);

			const agents = availableAgents.filter((u) => {
				const roles = u.roles || [];
				return roles.includes("partner") || roles.includes("agent") || roles.includes("admin");
			});

			if (agents.length > 0) {
				agentId = agents[0].id;
			}
		}

		if (!agentId) {
			return res
				.status(400)
				.json({ error: "No agents available. Please try again later." });
		}

		// Create meeting request with pending status (no Zoho meeting yet)
		const [request] = await db
			.insert(meetingBookings)
			.values({
				clientId: userId,
				agentId: agentId,
				topic: data.topic,
				description: data.description,
				scheduledAt: data.preferredDate,
				duration: data.duration,
				timezone: "Asia/Kolkata",
				status: "pending",
				clientNotes: data.clientNotes,
			})
			.returning();

		// Get agent details for response
		const agent = await db
			.select({
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
			})
			.from(users)
			.where(eq(users.id, agentId))
			.limit(1);

		res.json({
			success: true,
			request: {
				...request,
				agentName: agent[0]
					? `${agent[0].firstName || ""} ${agent[0].lastName || ""}`.trim()
					: "Agent",
			},
			message:
				"Meeting request submitted. An agent will review and confirm your meeting shortly.",
		});
	} catch (error: any) {
		console.error("Meeting request error:", error);
		if (error instanceof z.ZodError) {
			return res.status(400).json({ error: error.issues[0].message });
		}
		res
			.status(500)
			.json({ error: error.message || "Failed to submit meeting request" });
	}
});

// Get pending meeting requests (for agents)
router.get("/pending-requests", async (req, res) => {
	try {
		const user = (req as any).user;
		if (!user?.id) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const userRoles = user.roles || [];
		if (
			!userRoles.some((r: string) => ["agent", "admin", "partner"].includes(r))
		) {
			return res
				.status(403)
				.json({ error: "Access denied. Agent role required." });
		}

		const requests = await db
			.select({
				id: meetingBookings.id,
				topic: meetingBookings.topic,
				description: meetingBookings.description,
				scheduledAt: meetingBookings.scheduledAt,
				duration: meetingBookings.duration,
				clientId: meetingBookings.clientId,
				clientNotes: meetingBookings.clientNotes,
				createdAt: meetingBookings.createdAt,
			})
			.from(meetingBookings)
			.where(
				and(
					eq(meetingBookings.agentId, user.id),
					eq(meetingBookings.status, "pending"),
				),
			)
			.orderBy(desc(meetingBookings.createdAt));

		const requestsWithClients = await Promise.all(
			requests.map(async (req) => {
				const client = await db
					.select({
						firstName: users.firstName,
						lastName: users.lastName,
						email: users.email,
					})
					.from(users)
					.where(eq(users.id, req.clientId))
					.limit(1);
				return {
					...req,
					clientName: client[0]
						? `${client[0].firstName || ""} ${client[0].lastName || ""}`.trim() ||
							"Client"
						: "Client",
					clientEmail: client[0]?.email,
				};
			}),
		);

		res.json({ requests: requestsWithClients });
	} catch (error: any) {
		console.error("Fetch pending requests error:", error);
		res.status(500).json({ error: "Failed to fetch pending requests" });
	}
});

// Approve meeting request (creates Zoho meeting)
router.post("/:id/approve", async (req, res) => {
	try {
		const user = (req as any).user;
		if (!user?.id) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const userRoles = user.roles || [];
		if (
			!userRoles.some((r: string) => ["agent", "admin", "partner"].includes(r))
		) {
			return res
				.status(403)
				.json({ error: "Access denied. Agent role required." });
		}

		const { id } = req.params;
		const { scheduledAt, agentNotes } = req.body;

		// Get the pending meeting request
		const [request] = await db
			.select()
			.from(meetingBookings)
			.where(
				and(eq(meetingBookings.id, id), eq(meetingBookings.status, "pending")),
			)
			.limit(1);

		if (!request) {
			return res
				.status(404)
				.json({ error: "Meeting request not found or already processed" });
		}

		// Get participant details
		const client = await db
			.select({
				email: users.email,
				firstName: users.firstName,
				lastName: users.lastName,
			})
			.from(users)
			.where(eq(users.id, request.clientId))
			.limit(1);

		const agent = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, user.id))
			.limit(1);

		const participantEmails = [client[0]?.email, agent[0]?.email].filter(
			Boolean,
		) as string[];

		// Use provided scheduledAt or the original preferred date
		const meetingTime = scheduledAt
			? new Date(scheduledAt)
			: request.scheduledAt;

		// Create video meeting session (Google Meet / Teams / Zoho)
		const meetingSession = await videoConferencingService.createMeeting({
			topic: request.topic,
			description: request.description || undefined,
			startTime: meetingTime,
			duration: request.duration || 30,
			timezone: request.timezone || "Asia/Kolkata",
			participantEmails,
			userId: user.id,
		});

		// Update the request with meeting details
		const [updatedBooking] = await db
			.update(meetingBookings)
			.set({
				status: "confirmed",
				scheduledAt: meetingTime,
				zohoMeetingId: meetingSession.meetingId,
				joinLink: meetingSession.joinLink,
				startLink: meetingSession.startLink,
				agentNotes: agentNotes,
				confirmedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(meetingBookings.id, id))
			.returning();

		meetingNotificationService
			.sendNotification("approved", {
				bookingId: updatedBooking.id,
				topic: updatedBooking.topic,
				description: updatedBooking.description || undefined,
				scheduledAt: updatedBooking.scheduledAt,
				duration: updatedBooking.duration || 30,
				timezone: updatedBooking.timezone || "Asia/Kolkata",
				joinLink: updatedBooking.joinLink || undefined,
				startLink: updatedBooking.startLink || undefined,
				clientId: updatedBooking.clientId,
				agentId: updatedBooking.agentId,
			})
			.catch((err) =>
				console.error("Failed to send approval notification:", err),
			);

		res.json({
			success: true,
			booking: {
				...updatedBooking,
				clientName: client[0]
					? `${client[0].firstName || ""} ${client[0].lastName || ""}`.trim()
					: "Client",
			},
			message: "Meeting approved and scheduled successfully",
		});
	} catch (error: any) {
		console.error("Approve meeting error:", error);
		res
			.status(500)
			.json({ error: error.message || "Failed to approve meeting" });
	}
});

// Decline meeting request
router.post("/:id/decline", async (req, res) => {
	try {
		const user = (req as any).user;
		if (!user?.id) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const userRoles = user.roles || [];
		if (
			!userRoles.some((r: string) => ["agent", "admin", "partner"].includes(r))
		) {
			return res
				.status(403)
				.json({ error: "Access denied. Agent role required." });
		}

		const { id } = req.params;
		const { reason } = req.body;

		const [updatedBooking] = await db
			.update(meetingBookings)
			.set({
				status: "cancelled",
				cancellationReason: reason || "Request declined by agent",
				cancelledAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(eq(meetingBookings.id, id), eq(meetingBookings.status, "pending")),
			)
			.returning();

		if (!updatedBooking) {
			return res
				.status(404)
				.json({ error: "Meeting request not found or already processed" });
		}

		res.json({
			success: true,
			message: "Meeting request declined",
		});
	} catch (error: any) {
		console.error("Decline meeting error:", error);
		res
			.status(500)
			.json({ error: error.message || "Failed to decline meeting" });
	}
});

// Calendar export (iCal format) - requires authentication and participant authorization
router.get("/:id/calendar.ics", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const { id } = req.params;

		const [booking] = await db
			.select()
			.from(meetingBookings)
			.where(eq(meetingBookings.id, id))
			.limit(1);

		if (!booking) {
			return res.status(404).json({ error: "Meeting not found" });
		}

		// Verify user is a participant or admin
		if (booking.clientId !== userId && booking.agentId !== userId) {
			const user = (req as any).user;
			const userRoles = user?.roles || [];
			if (!userRoles.includes("admin")) {
				return res
					.status(403)
					.json({ error: "Not authorized to access this meeting" });
			}
		}

		const icalContent = meetingNotificationService.generateICalEvent({
			bookingId: booking.id,
			topic: booking.topic,
			description: booking.description || undefined,
			scheduledAt: booking.scheduledAt,
			duration: booking.duration || 30,
			timezone: booking.timezone || "Asia/Kolkata",
			joinLink: booking.joinLink || undefined,
			startLink: booking.startLink || undefined,
			clientId: booking.clientId,
			agentId: booking.agentId,
		});

		res.setHeader("Content-Type", "text/calendar; charset=utf-8");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="meeting-${id}.ics"`,
		);
		res.send(icalContent);
	} catch (error: any) {
		console.error("Calendar export error:", error);
		res.status(500).json({ error: "Failed to generate calendar file" });
	}
});

// Reschedule meeting
const rescheduleMeetingSchema = z.object({
	scheduledAt: z.string().transform((val) => new Date(val)),
	reason: z.string().optional(),
});

router.patch("/:id/reschedule", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const { id } = req.params;
		const data = rescheduleMeetingSchema.parse(req.body);

		const [booking] = await db
			.select()
			.from(meetingBookings)
			.where(eq(meetingBookings.id, id))
			.limit(1);

		if (!booking) {
			return res.status(404).json({ error: "Meeting not found" });
		}

		if (booking.clientId !== userId && booking.agentId !== userId) {
			return res
				.status(403)
				.json({ error: "Not authorized to reschedule this meeting" });
		}

		if (booking.status === "cancelled" || booking.status === "completed") {
			return res
				.status(400)
				.json({ error: "Cannot reschedule a cancelled or completed meeting" });
		}

		// Get participant details for new Zoho meeting
		const [client] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, booking.clientId))
			.limit(1);

		const [agent] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, booking.agentId))
			.limit(1);

		const participantEmails = [client?.email, agent?.email].filter(
			Boolean,
		) as string[];

		// Cancel old video meeting if exists
		if (booking.zohoMeetingId) {
			await videoConferencingService.cancelMeeting(booking.zohoMeetingId, undefined, userId);
		}

		// Create new video meeting
		const meetingSession = await videoConferencingService.createMeeting({
			topic: booking.topic,
			description: booking.description || undefined,
			startTime: data.scheduledAt,
			duration: booking.duration || 30,
			timezone: booking.timezone || "Asia/Kolkata",
			participantEmails,
			userId: userId,
		});

		const [updated] = await db
			.update(meetingBookings)
			.set({
				scheduledAt: data.scheduledAt,
				zohoMeetingId: meetingSession.meetingId,
				joinLink: meetingSession.joinLink,
				startLink: meetingSession.startLink,
				updatedAt: new Date(),
			})
			.where(eq(meetingBookings.id, id))
			.returning();

		meetingNotificationService
			.sendNotification("rescheduled", {
				bookingId: updated.id,
				topic: updated.topic,
				description: updated.description || undefined,
				scheduledAt: updated.scheduledAt,
				duration: updated.duration || 30,
				timezone: updated.timezone || "Asia/Kolkata",
				joinLink: updated.joinLink || undefined,
				startLink: updated.startLink || undefined,
				clientId: updated.clientId,
				agentId: updated.agentId,
			})
			.catch((err) =>
				console.error("Failed to send reschedule notification:", err),
			);

		res.json({ success: true, booking: updated });
	} catch (error: any) {
		console.error("Reschedule meeting error:", error);
		if (error instanceof z.ZodError) {
			return res.status(400).json({ error: error.issues[0].message });
		}
		res.status(500).json({ error: "Failed to reschedule meeting" });
	}
});

// Mark meeting as completed with outcome
const completeMeetingSchema = z.object({
	outcome: z.string().min(1, "Outcome is required"),
	agentNotes: z.string().optional(),
	followUpRequired: z.boolean().optional(),
	followUpDate: z
		.string()
		.transform((val) => new Date(val))
		.optional(),
});

router.patch("/:id/complete", async (req, res) => {
	try {
		const user = (req as any).user;
		if (!user?.id) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const userRoles = user.roles || [];
		if (
			!userRoles.some((r: string) => ["agent", "admin", "partner"].includes(r))
		) {
			return res
				.status(403)
				.json({ error: "Only agents can mark meetings as completed" });
		}

		const { id } = req.params;
		const data = completeMeetingSchema.parse(req.body);

		const [booking] = await db
			.select()
			.from(meetingBookings)
			.where(eq(meetingBookings.id, id))
			.limit(1);

		if (!booking) {
			return res.status(404).json({ error: "Meeting not found" });
		}

		if (booking.agentId !== user.id) {
			return res
				.status(403)
				.json({ error: "Only the assigned agent can complete this meeting" });
		}

		if (booking.status !== "confirmed") {
			return res
				.status(400)
				.json({ error: "Only confirmed meetings can be marked as completed" });
		}

		const [updated] = await db
			.update(meetingBookings)
			.set({
				status: "completed",
				outcome: data.outcome,
				agentNotes: data.agentNotes || booking.agentNotes,
				completedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(meetingBookings.id, id))
			.returning();

		meetingNotificationService
			.sendNotification("completed", {
				bookingId: updated.id,
				topic: updated.topic,
				description: updated.description || undefined,
				scheduledAt: updated.scheduledAt,
				duration: updated.duration || 30,
				timezone: updated.timezone || "Asia/Kolkata",
				joinLink: updated.joinLink || undefined,
				startLink: updated.startLink || undefined,
				clientId: updated.clientId,
				agentId: updated.agentId,
			})
			.catch((err) =>
				console.error("Failed to send completion notification:", err),
			);

		res.json({ success: true, booking: updated });
	} catch (error: any) {
		console.error("Complete meeting error:", error);
		if (error instanceof z.ZodError) {
			return res.status(400).json({ error: error.issues[0].message });
		}
		res.status(500).json({ error: "Failed to complete meeting" });
	}
});

// Get meeting details
router.get("/:id", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const { id } = req.params;

		const [booking] = await db
			.select()
			.from(meetingBookings)
			.where(eq(meetingBookings.id, id))
			.limit(1);

		if (!booking) {
			return res.status(404).json({ error: "Meeting not found" });
		}

		if (booking.clientId !== userId && booking.agentId !== userId) {
			const user = (req as any).user;
			const userRoles = user?.roles || [];
			if (!userRoles.includes("admin")) {
				return res
					.status(403)
					.json({ error: "Not authorized to view this meeting" });
			}
		}

		const [client] = await db
			.select({
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
			})
			.from(users)
			.where(eq(users.id, booking.clientId))
			.limit(1);

		const [agent] = await db
			.select({
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
			})
			.from(users)
			.where(eq(users.id, booking.agentId))
			.limit(1);

		res.json({
			booking: {
				...booking,
				clientName: client
					? `${client.firstName || ""} ${client.lastName || ""}`.trim()
					: "Client",
				clientEmail: client?.email,
				agentName: agent
					? `${agent.firstName || ""} ${agent.lastName || ""}`.trim()
					: "Agent",
				agentEmail: agent?.email,
			},
		});
	} catch (error: any) {
		console.error("Get meeting error:", error);
		res.status(500).json({ error: "Failed to get meeting details" });
	}
});

// Meeting analytics for admin
router.get("/admin/analytics", async (req, res) => {
	try {
		const user = (req as any).user;
		if (!user?.id) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const userRoles = user.roles || [];
		if (!userRoles.includes("admin")) {
			return res.status(403).json({ error: "Admin access required" });
		}

		const now = new Date();
		const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		const allMeetings = await db
			.select()
			.from(meetingBookings)
			.where(gte(meetingBookings.createdAt, thirtyDaysAgo));

		const stats = {
			total: allMeetings.length,
			pending: allMeetings.filter((m) => m.status === "pending").length,
			confirmed: allMeetings.filter((m) => m.status === "confirmed").length,
			completed: allMeetings.filter((m) => m.status === "completed").length,
			cancelled: allMeetings.filter((m) => m.status === "cancelled").length,
			noShow: allMeetings.filter((m) => m.status === "no_show").length,
			averageDuration: Math.round(
				allMeetings.reduce((sum, m) => sum + (m.duration || 30), 0) /
					(allMeetings.length || 1),
			),
			completionRate:
				allMeetings.length > 0
					? Math.round(
							(allMeetings.filter((m) => m.status === "completed").length /
								allMeetings.length) *
								100,
						)
					: 0,
		};

		res.json({ stats, period: "last_30_days" });
	} catch (error: any) {
		console.error("Meeting analytics error:", error);
		res.status(500).json({ error: "Failed to get meeting analytics" });
	}
});

export default router;
