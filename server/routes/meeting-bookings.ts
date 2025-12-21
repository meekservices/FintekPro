import { Router } from "express";
import { db } from "../db";
import { meetingBookings, users } from "@shared/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { zohoMeetingService } from "../services/zoho-meeting-service";
import { z } from "zod";

const router = Router();

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

    res.json({ success: true, booking: updated });
  } catch (error: any) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

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

    const filteredAgents = agents.filter(a => a.roles?.includes("agent")).map(a => ({
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
    if (agent.length === 0 || !agentRoles.some((r: string) => ["agent", "admin", "partner"].includes(r))) {
      return res.status(403).json({ error: "Only agents can schedule meetings" });
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
        clientName: `${client[0].firstName || ""} ${client[0].lastName || ""}`.trim() || client[0].userId,
        clientEmail: client[0].email,
      },
    });
  } catch (error: any) {
    console.error("Agent meeting booking error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
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
    if (!userRoles.some((r: string) => ["agent", "admin", "partner"].includes(r))) {
      return res.status(403).json({ error: "Access denied. Agent role required." });
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

    const clients = allUsers.filter(u => u.roles?.includes("user")).map(u => ({
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

export default router;
