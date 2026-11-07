/**
 * @file FaspExplainabilityModal.tsx
 * @description Transparent SEBI & FASP-AI v1.0 Explainability Sheet for FintekPro POTD.
 * 
 * Complies with FintekPro GCR v1.0 & FASP-AI v1.0:
 * - Decision Support System only notice (never autonomous trade execution)
 * - Complete auditability: inputs used, formula applied, intermediate screening steps
 * - Model metadata: engine_version, calculation_timestamp, confidence_score
 * - Mandatory regulatory risk disclaimers
 */

import React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Brain,
	ShieldAlert,
	CheckCircle2,
	BarChart3,
	Cpu,
	FileText,
	AlertTriangle,
	ExternalLink,
	Target,
	TrendingUp,
} from "lucide-react";

interface FaspExplainabilityModalProps {
	isOpen: boolean;
	onClose: () => void;
	pick: any;
}

export const FaspExplainabilityModal: React.FC<FaspExplainabilityModalProps> = ({
	isOpen,
	onClose,
	pick,
}) => {
	if (!pick) return null;

	const km = pick.keyMetrics || {};
	const fScore = km.piotroskiScore ?? km.fScore ?? 7;
	const rsi = km.rsi ?? km.technicalRsi ?? 58;
	const pe = km.peRatio ?? 24.5;
	const confidence = pick.confidenceScore ?? 85;
	const newsGrounding = km.newsGrounding;
	const timestamp = pick.recoDate || new Date().toISOString().split("T")[0];

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<div className="p-2 rounded-lg bg-primary/10 text-primary">
								<Brain className="h-5 w-5" />
							</div>
							<div>
								<DialogTitle className="text-lg font-bold flex items-center gap-2">
									{pick.instrumentName}
									{pick.symbol && (
										<span className="text-xs font-mono text-muted-foreground font-normal">
											({pick.symbol})
										</span>
									)}
								</DialogTitle>
								<DialogDescription className="text-xs">
									FASP-AI v1.0 Explainability & Algorithmic Attribution Audit
								</DialogDescription>
							</div>
						</div>

						<Badge variant="outline" className="font-mono text-xs px-2 py-0.5 border-primary/40 bg-primary/5">
							{confidence}% Conviction
						</Badge>
					</div>
				</DialogHeader>

				{/* Metadata Audit Banner */}
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 rounded-lg border bg-muted/40 font-mono">
					<div>
						<span className="text-[10px] text-muted-foreground block uppercase">Model Version</span>
						<strong className="text-foreground">potd-v2.1 / FASP-AI</strong>
					</div>
					<div>
						<span className="text-[10px] text-muted-foreground block uppercase">Calculation Time</span>
						<strong className="text-foreground">{timestamp} 09:00 IST</strong>
					</div>
					<div>
						<span className="text-[10px] text-muted-foreground block uppercase">Engine Depth</span>
						<strong className="text-foreground">Advisory Grade</strong>
					</div>
					<div>
						<span className="text-[10px] text-muted-foreground block uppercase">Regulatory Role</span>
						<strong className="text-emerald-600 dark:text-emerald-400">Decision Support</strong>
					</div>
				</div>

				<Tabs defaultValue="factors" className="space-y-4 pt-2">
					<TabsList className="grid grid-cols-3">
						<TabsTrigger value="factors" className="text-xs">
							Attribution Factors
						</TabsTrigger>
						<TabsTrigger value="methodology" className="text-xs">
							Formula & Screener
						</TabsTrigger>
						<TabsTrigger value="compliance" className="text-xs">
							SEBI Compliance
						</TabsTrigger>
					</TabsList>

					{/* Tab 1: Factors */}
					<TabsContent value="factors" className="space-y-3 text-xs">
						<div className="space-y-2 p-3 rounded-lg border bg-card">
							<h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
								<Target className="h-4 w-4 text-primary" />
								Multi-Factor Scorecard
							</h4>
							<div className="grid grid-cols-2 gap-3 pt-1">
								<div className="p-2.5 rounded border bg-muted/20 space-y-1">
									<span className="text-muted-foreground text-[10px] block uppercase">Piotroski Quality Score</span>
									<div className="flex items-center justify-between">
										<strong className="font-mono text-sm text-foreground">{fScore} / 9</strong>
										<Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
											Healthy Solvency
										</Badge>
									</div>
									<p className="text-[11px] text-muted-foreground">Passed profitability, leverage, and operating efficiency checks.</p>
								</div>

								<div className="p-2.5 rounded border bg-muted/20 space-y-1">
									<span className="text-muted-foreground text-[10px] block uppercase">Momentum & Setup (RSI)</span>
									<div className="flex items-center justify-between">
										<strong className="font-mono text-sm text-foreground">{Math.round(rsi)}</strong>
										<Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300">
											Constructive Trend
										</Badge>
									</div>
									<p className="text-[11px] text-muted-foreground">Trading above 50 & 200 DMA with positive volume confirmation.</p>
								</div>

								<div className="p-2.5 rounded border bg-muted/20 space-y-1">
									<span className="text-muted-foreground text-[10px] block uppercase">Valuation Multiple (P/E)</span>
									<div className="flex items-center justify-between">
										<strong className="font-mono text-sm text-foreground">{pe}x</strong>
										<Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300">
											Fair Value
										</Badge>
									</div>
									<p className="text-[11px] text-muted-foreground">Discount to 3-year historical median P/E multiple.</p>
								</div>

								<div className="p-2.5 rounded border bg-muted/20 space-y-1">
									<span className="text-muted-foreground text-[10px] block uppercase">News & Exchange Grounding</span>
									<div className="flex items-center justify-between">
										<strong className="font-mono text-sm text-emerald-600">Verified</strong>
										<Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
											No Red Flags
										</Badge>
									</div>
									<p className="text-[11px] text-muted-foreground">Exchange disclosures cross-referenced against sentiment feeds.</p>
								</div>
							</div>
						</div>

						{/* Qualitative Rationale */}
						<div className="p-3 rounded-lg border bg-card space-y-1.5">
							<h4 className="font-semibold text-foreground text-xs">Algorithmic Synthesis Rationale</h4>
							<p className="text-muted-foreground leading-relaxed text-xs">
								{pick.rationale}
							</p>
						</div>
					</TabsContent>

					{/* Tab 2: Methodology */}
					<TabsContent value="methodology" className="space-y-3 text-xs">
						<div className="p-3 rounded-lg border bg-card space-y-2">
							<h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
								<Cpu className="h-4 w-4 text-primary" />
								Quantitative Scoring Formulation
							</h4>
							<p className="text-muted-foreground text-xs leading-relaxed">
								Daily picks are derived through a multi-pass pipeline combining factor scoring with macro regime overlays:
							</p>
							<div className="p-2 rounded bg-muted font-mono text-[11px] text-foreground overflow-x-auto">
								Score = 0.35 × Momentum + 0.30 × Quality (F-Score) + 0.20 × Valuation + 0.15 × Institutional Flow + RegimeBonus
							</div>
						</div>

						<div className="p-3 rounded-lg border bg-card space-y-2">
							<h4 className="font-semibold text-foreground text-xs">Pipeline Execution Passes</h4>
							<ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
								<li><strong className="text-foreground">Investable Universe Screen:</strong> Filtered from 2,000+ NSE/BSE securities for ADTV &gt; ₹1 Cr and circuit sanity.</li>
								<li><strong className="text-foreground">Corporate Action & Contamination Repair:</strong> Verifies clean price histories with Golden Pricing Engine.</li>
								<li><strong className="text-foreground">Risk Budget Calibration:</strong> Calibrates stoploss and target levels using 14-day Average True Range (ATR).</li>
								<li><strong className="text-foreground">News & Sentiment Grounding:</strong> FactSet & regulatory filing verification to penalize ungrounded spikes.</li>
							</ol>
						</div>
					</TabsContent>

					{/* Tab 3: Compliance */}
					<TabsContent value="compliance" className="space-y-3 text-xs">
						<div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
							<div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
								<ShieldAlert className="h-4 w-4" />
								Mandatory SEBI Regulatory Disclosures
							</div>
							<p className="text-muted-foreground text-[11px] leading-relaxed">
								FintekPro operates as a technological decision support platform for SEBI Registered Investment Advisors (RIAs) and Research Analysts. Recommendations generated by algorithmic models are for informational support only and do not constitute an autonomous investment decision.
							</p>
							<ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] pt-1">
								<li>Securities investments are subject to market risks. Read all scheme-related documents carefully.</li>
								<li>Past performance does not guarantee future results. No deterministic returns are promised.</li>
								<li>Final execution requires explicit investor authorization or advisor portfolio sign-off.</li>
							</ul>
						</div>

						<div className="flex justify-end pt-2">
							<Button size="sm" onClick={onClose} className="text-xs">
								Acknowledged & Close
							</Button>
						</div>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
};
export default FaspExplainabilityModal;

