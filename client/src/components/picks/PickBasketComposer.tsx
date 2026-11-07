/**
 * @file PickBasketComposer.tsx
 * @description Floating Advisor Command Dock for Curated Multi-Asset Baskets.
 * 
 * Complies with FintekPro GCR v1.0 & FASP-AI v1.0:
 * - Multi-asset basket composition with blended risk and capital sizing
 * - Instant 1-Click SEBI-compliant WhatsApp Pitch Generator
 * - Safe batch execution via Slide-to-Confirm / Partner Client Dispatch
 */

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	Briefcase,
	MessageSquare,
	Copy,
	Send,
	ExternalLink,
	X,
	Check,
	Sparkles,
	TrendingUp,
	ShieldCheck,
	Layers,
	Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PickBasketComposerProps {
	selectedPicks: any[];
	onClearSelection: () => void;
	onSlideOrderOpen?: (picks: any[]) => void;
	onDispatchOpen?: (picks: any[]) => void;
}

export const PickBasketComposer: React.FC<PickBasketComposerProps> = ({
	selectedPicks,
	onClearSelection,
	onSlideOrderOpen,
	onDispatchOpen,
}) => {
	const { toast } = useToast();
	const [proposalModalOpen, setProposalModalOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	if (!selectedPicks || selectedPicks.length === 0) return null;

	// Basket Computations
	let totalCapital = 0;
	let weightedReturnNumerator = 0;

	const categoryCount: Record<string, number> = {};

	selectedPicks.forEach((p) => {
		const price = Number(p.recoPrice) || 0;
		const target = Number(p.targetPrice) || price;
		const returnPct = price > 0 ? ((target - price) / price) * 100 : 0;

		totalCapital += price;
		weightedReturnNumerator += returnPct * Math.max(1, price);

		const cat = p.category || "listed_stocks";
		categoryCount[cat] = (categoryCount[cat] || 0) + 1;
	});

	const blendedReturnPct =
		totalCapital > 0 ? (weightedReturnNumerator / totalCapital).toFixed(1) : "0.0";

	// Generate WhatsApp pitch proposal
	const generateProposalText = () => {
		const lines: string[] = [
			`*FintekPro Curated Advisory Basket (${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})*`,
			`_Recommended by your Wealth Advisory Team · Quantitative Model Confidence: High_`,
			``,
			`*Basket Summary:*`,
			`• Total Opportunities: ${selectedPicks.length}`,
			`• Blended Expected Target Return: +${blendedReturnPct}%`,
			`• Indicative Capital Base: ₹${Math.round(totalCapital).toLocaleString("en-IN")}`,
			``,
			`*Recommended Allocation Breakdown:*`,
		];

		selectedPicks.forEach((p, idx) => {
			const price = Number(p.recoPrice) || 0;
			const target = Number(p.targetPrice) || price;
			const sl = Number(p.stoplossPrice) || price * 0.95;
			const upside = price > 0 ? (((target - price) / price) * 100).toFixed(1) : "0.0";
			const catLabel = (p.category || "Equity").replace(/_/g, " ").toUpperCase();

			lines.push(
				`${idx + 1}. *${p.instrumentName}* (${p.symbol || "N/A"}) - [${catLabel}]`,
			);
			lines.push(`   • Entry CMP: ₹${Math.round(price).toLocaleString("en-IN")}`);
			lines.push(`   • Target: ₹${Math.round(target).toLocaleString("en-IN")} (+${upside}%)`);
			lines.push(`   • Stoploss: ₹${Math.round(sl).toLocaleString("en-IN")}`);
			lines.push(`   • Rationale: ${p.rationale ? p.rationale.slice(0, 110) + "..." : "High conviction momentum setup."}`);
			lines.push(``);
		});

		lines.push(
			`_Disclaimer: For informational and decision-support purposes only. Investment in securities is subject to market risks. Final investment requires investor authorization._`,
		);

		return lines.join("\n");
	};

	const proposalText = generateProposalText();

	const handleCopy = () => {
		navigator.clipboard.writeText(proposalText);
		setCopied(true);
		toast({
			title: "Advisory Basket Pitch Copied!",
			description: "Ready to paste directly into WhatsApp, Email, or Client Memo.",
		});
		setTimeout(() => setCopied(false), 2500);
	};

	const handleWhatsAppShare = () => {
		const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(proposalText)}`;
		window.open(url, "_blank");
	};

	return (
		<>
			{/* Floating Dock */}
			<div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-4xl animate-in slide-in-from-bottom duration-300">
				<div className="bg-background/95 backdrop-blur-md border-2 border-primary/40 shadow-2xl rounded-2xl p-3.5 px-5 flex items-center justify-between gap-4 flex-wrap">
					{/* Left: Basket Stats */}
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
							<Briefcase className="h-5 w-5" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h4 className="font-bold text-sm text-foreground">
									Curated Basket ({selectedPicks.length} Selected)
								</h4>
								<Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono">
									Blended Tgt: +{blendedReturnPct}%
								</Badge>
							</div>
							<div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
								<span>
									Indicative Capital: <strong className="font-mono text-foreground">₹{Math.round(totalCapital).toLocaleString("en-IN")}</strong>
								</span>
								<span>·</span>
								<span>
									{Object.entries(categoryCount)
										.map(([cat, cnt]) => `${cat.replace(/_/g, " ")}: ${cnt}`)
										.join(" · ")}
								</span>
							</div>
						</div>
					</div>

					{/* Right: Actions */}
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setProposalModalOpen(true)}
							className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
						>
							<MessageSquare className="h-3.5 w-3.5" />
							WhatsApp Pitch
						</Button>

						{onDispatchOpen && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => onDispatchOpen(selectedPicks)}
								className="h-8 text-xs gap-1.5"
							>
								<Share2 className="h-3.5 w-3.5" />
								Dispatch to Clients
							</Button>
						)}

						{onSlideOrderOpen && (
							<Button
								size="sm"
								onClick={() => onSlideOrderOpen(selectedPicks)}
								className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
							>
								<Sparkles className="h-3.5 w-3.5" />
								Batch Order
							</Button>
						)}

						<Button
							variant="ghost"
							size="icon"
							onClick={onClearSelection}
							className="h-8 w-8 text-muted-foreground hover:text-foreground"
							title="Clear Selection"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			{/* Proposal Preview Modal */}
			<Dialog open={proposalModalOpen} onOpenChange={setProposalModalOpen}>
				<DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-base">
							<MessageSquare className="h-4 w-4 text-emerald-600" />
							WhatsApp Client Pitch Proposal
						</DialogTitle>
						<DialogDescription className="text-xs">
							SEBI-compliant multi-asset recommendation summary ready to dispatch.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 py-2">
						<div className="p-3.5 rounded-lg border bg-muted/30 font-mono text-xs whitespace-pre-wrap leading-relaxed text-foreground select-all">
							{proposalText}
						</div>

						<div className="flex items-center justify-between gap-2 pt-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleCopy}
								className="gap-1.5 text-xs"
							>
								{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
								{copied ? "Copied to Clipboard" : "Copy Message Text"}
							</Button>

							<Button
								size="sm"
								onClick={handleWhatsAppShare}
								className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								Share via WhatsApp Web
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};
export default PickBasketComposer;

