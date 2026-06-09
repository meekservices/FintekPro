import { Router } from "express";
import { db } from "../db";
import { meetingBookings, users } from "@shared/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { zohoMeetingService } from "../services/zoho-meeting-service";
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
			.filter((a) => a.roles?.includes("agent"))
			.map((a) => ({
				id: a.id,
				fullName: `${a.firstName || ""} ${a.lastName || ""}`.trim() || "Agent",
				email: a.email,
				role: "agent",
			}));

		res.json({ agents: filteredAgents });
	} catch (error: any) {
		console.error("Fetch agents error:", error);
		res.status(500).json({ error: "Failed to fetch agents" });
	}
});

const agentBookMeetingSchema = z.object({
	clientId: z.string().min(1, "Client ID is required"),
	topic: z.string().min(3, "Topic must be at least 3 characters"),
	description: z.string().optional(),
	scheduledAt: z.string().transform((val) => new Date(val)),
	duration: z.number().min(15).max(120).default(30),
	timezone: z.string().default("Asia/Kolkata"),
	agentNotes: z.string().optional(),
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

		const client = await db
			.select()
			.from(users)
			.where(eq(users.id, data.clientId))
			.limit(1);

		if (client.length === 0) {
			return res.status(404).json({ error: "Client not found" });
		}

		const participantEmails = [client[0].email, agent[0].email].filter(
			Boolean,
		) as string[];

		const zohoMeeting = await zohoMeetingService.createMeeting({
			topic: data.topic,
			agenda: data.description,
			startTime: data.scheduledAt,
			duration: data.duration,
			timezone: data.timezone,
			participantEmails,
		});

		const [booking] = await db
			.insert(meetingBookings)
			.values({
				clientId: data.clientId,
				agentId: agentId,
				topic: data.topic,
				description: data.description,
				scheduledAt: data.scheduledAt,
				duration: data.duration,
				timezone: data.timezone,
				zohoMeetingId: zohoMeeting.meetingId,
				joinLink: zohoMeeting.joinLink,
				startLink: zohoMeeting.startLink,
				status: "confirmed",
				agentNotes: data.agentNotes,
				confirmedAt: new Date(),
			})
			.returning();

		res.json({
			success: true,
			booking: {
				...booking,
				clientName:
					`${client[0].firstName || ""} ${client[0].lastName || ""}`.trim() ||
					client[0].userId,
				clientEmail: client[0].email,
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
				email: u.email,
			}));

		res.json({ clients });
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
				return roles.includes("agent") || roles.includes("admin");
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

		// Create Zoho meeting
		const zohoMeeting = await zohoMeetingService.createMeeting({
			topic: request.topic,
			agenda: request.description || undefined,
			startTime: meetingTime,
			duration: request.duration || 30,
			timezone: request.timezone || "Asia/Kolkata",
			participantEmails,
		});

		// Update the request with meeting details
		const [updatedBooking] = await db
			.update(meetingBookings)
			.set({
				status: "confirmed",
				scheduledAt: meetingTime,
				zohoMeetingId: zohoMeeting.meetingId,
				joinLink: zohoMeeting.joinLink,
				startLink: zohoMeeting.startLink,
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

		// Cancel old Zoho meeting if exists
		if (booking.zohoMeetingId) {
			await zohoMeetingService.cancelMeeting(booking.zohoMeetingId);
		}

		// Create new Zoho meeting
		const zohoMeeting = await zohoMeetingService.createMeeting({
			topic: booking.topic,
			agenda: booking.description || undefined,
			startTime: data.scheduledAt,
			duration: booking.duration || 30,
			timezone: booking.timezone || "Asia/Kolkata",
			participantEmails,
		});

		const [updated] = await db
			.update(meetingBookings)
			.set({
				scheduledAt: data.scheduledAt,
				zohoMeetingId: zohoMeeting.meetingId,
				joinLink: zohoMeeting.joinLink,
				startLink: zohoMeeting.startLink,
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
