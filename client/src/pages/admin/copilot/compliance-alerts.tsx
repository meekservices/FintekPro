/**
 * Compliance Alerts — /admin/copilot/compliance
 * Displays SEBI/FASP-AI high-risk compliance alerts and allows admin resolution.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

const SEVERITY_COLORS: Record<string, string> = {
	critical: "#ef4444",
	high: "#f97316",
	medium: "#eab308",
	low: "#22c55e",
};

export default function CopilotComplianceAlerts() {
	const [severity, setSeverity] = useState("");
	const [status, setStatus] = useState("open");
	const [error, setError] = useState<string | null>(null);
	const qc = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["copilot-compliance-alerts", severity, status],
		queryFn: async () => {
			const params = new URLSearchParams({ limit: "50" });
			if (severity) params.set("severity", severity);
			if (status) params.set("status", status);
			const r = await fetch(
				`/api/admin/copilot/compliance/alerts?${params.toString()}`,
			);
			return r.json();
		},
	});

	const alerts = data?.data ?? [];

	async function handleResolve(id: string, action: "approve" | "reject") {
		setError(null);
		const r = await fetch("/api/admin/copilot/approve", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				agentType: "compliance",
				entityId: id,
				entityType: "ai_compliance_alerts",
				action,
			}),
		});
		const json = await r.json().catch(() => ({}));
		if (!r.ok || json?.success === false) {
			setError(json?.error?.message || "Failed to update compliance alert");
			return;
		}
		qc.invalidateQueries({ queryKey: ["copilot-compliance-alerts"] });
		qc.invalidateQueries({ queryKey: ["copilot-compliance-count"] });
	}

	return (
		<div
			style={{
				minHeight: "100vh",
				background: "#0f172a",
				color: "#f1f5f9",
				fontFamily: "'Inter', sans-serif",
				padding: "1.5rem 2rem",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "1rem",
					marginBottom: "1.5rem",
					flexWrap: "wrap",
				}}
			>
				<Link href="/admin/copilot">
					<span style={{ cursor: "pointer", fontSize: "1.25rem" }}>←</span>
				</Link>
				<span style={{ fontSize: "1.5rem" }}>⚠️</span>
				<div>
					<h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
						Compliance Alerts
					</h1>
					<div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
						FASP-AI v1.0 &amp; SEBI regulatory risk flags
					</div>
				</div>
				<div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
					<select
						value={severity}
						onChange={(e) => setSeverity(e.target.value)}
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.45rem 0.75rem",
							fontSize: "0.82rem",
						}}
					>
						<option value="">All Severities</option>
						<option value="critical">Critical</option>
						<option value="high">High</option>
						<option value="medium">Medium</option>
						<option value="low">Low</option>
					</select>
					<select
						value={status}
						onChange={(e) => setStatus(e.target.value)}
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.45rem 0.75rem",
							fontSize: "0.82rem",
						}}
					>
						<option value="open">Open</option>
						<option value="resolved">Resolved</option>
						<option value="dismissed">Dismissed</option>
					</select>
				</div>
			</div>

			{error && (
				<div
					style={{
						background: "rgba(239,68,68,0.12)",
						border: "1px solid rgba(239,68,68,0.3)",
						color: "#fca5a5",
						borderRadius: 10,
						padding: "0.75rem 1rem",
						marginBottom: "1rem",
						fontSize: "0.85rem",
					}}
				>
					⚠️ {error}
				</div>
			)}

			{isLoading ? (
				<div style={{ color: "#94a3b8", padding: "2rem" }}>
					Loading compliance alerts…
				</div>
			) : alerts.length === 0 ? (
				<div
					style={{
						background: "rgba(255,255,255,0.03)",
						border: "1px solid rgba(255,255,255,0.08)",
						borderRadius: 12,
						padding: "2rem",
						textAlign: "center",
						color: "#94a3b8",
					}}
				>
					No {status} compliance alerts.
				</div>
			) : (
				<div style={{ display: "grid", gap: "0.75rem" }}>
					{alerts.map((a: any) => {
						const color = SEVERITY_COLORS[a.severity] || "#f59e0b";
						return (
							<div
								key={a.id}
								style={{
									background: "rgba(255,255,255,0.04)",
									border: `1px solid ${color}44`,
									borderRadius: 12,
									padding: "1rem 1.25rem",
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									gap: "1rem",
									flexWrap: "wrap",
								}}
							>
								<div style={{ flex: 1, minWidth: 260 }}>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "0.5rem",
											marginBottom: "0.3rem",
										}}
									>
										<span
											style={{
												background: `${color}22`,
												color,
												border: `1px solid ${color}44`,
												borderRadius: 12,
												padding: "0.1rem 0.55rem",
												fontSize: "0.7rem",
												fontWeight: 700,
												textTransform: "uppercase",
											}}
										>
											{a.severity || "high"}
										</span>
										<span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
											{a.alertType || a.agentSource} · {a.status}
										</span>
									</div>
									<div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
										{a.title || a.ruleViolated || "Compliance Flag"}
									</div>
									{a.description && (
										<div
											style={{
												fontSize: "0.82rem",
												color: "#cbd5e1",
												marginTop: "0.25rem",
											}}
										>
											{a.description}
										</div>
									)}
								</div>
								{a.status === "open" && (
									<div style={{ display: "flex", gap: "0.5rem" }}>
										<button
											onClick={() => handleResolve(a.id, "approve")}
											style={{
												background: "#22c55e",
												color: "#fff",
												border: "none",
												borderRadius: 8,
												padding: "0.4rem 0.9rem",
												fontSize: "0.78rem",
												fontWeight: 700,
												cursor: "pointer",
											}}
										>
											Acknowledge
										</button>
										<button
											onClick={() => handleResolve(a.id, "reject")}
											style={{
												background: "rgba(255,255,255,0.08)",
												color: "#cbd5e1",
												border: "1px solid rgba(255,255,255,0.15)",
												borderRadius: 8,
												padding: "0.4rem 0.9rem",
												fontSize: "0.78rem",
												fontWeight: 700,
												cursor: "pointer",
											}}
										>
											Dismiss
										</button>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
