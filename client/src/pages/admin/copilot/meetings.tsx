/**
 * Meetings — /admin/copilot/meetings
 * Schedule meetings, view no-shows, send invites, and extract follow-up tasks.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function CopilotMeetings() {
	const [showNoShows, setShowNoShows] = useState(false);
	const [showSchedule, setShowSchedule] = useState(false);
	const [connectionId, setConnectionId] = useState("default");
	const [title, setTitle] = useState("");
	const [meetingType, setMeetingType] = useState("portfolio_review");
	const [scheduledAt, setScheduledAt] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const qc = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["copilot-meetings", showNoShows],
		queryFn: async () => {
			const url = showNoShows
				? "/api/admin/copilot/meetings/no-shows"
				: "/api/admin/copilot/meetings?limit=50";
			const r = await fetch(url);
			return r.json();
		},
	});

	const { data: detailData } = useQuery({
		queryKey: ["copilot-meeting-detail", selectedId],
		enabled: Boolean(selectedId),
		queryFn: async () => {
			const r = await fetch(`/api/admin/copilot/meetings/${selectedId}`);
			return r.json();
		},
	});

	const meetings = data?.data ?? [];
	const detail = detailData?.data;

	async function handleSchedule(e: React.FormEvent) {
		e.preventDefault();
		if (!title.trim() || !scheduledAt) return;
		setSubmitting(true);
		setError(null);
		try {
			const r = await fetch("/api/admin/copilot/meetings/schedule", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					connectionId: connectionId.trim() || "default",
					title: title.trim(),
					meetingType,
					scheduledAt: new Date(scheduledAt).toISOString(),
				}),
			});
			const json = await r.json().catch(() => ({}));
			if (!r.ok || json?.success === false) {
				setError(json?.error?.message || "Failed to schedule meeting");
				return;
			}
			setTitle("");
			setScheduledAt("");
			setShowSchedule(false);
			qc.invalidateQueries({ queryKey: ["copilot-meetings"] });
		} finally {
			setSubmitting(false);
		}
	}

	async function handleAction(id: string, action: "invite" | "followups") {
		setError(null);
		const url =
			action === "invite"
				? `/api/admin/copilot/meetings/${id}/invite`
				: `/api/admin/copilot/meetings/${id}/followups/extract`;
		const r = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ connectionId: connectionId.trim() || "default" }),
		});
		const json = await r.json().catch(() => ({}));
		if (!r.ok || json?.success === false) {
			setError(json?.error?.message || `Failed to run ${action}`);
			return;
		}
		qc.invalidateQueries({ queryKey: ["copilot-meeting-detail", id] });
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
				<span style={{ fontSize: "1.5rem" }}>📅</span>
				<div>
					<h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
						Meetings Copilot
					</h1>
					<div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
						Schedule, invites, no-show tracking &amp; follow-up extraction
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
					<button
						type="button"
						onClick={() => setShowNoShows((v) => !v)}
						style={{
							background: showNoShows ? "#ef4444" : "rgba(255,255,255,0.08)",
							color: "#fff",
							border: "none",
							borderRadius: 8,
							padding: "0.45rem 0.9rem",
							fontWeight: 700,
							cursor: "pointer",
							fontSize: "0.82rem",
						}}
					>
						{showNoShows ? "All Meetings" : "No-Shows"}
					</button>
					<button
						type="button"
						onClick={() => setShowSchedule((v) => !v)}
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
						{showSchedule ? "Cancel" : "+ Schedule"}
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

			{showSchedule && (
				<form
					onSubmit={handleSchedule}
					style={{
						background: "rgba(255,255,255,0.04)",
						border: "1px solid rgba(255,255,255,0.1)",
						borderRadius: 12,
						padding: "1.25rem",
						marginBottom: "1.5rem",
						display: "flex",
						gap: "0.75rem",
						flexWrap: "wrap",
					}}
				>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Meeting title"
						required
						style={{
							flex: "1 1 220px",
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.5rem 0.75rem",
						}}
					/>
					<select
						value={meetingType}
						onChange={(e) => setMeetingType(e.target.value)}
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.5rem 0.75rem",
						}}
					>
						<option value="portfolio_review">Portfolio Review</option>
						<option value="onboarding">Client Onboarding</option>
						<option value="compliance_review">Compliance Review</option>
						<option value="partner_sync">Partner Sync</option>
					</select>
					<input
						type="datetime-local"
						value={scheduledAt}
						onChange={(e) => setScheduledAt(e.target.value)}
						required
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.5rem 0.75rem",
						}}
					/>
					<button
						type="submit"
						disabled={submitting}
						style={{
							background: "#22c55e",
							color: "#fff",
							border: "none",
							borderRadius: 8,
							padding: "0.5rem 1.25rem",
							fontWeight: 700,
							cursor: "pointer",
						}}
					>
						{submitting ? "Scheduling…" : "Create Draft"}
					</button>
				</form>
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
							Loading meetings…
						</div>
					) : meetings.length === 0 ? (
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
							No {showNoShows ? "no-show " : ""}meetings found.
						</div>
					) : (
						<div style={{ display: "grid", gap: "0.75rem" }}>
							{meetings.map((m: any) => (
								<button
									type="button"
									key={m.id}
									onClick={() => setSelectedId(m.id)}
									style={{
										width: "100%",
										textAlign: "left",
										color: "inherit",
										background:
											selectedId === m.id
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
										<span style={{ fontWeight: 700 }}>{m.title}</span>
										<span
											style={{
												fontSize: "0.72rem",
												padding: "0.1rem 0.55rem",
												borderRadius: 12,
												background: "rgba(20,184,166,0.2)",
												color: "#5eead4",
												fontWeight: 700,
											}}
										>
											{m.meetingStatus || m.approvalStatus || "scheduled"}
										</span>
									</div>
									<div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
										{m.meetingType} ·{" "}
										{m.scheduledAt
											? new Date(m.scheduledAt).toLocaleString("en-IN")
											: "—"}
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
							<h2 style={{ margin: 0, fontSize: "1.1rem" }}>{detail.title}</h2>
							<div style={{ display: "flex", gap: "0.5rem" }}>
								<button
									type="button"
									onClick={() => handleAction(detail.id, "invite")}
									style={{
										background: "#22c55e",
										color: "#fff",
										border: "none",
										borderRadius: 8,
										padding: "0.4rem 0.9rem",
										fontWeight: 700,
										cursor: "pointer",
									}}
								>
									Send Invite
								</button>
								<button
									type="button"
									onClick={() => handleAction(detail.id, "followups")}
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
									Extract Follow-ups
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
							{detail.description || JSON.stringify(detail, null, 2)}
						</pre>
					</div>
				)}
			</div>
		</div>
	);
}
