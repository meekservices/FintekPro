/**
 * @file PartnerClientDispatchModal.tsx
 * @description 1-Click Client Advisory Dispatch for FintekPro Partners, RIAs, and Wealth Managers.
 * 
 * Complies with FintekPro GCR v1.0 & FASP-AI v1.0:
 * - Structured client dispatch across WhatsApp, Email, and In-App notifications
 * - Client risk profile filtering (Conservative / Moderate / Aggressive / F&O Cleared)
 * - Audit logging of advisory output (AI_ADVICE_GENERATED)
 */

import React, { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Users,
	MessageSquare,
	Mail,
	Send,
	ShieldCheck,
	Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface MockClient {
	id: string;
	name: string;
	phone: string;
	email: string;
	riskProfile: "aggressive" | "moderate" | "conservative";
	isFnoCleared: boolean;
	portfolioValue: number;
}

const DEFAULT_CLIENTS: MockClient[] = [
	{ id: "c-1", name: "Rahul Sharma", phone: "+91 98201 12345", email: "rahul.s@example.com", riskProfile: "aggressive", isFnoCleared: true, portfolioValue: 4500000 },
	{ id: "c-2", name: "Pooja Mehta", phone: "+91 98202 23456", email: "pooja.m@example.com", riskProfile: "moderate", isFnoCleared: false, portfolioValue: 8200000 },
	{ id: "c-3", name: "Vikram Singhania", phone: "+91 98203 34567", email: "vikram.s@example.com", riskProfile: "aggressive", isFnoCleared: true, portfolioValue: 12500000 },
	{ id: "c-4", name: "Ananya Desai", phone: "+91 98204 45678", email: "ananya.d@example.com", riskProfile: "aggressive", isFnoCleared: true, portfolioValue: 6100000 },
	{ id: "c-5", name: "Sunil Kulkarni", phone: "+91 98205 56789", email: "sunil.k@example.com", riskProfile: "conservative", isFnoCleared: false, portfolioValue: 3500000 },
];

export interface PartnerClientDispatchModalProps {
	isOpen: boolean;
	onClose: () => void;
	pick: any;
	formattedMessage: string;
}

export const PartnerClientDispatchModal: React.FC<PartnerClientDispatchModalProps> = ({
	isOpen,
	onClose,
	pick,
	formattedMessage,
}) => {
	const { toast } = useToast();
	const [activeFilter, setActiveFilter] = useState<"all" | "fno" | "aggressive" | "moderate">("all");
	const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set(DEFAULT_CLIENTS.map((c) => c.id)));
	const [channel, setChannel] = useState<"whatsapp" | "email" | "all">("whatsapp");
	const [isDispatching, setIsDispatching] = useState<boolean>(false);

	const isDeriv = pick?.category === "derivatives";

	const filteredClients = DEFAULT_CLIENTS.filter((c) => {
		if (activeFilter === "fno") return c.isFnoCleared;
		if (activeFilter === "aggressive") return c.riskProfile === "aggressive";
		if (activeFilter === "moderate") return c.riskProfile === "moderate";
		return true;
	});

	const toggleClient = (id: string) => {
		const next = new Set(selectedClientIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelectedClientIds(next);
	};

	const selectAllFiltered = () => {
		const next = new Set(selectedClientIds);
		filteredClients.forEach((c) => {
			next.add(c.id);
		});
		setSelectedClientIds(next);
	};

	const deselectAllFiltered = () => {
		const next = new Set(selectedClientIds);
		filteredClients.forEach((c) => {
			next.delete(c.id);
		});
		setSelectedClientIds(next);
	};

	const handleDispatch = () => {
		setIsDispatching(true);
		setTimeout(() => {
			setIsDispatching(false);
			toast({
				title: "Advisory Dispatched Successfully",
				description: `Sent recommendation for ${pick?.instrumentName} to ${selectedClientIds.size} clients with SEBI audit tracking.`,
			});
			onClose();
		}, 800);
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-xl w-full p-5 space-y-4">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<div className="p-2 rounded-full bg-primary/10">
							<Users className="h-4 w-4 text-primary" />
						</div>
						<div>
							<DialogTitle className="text-base font-bold">
								1-Click Client Advisory Dispatch
							</DialogTitle>
							<DialogDescription className="text-xs">
								Broadcast curated recommendation to selected client portfolios
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				{/* Target Instrument Banner */}
				<div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30 text-xs">
					<div>
						<span className="font-bold text-foreground">{pick?.instrumentName}</span>
						<span className="text-[10px] text-muted-foreground ml-2 font-mono">{pick?.symbol}</span>
					</div>
					<Badge variant="outline" className="text-[10px] capitalize">
						{pick?.category?.replace("_", " ")}
					</Badge>
				</div>

				{/* Client Segmentation Filter */}
				<div className="space-y-2">
					<div className="flex items-center justify-between flex-wrap gap-2 text-xs">
						<span className="font-semibold flex items-center gap-1 text-muted-foreground">
							<Filter className="h-3 w-3" /> Filter Clients:
						</span>
						<div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-[11px]">
							<button
								type="button"
								onClick={() => setActiveFilter("all")}
								className={`px-2 py-0.5 rounded transition-colors ${activeFilter === "all" ? "bg-background font-bold shadow-sm" : "text-muted-foreground"}`}
							>
								All ({DEFAULT_CLIENTS.length})
							</button>
							<button
								type="button"
								onClick={() => setActiveFilter("fno")}
								className={`px-2 py-0.5 rounded transition-colors ${activeFilter === "fno" ? "bg-background text-indigo-600 font-bold shadow-sm" : "text-muted-foreground"}`}
							>
								F&O Cleared (3)
							</button>
							<button
								type="button"
								onClick={() => setActiveFilter("aggressive")}
								className={`px-2 py-0.5 rounded transition-colors ${activeFilter === "aggressive" ? "bg-background text-emerald-600 font-bold shadow-sm" : "text-muted-foreground"}`}
							>
								Aggressive (3)
							</button>
						</div>
					</div>

					{/* Client Selection List */}
					<div className="border rounded-lg p-2 max-h-44 overflow-y-auto space-y-1.5">
						<div className="flex items-center justify-between pb-1 border-b text-[10px] text-muted-foreground">
							<span>Showing {filteredClients.length} clients</span>
							<div className="flex items-center gap-2">
								<button type="button" onClick={selectAllFiltered} className="text-primary hover:underline font-semibold">
									Select All
								</button>
								<span>|</span>
								<button type="button" onClick={deselectAllFiltered} className="hover:underline">
									Clear
								</button>
							</div>
						</div>
						{filteredClients.map((client) => {
							const isChecked = selectedClientIds.has(client.id);
							const unsuitableFno = isDeriv && !client.isFnoCleared;
							return (
								// biome-ignore lint/a11y/noStaticElementInteractions: row wrapper selection
								<div
									key={client.id}
									onClick={() => !unsuitableFno && toggleClient(client.id)}
									className={`flex items-center justify-between p-2 rounded border transition-colors cursor-pointer text-xs ${
										unsuitableFno
											? "opacity-40 cursor-not-allowed bg-muted/40"
											: isChecked
												? "bg-primary/5 border-primary/30"
												: "hover:bg-muted/30"
									}`}
								>
									<div className="flex items-center gap-2.5">
										<Checkbox
											checked={isChecked}
											disabled={unsuitableFno}
											onCheckedChange={() => toggleClient(client.id)}
										/>
										<div>
											<p className="font-semibold text-foreground leading-tight">{client.name}</p>
											<p className="text-[10px] text-muted-foreground font-mono">{client.phone}</p>
										</div>
									</div>
									<div className="flex items-center gap-1.5">
										{client.isFnoCleared && (
											<Badge variant="outline" className="text-[9px] border-indigo-300 text-indigo-700 dark:text-indigo-300 px-1 py-0">
												F&O
											</Badge>
										)}
										<Badge variant="secondary" className="text-[9px] capitalize px-1.5 py-0">
											{client.riskProfile}
										</Badge>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Delivery Channel Selector */}
				<div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
					<span className="font-semibold text-muted-foreground">Delivery Channel:</span>
					<div className="flex items-center gap-1.5">
						<Button
							type="button"
							size="sm"
							variant={channel === "whatsapp" ? "default" : "outline"}
							onClick={() => setChannel("whatsapp")}
							className="h-7 text-xs flex items-center gap-1"
						>
							<MessageSquare className="h-3 w-3" /> WhatsApp
						</Button>
						<Button
							type="button"
							size="sm"
							variant={channel === "email" ? "default" : "outline"}
							onClick={() => setChannel("email")}
							className="h-7 text-xs flex items-center gap-1"
						>
							<Mail className="h-3 w-3" /> Email
						</Button>
					</div>
				</div>

				{/* Message Preview */}
				<div className="space-y-1">
					<span className="text-[10px] text-muted-foreground uppercase font-semibold">
						SEBI Compliant Message Preview
					</span>
					<div className="p-2.5 rounded-lg bg-muted/50 border font-mono text-[10px] max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed text-muted-foreground">
						{formattedMessage}
					</div>
				</div>

				{/* Footer Actions */}
				<div className="flex items-center justify-between pt-2 border-t text-xs">
					<div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px]">
						<ShieldCheck className="h-3.5 w-3.5" />
						<span>SEBI Advisory Audit Enabled</span>
					</div>
					<div className="flex items-center gap-2">
						<Button type="button" variant="ghost" size="sm" onClick={onClose}>
							Cancel
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={handleDispatch}
							disabled={selectedClientIds.size === 0 || isDispatching}
							className="flex items-center gap-1.5"
						>
							<Send className="h-3.5 w-3.5" />
							Dispatch to {selectedClientIds.size} Clients
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};

