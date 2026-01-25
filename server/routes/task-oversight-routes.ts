import { Router, Response } from "express";
import { db } from "../db";
import { sql, eq, and, desc, gte, lte, or, count, isNull, isNotNull } from "drizzle-orm";
import { clientTasks, agentAppointments, users } from "@shared/schema";

const router = Router();

interface TaskOversightStats {
  totalTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completedToday: number;
  dueToday: number;
  completionRate: number;
  agentCount: number;
}

interface AgentTaskOverview {
  id: string;
  name: string;
  email: string;
  pendingTasks: number;
  overdueTasks: number;
  completedToday: number;
  totalTasks: number;
  completionRate: number;
  lastActive: string;
  complianceStatus: "compliant" | "at_risk" | "non_compliant";
}

interface ComplianceAlert {
  id: string;
  agentId: string;
  agentName: string;
  taskId: string;
  taskTitle: string;
  taskType: string;
  dueDate: string;
  daysOverdue: number;
  priority: "high" | "medium" | "low";
  clientName?: string;
}

interface TaskTypeBreakdown {
  name: string;
  value: number;
  color: string;
}

const TASK_TYPE_COLORS: Record<string, string> = {
  kyc_renewal: "#6366f1",
  document_submission: "#f59e0b",
  payment_due: "#ef4444",
  review_scheduled: "#8b5cf6",
  action_required: "#f97316",
  follow_up: "#3b82f6",
  call: "#10b981",
  video_call: "#8b5cf6",
  in_person: "#14b8a6",
  office_visit: "#6366f1",
  other: "#64748b"
};

router.get("/stats", async (req, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const [taskStats] = await db
      .select({
        total: count(),
        pending: sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
        overdue: sql<number>`COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'pending' AND due_date < ${todayStr}))`,
        completedToday: sql<number>`COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= ${today})`,
        dueToday: sql<number>`COUNT(*) FILTER (WHERE due_date = ${todayStr} AND status = 'pending')`,
      })
      .from(clientTasks);

    const [appointmentStats] = await db
      .select({
        total: count(),
        scheduled: sql<number>`COUNT(*) FILTER (WHERE status = 'scheduled')`,
        overdue: sql<number>`COUNT(*) FILTER (WHERE status = 'scheduled' AND date < ${todayStr})`,
        completedToday: sql<number>`COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= ${today})`,
        dueToday: sql<number>`COUNT(*) FILTER (WHERE date = ${todayStr} AND status = 'scheduled')`,
      })
      .from(agentAppointments);

    const agentCountResult = await db
      .select({ count: count() })
      .from(users)
      .where(
        or(
          sql`'agent' = ANY(roles)`,
          sql`'partner' = ANY(roles)`,
          sql`'master_agent' = ANY(roles)`,
          sql`'sub_agent' = ANY(roles)`
        )
      );

    const totalTasks = (taskStats?.total || 0) + (appointmentStats?.total || 0);
    const pendingTasks = (taskStats?.pending || 0) + (appointmentStats?.scheduled || 0);
    const overdueTasks = (taskStats?.overdue || 0) + (appointmentStats?.overdue || 0);
    const completedToday = (taskStats?.completedToday || 0) + (appointmentStats?.completedToday || 0);
    const dueToday = (taskStats?.dueToday || 0) + (appointmentStats?.dueToday || 0);
    const completedTasks = totalTasks - pendingTasks;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 100;

    const stats: TaskOversightStats = {
      totalTasks,
      pendingTasks,
      overdueTasks,
      completedToday,
      dueToday,
      completionRate: Math.round(completionRate * 10) / 10,
      agentCount: agentCountResult[0]?.count || 0,
    };

    res.json({ success: true, stats });
  } catch (error: any) {
    console.error("[TaskOversight] Error fetching stats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch task oversight stats" });
  }
});

