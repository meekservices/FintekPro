import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	ShieldCheck,
	ShieldAlert,
	CheckCircle2,
	Circle,
	ArrowRight,
	Info,
} from "lucide-react";
import { KycCheckResult } from "@/hooks/use-kyc-guard";
import { cn } from "@/lib/utils";

interface KycGuardModalProps {
	open: boolean;
	checkResult: KycCheckResult | null;
	onClose: () => void;
	onProceedToKyc: () => void;
}

export function KycGuardModal({
	open,
	checkResult,
	onClose,
	onProceedToKyc,
}: KycGuardModalProps) {
	if (!checkResult) return null;

	const {
		productLabel,
		allRequiredSteps,
		missingSteps,
		sebiRef,
		currentLevel,
		requiredLevel,
	} = checkResult;

	const completedSteps = allRequiredSteps.filter(
		(s) => !missingSteps.includes(s),
	);
	const progressPct = allRequiredSteps.length
		? Math.round((completedSteps.length / allRequiredSteps.length) * 100)
		: 0;

	const levelLabel = requiredLevel === 1 ? "PAN Verified" : "Full KYC";

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="flex items-center gap-3 mb-1">
						<div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
							<ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
						</div>
						<div>
							<DialogTitle className="text-base">
								KYC Verification Required
							</DialogTitle>
							<DialogDescription className="text-xs mt-0.5">
								To transact in{" "}
								<span className="font-semibold text-foreground">
									{productLabel}
								</span>
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				{/* Progress */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>Verification progress</span>
						<span className="font-medium text-foreground">{progressPct}%</span>
					</div>
					<Progress value={progressPct} className="h-1.5" />
				</div>

				{/* Steps */}
				<div className="space-y-1.5">
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Required for {levelLabel}
					</p>
					{allRequiredSteps.map((step) => {
						const done = !missingSteps.includes(step);
						return (
							<div
								key={step}
								className={cn(
									"flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
									done
										? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
										: "bg-muted/60 text-foreground",
								)}
							>
								{done ? (
									<CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
								) : (
									<Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
								)}
								<span className={done ? "line-through opacity-70" : ""}>
									{step}
								</span>
								{!done && (
									<Badge variant="secondary" className="ml-auto text-[10px]">
										Pending
									</Badge>
								)}
							</div>
						);
					})}
				</div>

				{/* Regulatory note */}
				{sebiRef && (
					<div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
						<Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
						<span>
							Mandated under <span className="font-medium">{sebiRef}</span>. We
							only collect the minimum information required by Indian
							regulations.
						</span>
					</div>
				)}

				{/* Actions */}
				<div className="flex flex-col gap-2 pt-1">
					<Button onClick={onProceedToKyc} className="w-full gap-2">
						<ShieldCheck className="h-4 w-4" />
						Complete{" "}
						{missingSteps.length === 1 ? missingSteps[0] : "Verification"}
						<ArrowRight className="h-4 w-4 ml-auto" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={onClose}
						className="w-full text-muted-foreground"
					>
						Continue Browsing
					</Button>
				</div>

				<p className="text-center text-[10px] text-muted-foreground">
					Your data is encrypted and stored securely per DPDP Act 2023.
				</p>
			</DialogContent>
		</Dialog>
	);
}
