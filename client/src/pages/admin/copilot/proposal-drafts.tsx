/**
 * Proposal Drafts — /admin/copilot/proposals
 * Lists AI-generated investor proposals, supports generation and FASP-AI approval.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function CopilotProposalDrafts() {
	const [statusFilter, setStatusFilter] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [showGenerate, setShowGenerate] = useState(false);
	const [investorName, setInvestorName] = useState("");
	const [productType, setProductType] = useState("mutual_funds");
	const [amount, setAmount] = useState("1000000");
	const [riskProfile, setRiskProfile] = useState("moderate");
	const [error, setError] = useState<string | null>(null);
	const [generating, setGenerating] = useState(false);
	const qc = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["copilot-proposals", statusFilter],
		queryFn: async () => {
			const params = new URLSearchParams({ limit: "50" });
			if (statusFilter) params.set("approvalStatus", statusFilter);
			const r = await fetch(`/api/admin/copilot/proposals?${params.toString()}`);
			return r.json();
		},
	});

	const { data: detailData } = useQuery({
		queryKey: ["copilot-proposal-detail", selectedId],
		enabled: Boolean(selectedId),
		queryFn: async () => {
			const r = await fetch(`/api/admin/copilot/proposals/${selectedId}`);
			return r.json();
		},
	});

	const proposals = data?.data ?? [];
	const detail = detailData?.data;

	async function handleGenerate(e: React.FormEvent) {
		e.preventDefault();
		if (!investorName.trim()) return;
		setGenerating(true);
		setError(null);
		try {
			const r = await fetch("/api/admin/copilot/proposals/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					investorName: investorName.trim(),
					productType,
					amount: Number(amount) || 1000000,
					riskProfile,
				}),
			});
			const json = await r.json().catch(() => ({}));
			if (!r.ok || json?.success === false) {
				setError(json?.error?.message || "Failed to generate proposal draft");
				return;
			}
			setInvestorName("");
			setShowGenerate(false);
			qc.invalidateQueries({ queryKey: ["copilot-proposals"] });
			qc.invalidateQueries({ queryKey: ["copilot-proposal-count"] });
		} finally {
			setGenerating(false);
		}
	}

	async function handleDecision(id: string, action: "approve" | "reject") {
		setError(null);
		const r = await fetch("/api/admin/copilot/approve", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				agentType: "proposal",
				entityId: id,
				entityType: "ai_proposal_drafts",
				action,
			}),
		});
		const json = await r.json().catch(() => ({}));
		if (!r.ok || json?.success === false) {
			setError(json?.error?.message || `Failed to ${action} proposal`);
			return;
		}
		qc.invalidateQueries({ queryKey: ["copilot-proposals"] });
		qc.invalidateQueries({ queryKey: ["copilot-proposal-detail", id] });
		qc.invalidateQueries({ queryKey: ["copilot-proposal-count"] });
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
				<span style={{ fontSize: "1.5rem" }}>📋</span>
				<div>
					<h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
						Proposal Drafts
					</h1>
					<div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
						FASP-AI Decision Support · Draft-only until Admin approval
					</div>
				</div>
				<div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
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
						onClick={() => setShowGenerate((v) => !v)}
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
						{showGenerate ? "Cancel" : "+ Generate Draft"}
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

			{showGenerate && (
				<form
					onSubmit={handleGenerate}
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
						value={investorName}
						onChange={(e) => setInvestorName(e.target.value)}
						placeholder="Investor Name"
						required
						style={{
							flex: "1 1 200px",
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.5rem 0.75rem",
						}}
					/>
					<select
						value={productType}
						onChange={(e) => setProductType(e.target.value)}
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.5rem 0.75rem",
						}}
					>
						<option value="mutual_funds">Mutual Funds</option>
						<option value="pms">PMS</option>
						<option value="aif">AIF</option>
						<option value="bonds">Bonds / NCD</option>
						<option value="reit_invit">REIT / InvIT</option>
					</select>
					<input
						type="number"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						placeholder="Amount (INR)"
						style={{
							width: 140,
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.5rem 0.75rem",
						}}
					/>
					<select
						value={riskProfile}
						onChange={(e) => setRiskProfile(e.target.value)}
						style={{
							background: "#1e293b",
							color: "#f1f5f9",
							border: "1px solid rgba(255,255,255,0.12)",
							borderRadius: 8,
							padding: "0.5rem 0.75rem",
						}}
					>
						<option value="conservative">Conservative</option>
						<option value="moderate">Moderate</option>
						<option value="aggressive">Aggressive</option>
					</select>
					<button
						type="submit"
						disabled={generating}
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
						{generating ? "Generating…" : "Generate"}
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
							Loading proposal drafts…
						</div>
					) : proposals.length === 0 ? (
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
							No proposal drafts found.
						</div>
					) : (
						<div style={{ display: "grid", gap: "0.75rem" }}>
							{proposals.map((p: any) => (
								<button
									type="button"
									key={p.id}
									onClick={() => setSelectedId(p.id)}
									style={{
										width: "100%",
										textAlign: "left",
										color: "inherit",
										background:
											selectedId === p.id
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
										<span style={{ fontWeight: 700 }}>{p.investorName}</span>
										<span
											style={{
												fontSize: "0.72rem",
												padding: "0.1rem 0.55rem",
												borderRadius: 12,
												background: "rgba(99,102,241,0.2)",
												color: "#a5b4fc",
												fontWeight: 700,
											}}
										>
											{p.approvalStatus || "draft"}
										</span>
									</div>
									<div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
										{p.productType} · ₹{Number(p.amount || 0).toLocaleString("en-IN")} ·{" "}
										{p.riskProfile}
										{p.confidenceScore != null
											? ` · Confidence ${Math.round(p.confidenceScore * 100)}%`
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
								{detail.investorName} — {detail.productType}
							</h2>
							<div style={{ display: "flex", gap: "0.5rem" }}>
								{detail.approvalStatus !== "approved" && (
									<button
										onClick={() => handleDecision(detail.id, "approve")}
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
										Approve
									</button>
								)}
								{detail.approvalStatus !== "rejected" && (
									<button
										onClick={() => handleDecision(detail.id, "reject")}
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
										Reject
									</button>
								)}
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
							{detail.rationale ||
								detail.summary ||
								JSON.stringify(detail.allocation || detail, null, 2)}
						</pre>
					</div>
				)}
			</div>
		</div>
	);
}