router.get("/agents", async (req, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const agents = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        or(
          sql`'agent' = ANY(roles)`,
          sql`'partner' = ANY(roles)`,
          sql`'master_agent' = ANY(roles)`,
          sql`'sub_agent' = ANY(roles)`
        )
      );

    if (agents.length === 0) {
      return res.json({ success: true, agents: [] });
    }

    const agentIds = agents.map(a => a.id);
    const agentIdsArray = `ARRAY[${agentIds.map(id => `'${id}'`).join(',')}]::text[]`;

    const appointmentStatsResult = await db.execute(sql`
      SELECT 
        agent_id,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'scheduled')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'scheduled' AND date < ${todayStr})::int AS overdue,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= ${today})::int AS completed_today
      FROM agent_appointments
      WHERE agent_id = ANY(${sql.raw(agentIdsArray)})
      GROUP BY agent_id
    `);

    const clientTaskStatsResult = await db.execute(sql`
      SELECT 
        metadata->>'agentId' AS agent_id,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'pending' AND due_date < ${todayStr}))::int AS overdue,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= ${today})::int AS completed_today
      FROM client_tasks
      WHERE metadata->>'agentId' = ANY(${sql.raw(agentIdsArray)})
      GROUP BY metadata->>'agentId'
    `);

    const appointmentStatsMap = new Map<string, { total: number; pending: number; overdue: number; completedToday: number }>();
    for (const row of appointmentStatsResult.rows as any[]) {
      appointmentStatsMap.set(row.agent_id, {
        total: Number(row.total) || 0,
        pending: Number(row.pending) || 0,
        overdue: Number(row.overdue) || 0,
        completedToday: Number(row.completed_today) || 0,
      });
    }

    const clientTaskStatsMap = new Map<string, { total: number; pending: number; overdue: number; completedToday: number }>();
    for (const row of clientTaskStatsResult.rows as any[]) {
      if (row.agent_id) {
        clientTaskStatsMap.set(row.agent_id, {
          total: Number(row.total) || 0,
          pending: Number(row.pending) || 0,
          overdue: Number(row.overdue) || 0,
          completedToday: Number(row.completed_today) || 0,
        });
      }
    }

    const agentOverviews: AgentTaskOverview[] = agents.map(agent => {
      const aptStats = appointmentStatsMap.get(agent.id) || { total: 0, pending: 0, overdue: 0, completedToday: 0 };
      const taskStats = clientTaskStatsMap.get(agent.id) || { total: 0, pending: 0, overdue: 0, completedToday: 0 };

      const totalTasks = aptStats.total + taskStats.total;
      const pendingTasks = aptStats.pending + taskStats.pending;
      const overdueTasks = aptStats.overdue + taskStats.overdue;
      const completedToday = aptStats.completedToday + taskStats.completedToday;
      const completedTasks = totalTasks - pendingTasks;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 100;

      let complianceStatus: "compliant" | "at_risk" | "non_compliant" = "compliant";
      if (overdueTasks >= 3 || completionRate < 60) {
        complianceStatus = "non_compliant";
      } else if (overdueTasks >= 1 || completionRate < 75) {
        complianceStatus = "at_risk";
      }

      const fullName = [agent.firstName, agent.lastName].filter(Boolean).join(' ') || "Unknown Agent";
      return {
        id: agent.id,
        name: fullName,
        email: agent.email || "",
        pendingTasks,
        overdueTasks,
        completedToday,
        totalTasks,
        completionRate: Math.round(completionRate * 10) / 10,
        lastActive: getLastActiveText(agent.updatedAt),
        complianceStatus,
      };
    });

    agentOverviews.sort((a, b) => b.overdueTasks - a.overdueTasks);

    res.json({ success: true, agents: agentOverviews });
  } catch (error: any) {
    console.error("[TaskOversight] Error fetching agent overview:", error);
    res.status(500).json({ success: false, message: "Failed to fetch agent task overview" });
  }
});

