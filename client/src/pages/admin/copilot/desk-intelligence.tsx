/**
 * Desk Intelligence — /admin/copilot/desk
 * Support ticket classification, SLA breach flags, draft responses & escalation.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function CopilotDeskIntelligence() {
	const [filter, setFilter] = useState<"all" | "highRisk" | "slaBreach">("all");
	const [connectionId, setConnectionId] = useState("default");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [syncing, setSyncing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const qc = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["copilot-desk-tickets", filter],
		queryFn: async () => {
			const params = new URLSearchParams({ limit: "50" });
			if (filter === "highRisk") params.set("isHighRisk", "true");
			if (filter === "slaBreach") params.set("slaBreach", "true");
			const r = await fetch(
				`/api/admin/copilot/desk/tickets?${params.toString()}`,
			);
			return r.json();
		},
	});

	const { data: detailData } = useQuery({
		queryKey: ["copilot-desk-ticket-detail", selectedId],
		enabled: Boolean(selectedId),
		queryFn: async () => {
			const r = await fetch(`/api/admin/copilot/desk/tickets/${selectedId}`);
			return r.json();
		},
	});

	const tickets = data?.data ?? [];
	const detail = detailData?.data;

	async function handleSync() {
		setSyncing(true);
		setError(null);
		try {
			const r = await fetch("/api/admin/copilot/desk/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ connectionId: connectionId.trim() || "default" }),
			});
			const json = await r.json().catch(() => ({}));
			if (!r.ok || json?.success === false) {
				setError(json?.error?.message || `Desk sync failed (${r.status})`);
				return;
			}
			qc.invalidateQueries({ queryKey: ["copilot-desk-tickets"] });
		} finally {
			setSyncing(false);
		}
	}

	async function handleDraftResponse(id: string) {
		setError(null);
		const r = await fetch(`/api/admin/copilot/desk/tickets/${id}/draft-response`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		const json = await r.json().catch(() => ({}));
		if (!r.ok || json?.success === false) {
			setError(json?.error?.message || "Failed to generate draft response");
			return;
		}
		qc.invalidateQueries({ queryKey: ["copilot-desk-ticket-detail", id] });
	}

	async function handleEscalate(id: string) {
		setError(null);
		const r = await fetch(`/api/admin/copilot/desk/tickets/${id}/escalate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				connectionId: connectionId.trim() || "default",
				reason: "Escalated from Admin Copilot Desk Intelligence",
			}),
		});
		const json = await r.json().catch(() => ({}));
		if (!r.ok || json?.success === false) {
			setError(json?.error?.message || "Failed to escalate ticket");
			return;
		}
		qc.invalidateQueries({ queryKey: ["copilot-desk-tickets"] });
		qc.invalidateQueries({ queryKey: ["copilot-desk-ticket-detail", id] });
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
				<span style={{ fontSize: "1.5rem" }}>🎫</span>
				<div>
					<h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
						Desk Intelligence
					</h1>
					<div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
						Ticket classification, SLA risk alerts &amp; draft replies
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
						value={filter}
						onChange={(e) => setFilter(e.target.value as any)}
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.45rem 0.75rem",
							fontSize: "0.82rem",
						}}
					>
						<option value="all">All Tickets</option>
						<option value="highRisk">High Risk Only</option>
						<option value="slaBreach">SLA Breach Only</option>
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
						{syncing ? "Syncing…" : "↻ Sync Desk"}
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
							Loading desk tickets…
						</div>
					) : tickets.length === 0 ? (
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
							No desk tickets found. Click Sync Desk to fetch tickets.
						</div>
					) : (
						<div style={{ display: "grid", gap: "0.75rem" }}>
							{tickets.map((t: any) => (
								<button
									type="button"
									key={t.id}
									onClick={() => setSelectedId(t.id)}
									style={{
										width: "100%",
										textAlign: "left",
										color: "inherit",
										background:
											selectedId === t.id
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
											{t.subject || t.zohoTicketId}
										</span>
										<span
											style={{
												fontSize: "0.72rem",
												padding: "0.1rem 0.55rem",
												borderRadius: 12,
												background: t.slaBreach
													? "rgba(239,68,68,0.22)"
													: "rgba(236,72,153,0.2)",
												color: t.slaBreach ? "#fca5a5" : "#f9a8d4",
												fontWeight: 700,
											}}
										>
											{t.slaBreach ? "SLA BREACH" : t.category || "ticket"}
										</span>
									</div>
									<div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
										{t.isHighRisk ? "⚠️ High Risk · " : ""}
										Status: {t.approvalStatus || "draft"}
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
								gap: "0.5rem",
								flexWrap: "wrap",
							}}
						>
							<h2 style={{ margin: 0, fontSize: "1.1rem" }}>
								{detail.subject || detail.zohoTicketId}
							</h2>
							<div style={{ display: "flex", gap: "0.5rem" }}>
								<button
									type="button"
									onClick={() => handleDraftResponse(detail.id)}
									style={{
										background: "#6366f1",
										color: "#fff",
										border: "none",
										borderRadius: 8,
										padding: "0.4rem 0.9rem",
										fontWeight: 700,
										cursor: "pointer",
									}}
								>
									Draft Reply
								</button>
								<button
									type="button"
									onClick={() => handleEscalate(detail.id)}
									style={{
										background: "rgba(239,68,68,0.2)",
										color: "#fca5a5",
										border: "1px solid rgba(239,68,68,0.35)",
										borderRadius: 8,
										padding: "0.4rem 0.9rem",
										fontWeight: 700,
										cursor: "pointer",
									}}
								>
									Escalate
								</button>
							</div>
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
							{detail.draftResponse ||
								detail.aiSummary ||
								JSON.stringify(detail, null, 2)}
						</pre>
					</div>
				)}
			</div>
		</div>
	);
}
