import { Router } from "express";
import { db } from "../db";
import { meetingBookings, users } from "@shared/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { zohoMeetingService } from "../services/zoho-meeting-service";
import { meetingNotificationService } from "../services/meeting-notification-service";
import { z } from "zod";

const router = Router();

router.get("/test-zoho-connection", async (req, res) => {
  try {
    const result = await zohoMeetingService.testConnection();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error testing Zoho connection",
      details: error.message
    });
  }
});

router.get("/zoho-oauth-url", async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/api/meetings/zoho-oauth-callback`;
    const oauthUrl = zohoMeetingService.getOAuthUrl(redirectUri);
    res.json({ 
      success: true, 
      oauthUrl,
      instructions: "Visit the URL to authorize Zoho Meeting. After authorization, copy the refresh token from the callback response and update ZOHO_REFRESH_TOKEN secret."
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error generating OAuth URL",
      details: error.message
    });
  }
});

router.get("/zoho-oauth-callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: "Missing authorization code" 
      });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/api/meetings/zoho-oauth-callback`;
    
    const tokens = await zohoMeetingService.exchangeCodeForTokens(code, redirectUri);
    
    res.json({
      success: true,
      message: "Authorization successful! Copy the refresh_token below and update your ZOHO_REFRESH_TOKEN secret.",
      refresh_token: tokens.refresh_token,
      access_token_expires_in: tokens.expires_in
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error exchanging code for tokens",
      details: error.response?.data || error.message
    });
  }
});

// POST /api/meetings/schedule - Alias for agent-book endpoint (agents schedule meetings with clients)
router.post("/schedule", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRoles = user.roles || [];
    if (!userRoles.some((r: string) => ["agent", "admin", "partner"].includes(r))) {
      return res.status(403).json({ error: "Access denied. Only agents/partners can schedule meetings." });
    }

    const data = z.object({
      clientId: z.string().min(1, "Client ID is required"),
      topic: z.string().min(3, "Topic must be at least 3 characters"),
      description: z.string().optional(),
      scheduledAt: z.string().transform((val) => new Date(val)),
      duration: z.number().min(15).max(120).default(30),
      timezone: z.string().default("Asia/Kolkata"),
      agentNotes: z.string().optional(),
    }).parse(req.body);

    const agent = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const client = await db
      .select()
      .from(users)
      .where(eq(users.id, data.clientId))
      .limit(1);

    if (client.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }

    const participantEmails = [
      client[0].email,
      agent[0].email,
    ].filter(Boolean) as string[];

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
        agentId: user.id,
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

    meetingNotificationService.sendNotification('scheduled', {
      bookingId: booking.id,
      topic: booking.topic,
      description: booking.description || undefined,
      scheduledAt: booking.scheduledAt,
      duration: booking.duration || 30,
      timezone: booking.timezone || 'Asia/Kolkata',
      joinLink: booking.joinLink || undefined,
      startLink: booking.startLink || undefined,
      clientId: booking.clientId,
      agentId: booking.agentId,
    }).catch(err => console.error('Failed to send meeting notification:', err));

    res.json({
      success: true,
      meeting: {
        id: booking.id,
        topic: booking.topic,
        description: booking.description,
        scheduledAt: booking.scheduledAt,
        duration: booking.duration,
        status: booking.status,
        joinLink: booking.joinLink,
        startLink: booking.startLink,
        zohoMeetingId: booking.zohoMeetingId,
        clientName: `${client[0].firstName || ""} ${client[0].lastName || ""}`.trim() || client[0].userId,
        clientEmail: client[0].email,
        agentName: `${agent[0].firstName || ""} ${agent[0].lastName || ""}`.trim() || agent[0].userId,
        agentEmail: agent[0].email,
      },
    });
  } catch (error: any) {
    console.error("Schedule meeting error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message || "Failed to schedule meeting" });
  }
});

