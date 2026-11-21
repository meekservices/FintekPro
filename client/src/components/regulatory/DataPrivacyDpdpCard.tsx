import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
	Download,
	ShieldCheck,
	FileText,
	AlertTriangle,
	ExternalLink,
	Lock,
	CheckCircle2,
	RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export function DataPrivacyDpdpCard() {
	const { toast } = useToast();
	const [isExporting, setIsExporting] = useState(false);
	const [isErasureDialogOpen, setIsErasureDialogOpen] = useState(false);
	const [erasureReason, setErasureReason] = useState("");
	const [isSubmittingErasure, setIsSubmittingErasure] = useState(false);

	const handleExportData = async () => {
		setIsExporting(true);
		try {
			const res = await fetch("/api/privacy/export-my-data");
			if (!res.ok) {
				throw new Error("Failed to export data");
			}
			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `fintekpro-personal-data-export.json`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			toast({
				title: "Data Export Generated",
				description:
					"Your personal data package has been downloaded in compliance with DPDP Act 2023.",
			});
		} catch (error) {
			toast({
				title: "Export Failed",
				description:
					"Could not generate personal data export. Please ensure you are logged in.",
				variant: "destructive",
			});
		} finally {
			setIsExporting(false);
		}
	};

	const handleRequestErasure = async () => {
		if (!erasureReason.trim()) {
			toast({
				title: "Reason Required",
				description: "Please specify a brief reason for requesting data erasure.",
				variant: "destructive",
			});
			return;
		}

		setIsSubmittingErasure(true);
		try {
			const res = await fetch("/api/privacy/request-erasure", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason: erasureReason }),
			});
			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error || "Failed to submit request");
			}

			toast({
				title: "Erasure Request Registered",
				description:
					"Non-statutory processing revoked. Statutory financial and KYC records will be held under mandatory 7-year SEBI/PMLA retention.",
			});
			setIsErasureDialogOpen(false);
			setErasureReason("");
		} catch (error: any) {
			toast({
				title: "Request Error",
				description: error.message || "Could not register erasure request.",
				variant: "destructive",
			});
		} finally {
			setIsSubmittingErasure(false);
		}
	};

	return (
		<Card className="border-border">
			<CardHeader>
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<div className="p-2 rounded-lg bg-primary/10 text-primary">
							<ShieldCheck className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-base sm:text-lg flex items-center gap-2">
								Data Privacy & DPDP Act Rights
								<Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
									DPDP Act 2023
								</Badge>
							</CardTitle>
							<CardDescription className="text-xs">
								Exercise your statutory Data Principal rights, download your data, and view governance disclosures
							</CardDescription>
						</div>
					</div>
					<Link href="/ai-governance">
						<Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
							<FileText className="h-3.5 w-3.5" />
							AI Governance Policy
							<ExternalLink className="h-3 w-3 opacity-60" />
						</Button>
					</Link>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Right to Access / Export */}
				<div className="p-4 rounded-xl border border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<FileText className="h-4 w-4 text-primary" />
							<h4 className="text-sm font-semibold">Right to Access Information (Section 11)</h4>
						</div>
						<p className="text-xs text-muted-foreground leading-relaxed">
							Download a machine-readable summary of your personal identity, bank accounts, demat registrations, and active consent records.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleExportData}
						disabled={isExporting}
						className="shrink-0 gap-2 h-9"
					>
						{isExporting ? (
							<>
								<RefreshCw className="h-4 w-4 animate-spin" />
								Exporting...
							</>
						) : (
							<>
								<Download className="h-4 w-4" />
								Export My Data (JSON)
							</>
						)}
					</Button>
				</div>

				{/* Statutory Retention Notice */}
				<div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20 text-amber-950 dark:text-amber-200 space-y-1.5">
					<div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-100">
						<Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
						<span>Statutory Retention Notice (SEBI & PMLA Mandatory 7-Year Period)</span>
					</div>
					<p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 leading-relaxed pl-5">
						Under Section 12(3) of DPDP Act 2023, data erasure is subject to compliance with applicable laws. In accordance with the <strong>SEBI Master Circular for Intermediaries</strong> and <strong>PMLA 2002 Rule 3</strong>, regulated financial transaction records, order logs, and KYC verification artifacts must be preserved for a mandatory period of 7 years in encrypted tamper-evident storage.
					</p>
				</div>

				{/* Right to Erasure / Request Account Purge */}
				<div className="p-4 rounded-xl border border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-semibold">Right to Erasure & Revocation (Section 12)</h4>
						</div>
						<p className="text-xs text-muted-foreground leading-relaxed">
							Revoke consent for non-statutory processing (marketing, personalized recommendations). Statutory financial records remain in encrypted retention hold.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsErasureDialogOpen(true)}
						className="shrink-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 h-9"
					>
						Request Data Erasure
					</Button>
				</div>

				{/* DPO Contact footer */}
				<div className="text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border pt-3">
					<span>Data Fiduciary: <strong>FintekPro Wealth Systems</strong> (SEBI Reg. Intermediary)</span>
					<span>Data Protection Officer: <a href="mailto:privacy@fintekpro.com" className="text-primary hover:underline">privacy@fintekpro.com</a></span>
				</div>
			</CardContent>

			{/* Erasure Confirmation Dialog */}
			<Dialog open={isErasureDialogOpen} onOpenChange={setIsErasureDialogOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-rose-600">
							<AlertTriangle className="h-5 w-5" />
							Confirm DPDP Data Erasure Request
						</DialogTitle>
						<DialogDescription className="text-xs leading-relaxed pt-2">
							This will revoke all active marketing and personalization consents. Regulated trading, capital gains, and KYC records will be archived under statutory 7-year legal hold as mandated by SEBI.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 py-2">
						<label htmlFor="erasure-reason-input" className="text-xs font-semibold text-foreground">
							Please state the reason for requesting erasure:
						</label>
						<Textarea
							id="erasure-reason-input"
							value={erasureReason}
							onChange={(e) => setErasureReason(e.target.value)}
							placeholder="e.g. Closing investment accounts, moving overseas..."
							className="text-xs min-h-[80px]"
						/>
					</div>

					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsErasureDialogOpen(false)}
							disabled={isSubmittingErasure}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={handleRequestErasure}
							disabled={isSubmittingErasure}
							className="gap-2"
						>
							{isSubmittingErasure ? (
								<>
									<RefreshCw className="h-3.5 w-3.5 animate-spin" />
									Submitting...
								</>
							) : (
								<>
									<CheckCircle2 className="h-3.5 w-3.5" />
									Submit Erasure Request
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
