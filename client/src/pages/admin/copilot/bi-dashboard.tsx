/**
 * BI Dashboard — /admin/copilot/bi
 * Daily Business Intelligence summary and natural-language Q&A via /api/admin/copilot/bi/*.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

export default function CopilotBiDashboard() {
	const [question, setQuestion] = useState("");
	const [answer, setAnswer] = useState<string | null>(null);
	const [asking, setAsking] = useState(false);
	const [askError, setAskError] = useState<string | null>(null);

	const { data, isLoading, refetch } = useQuery({
		queryKey: ["copilot-bi-summary"],
		queryFn: async () => {
			const r = await fetch("/api/admin/copilot/bi/summary");
			return r.json();
		},
	});

	const summary = data?.data;

	async function handleAsk(e: React.FormEvent) {
		e.preventDefault();
		if (!question.trim()) return;
		setAsking(true);
		setAskError(null);
		try {
			const r = await fetch("/api/admin/copilot/bi/ask", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: question.trim(),
					biSummary: summary ?? {},
				}),
			});
			const json = await r.json().catch(() => ({}));
			if (!r.ok || json?.success === false) {
				setAskError(json?.error?.message || "Failed to get BI answer");
				return;
			}
			const ans = json?.data?.answer ?? json?.data;
			setAnswer(typeof ans === "string" ? ans : JSON.stringify(ans, null, 2));
		} finally {
			setAsking(false);
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
				}}
			>
				<Link href="/admin/copilot">
					<span style={{ cursor: "pointer", fontSize: "1.25rem" }}>←</span>
				</Link>
				<span style={{ fontSize: "1.5rem" }}>📊</span>
				<div>
					<h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
						BI Dashboard
					</h1>
					<div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
						Daily business intelligence summary &amp; conversational analytics
					</div>
				</div>
				<button
					onClick={() => refetch()}
					style={{
						marginLeft: "auto",
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
					↻ Refresh Summary
				</button>
			</div>

			<form
				onSubmit={handleAsk}
				style={{
					background: "rgba(255,255,255,0.04)",
					border: "1px solid rgba(255,255,255,0.1)",
					borderRadius: 12,
					padding: "1rem 1.25rem",
					marginBottom: "1.5rem",
					display: "flex",
					gap: "0.75rem",
				}}
			>
				<input
					value={question}
					onChange={(e) => setQuestion(e.target.value)}
					placeholder="Ask BI Copilot a question (e.g., What are today's top revenue drivers or open bottlenecks?)"
					style={{
						flex: 1,
						background: "#1e293b",
						color: "#f1f5f9",
						border: "1px solid rgba(255,255,255,0.12)",
						borderRadius: 8,
						padding: "0.55rem 0.85rem",
						fontSize: "0.9rem",
					}}
				/>
				<button
					type="submit"
					disabled={asking}
					style={{
						background: "#22c55e",
						color: "#fff",
						border: "none",
						borderRadius: 8,
						padding: "0.55rem 1.25rem",
						fontWeight: 700,
						cursor: "pointer",
					}}
				>
					{asking ? "Analyzing…" : "Ask BI"}
				</button>
			</form>

			{askError && (
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
					⚠️ {askError}
				</div>
			)}

			{answer && (
				<div
					style={{
						background: "rgba(99,102,241,0.12)",
						border: "1px solid rgba(99,102,241,0.35)",
						borderRadius: 12,
						padding: "1.25rem",
						marginBottom: "1.5rem",
					}}
				>
					<div
						style={{
							fontWeight: 700,
							color: "#a5b4fc",
							marginBottom: "0.5rem",
						}}
					>
						BI Copilot Answer
					</div>
					<div style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem" }}>
						{answer}
					</div>
				</div>
			)}

			{isLoading ? (
				<div style={{ color: "#94a3b8", padding: "2rem" }}>
					Generating daily BI summary…
				</div>
			) : (
				<div
					style={{
						background: "rgba(255,255,255,0.04)",
						border: "1px solid rgba(255,255,255,0.1)",
						borderRadius: 12,
						padding: "1.25rem",
					}}
				>
					<div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>
						Daily Executive Summary
					</div>
					<pre
						style={{
							whiteSpace: "pre-wrap",
							fontSize: "0.82rem",
							color: "#cbd5e1",
							margin: 0,
						}}
					>
						{typeof summary === "string"
							? summary
							: JSON.stringify(summary ?? {}, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}
