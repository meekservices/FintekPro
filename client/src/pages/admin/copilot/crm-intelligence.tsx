/**
 * CRM Intelligence — /admin/copilot/crm
 * Lead insights, AI-suggested next stage, and FASP-AI approval before CRM updates.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function CopilotCrmIntelligence() {
	const [statusFilter, setStatusFilter] = useState("");
	const [connectionId, setConnectionId] = useState("default");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [syncing, setSyncing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const qc = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["copilot-crm-leads", statusFilter],
		queryFn: async () => {
			const params = new URLSearchParams({ limit: "50" });
			if (statusFilter) params.set("approvalStatus", statusFilter);
			const r = await fetch(`/api/admin/copilot/crm/leads?${params.toString()}`);
			return r.json();
		},
	});

	const { data: detailData } = useQuery({
		queryKey: ["copilot-crm-lead-detail", selectedId],
		enabled: Boolean(selectedId),
		queryFn: async () => {
			const r = await fetch(`/api/admin/copilot/crm/leads/${selectedId}`);
			return r.json();
		},
	});

	const leads = data?.data ?? [];
	const detail = detailData?.data;

	async function handleSync() {
		setSyncing(true);
		setError(null);
		try {
			const r = await fetch("/api/admin/copilot/crm/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ connectionId: connectionId.trim() || "default" }),
			});
			const json = await r.json().catch(() => ({}));
			if (!r.ok || json?.success === false) {
				setError(json?.error?.message || `CRM sync failed (${r.status})`);
				return;
			}
			qc.invalidateQueries({ queryKey: ["copilot-crm-leads"] });
		} finally {
			setSyncing(false);
		}
	}

	async function handleApproveStage(lead: any) {
		setError(null);
		const stage = lead.suggestedStage || lead.nextStage || "Qualified";
		const r = await fetch(`/api/admin/copilot/crm/leads/${lead.id}/stage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				newStage: stage,
				connectionId: lead.connectionId || connectionId || "default",
			}),
		});
		const json = await r.json().catch(() => ({}));
		if (!r.ok || json?.success === false) {
			setError(json?.error?.message || "Failed to update lead stage");
			return;
		}
		qc.invalidateQueries({ queryKey: ["copilot-crm-leads"] });
		qc.invalidateQueries({ queryKey: ["copilot-crm-lead-detail", lead.id] });
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
				<span style={{ fontSize: "1.5rem" }}>🤝</span>
				<div>
					<h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
						CRM Intelligence
					</h1>
					<div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
						Lead scoring, stage routing &amp; Zoho CRM sync
					</div>
				</div>
				<div
					style={{
						marginLeft: "auto",
						display: "flex",
						gap: "0.5rem",
						flexWrap: "wrap",
					}}
				>
					<input
						value={connectionId}
						onChange={(e) => setConnectionId(e.target.value)}
						placeholder="Zoho Connection ID"
						style={{
							width: 160,
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.45rem 0.75rem",
							fontSize: "0.82rem",
						}}
					/>
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.45rem 0.75rem",
							fontSize: "0.82rem",
						}}
					>
						<option value="">All Statuses</option>
						<option value="draft">Draft</option>
						<option value="approved">Approved</option>
						<option value="rejected">Rejected</option>
					</select>
					<button
						type="button"
						onClick={handleSync}
						disabled={syncing}
						style={{
							background: "#6366f1",
							color: "#fff",
							border: "none",
							borderRadius: 8,
							padding: "0.45rem 1rem",
							fontWeight: 700,
							cursor: "pointer",
							fontSize: "0.82rem",
						}}
					>
						{syncing ? "Syncing…" : "↻ Sync CRM"}
					</button>
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

			<div
				style={{
					display: "grid",
					gridTemplateColumns: detail ? "1fr 1.2fr" : "1fr",
					gap: "1rem",
				}}
			>
				<div>
					{isLoading ? (
						<div style={{ color: "#94a3b8", padding: "2rem" }}>
							Loading CRM leads…
						</div>
					) : leads.length === 0 ? (
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
							No CRM lead actions found. Click Sync CRM to fetch leads.
						</div>
					) : (
						<div style={{ display: "grid", gap: "0.75rem" }}>
							{leads.map((lead: any) => (
								<button
									type="button"
									key={lead.id}
									onClick={() => setSelectedId(lead.id)}
									style={{
										width: "100%",
										textAlign: "left",
										color: "inherit",
										background:
											selectedId === lead.id
												? "rgba(99,102,241,0.16)"
												: "rgba(255,255,255,0.04)",
										border: "1px solid rgba(255,255,255,0.1)",
										borderRadius: 12,
										padding: "1rem 1.25rem",
										cursor: "pointer",
									}}
								>
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											marginBottom: "0.25rem",
										}}
									>
										<span style={{ fontWeight: 700 }}>
											{lead.leadName || lead.company || lead.zohoLeadId}
										</span>
										<span
											style={{
												fontSize: "0.72rem",
												padding: "0.1rem 0.55rem",
												borderRadius: 12,
												background: "rgba(6,182,212,0.2)",
												color: "#67e8f9",
												fontWeight: 700,
											}}
										>
											{lead.approvalStatus || "draft"}
										</span>
									</div>
									<div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
										Stage: {lead.currentStage || "—"} →{" "}
										{lead.suggestedStage || "—"}
										{lead.leadScore != null
											? ` · Score ${lead.leadScore}`
											: ""}
									</div>
								</button>
							))}
						</div>
					)}
				</div>

				{detail && (
					<div
						style={{
							background: "rgba(255,255,255,0.04)",
							border: "1px solid rgba(255,255,255,0.1)",
							borderRadius: 12,
							padding: "1.25rem",
						}}
					>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "1rem",
							}}
						>
							<h2 style={{ margin: 0, fontSize: "1.1rem" }}>
								{detail.leadName || detail.zohoLeadId}
							</h2>
							{detail.approvalStatus !== "approved" && (
								<button
									type="button"
									onClick={() => handleApproveStage(detail)}
									style={{
										background: "#22c55e",
										color: "#fff",
										border: "none",
										borderRadius: 8,
										padding: "0.45rem 1rem",
										fontWeight: 700,
										cursor: "pointer",
									}}
								>
									Approve Stage Update
								</button>
							)}
						</div>
						<pre
							style={{
								whiteSpace: "pre-wrap",
								fontSize: "0.82rem",
								color: "#cbd5e1",
								background: "rgba(0,0,0,0.25)",
								padding: "1rem",
								borderRadius: 8,
								maxHeight: 420,
								overflowY: "auto",
							}}
						>
							{detail.aiSummary ||
								detail.recommendedAction ||
								JSON.stringify(detail, null, 2)}
						</pre>
					</div>
				)}
			</div>
		</div>
	);
}
