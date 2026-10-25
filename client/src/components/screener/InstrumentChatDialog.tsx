/**
 * client/src/components/screener/InstrumentChatDialog.tsx
 *
 * Universal Contextual AI Decision Support Copilot Dialog.
 * Enables conversational advisory across all asset classes:
 * - Listed Stocks (NSE/BSE)
 * - Smallcase Thematic Baskets
 * - Market & Sectoral Indices
 * - Mutual Funds
 * - Bonds & Fixed Income
 * - ETFs, REITs, Pre-IPO
 *
 * Features:
 * - Instant asset-class customized prompt suggestion chips
 * - Multi-turn conversational context with FASP-AI Decision Support
 * - Confidence score and explainability factors breakdown
 * - Key positives & risks indicator pills
 * - SEBI regulatory disclaimers
 */

import { useState, useRef, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Bot,
	User,
	Send,
	Loader2,
	Sparkles,
	TrendingUp,
	ShieldAlert,
	CheckCircle2,
	HelpCircle,
} from "lucide-react";

export interface ChatInstrumentTarget {
	type?:
		| "stock"
		| "mutual_fund"
		| "bond"
		| "etf"
		| "unlisted"
		| "reit_invit"
		| "smallcase"
		| "index"
		| string;
	assetType?: string;
	symbolOrId?: string;
	id?: string;
	symbol?: string;
	name: string;
	sector?: string;
	subSector?: string;
	macroSector?: string;
	price?: number | string;
	currentPrice?: number | string;
	changePercent?: number | string;
	peRatio?: number | string;
	pe?: number | string;
	pbRatio?: number | string;
	roe?: number | string;
	cagr3y?: number | string;
	returns1y?: number | string;
	returns3y?: number | string;
	expenseRatio?: number | string;
	rating?: number | string;
	creditRating?: string;
	yield?: number | string;
	ytm?: number | string;
	theme?: string;
	riskLevel?: string;
	holdingsCount?: number;
	constituentsCount?: number;
	manager?: string;
	topHoldings?: Array<{ symbol: string; weight?: number; name?: string }>;
	indexLevel?: number | string;
	description?: string;
	[key: string]: any;
}

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	recommendation?: string;
	confidence?: number;
	factors?: string[];
	positives?: string[];
	risks?: string[];
	suggestedQuestions?: string[];
	timestamp: string;
}

interface InstrumentChatDialogProps {
	instrument: ChatInstrumentTarget | null;
	isOpen: boolean;
	onClose: () => void;
}

