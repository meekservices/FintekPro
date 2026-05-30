/**
 * Admin Copilot Hub — /admin/copilot
 * Overview dashboard for all 11 AI Copilot modules.
 * Shows pending approvals, compliance alerts, and quick-action buttons.
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface ModuleCard {
  title:      string;
  subtitle:   string;
  icon:       string;
  href:       string;
  phase:      1 | 2 | 3;
  color:      string;
  stat?:      string;
  statLabel?: string;
}

const MODULES: ModuleCard[] = [
  { title: "Email Intelligence", subtitle: "Classify & draft replies", icon: "📧", href: "/admin/copilot/email", phase: 1, color: "from-blue-600 to-blue-700", stat: "—", statLabel: "unread" },
  { title: "Proposal Drafts", subtitle: "AI-generated investor proposals", icon: "📋", href: "/admin/copilot/proposals", phase: 1, color: "from-violet-600 to-violet-700", stat: "—", statLabel: "drafts" },
  { title: "Task Manager", subtitle: "AI-extracted tasks", icon: "✅", href: "/admin/copilot/tasks", phase: 1, color: "from-emerald-600 to-emerald-700", stat: "—", statLabel: "open" },
  { title: "Audit Logs", subtitle: "Immutable action history", icon: "🔍", href: "/admin/copilot/audit-logs", phase: 1, color: "from-slate-600 to-slate-700", stat: "—", statLabel: "events" },
  { title: "BI Dashboard", subtitle: "Daily business intelligence", icon: "📊", href: "/admin/copilot/bi", phase: 1, color: "from-orange-600 to-orange-700", stat: "—", statLabel: "metrics" },
  { title: "Compliance Alerts", subtitle: "High-risk flags", icon: "⚠️", href: "/admin/copilot/compliance", phase: 1, color: "from-red-600 to-red-700", stat: "—", statLabel: "open alerts" },
  { title: "CRM Intelligence", subtitle: "Lead insights & routing", icon: "🤝", href: "/admin/copilot/crm", phase: 2, color: "from-cyan-600 to-cyan-700", stat: "Phase 2", statLabel: "" },
  { title: "Desk Intelligence", subtitle: "Ticket classification & SLA", icon: "🎫", href: "/admin/copilot/desk", phase: 2, color: "from-pink-600 to-pink-700", stat: "Phase 2", statLabel: "" },
  { title: "Finance (Books)", subtitle: "Invoices, payouts, GST", icon: "💰", href: "/admin/copilot/finance", phase: 2, color: "from-yellow-600 to-yellow-700", stat: "Phase 2", statLabel: "" },
  { title: "Meetings", subtitle: "Schedule, agenda & notes", icon: "📅", href: "/admin/copilot/meetings", phase: 2, color: "from-teal-600 to-teal-700", stat: "Phase 2", statLabel: "" },
  { title: "BI Analytics", subtitle: "Zoho Analytics deep-dive", icon: "🧠", href: "/admin/copilot/bi", phase: 3, color: "from-indigo-600 to-indigo-700", stat: "Phase 3", statLabel: "" },
];

export default function AdminCopilotHub() {
  const [serverTime, setServerTime] = useState<string>("--:--");

  const { data: health } = useQuery({
    queryKey: ["copilot-health"],
    queryFn:  async () => {
      const r = await fetch("/api/admin/copilot/health");
      return r.json();
    },
    retry: false,
    refetchInterval: 30_000,
  });

  const { data: complianceData } = useQuery({
    queryKey: ["copilot-compliance-count"],
    queryFn:  async () => {
      const r = await fetch("/api/admin/copilot/compliance/alerts?limit=1");
      return r.json();
    },
    retry: false,
  });

  const { data: taskData } = useQuery({
    queryKey: ["copilot-task-count"],
    queryFn:  async () => {
      const r = await fetch("/api/admin/copilot/tasks?status=draft&limit=1");
      return r.json();
    },
    retry: false,
  });

  useEffect(() => {
    const tick = () => setServerTime(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const openAlerts  = complianceData?.meta?.total ?? "—";
  const openTasks   = taskData?.meta?.total ?? "—";
  const isHealthy   = health?.data?.status === "ok";

  const phase1 = MODULES.filter(m => m.phase === 1);
  const phase2 = MODULES.filter(m => m.phase === 2);
  const phase3 = MODULES.filter(m => m.phase === 3);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", color: "#fff", fontFamily: "'Inter', sans-serif", padding: "2rem" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "2rem" }}>🤖</span>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, background: "linear-gradient(90deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              FintekPro Admin Copilot
            </h1>
          </div>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.95rem" }}>
            AI Decision Support System · FASP-AI v1.0 · All outputs require Admin approval
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end", marginBottom: "0.25rem" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isHealthy ? "#22c55e" : "#ef4444", display: "inline-block", boxShadow: isHealthy ? "0 0 8px #22c55e" : "0 0 8px #ef4444" }} />
            <span style={{ fontSize: "0.8rem", color: isHealthy ? "#22c55e" : "#ef4444" }}>
              {isHealthy ? "All systems operational" : "Checking…"}
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{serverTime} IST</div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2.5rem" }}>
        {[
          { label: "Pending Approvals", value: openTasks, icon: "⏳", color: "#f59e0b" },
          { label: "Compliance Alerts", value: openAlerts, icon: "🚨", color: "#ef4444" },
          { label: "Active Agents", value: "5 / 11", icon: "🤖", color: "#6366f1" },
          { label: "Guardrails Active", value: "100%", icon: "🛡️", color: "#22c55e" },
        ].map((stat, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.25rem", backdropFilter: "blur(10px)" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{stat.icon}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: stat.color }}>{String(stat.value)}</div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.25rem" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* FASP-AI Guardrail banner */}
      <div style={{ background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)", borderRadius: 12, padding: "0.875rem 1.25rem", marginBottom: "2rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "1.25rem" }}>🛡️</span>
        <span style={{ fontSize: "0.85rem", color: "#fcd34d" }}>
          <strong>FASP-AI v1.0 Guardrails Active:</strong> All AI outputs are DRAFT-only. No emails are sent, invoices issued, meetings scheduled, or payouts released without explicit Admin/Superadmin approval.
        </span>
      </div>

      {/* Phase 1 — Live */}
      <SectionHeader phase={1} label="Phase 1 — Live" badge="🟢 Active" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        {phase1.map((m, i) => (
          <ModuleCardComp key={i} module={{ ...m, stat: m.title === "Compliance Alerts" ? String(openAlerts) : m.title === "Task Manager" ? String(openTasks) : m.stat }} />
        ))}
      </div>

      {/* Phase 2 — Planned */}
      <SectionHeader phase={2} label="Phase 2 — Planned (CRM, Desk, Books, Meeting)" badge="🔵 Coming Soon" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        {phase2.map((m, i) => <ModuleCardComp key={i} module={m} disabled />)}
      </div>

      {/* Phase 3 — Future */}
      <SectionHeader phase={3} label="Phase 3 — Future (Zoho Analytics BI)" badge="⚪ Roadmap" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {phase3.map((m, i) => <ModuleCardComp key={i} module={m} disabled />)}
      </div>
    </div>
  );
}

function SectionHeader({ label, badge }: { phase: number; label: string; badge: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>{label}</h2>
      <span style={{ fontSize: "0.75rem", color: "#94a3b8", background: "rgba(255,255,255,0.06)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>{badge}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
    </div>
  );
}

function ModuleCardComp({ module: m, disabled }: { module: ModuleCard; disabled?: boolean }) {
  const card = (
    <div style={{
      background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
      border: `1px solid rgba(255,255,255,${disabled ? "0.05" : "0.12"})`,
      borderRadius: 16,
      padding: "1.25rem",
      backdropFilter: "blur(10px)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "all 0.2s",
      textDecoration: "none",
      display: "block",
    }}>
      <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{m.icon}</div>
      <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: "0.25rem" }}>{m.title}</div>
      <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.75rem" }}>{m.subtitle}</div>
      {m.stat && (
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
          <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#a78bfa" }}>{m.stat}</span>
          <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{m.statLabel}</span>
        </div>
      )}
      <div style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "#6366f1", fontWeight: 600 }}>
        {disabled ? "Phase " + m.phase : "Open →"}
      </div>
    </div>
  );

  return disabled ? card : <Link href={m.href}>{card}</Link>;
}
