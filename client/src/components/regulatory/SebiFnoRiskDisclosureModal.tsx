import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, ShieldAlert, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "sebi_fno_risk_disclosure_acknowledged_date";

export function SebiFnoRiskDisclosureModal() {
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		try {
			const acknowledgedDate = localStorage.getItem(STORAGE_KEY);
			const today = new Date().toISOString().split("T")[0];
			// SEBI recommends daily or session-level mandatory acknowledgment
			if (acknowledgedDate !== today) {
				setIsOpen(true);
			}
		} catch {
			setIsOpen(true);
		}
	}, []);

	const handleAcknowledge = () => {
		try {
			const today = new Date().toISOString().split("T")[0];
			localStorage.setItem(STORAGE_KEY, today);
			fetch("/api/consent", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					preferences: { fnoRiskDisclosure: true },
					sourceScreen: "fno_derivatives_screen",
					sourceComponent: "SebiFnoRiskDisclosureModal",
					version: "SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2023/71",
					timestamp: new Date().toISOString(),
				}),
			}).catch(() => {});
		} catch {}
		setIsOpen(false);
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => {
			// Prevent closing without explicit acknowledgment
			if (!open && !localStorage.getItem(STORAGE_KEY)) return;
			setIsOpen(open);
		}}>
			<DialogContent className="max-w-lg p-0 overflow-hidden border-2 border-rose-500/80 dark:border-rose-700 shadow-2xl">
				{/* Top Danger Header */}
				<div className="bg-rose-600 text-white p-5 text-center space-y-1.5 relative">
					<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-700/80 text-[11px] font-bold uppercase tracking-wider">
						<ShieldAlert className="h-3.5 w-3.5" />
						SEBI Mandatory Regulatory Risk Disclosure
					</div>
					<DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
						Risk Warning on Derivatives (F&O) Trading
					</DialogTitle>
					<DialogDescription className="text-xs text-rose-100 font-medium">
						Prescribed under SEBI Circular SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2023/71
					</DialogDescription>
				</div>

				<div className="p-6 space-y-4 bg-background">
					{/* Key Statistics Cards */}
					<div className="space-y-3">
						<div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 flex items-start gap-3">
							<div className="p-2 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 font-black text-base shrink-0">
								9 / 10
							</div>
							<div>
								<h4 className="text-xs font-bold text-rose-950 dark:text-rose-200">
									9 out of 10 Individual Traders Incur Net Losses
								</h4>
								<p className="text-[11px] text-rose-900/80 dark:text-rose-300/80 mt-0.5 leading-relaxed">
									93% of individual traders in the Equity Futures and Options (F&O) segment incurred net losses over the analyzed periods.
								</p>
							</div>
						</div>

						<div className="p-3.5 rounded-xl border border-border bg-card flex items-start gap-3">
							<div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-base shrink-0">
								₹50k
							</div>
							<div>
								<h4 className="text-xs font-bold text-foreground">
									Average Net Trading Loss of ~₹50,000
								</h4>
								<p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
									On average, individual loss-makers registered a net trading loss close to ₹50,000 per person.
								</p>
							</div>
						</div>

						<div className="p-3.5 rounded-xl border border-border bg-card flex items-start gap-3">
							<div className="p-2 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black text-base shrink-0">
								+28%
							</div>
							<div>
								<h4 className="text-xs font-bold text-foreground">
									Substantial Additional Friction Costs
								</h4>
								<p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
									Over and above net trading losses, loss-makers incurred an additional 28% of their losses as transaction costs (brokerage, STT, exchange turnover fees).
								</p>
							</div>
						</div>
					</div>

					<p className="text-[11px] text-muted-foreground leading-relaxed italic border-t border-border pt-3">
						Source: Official SEBI study dated January 25, 2023 on "Analysis of Profit and Loss of Individual Traders dealing in equity Futures and Options (F&O) Segment".
					</p>
				</div>

				<DialogFooter className="p-4 bg-muted/40 border-t border-border flex flex-col sm:flex-row gap-2">
					<Button
						onClick={handleAcknowledge}
						className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm py-2.5 shadow-md gap-2"
					>
						<CheckCircle2 className="h-4 w-4" />
						I Understand & Acknowledge SEBI Risk Warning
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function SebiFnoRiskBanner() {
	return (
		<div className="p-3.5 rounded-xl border-2 border-rose-300 dark:border-rose-900 bg-rose-50/90 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs shadow-xs space-y-1.5">
			<div className="flex items-center gap-2 font-bold text-rose-950 dark:text-rose-100">
				<AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
				<span>SEBI Mandatory Regulatory Risk Disclosure on Derivatives (F&O)</span>
			</div>
			<p className="text-[11px] text-rose-900/90 dark:text-rose-300/90 leading-relaxed pl-6">
				<strong>9 out of 10</strong> individual traders in equity Futures and Options incurred net losses (average loss ~₹50,000), plus an additional <strong>28%</strong> in transaction fees. Trading in derivatives involves substantial risk of loss and is not suitable for all investors.
			</p>
		</div>
	);
}