export function InstrumentChatDialog({
	instrument,
	isOpen,
	onClose,
}: InstrumentChatDialogProps) {
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Generate initial suggestions based on asset type
	const getInitialSuggestions = (inst: ChatInstrumentTarget | null) => {
		if (!inst) return [];
		switch (inst.type) {
			case "smallcase":
				return [
					"Analyze this thematic basket and its rationale",
					"What is the risk-reward profile and volatility?",
					"How does this fit in a core-satellite portfolio?",
					"Compare this theme with direct ETF index investing",
				];
			case "index":
				return [
					"What is current valuation vs 10Y historical median?",
					"Which sectors and stocks are driving recent momentum?",
					"Is now a good entry point for systematic SIP?",
					"What are key support and resistance levels?",
				];
			case "stock":
				return [
					"Explain investment thesis, moat, and valuation",
					"What are the top 3 downside risk factors?",
					"How does ROCE and balance sheet compare to peers?",
					"Analyze recent revenue and earnings growth trends",
				];
			case "mutual_fund":
				return [
					"Evaluate fund manager track record & alpha generation",
					"Is the expense ratio justified against benchmark?",
					"How has the scheme performed during market downturns?",
					"Recommend ideal investment horizon and risk profile",
				];
			case "bond":
				return [
					"Analyze credit quality, safety, and issuer rating",
					"What is the effective post-tax yield to maturity?",
					"How will interest rate shifts affect duration risk?",
				];
			default:
				return [
					"Provide comprehensive investment analysis",
					"What are the major catalysts and risks?",
					"Recommended asset allocation and horizon",
				];
		}
	};

	// Reset messages when instrument changes
	useEffect(() => {
		if (instrument && isOpen) {
			const instType = (instrument.type || instrument.assetType || "stock").toLowerCase();
			const instSymbol = instrument.symbolOrId || instrument.symbol || instrument.id || "";
			const typeLabel =
				instType === "smallcase"
					? "Thematic Smallcase Basket"
					: instType === "index"
					? "Market Benchmark Index"
					: instType === "stock"
					? "Listed Equity"
					: instType.toUpperCase();

			setMessages([
				{
					id: "welcome",
					role: "assistant",
					content: `Hello! I am your **FintekPro FASP-AI Decision Support Copilot**. I have loaded full operational & quantitative context for **${instrument.name} (${instSymbol})** [${typeLabel}].

Ask any question about fundamentals, valuation multiples, thematic catalysts, risk breakdown, or portfolio suitability.`,
					timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					suggestedQuestions: getInitialSuggestions(instrument),
				},
			]);
		}
	}, [instrument, isOpen]);

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, isLoading]);

	const handleSendMessage = async (textToSend?: string) => {
		const messageText = textToSend || input;
		if (!messageText.trim() || !instrument || isLoading) return;

		const userMsg: ChatMessage = {
			id: `user-${Date.now()}`,
			role: "user",
			content: messageText.trim(),
			timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		};

		setMessages((prev) => [...prev, userMsg]);
		if (!textToSend) setInput("");
		setIsLoading(true);

		try {
			const instType = (instrument.type || instrument.assetType || "stock").toLowerCase();
			const instSymbol = instrument.symbolOrId || instrument.symbol || instrument.id || "";
			const res = await fetch("/api/screener/instruments/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					instrumentType: instType,
					symbolOrId: instSymbol,
					name: instrument.name,
					context: {
						price: instrument.price ?? instrument.currentPrice,
						sector: instrument.sector,
						subSector: instrument.subSector,
						macroSector: instrument.macroSector,
						peRatio: instrument.peRatio ?? instrument.pe,
						pbRatio: instrument.pbRatio,
						roe: instrument.roe,
						cagr3y: instrument.cagr3y,
						returns1y: instrument.returns1y,
						returns3y: instrument.returns3y,
						expenseRatio: instrument.expenseRatio,
						rating: instrument.rating,
						creditRating: instrument.creditRating,
						yield: instrument.yield ?? instrument.ytm,
						ytm: instrument.ytm,
						theme: instrument.theme,
						riskLevel: instrument.riskLevel,
						manager: instrument.manager,
						constituentsCount: instrument.constituentsCount || instrument.holdingsCount,
						topHoldings: instrument.topHoldings,
						indexLevel: instrument.indexLevel,
						changePercent: instrument.changePercent,
						description: instrument.description,
					},
					message: messageText.trim(),
					history: messages
						.filter((m) => m.id !== "welcome")
						.map((m) => ({ role: m.role, content: m.content })),
				}),
			});

			const json = await res.json();
			if (json.success && json.data) {
				const d = json.data;
				const assistantMsg: ChatMessage = {
					id: `ai-${Date.now()}`,
					role: "assistant",
					content: d.reply || "Analysis complete.",
					recommendation: d.recommendation,
					confidence: d.confidence_score,
					factors: d.factors_considered,
					positives: d.key_positives,
					risks: d.key_risks,
					suggestedQuestions: d.suggested_questions,
					timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
				};
				setMessages((prev) => [...prev, assistantMsg]);
			} else {
				throw new Error(json.message || "Failed to generate AI analysis");
			}
		} catch (err: any) {
			setMessages((prev) => [
				...prev,
				{
					id: `err-${Date.now()}`,
					role: "assistant",
					content: `⚠️ Note: ${err.message || "Unable to reach advisory engine"}. Using conservative decision support: ensure this instrument aligns with your investment horizon and target asset allocation.`,
					timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	if (!instrument) return null;

	const typeBadgeColor =
		instrument.type === "stock"
			? "bg-blue-500/10 text-blue-600 border-blue-500/30"
			: instrument.type === "smallcase"
			? "bg-indigo-500/10 text-indigo-600 border-indigo-500/30"
			: instrument.type === "index"
			? "bg-sky-500/10 text-sky-600 border-sky-500/30"
			: instrument.type === "mutual_fund"
			? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
			: "bg-amber-500/10 text-amber-600 border-amber-500/30";

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-border shadow-2xl">
				{/* ── Dialog Header ── */}
				<DialogHeader className="p-4 border-b bg-muted/20 shrink-0">
					<div className="flex items-start justify-between gap-3">
						<div className="space-y-1">
							<div className="flex items-center gap-2 flex-wrap">
								<DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
									<Sparkles className="h-4 w-4 text-amber-500" />
									{instrument.name}
								</DialogTitle>
								<Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${typeBadgeColor}`}>
									{instrument.type}
								</Badge>
								<span className="text-xs font-mono text-muted-foreground">
									{instrument.symbolOrId}
								</span>
							</div>
							<DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
								{instrument.sector && (
									<span>Sector: <strong className="text-foreground">{instrument.sector}</strong></span>
								)}
								{instrument.subSector && (
									<span>· Sub-sector: <strong className="text-foreground">{instrument.subSector}</strong></span>
								)}
								{instrument.theme && (
									<span>· Theme: <strong className="text-foreground">{instrument.theme}</strong></span>
								)}
								{instrument.category && (
									<span>· Category: <strong className="text-foreground">{instrument.category}</strong></span>
								)}
							</DialogDescription>
						</div>

						{/* Quick Price/Metric pill */}
						<div className="text-right shrink-0 bg-background/80 px-2.5 py-1 rounded-lg border border-border/60">
							<div className="text-xs font-bold text-foreground">
								{instrument.indexLevel
									? Number(instrument.indexLevel).toLocaleString()
									: instrument.price
									? `₹${Number(instrument.price).toLocaleString()}`
									: instrument.cagr3y
									? `${instrument.cagr3y}% 3Y CAGR`
									: "—"}
							</div>
							{instrument.changePercent !== undefined && (
								<div
									className={`text-[10px] font-semibold ${
										Number(instrument.changePercent) >= 0 ? "text-emerald-600" : "text-rose-600"
									}`}
								>
									{Number(instrument.changePercent) >= 0 ? "+" : ""}
									{instrument.changePercent}%
								</div>
							)}
						</div>
					</div>
				</DialogHeader>

				{/* ── Chat Message Thread ── */}
				<div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[55vh]">
					{messages.map((m) => (
						<div
							key={m.id}
							className={`flex gap-3 text-xs ${
								m.role === "user" ? "justify-end" : "justify-start"
							}`}
						>
							{m.role === "assistant" && (
								<div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
									<Bot className="h-4 w-4 text-primary" />
								</div>
							)}

							<div
								className={`max-w-[85%] rounded-xl p-3 space-y-2.5 ${
									m.role === "user"
										? "bg-primary text-primary-foreground ml-12"
										: "bg-muted/40 border border-border/60 text-foreground mr-8"
								}`}
							>
								{/* Recommendation & Confidence Badge for Assistant */}
								{m.role === "assistant" && m.recommendation && (
									<div className="flex items-center gap-2 pb-1 border-b border-border/40">
										<Badge
											variant="secondary"
											className={`text-[10px] font-bold ${
												m.recommendation === "ACCUMULATE"
													? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
													: m.recommendation === "REVIEW"
													? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
													: "bg-blue-500/20 text-blue-700 dark:text-blue-300"
											}`}
										>
											{m.recommendation.replace(/_/g, " ")}
										</Badge>
										{m.confidence && (
											<span className="text-[10px] text-muted-foreground flex items-center gap-1">
												<CheckCircle2 className="h-3 w-3 text-emerald-500" />
												Confidence: {m.confidence}%
											</span>
										)}
									</div>
								)}

								{/* Message Content */}
								<div className="whitespace-pre-line leading-relaxed text-xs">
									{m.content}
								</div>

								{/* Positives & Risks */}
								{m.role === "assistant" && (m.positives?.length || m.risks?.length) ? (
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[11px]">
										{m.positives && m.positives.length > 0 && (
											<div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20 space-y-1">
												<div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 text-[10px]">
													<TrendingUp className="h-3 w-3" /> Key Drivers & Positives
												</div>
												<ul className="list-disc list-inside space-y-0.5 text-foreground/80 text-[10px]">
													{m.positives.map((p, i) => (
														<li key={i}>{p}</li>
													))}
												</ul>
											</div>
										)}
										{m.risks && m.risks.length > 0 && (
											<div className="bg-rose-500/10 p-2 rounded border border-rose-500/20 space-y-1">
												<div className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1 text-[10px]">
													<ShieldAlert className="h-3 w-3" /> Downside Risks & Cautions
												</div>
												<ul className="list-disc list-inside space-y-0.5 text-foreground/80 text-[10px]">
													{m.risks.map((r, i) => (
														<li key={i}>{r}</li>
													))}
												</ul>
											</div>
										)}
									</div>
								) : null}

								{/* Suggested Next Questions */}
								{m.role === "assistant" && m.suggestedQuestions && m.suggestedQuestions.length > 0 && (
									<div className="pt-1.5 border-t border-border/40 space-y-1">
										<span className="text-[10px] text-muted-foreground font-medium block">
											Suggested Follow-ups:
										</span>
										<div className="flex flex-wrap gap-1">
											{m.suggestedQuestions.map((q, idx) => (
												<button
													key={idx}
													type="button"
													disabled={isLoading}
													onClick={() => handleSendMessage(q)}
													className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-background border border-border/70 text-foreground/90 hover:bg-muted hover:border-primary/50 transition-colors text-left"
												>
													<HelpCircle className="h-2.5 w-2.5 text-primary shrink-0" />
													<span>{q}</span>
												</button>
											))}
										</div>
									</div>
								)}

								<div className="text-[9px] opacity-60 text-right">
									{m.timestamp}
								</div>
							</div>

							{m.role === "user" && (
								<div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
									<User className="h-4 w-4 text-primary-foreground" />
								</div>
							)}
						</div>
					))}

					{isLoading && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/20 rounded-xl w-fit">
							<Loader2 className="h-4 w-4 animate-spin text-primary" />
							<span>FintekPro FASP-AI evaluating {instrument.name}...</span>
						</div>
					)}
				</div>

				{/* ── Input Box & Footer ── */}
				<div className="p-3 border-t bg-muted/20 space-y-2 shrink-0">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSendMessage();
						}}
						className="flex items-center gap-2"
					>
						<Input
							placeholder={`Ask AI about ${instrument.name} (${instrument.symbolOrId})...`}
							value={input}
							disabled={isLoading}
							onChange={(e) => setInput(e.target.value)}
							className="h-9 text-xs bg-background"
						/>
						<Button
							type="submit"
							size="sm"
							disabled={isLoading || !input.trim()}
							className="h-9 px-3 gap-1.5 shrink-0"
						>
							{isLoading ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Send className="h-3.5 w-3.5" />
							)}
							<span>Send</span>
						</Button>
					</form>

					<div className="text-[10px] text-muted-foreground text-center">
						Decision Support only · SEBI registered IA rules apply · Not automated trade execution
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