// GET /api/meetings - List user's meetings (alias for my-bookings/agent-bookings based on role)
router.get("/", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRoles = user.roles || [];
    const isAgent = userRoles.some((r: string) => ["agent", "admin", "partner"].includes(r));

    // Fetch meetings where user is either client or agent
    const allMeetings = await db
      .select()
      .from(meetingBookings)
      .where(
        isAgent 
          ? eq(meetingBookings.agentId, user.id)
          : eq(meetingBookings.clientId, user.id)
      )
      .orderBy(desc(meetingBookings.scheduledAt));

    const meetingsWithParticipants = await Promise.all(
      allMeetings.map(async (meeting) => {
        const [client] = await db
          .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
          .from(users)
          .where(eq(users.id, meeting.clientId))
          .limit(1);
        
        const [agent] = await db
          .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
          .from(users)
          .where(eq(users.id, meeting.agentId))
          .limit(1);

        return {
          ...meeting,
          clientName: client ? `${client.firstName || ""} ${client.lastName || ""}`.trim() || "Client" : "Client",
          clientEmail: client?.email,
          agentName: agent ? `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || "Agent" : "Agent",
          agentEmail: agent?.email,
        };
      })
    );

    res.json({ meetings: meetingsWithParticipants });
  } catch (error: any) {
    console.error("List meetings error:", error);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

// DELETE /api/meetings/:id - Cancel a meeting (alias for PATCH cancel)
router.delete("/:id", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;
    const { reason } = req.body || {};

    const booking = await db
      .select()
      .from(meetingBookings)
      .where(eq(meetingBookings.id, id))
      .limit(1);

    if (booking.length === 0) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (booking[0].clientId !== userId && booking[0].agentId !== userId) {
      const user = (req as any).user;
      const userRoles = user?.roles || [];
      if (!userRoles.includes("admin")) {
        return res.status(403).json({ error: "Not authorized to cancel this meeting" });
      }
    }

    if (booking[0].status === "cancelled") {
      return res.status(400).json({ error: "Meeting is already cancelled" });
    }

    if (booking[0].zohoMeetingId) {
      await zohoMeetingService.cancelMeeting(booking[0].zohoMeetingId);
    }

    const [updated] = await db
      .update(meetingBookings)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: reason || "Cancelled by user",
        updatedAt: new Date(),
      })
      .where(eq(meetingBookings.id, id))
      .returning();

    meetingNotificationService.sendNotification('cancelled', {
      bookingId: updated.id,
      topic: updated.topic,
      description: updated.description || undefined,
      scheduledAt: updated.scheduledAt,
      duration: updated.duration || 30,
      timezone: updated.timezone || 'Asia/Kolkata',
      joinLink: updated.joinLink || undefined,
      startLink: updated.startLink || undefined,
      clientId: updated.clientId,
      agentId: updated.agentId,
    }).catch(err => console.error('Failed to send cancellation notification:', err));

    res.json({ success: true, message: "Meeting cancelled successfully" });
  } catch (error: any) {
    console.error("Delete meeting error:", error);
    res.status(500).json({ error: "Failed to cancel meeting" });
  }
});

const bookMeetingSchema = z.object({
  agentId: z.string().min(1, "Agent ID is required"),
  topic: z.string().min(3, "Topic must be at least 3 characters"),
  description: z.string().optional(),
  scheduledAt: z.string().transform((val) => new Date(val)),
  duration: z.number().min(15).max(120).default(30),
  timezone: z.string().default("Asia/Kolkata"),
  clientNotes: z.string().optional(),
});

router.post("/book", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const data = bookMeetingSchema.parse(req.body);

    const agent = await db
      .select()
      .from(users)
      .where(eq(users.id, data.agentId))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const client = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (client.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }

    const participantEmails = [
      client[0].email,
      agent[0].email,
    ].filter(Boolean) as string[];

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
        clientId: userId,
        agentId: data.agentId,
        topic: data.topic,
        description: data.description,
        scheduledAt: data.scheduledAt,
        duration: data.duration,
        timezone: data.timezone,
        zohoMeetingId: zohoMeeting.meetingId,
        joinLink: zohoMeeting.joinLink,
        startLink: zohoMeeting.startLink,
        status: "confirmed",
        clientNotes: data.clientNotes,
        confirmedAt: new Date(),
      })
      .returning();

    meetingNotificationService.sendNotification('scheduled', {
      bookingId: booking.id,
      topic: booking.topic,
      description: booking.description || undefined,
      scheduledAt: booking.scheduledAt,
      duration: booking.duration || 30,
      timezone: booking.timezone || 'Asia/Kolkata',
      joinLink: booking.joinLink || undefined,
      startLink: booking.startLink || undefined,
      clientId: booking.clientId,
      agentId: booking.agentId,
    }).catch(err => console.error('Failed to send meeting notification:', err));

    res.json({
      success: true,
      booking: {
        ...booking,
        agentName: `${agent[0].firstName || ""} ${agent[0].lastName || ""}`.trim() || agent[0].userId,
        agentEmail: agent[0].email,
      },
    });
  } catch (error: any) {
    console.error("Meeting booking error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message || "Failed to book meeting" });
  }
});

router.get("/my-bookings", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const bookings = await db
      .select({
        id: meetingBookings.id,
        topic: meetingBookings.topic,
        description: meetingBookings.description,
        scheduledAt: meetingBookings.scheduledAt,
        duration: meetingBookings.duration,
        status: meetingBookings.status,
        joinLink: meetingBookings.joinLink,
        agentId: meetingBookings.agentId,
        createdAt: meetingBookings.createdAt,
      })
      .from(meetingBookings)
      .where(eq(meetingBookings.clientId, userId))
      .orderBy(desc(meetingBookings.scheduledAt));

    const bookingsWithAgents = await Promise.all(
      bookings.map(async (booking) => {
        const agent = await db
          .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
          .from(users)
          .where(eq(users.id, booking.agentId))
          .limit(1);
        return {
          ...booking,
          agentName: agent[0] ? `${agent[0].firstName || ""} ${agent[0].lastName || ""}`.trim() || "Agent" : "Agent",
          agentEmail: agent[0]?.email,
        };
      })
    );

    res.json({ bookings: bookingsWithAgents });
  } catch (error: any) {
    console.error("Fetch bookings error:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

router.get("/agent-bookings", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRoles = user.roles || [];
    if (!userRoles.some((r: string) => ["agent", "admin", "partner"].includes(r))) {
      return res.status(403).json({ error: "Access denied. Agent role required." });
    }

    const bookings = await db
      .select({
        id: meetingBookings.id,
        topic: meetingBookings.topic,
        description: meetingBookings.description,
        scheduledAt: meetingBookings.scheduledAt,
        duration: meetingBookings.duration,
        status: meetingBookings.status,
        startLink: meetingBookings.startLink,
        joinLink: meetingBookings.joinLink,
        clientId: meetingBookings.clientId,
        clientNotes: meetingBookings.clientNotes,
        createdAt: meetingBookings.createdAt,
      })
      .from(meetingBookings)
      .where(eq(meetingBookings.agentId, user.id))
      .orderBy(desc(meetingBookings.scheduledAt));

    const bookingsWithClients = await Promise.all(
      bookings.map(async (booking) => {
        const client = await db
          .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
          .from(users)
          .where(eq(users.id, booking.clientId))
          .limit(1);
        return {
          ...booking,
          clientName: client[0] ? `${client[0].firstName || ""} ${client[0].lastName || ""}`.trim() || "Client" : "Client",
          clientEmail: client[0]?.email,
        };
      })
    );

    res.json({ bookings: bookingsWithClients });
  } catch (error: any) {
    console.error("Fetch agent bookings error:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

router.get("/upcoming", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const now = new Date();

    const bookings = await db
      .select()
      .from(meetingBookings)
      .where(
        and(
          eq(meetingBookings.clientId, userId),
          gte(meetingBookings.scheduledAt, now),
          eq(meetingBookings.status, "confirmed")
        )
      )
      .orderBy(meetingBookings.scheduledAt)
      .limit(5);

    res.json({ bookings });
  } catch (error: any) {
    console.error("Fetch upcoming error:", error);
    res.status(500).json({ error: "Failed to fetch upcoming meetings" });
  }
});

router.patch("/:id/cancel", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const booking = await db
      .select()
      .from(meetingBookings)
      .where(eq(meetingBookings.id, id))
      .limit(1);

    if (booking.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking[0].clientId !== userId && booking[0].agentId !== userId) {
      return res.status(403).json({ error: "Not authorized to cancel this booking" });
    }

    if (booking[0].zohoMeetingId) {
      await zohoMeetingService.cancelMeeting(booking[0].zohoMeetingId);
    }

    const [updated] = await db
      .update(meetingBookings)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: reason || "Cancelled by user",
        updatedAt: new Date(),
      })
      .where(eq(meetingBookings.id, id))
      .returning();

    meetingNotificationService.sendNotification('cancelled', {
      bookingId: updated.id,
      topic: updated.topic,
      description: updated.description || undefined,
      scheduledAt: updated.scheduledAt,
      duration: updated.duration || 30,
      timezone: updated.timezone || 'Asia/Kolkata',
      joinLink: updated.joinLink || undefined,
      startLink: updated.startLink || undefined,
      clientId: updated.clientId,
      agentId: updated.agentId,
    }).catch(err => console.error('Failed to send cancellation notification:', err));

    res.json({ success: true, booking: updated });
  } catch (error: any) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});


export default router;
