import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
	RefreshCw,
	Plus,
	ArrowRightLeft,
	Loader2,
	Info,
	Trash2,
} from "lucide-react";

type SipSource = "rebalancing" | "fresh" | "hybrid";

interface SipRecommendation {
	instrumentType: string;
	instrumentIsin?: string;
	instrumentName: string;
	sipAmount: number;
	sipFrequency: string;
	sipDurationMonths?: number;
	sipSource: SipSource;
	sourceRationale: string;
	convertedFromLumpsum?: boolean;
	originalLumpsumAmount?: number;
}

interface SipSummary {
	proposalId: string;
	totalMonthlyAmount: number;
	rebalancingSipCount: number;
	rebalancingSipAmount: number;
	freshSipCount: number;
	freshSipAmount: number;
	hybridSipCount: number;
	hybridSipAmount: number;
	recommendations: SipRecommendation[];
}

interface SipAttributionProps {
	proposalId: string;
}

const SOURCE_CONFIG: Record<
	SipSource,
	{ label: string; color: string; description: string }
> = {
	rebalancing: {
		label: "Rebalancing",
		color:
			"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
		description: "SIP from existing holdings optimization",
	},
	fresh: {
		label: "Fresh Investment",
		color:
			"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
		description: "SIP from new investment amount",
	},
	hybrid: {
		label: "Hybrid",
		color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
		description: "Combination of rebalancing and fresh investment",
	},
};

