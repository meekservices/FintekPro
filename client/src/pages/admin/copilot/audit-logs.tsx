/**
 * Audit Logs — /admin/copilot/audit-logs
 * Immutable append-only action history for all Admin Copilot agents.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

export default function CopilotAuditLogs() {
	const [agentType, setAgentType] = useState("");
	const [status, setStatus] = useState("");
	const [page, setPage] = useState(1);

	const { data, isLoading } = useQuery({
		queryKey: ["copilot-audit-logs", agentType, status, page],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: String(page),
				limit: "25",
			});
			if (agentType) params.set("agentType", agentType);
			if (status) params.set("status", status);
			const r = await fetch(
				`/api/admin/copilot/audit-logs?${params.toString()}`,
			);
			return r.json();
		},
	});

	const logs = data?.data ?? [];
	const total = data?.meta?.total ?? 0;

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
				<span style={{ fontSize: "1.5rem" }}>🔍</span>
				<div>
					<h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
						Copilot Audit Logs
					</h1>
					<div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
						Immutable append-only FASP-AI v1.0 action trail ({total} events)
					</div>
				</div>
				<div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
					<select
						value={agentType}
						onChange={(e) => {
							setAgentType(e.target.value);
							setPage(1);
						}}
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.45rem 0.75rem",
							fontSize: "0.82rem",
						}}
					>
						<option value="">All Agents</option>
						<option value="mail">Mail</option>
						<option value="task">Task</option>
						<option value="proposal">Proposal</option>
						<option value="bi">BI</option>
						<option value="crm">CRM</option>
						<option value="desk">Desk</option>
						<option value="books">Books</option>
						<option value="meeting">Meeting</option>
						<option value="approval">Approval</option>
					</select>
					<select
						value={status}
						onChange={(e) => {
							setStatus(e.target.value);
							setPage(1);
						}}
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
						<option value="success">Success</option>
						<option value="failed">Failed</option>
						<option value="blocked">Blocked</option>
					</select>
				</div>
			</div>

			{isLoading ? (
				<div style={{ color: "#94a3b8", padding: "2rem" }}>
					Loading audit logs…
				</div>
			) : logs.length === 0 ? (
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
					No audit log entries found.
				</div>
			) : (
				<>
					<div style={{ overflowX: "auto" }}>
						<table
							style={{
								width: "100%",
								borderCollapse: "collapse",
								fontSize: "0.82rem",
							}}
						>
							<thead>
								<tr
									style={{
										borderBottom: "1px solid rgba(255,255,255,0.12)",
										textAlign: "left",
										color: "#94a3b8",
									}}
								>
									<th style={{ padding: "0.75rem" }}>Timestamp</th>
									<th style={{ padding: "0.75rem" }}>Agent</th>
									<th style={{ padding: "0.75rem" }}>Action</th>
									<th style={{ padding: "0.75rem" }}>Status</th>
									<th style={{ padding: "0.75rem" }}>Model / Confidence</th>
									<th style={{ padding: "0.75rem" }}>Summary</th>
								</tr>
							</thead>
							<tbody>
								{logs.map((l: any) => (
									<tr
										key={l.id}
										style={{
											borderBottom: "1px solid rgba(255,255,255,0.06)",
										}}
									>
										<td style={{ padding: "0.7rem 0.75rem", color: "#94a3b8" }}>
											{l.timestamp
												? new Date(l.timestamp).toLocaleString("en-IN")
												: "—"}
										</td>
										<td style={{ padding: "0.7rem 0.75rem", fontWeight: 700 }}>
											{l.agentType}
										</td>
										<td style={{ padding: "0.7rem 0.75rem" }}>
											{l.agentAction}
										</td>
										<td style={{ padding: "0.7rem 0.75rem" }}>
											<span
												style={{
													padding: "0.15rem 0.5rem",
													borderRadius: 10,
													background:
														l.status === "success"
															? "rgba(34,197,94,0.18)"
															: "rgba(239,68,68,0.18)",
													color: l.status === "success" ? "#86efac" : "#fca5a5",
													fontWeight: 700,
												}}
											>
												{l.status}
											</span>
										</td>
										<td style={{ padding: "0.7rem 0.75rem", color: "#94a3b8" }}>
											{l.modelVersion || "—"}
											{l.confidenceScore != null
												? ` (${Math.round(l.confidenceScore * 100)}%)`
												: ""}
										</td>
										<td style={{ padding: "0.7rem 0.75rem", color: "#cbd5e1" }}>
											{l.outputSummary || l.errorMessage || "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div
						style={{
							display: "flex",
							justifyContent: "flex-end",
							gap: "0.75rem",
							marginTop: "1rem",
							alignItems: "center",
						}}
					>
						<button
							disabled={page <= 1}
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							style={{
								background: "rgba(255,255,255,0.08)",
								color: "#f1f5f9",
								border: "none",
								borderRadius: 8,
								padding: "0.4rem 0.85rem",
								cursor: page <= 1 ? "not-allowed" : "pointer",
							}}
						>
							Previous
						</button>
						<span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
							Page {page}
						</span>
						<button
							disabled={page * 25 >= total}
							onClick={() => setPage((p) => p + 1)}
							style={{
								background: "rgba(255,255,255,0.08)",
								color: "#f1f5f9",
								border: "none",
								borderRadius: 8,
								padding: "0.4rem 0.85rem",
								cursor: page * 25 >= total ? "not-allowed" : "pointer",
							}}
						>
							Next
						</button>
					</div>
				</>
			)}
		</div>
	);
}
