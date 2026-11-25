/**
 * Task Manager — /admin/copilot/tasks
 * Lists AI-extracted and manual admin tasks, supports status updates & task creation.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

const PRIORITY_COLORS: Record<string, string> = {
	critical: "#ef4444",
	high: "#f97316",
	medium: "#eab308",
	low: "#22c55e",
};

export default function CopilotTaskManager() {
	const [statusFilter, setStatusFilter] = useState("");
	const [priorityFilter, setPriorityFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [priority, setPriority] = useState("medium");
	const [assignedToRole, setAssignedToRole] = useState("admin");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const qc = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["copilot-tasks", statusFilter, priorityFilter],
		queryFn: async () => {
			const params = new URLSearchParams({ limit: "50" });
			if (statusFilter) params.set("status", statusFilter);
			if (priorityFilter) params.set("priority", priorityFilter);
			const r = await fetch(`/api/admin/copilot/tasks?${params.toString()}`);
			return r.json();
		},
	});

	const tasks = data?.data ?? [];

	async function handleStatusChange(id: string, status: string) {
		setError(null);
		const r = await fetch(`/api/admin/copilot/tasks/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status }),
		});
		const json = await r.json().catch(() => ({}));
		if (!r.ok || json?.success === false) {
			setError(json?.error?.message || "Failed to update task");
			return;
		}
		qc.invalidateQueries({ queryKey: ["copilot-tasks"] });
		qc.invalidateQueries({ queryKey: ["copilot-task-count"] });
	}

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!title.trim()) return;
		setSubmitting(true);
		setError(null);
		try {
			const r = await fetch("/api/admin/copilot/tasks/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: title.trim(),
					description: description.trim() || undefined,
					source: "admin_prompt",
					priority,
					assignedToRole,
				}),
			});
			const json = await r.json().catch(() => ({}));
			if (!r.ok || json?.success === false) {
				setError(json?.error?.message || "Failed to create task");
				return;
			}
			setTitle("");
			setDescription("");
			setShowCreate(false);
			qc.invalidateQueries({ queryKey: ["copilot-tasks"] });
			qc.invalidateQueries({ queryKey: ["copilot-task-count"] });
		} finally {
			setSubmitting(false);
		}
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
				<span style={{ fontSize: "1.5rem" }}>✅</span>
				<div>
					<h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
						Task Manager
					</h1>
					<div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
						AI-extracted &amp; admin tasks · FASP-AI v1.0 approval workflow
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
						<option value="in_progress">In Progress</option>
						<option value="completed">Completed</option>
						<option value="escalated">Escalated</option>
					</select>
					<select
						value={priorityFilter}
						onChange={(e) => setPriorityFilter(e.target.value)}
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.45rem 0.75rem",
							fontSize: "0.82rem",
						}}
					>
						<option value="">All Priorities</option>
						<option value="critical">Critical</option>
						<option value="high">High</option>
						<option value="medium">Medium</option>
						<option value="low">Low</option>
					</select>
					<button
						onClick={() => setShowCreate((v) => !v)}
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
						{showCreate ? "Cancel" : "+ New Task"}
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

			{showCreate && (
				<form
					onSubmit={handleCreate}
					style={{
						background: "rgba(255,255,255,0.04)",
						border: "1px solid rgba(255,255,255,0.1)",
						borderRadius: 12,
						padding: "1.25rem",
						marginBottom: "1.5rem",
						display: "grid",
						gap: "0.75rem",
					}}
				>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Task title (required)"
						required
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.6rem 0.85rem",
							fontSize: "0.9rem",
						}}
					/>
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Task description / context"
						rows={2}
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.6rem 0.85rem",
							fontSize: "0.85rem",
						}}
					/>
					<div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
						<select
							value={priority}
							onChange={(e) => setPriority(e.target.value)}
							style={{
								background: "#1e293b",
								color: "#f1f5f9",
								border: "1px solid rgba(255,255,255,0.12)",
								borderRadius: 8,
								padding: "0.45rem 0.75rem",
							}}
						>
							<option value="critical">Critical</option>
							<option value="high">High</option>
							<option value="medium">Medium</option>
							<option value="low">Low</option>
						</select>
						<select
							value={assignedToRole}
							onChange={(e) => setAssignedToRole(e.target.value)}
							style={{
								background: "#1e293b",
								color: "#f1f5f9",
								border: "1px solid rgba(255,255,255,0.12)",
								borderRadius: 8,
								padding: "0.45rem 0.75rem",
							}}
						>
							<option value="admin">Admin</option>
							<option value="agent">Agent</option>
							<option value="ca">CA</option>
							<option value="compliance">Compliance</option>
						</select>
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
							{submitting ? "Creating…" : "Create Draft Task"}
						</button>
					</div>
				</form>
			)}

			{isLoading ? (
				<div style={{ color: "#94a3b8", padding: "2rem" }}>Loading tasks…</div>
			) : tasks.length === 0 ? (
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
					No tasks found for the selected filter.
				</div>
			) : (
				<div style={{ display: "grid", gap: "0.75rem" }}>
					{tasks.map((t: any) => {
						const pColor = PRIORITY_COLORS[t.priority] || "#94a3b8";
						return (
							<div
								key={t.id}
								style={{
									background: "rgba(255,255,255,0.04)",
									border: "1px solid rgba(255,255,255,0.1)",
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
											marginBottom: "0.25rem",
										}}
									>
										<span
											style={{
												background: `${pColor}22`,
												color: pColor,
												border: `1px solid ${pColor}44`,
												borderRadius: 12,
												padding: "0.1rem 0.55rem",
												fontSize: "0.7rem",
												fontWeight: 700,
												textTransform: "uppercase",
											}}
										>
											{t.priority || "medium"}
										</span>
										<span
											style={{
												background: "rgba(99,102,241,0.18)",
												color: "#a5b4fc",
												borderRadius: 12,
												padding: "0.1rem 0.55rem",
												fontSize: "0.7rem",
												fontWeight: 600,
											}}
										>
											{t.status}
										</span>
										<span style={{ fontSize: "0.72rem", color: "#64748b" }}>
											Source: {t.source}
											{t.assignedToRole ? ` · Role: ${t.assignedToRole}` : ""}
										</span>
									</div>
									<div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
										{t.title}
									</div>
									{t.description && (
										<div
											style={{
												fontSize: "0.82rem",
												color: "#94a3b8",
												marginTop: "0.25rem",
											}}
										>
											{t.description}
										</div>
									)}
								</div>
								<div style={{ display: "flex", gap: "0.5rem" }}>
									{t.status === "draft" && (
										<button
											onClick={() => handleStatusChange(t.id, "approved")}
											style={{
												background: "#22c55e",
												color: "#fff",
												border: "none",
												borderRadius: 8,
												padding: "0.4rem 0.85rem",
												fontSize: "0.78rem",
												fontWeight: 700,
												cursor: "pointer",
											}}
										>
											Approve
										</button>
									)}
									{t.status !== "completed" && (
										<button
											onClick={() => handleStatusChange(t.id, "completed")}
											style={{
												background: "#3b82f6",
												color: "#fff",
												border: "none",
												borderRadius: 8,
												padding: "0.4rem 0.85rem",
												fontSize: "0.78rem",
												fontWeight: 700,
												cursor: "pointer",
											}}
										>
											Complete
										</button>
									)}
									{t.status !== "escalated" && t.status !== "completed" && (
										<button
											onClick={() => handleStatusChange(t.id, "escalated")}
											style={{
												background: "rgba(239,68,68,0.2)",
												color: "#fca5a5",
												border: "1px solid rgba(239,68,68,0.35)",
												borderRadius: 8,
												padding: "0.4rem 0.85rem",
												fontSize: "0.78rem",
												fontWeight: 700,
												cursor: "pointer",
											}}
										>
											Escalate
										</button>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
