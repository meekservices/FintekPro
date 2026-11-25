/**
 * Finance (Books) — /admin/copilot/finance
 * Invoices, payouts, revenue reconciliation & Zoho Books sync.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function CopilotBooksFinance() {
	const [tab, setTab] = useState<"invoices" | "payouts" | "reconciliation">(
		"invoices",
	);
	const [connectionId, setConnectionId] = useState("default");
	const [syncing, setSyncing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const qc = useQueryClient();

	const { data: invData, isLoading: invLoading } = useQuery({
		queryKey: ["copilot-books-invoices"],
		enabled: tab === "invoices",
		queryFn: async () => {
			const r = await fetch("/api/admin/copilot/books/invoices?limit=50");
			return r.json();
		},
	});

	const { data: payoutData, isLoading: payoutLoading } = useQuery({
		queryKey: ["copilot-books-payouts"],
		enabled: tab === "payouts",
		queryFn: async () => {
			const r = await fetch("/api/admin/copilot/books/payouts?limit=50");
			return r.json();
		},
	});

	const { data: reconData, isLoading: reconLoading } = useQuery({
		queryKey: ["copilot-books-reconciliation"],
		enabled: tab === "reconciliation",
		queryFn: async () => {
			const r = await fetch("/api/admin/copilot/books/reconciliation");
			return r.json();
		},
	});

	async function handleSync() {
		setSyncing(true);
		setError(null);
		try {
			const r = await fetch("/api/admin/copilot/books/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ connectionId: connectionId.trim() || "default" }),
			});
			const json = await r.json().catch(() => ({}));
			if (!r.ok || json?.success === false) {
				setError(json?.error?.message || `Books sync failed (${r.status})`);
				return;
			}
			qc.invalidateQueries({ queryKey: ["copilot-books-invoices"] });
			qc.invalidateQueries({ queryKey: ["copilot-books-payouts"] });
			qc.invalidateQueries({ queryKey: ["copilot-books-reconciliation"] });
		} finally {
			setSyncing(false);
		}
	}

	async function handleIssueInvoice(id: string) {
		setError(null);
		const r = await fetch(`/api/admin/copilot/books/invoices/${id}/issue`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ connectionId: connectionId.trim() || "default" }),
		});
		const json = await r.json().catch(() => ({}));
		if (!r.ok || json?.success === false) {
			setError(json?.error?.message || "Failed to issue invoice");
			return;
		}
		qc.invalidateQueries({ queryKey: ["copilot-books-invoices"] });
	}

	const invoices = invData?.data ?? [];
	const payouts = payoutData?.data ?? [];
	const recons = reconData?.data ?? [];

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
				<span style={{ fontSize: "1.5rem" }}>💰</span>
				<div>
					<h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
						Finance (Books)
					</h1>
					<div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
						Invoice drafts, partner payouts &amp; revenue reconciliation
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
						{syncing ? "Syncing…" : "↻ Sync Books"}
					</button>
				</div>
			</div>

			<div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
				{(["invoices", "payouts", "reconciliation"] as const).map((t) => (
					<button
						type="button"
						key={t}
						onClick={() => setTab(t)}
						style={{
							background:
								tab === t ? "#6366f1" : "rgba(255,255,255,0.06)",
							color: "#f1f5f9",
							border: "none",
							borderRadius: 8,
							padding: "0.45rem 1rem",
							fontWeight: 700,
							cursor: "pointer",
							textTransform: "capitalize",
							fontSize: "0.82rem",
						}}
					>
						{t}
					</button>
				))}
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

			{tab === "invoices" &&
				(invLoading ? (
					<div style={{ color: "#94a3b8" }}>Loading invoices…</div>
				) : invoices.length === 0 ? (
					<div style={{ color: "#94a3b8" }}>No invoice drafts found.</div>
				) : (
					<div style={{ display: "grid", gap: "0.75rem" }}>
						{invoices.map((inv: any) => (
							<div
								key={inv.id}
								style={{
									background: "rgba(255,255,255,0.04)",
									border: "1px solid rgba(255,255,255,0.1)",
									borderRadius: 12,
									padding: "1rem 1.25rem",
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									gap: "1rem",
								}}
							>
								<div>
									<div style={{ fontWeight: 700 }}>
										{inv.customerName || inv.dealName || inv.id}
									</div>
									<div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
										₹{Number(inv.totalAmount || inv.amount || 0).toLocaleString("en-IN")} ·{" "}
										{inv.issuedToZohoBooks ? "Issued" : "Draft"}
									</div>
								</div>
								{!inv.issuedToZohoBooks && (
									<button
										type="button"
										onClick={() => handleIssueInvoice(inv.id)}
										style={{
											background: "#22c55e",
											color: "#fff",
											border: "none",
											borderRadius: 8,
											padding: "0.4rem 0.9rem",
											fontWeight: 700,
											cursor: "pointer",
											fontSize: "0.8rem",
										}}
									>
										Issue to Zoho Books
									</button>
								)}
							</div>
						))}
					</div>
				))}

			{tab === "payouts" &&
				(payoutLoading ? (
					<div style={{ color: "#94a3b8" }}>Loading payouts…</div>
				) : payouts.length === 0 ? (
					<div style={{ color: "#94a3b8" }}>No payout suggestions found.</div>
				) : (
					<div style={{ display: "grid", gap: "0.75rem" }}>
						{payouts.map((p: any) => (
							<div
								key={p.id}
								style={{
									background: "rgba(255,255,255,0.04)",
									border: "1px solid rgba(255,255,255,0.1)",
									borderRadius: 12,
									padding: "1rem 1.25rem",
								}}
							>
								<div style={{ fontWeight: 700 }}>
									{p.recipientName} ({p.recipientType})
								</div>
								<div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
									Net Payable: ₹
									{Number(p.netPayable || p.grossAmount || 0).toLocaleString("en-IN")}{" "}
									· Status: {p.approvalStatus || "draft"}
								</div>
							</div>
						))}
					</div>
				))}

			{tab === "reconciliation" &&
				(reconLoading ? (
					<div style={{ color: "#94a3b8" }}>Loading reconciliation…</div>
				) : recons.length === 0 ? (
					<div style={{ color: "#94a3b8" }}>
						No revenue reconciliation records found.
					</div>
				) : (
					<div style={{ display: "grid", gap: "0.75rem" }}>
						{recons.map((r: any) => (
							<div
								key={r.id}
								style={{
									background: "rgba(255,255,255,0.04)",
									border: "1px solid rgba(255,255,255,0.1)",
									borderRadius: 12,
									padding: "1rem 1.25rem",
								}}
							>
								<div style={{ fontWeight: 700 }}>
									Period:{" "}
									{r.periodStart
										? new Date(r.periodStart).toLocaleDateString("en-IN")
										: "—"}{" "}
									–{" "}
									{r.periodEnd
										? new Date(r.periodEnd).toLocaleDateString("en-IN")
										: "—"}
								</div>
								<div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
									Variance: ₹
									{Number(r.varianceAmount || 0).toLocaleString("en-IN")} ·{" "}
									{r.status || "pending"}
								</div>
							</div>
						))}
					</div>
				))}
		</div>
	);
}