export function SipAttribution({ proposalId }: SipAttributionProps) {
	const { toast } = useToast();
	const [showConvertDialog, setShowConvertDialog] = useState(false);
	const [selectedInstrument, setSelectedInstrument] = useState<string | null>(
		null,
	);
	const [lumpsumAmount, setLumpsumAmount] = useState("");
	const [sipDuration, setSipDuration] = useState("12");

	const { data: summary, isLoading } = useQuery<SipSummary>({
		queryKey: ["/api/proposal-builder/sips", proposalId, "summary"],
		queryFn: async () => {
			const response = await fetch(
				`/api/proposal-builder/sips/${proposalId}/summary`,
			);
			if (!response.ok) throw new Error("Failed to fetch SIP summary");
			return response.json();
		},
		enabled: !!proposalId,
	});

	const convertLumpsum = useMutation({
		mutationFn: async () => {
			return apiRequest(
				`/api/proposal-builder/sips/${proposalId}/convert-lumpsum`,
				{
					method: "POST",
					body: JSON.stringify({
						instrumentName: selectedInstrument,
						lumpsumAmount: Number.parseFloat(lumpsumAmount),
						sipDurationMonths: Number.parseInt(sipDuration),
					}),
				},
			);
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/proposal-builder/sips", proposalId],
			});
			setShowConvertDialog(false);
			setLumpsumAmount("");
			toast({
				title: "Conversion Complete",
				description: `Lumpsum converted to ₹${data.sipAmount?.toLocaleString()}/month SIP`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Conversion Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const deleteSip = useMutation({
		mutationFn: async (instrumentName: string) => {
			return apiRequest(
				`/api/proposal-builder/sips/${proposalId}/${encodeURIComponent(instrumentName)}`,
				{
					method: "DELETE",
				},
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/proposal-builder/sips", proposalId],
			});
			toast({
				title: "SIP Removed",
				description: "SIP recommendation has been removed",
			});
		},
	});

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(value);
	};

	const handleConvertClick = (instrumentName: string) => {
		setSelectedInstrument(instrumentName);
		setShowConvertDialog(true);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<RefreshCw className="h-5 w-5" />
					SIP Recommendations
				</CardTitle>
				<CardDescription>
					View SIP recommendations with source attribution
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{summary && (
					<>
						<div className="grid grid-cols-4 gap-4">
							<div className="text-center p-3 bg-muted rounded-lg">
								<div className="text-2xl font-bold">
									{formatCurrency(summary.totalMonthlyAmount)}
								</div>
								<div className="text-xs text-muted-foreground">
									Total Monthly
								</div>
							</div>
							<div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
								<div className="text-lg font-bold text-purple-600">
									{summary.rebalancingSipCount}
								</div>
								<div className="text-xs text-muted-foreground">Rebalancing</div>
								<div className="text-sm">
									{formatCurrency(summary.rebalancingSipAmount)}
								</div>
							</div>
							<div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
								<div className="text-lg font-bold text-green-600">
									{summary.freshSipCount}
								</div>
								<div className="text-xs text-muted-foreground">Fresh</div>
								<div className="text-sm">
									{formatCurrency(summary.freshSipAmount)}
								</div>
							</div>
							<div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
								<div className="text-lg font-bold text-blue-600">
									{summary.hybridSipCount}
								</div>
								<div className="text-xs text-muted-foreground">Hybrid</div>
								<div className="text-sm">
									{formatCurrency(summary.hybridSipAmount)}
								</div>
							</div>
						</div>

						{summary.recommendations.length > 0 && (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Instrument</TableHead>
										<TableHead className="text-center">Source</TableHead>
										<TableHead className="text-right">SIP Amount</TableHead>
										<TableHead className="text-center">Frequency</TableHead>
										<TableHead className="text-center">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{summary.recommendations.map((sip) => {
										const config = SOURCE_CONFIG[sip.sipSource];
										return (
											<TableRow key={sip.instrumentName}>
												<TableCell>
													<div>
														<div className="font-medium">
															{sip.instrumentName}
														</div>
														{sip.convertedFromLumpsum && (
															<div className="text-xs text-muted-foreground">
																Converted from{" "}
																{formatCurrency(sip.originalLumpsumAmount || 0)}{" "}
																lumpsum
															</div>
														)}
													</div>
												</TableCell>
												<TableCell className="text-center">
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger>
																<Badge className={config.color}>
																	{config.label}
																</Badge>
															</TooltipTrigger>
															<TooltipContent>
																<p className="max-w-xs">
																	{sip.sourceRationale || config.description}
																</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</TableCell>
												<TableCell className="text-right font-mono">
													{formatCurrency(sip.sipAmount)}
												</TableCell>
												<TableCell className="text-center capitalize">
													{sip.sipFrequency}
												</TableCell>
												<TableCell className="text-center">
													<div className="flex items-center justify-center gap-2">
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button
																		variant="ghost"
																		size="icon"
																		onClick={() =>
																			handleConvertClick(sip.instrumentName)
																		}
																	>
																		<ArrowRightLeft className="h-4 w-4" />
																	</Button>
																</TooltipTrigger>
																<TooltipContent>
																	Convert Lumpsum to SIP
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
														<Button
															variant="ghost"
															size="icon"
															onClick={() =>
																deleteSip.mutate(sip.instrumentName)
															}
														>
															<Trash2 className="h-4 w-4 text-destructive" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}

						{summary.recommendations.length === 0 && (
							<div className="text-center py-8 text-muted-foreground">
								No SIP recommendations yet. Generate recommendations first.
							</div>
						)}
					</>
				)}

				<Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Convert Lumpsum to SIP</DialogTitle>
							<DialogDescription>
								Convert a lumpsum investment into a systematic investment plan
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="font-medium">{selectedInstrument}</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">
									Lumpsum Amount (₹)
								</label>
								<Input
									type="number"
									value={lumpsumAmount}
									onChange={(e) => setLumpsumAmount(e.target.value)}
									placeholder="Enter lumpsum amount"
								/>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">
									SIP Duration (months)
								</label>
								<Input
									type="number"
									value={sipDuration}
									onChange={(e) => setSipDuration(e.target.value)}
									min="1"
									max="60"
								/>
							</div>

							{lumpsumAmount && sipDuration && (
								<div className="p-3 bg-muted rounded-lg">
									<div className="text-sm text-muted-foreground">
										Monthly SIP Amount:
									</div>
									<div className="text-xl font-bold">
										{formatCurrency(
											Number.parseFloat(lumpsumAmount) /
												Number.parseInt(sipDuration),
										)}
									</div>
								</div>
							)}
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setShowConvertDialog(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={() => convertLumpsum.mutate()}
								disabled={convertLumpsum.isPending || !lumpsumAmount}
							>
								{convertLumpsum.isPending && (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								)}
								Convert to SIP
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
}
