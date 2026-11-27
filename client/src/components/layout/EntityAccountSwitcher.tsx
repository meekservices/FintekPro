import { useState, } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Building2,
	ChevronDown,
	CheckCircle2,
	ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DematAccount {
	id: string;
	dematDpName: string;
	dematAccountNumber: string;
	depositoryType: string;
	isVerified: boolean;
	accountHolderName?: string;
}

export function EntityAccountSwitcher() {
	const [activeDematId, setActiveDematId] = useState<string>(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("fintekpro_active_demat_id") || "";
		}
		return "";
	});

	const { data: dematAccounts, isLoading } = useQuery<DematAccount[]>({
		queryKey: ["/api/demat-accounts"],
		staleTime: 1000 * 60 * 5,
	});

	const activeAccount =
		dematAccounts?.find((acc) => acc.id === activeDematId) ||
		dematAccounts?.[0] ||
		null;

	const handleSelectAccount = (acc: DematAccount) => {
		setActiveDematId(acc.id);
		if (typeof window !== "undefined") {
			localStorage.setItem("fintekpro_active_demat_id", acc.id);
			window.dispatchEvent(
				new CustomEvent("fintekpro_active_demat_changed", {
					detail: { account: acc },
				}),
			);
		}
	};

	if (isLoading || !dematAccounts || dematAccounts.length === 0) {
		return null;
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card/60 hover:bg-muted text-xs font-medium text-foreground transition-all shadow-2xs hover:border-primary/40 focus:outline-none"
					title="Active Demat / Trading Entity"
					data-testid="header-entity-account-switcher"
				>
					<div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
					<Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
					<div className="flex flex-col text-left leading-tight">
						<span className="font-semibold truncate max-w-[110px] text-[11px]">
							{activeAccount?.dematDpName || "Primary Demat"}
						</span>
						<span className="text-[9px] text-muted-foreground font-mono truncate max-w-[110px]">
							{activeAccount?.dematAccountNumber
								? `ID: ••••${activeAccount.dematAccountNumber.slice(-4)}`
								: "Account Linked"}
						</span>
					</div>
					<Badge
						variant="outline"
						className="text-[9px] px-1 py-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider"
					>
						{activeAccount?.depositoryType || "CDSL"}
					</Badge>
					<ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
				</button>
			</PopoverTrigger>

			<PopoverContent
				align="end"
				className="w-80 p-0 shadow-xl border-border bg-popover"
			>
				<div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between">
					<div>
						<h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
							Demat & Trading Entity
						</h4>
						<p className="text-[10px] text-muted-foreground mt-0.5">
							Switch active depository account for order routing
						</p>
					</div>
					<ShieldCheck className="h-4 w-4 text-emerald-600" />
				</div>

				<div className="p-2 space-y-1 max-h-60 overflow-y-auto">
					{dematAccounts.map((acc) => {
						const isSelected = activeAccount?.id === acc.id;
						return (
							<button
								key={acc.id}
								type="button"
								onClick={() => handleSelectAccount(acc)}
								className={cn(
									"w-full text-left p-2.5 rounded-md text-xs flex items-center justify-between transition-colors",
									isSelected
										? "bg-primary/10 border border-primary/30 text-primary font-semibold"
										: "hover:bg-muted text-foreground border border-transparent",
								)}
							>
								<div className="flex items-start gap-2.5 min-w-0">
									<div
										className={cn(
											"p-1.5 rounded-md shrink-0 mt-0.5",
											isSelected
												? "bg-primary text-primary-foreground"
												: "bg-muted text-muted-foreground",
										)}
									>
										<Building2 className="h-3.5 w-3.5" />
									</div>
									<div className="min-w-0">
										<p className="font-semibold text-xs truncate">
											{acc.dematDpName}
										</p>
										<p className="text-[10px] font-mono text-muted-foreground">
											A/C: {acc.dematAccountNumber}
										</p>
										{acc.accountHolderName && (
											<p className="text-[10px] text-muted-foreground truncate">
												Holder: {acc.accountHolderName}
											</p>
										)}
									</div>
								</div>

								<div className="flex flex-col items-end gap-1 shrink-0">
									<Badge
										variant="outline"
										className="text-[9px] uppercase font-bold"
									>
										{acc.depositoryType || "CDSL"}
									</Badge>
									{isSelected && (
										<span className="text-[10px] text-emerald-600 flex items-center gap-0.5 font-bold">
											<CheckCircle2 className="h-3 w-3" /> Active
										</span>
									)}
								</div>
							</button>
						);
					})}
				</div>

				<div className="p-2 border-t border-border bg-muted/20 text-center">
					<span className="text-[10px] text-muted-foreground">
						SEBI Regulation 2024 Compliant Account Verification
					</span>
				</div>
			</PopoverContent>
		</Popover>
	);
}