router.get("/alerts", async (req, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const overdueAppointments = await db
      .select({
        id: agentAppointments.id,
        agentId: agentAppointments.agentId,
        title: agentAppointments.title,
        meetingType: agentAppointments.meetingType,
        date: agentAppointments.date,
        clientName: agentAppointments.clientName,
      })
      .from(agentAppointments)
      .where(
        and(
          eq(agentAppointments.status, "scheduled"),
          sql`date < ${todayStr}`
        )
      )
      .orderBy(agentAppointments.date)
      .limit(limit);

    const overdueTasks = await db
      .select({
        id: clientTasks.id,
        userId: clientTasks.userId,
        title: clientTasks.title,
        type: clientTasks.type,
        priority: clientTasks.priority,
        dueDate: clientTasks.dueDate,
        metadata: clientTasks.metadata,
      })
      .from(clientTasks)
      .where(
        or(
          eq(clientTasks.status, "overdue"),
          and(
            eq(clientTasks.status, "pending"),
            sql`due_date < ${todayStr}`
          )
        )
      )
      .orderBy(clientTasks.dueDate)
      .limit(limit);

    const agentIds = new Set<string>();
    overdueAppointments.forEach(a => agentIds.add(a.agentId));
    overdueTasks.forEach(t => {
      const agentId = (t.metadata as any)?.agentId;
      if (agentId) agentIds.add(agentId);
    });

    const agentMap = new Map<string, string>();
    if (agentIds.size > 0) {
      const agentIdArray = Array.from(agentIds);
      const agentIdsSqlArray = `ARRAY[${agentIdArray.map(id => `'${id}'`).join(',')}]::text[]`;
      const agentUsers = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(sql`id = ANY(${sql.raw(agentIdsSqlArray)})`);
      agentUsers.forEach(a => {
        const fullName = [a.firstName, a.lastName].filter(Boolean).join(' ') || "Unknown";
        agentMap.set(a.id, fullName);
      });
    }

    const alerts: ComplianceAlert[] = [];

    for (const apt of overdueAppointments) {
      const daysOverdue = Math.floor((today.getTime() - new Date(apt.date).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: apt.id,
        agentId: apt.agentId,
        agentName: agentMap.get(apt.agentId) || "Unknown Agent",
        taskId: apt.id,
        taskTitle: apt.title,
        taskType: apt.meetingType || "meeting",
        dueDate: apt.date,
        daysOverdue,
        priority: daysOverdue >= 7 ? "high" : daysOverdue >= 3 ? "medium" : "low",
        clientName: apt.clientName || undefined,
      });
    }

    for (const task of overdueTasks) {
      const agentId = (task.metadata as any)?.agentId || "";
      const daysOverdue = Math.floor((today.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: task.id,
        agentId,
        agentName: agentMap.get(agentId) || "System Task",
        taskId: task.id,
        taskTitle: task.title,
        taskType: task.type,
        dueDate: task.dueDate,
        daysOverdue,
        priority: (task.priority as "high" | "medium" | "low") || (daysOverdue >= 7 ? "high" : "medium"),
      });
    }

    alerts.sort((a, b) => b.daysOverdue - a.daysOverdue);

    res.json({ success: true, alerts: alerts.slice(0, limit) });
  } catch (error: any) {
    console.error("[TaskOversight] Error fetching alerts:", error);
    res.status(500).json({ success: false, message: "Failed to fetch compliance alerts" });
  }
});

router.get("/breakdown", async (req, res: Response) => {
  try {
    const taskTypeBreakdown = await db
      .select({
        type: clientTasks.type,
        count: count(),
      })
      .from(clientTasks)
      .where(eq(clientTasks.status, "pending"))
      .groupBy(clientTasks.type);

    const appointmentTypeBreakdown = await db
      .select({
        type: agentAppointments.meetingType,
        count: count(),
      })
      .from(agentAppointments)
      .where(eq(agentAppointments.status, "scheduled"))
      .groupBy(agentAppointments.meetingType);

    const breakdown: TaskTypeBreakdown[] = [];

    for (const item of taskTypeBreakdown) {
      breakdown.push({
        name: formatTaskTypeName(item.type),
        value: item.count,
        color: TASK_TYPE_COLORS[item.type] || TASK_TYPE_COLORS.other,
      });
    }

    for (const item of appointmentTypeBreakdown) {
      const existingIdx = breakdown.findIndex(b => b.name.toLowerCase() === formatTaskTypeName(item.type).toLowerCase());
      if (existingIdx >= 0) {
        breakdown[existingIdx].value += item.count;
      } else {
        breakdown.push({
          name: formatTaskTypeName(item.type),
          value: item.count,
          color: TASK_TYPE_COLORS[item.type] || TASK_TYPE_COLORS.other,
        });
      }
    }

    breakdown.sort((a, b) => b.value - a.value);

    res.json({ success: true, breakdown });
  } catch (error: any) {
    console.error("[TaskOversight] Error fetching breakdown:", error);
    res.status(500).json({ success: false, message: "Failed to fetch task type breakdown" });
  }
});

function formatTaskTypeName(type: string): string {
  if (!type) return "Other";
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getLastActiveText(updatedAt: Date | string | null): string {
  if (!updatedAt) return "Unknown";
  
  const now = new Date();
  const updated = new Date(updatedAt);
  const diffMs = now.getTime() - updated.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

export default router;
