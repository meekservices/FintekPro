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
        agentName: agent[0].fullName || agent[0].username,
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
          .select({ fullName: users.fullName, email: users.email })
          .from(users)
          .where(eq(users.id, booking.agentId))
          .limit(1);
        return {
          ...booking,
          agentName: agent[0]?.fullName || "Agent",
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
        startLink: meetingBookings.startLink,
        joinLink: meetingBookings.joinLink,
        clientId: meetingBookings.clientId,
        clientNotes: meetingBookings.clientNotes,
        createdAt: meetingBookings.createdAt,
      })
      .from(meetingBookings)
      .where(eq(meetingBookings.agentId, userId))
      .orderBy(desc(meetingBookings.scheduledAt));

    const bookingsWithClients = await Promise.all(
      bookings.map(async (booking) => {
        const client = await db
          .select({ fullName: users.fullName, email: users.email })
          .from(users)
          .where(eq(users.id, booking.clientId))
          .limit(1);
        return {
          ...booking,
          clientName: client[0]?.fullName || "Client",
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
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.role, "agent"));

    res.json({ agents });
  } catch (error: any) {
    console.error("Fetch agents error:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

export default router;
