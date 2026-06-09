import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FeeBreakdown } from "@/hooks/use-fee-breakdown";

interface CalculatedFee {
	feeCode: string;
	feeName: string;
	category: string;
	chargeType: string;
	baseAmount: number;
	gstAmount: number;
	waiverAmount: number;
	netAmount: number;
	rateApplied: string;
	isWaived: boolean;
	sourceProductType?: string;
}

interface FeeBreakdownCardProps {
	feeBreakdown?: FeeBreakdown;
	isLoading?: boolean;
	showDetails?: boolean;
	compact?: boolean;
}

// Product type display labels
const productTypeLabels: Record<string, string> = {
	equity: "Equity",
	mutual_fund: "Mutual Funds",
	bond: "Bonds",
	unlisted: "Unlisted",
	ipo: "IPO",
	pms: "PMS",
	aif: "AIF",
	derivatives: "Derivatives",
	loan: "Loans",
	tax_services: "Tax Services",
	advisory: "Advisory",
	all: "All Products",
	mixed: "Mixed",
};

export function FeeBreakdownCard({
	feeBreakdown,
	isLoading = false,
	showDetails = true,
	compact = false,
}: FeeBreakdownCardProps) {
	const [isOpen, setIsOpen] = useState(false);

	if (isLoading) {
		return (
			<div
				className="animate-pulse space-y-2"
				data-testid="fee-breakdown-loading"
			>
				<div className="h-4 bg-muted rounded w-3/4" />
				<div className="h-4 bg-muted rounded w-1/2" />
			</div>
		);
	}

	if (!feeBreakdown) {
		return null;
	}

	const { summary, fees, metadata } = feeBreakdown;

	if (summary.grandTotal === 0) {
		return null;
	}

	const isMixedBasket = metadata?.productType === "mixed";

	const categoryLabels: Record<string, string> = {
		regulatory: "Regulatory",
		platform: "Platform",
		advisory: "Advisory",
		document: "Document",
		convenience: "Convenience",
		value_added: "Value Added",
	};

	const categoryGroups = fees.reduce(
		(acc, fee) => {
			const category = fee.category || "platform";
			if (!acc[category]) {
				acc[category] = [];
			}
			acc[category].push(fee as CalculatedFee);
			return acc;
		},
		{} as Record<string, CalculatedFee[]>,
	);

	if (compact) {
		return (
			<div className="text-sm space-y-1" data-testid="fee-breakdown-compact">
				<div className="flex justify-between text-muted-foreground">
					<span>Fees & Charges</span>
					<span>₹{summary.subtotal.toFixed(2)}</span>
				</div>
				{summary.totalGst > 0 && (
					<div className="flex justify-between text-muted-foreground">
						<span>GST (18%)</span>
						<span>₹{summary.totalGst.toFixed(2)}</span>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="space-y-2" data-testid="fee-breakdown-card">
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<CollapsibleTrigger
					className="flex items-center justify-between w-full text-sm hover:bg-muted p-2 rounded transition-colors"
					data-testid="button-toggle-fee-details"
				>
					<div className="flex items-center gap-2">
						<span className="font-medium">Fees & Charges</span>
						<Badge variant="secondary" className="text-xs">
							{fees.length} items
						</Badge>
						{isMixedBasket && (
							<Badge variant="outline" className="text-xs">
								Mixed Basket
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-2">
						<span className="font-semibold">
							₹{summary.grandTotal.toFixed(2)}
						</span>
						{isOpen ? (
							<ChevronUp className="h-4 w-4" />
						) : (
							<ChevronDown className="h-4 w-4" />
						)}
					</div>
				</CollapsibleTrigger>

				<CollapsibleContent className="space-y-3 pt-2">
					{Object.entries(categoryGroups).map(([category, categoryFees]) => {
						const categoryTotal = categoryFees.reduce(
							(sum, f) => sum + f.netAmount,
							0,
						);
						if (categoryTotal === 0) return null;

						return (
							<div key={category} className="space-y-1">
								<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									{categoryLabels[category] || category}
								</div>
								{categoryFees.map(
									(fee) =>
										fee.netAmount > 0 && (
											<div
												key={fee.feeCode}
												className="flex justify-between text-sm pl-2"
											>
												<div className="flex items-center gap-1 flex-wrap">
													<span>{fee.feeName}</span>
													{/* Show product type badge for category-specific fees in mixed baskets */}
													{isMixedBasket &&
														fee.sourceProductType &&
														fee.sourceProductType !== "all" && (
															<Badge
																variant="outline"
																className="text-xs px-1 py-0"
															>
																{productTypeLabels[fee.sourceProductType] ||
																	fee.sourceProductType}
															</Badge>
														)}
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger>
																<Info className="h-3 w-3 text-muted-foreground" />
															</TooltipTrigger>
															<TooltipContent>
																<p>Rate: {fee.rateApplied}</p>
																{fee.gstAmount > 0 && (
																	<p>
																		Includes GST: ₹{fee.gstAmount.toFixed(2)}
																	</p>
																)}
																{fee.sourceProductType &&
																	fee.sourceProductType !== "all" && (
																		<p>
																			Applies to:{" "}
																			{productTypeLabels[
																				fee.sourceProductType
																			] || fee.sourceProductType}
																		</p>
																	)}
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
													{fee.isWaived && (
														<Badge
															variant="outline"
															className="text-xs text-green-600"
														>
															Waived
														</Badge>
													)}
												</div>
												<span className="whitespace-nowrap">
													₹{fee.netAmount.toFixed(2)}
												</span>
											</div>
										),
								)}
							</div>
						);
					})}

					<div className="border-t pt-2 space-y-1">
						<div className="flex justify-between text-sm">
							<span>Subtotal (excl. GST)</span>
							<span>₹{summary.subtotal.toFixed(2)}</span>
						</div>
						{summary.totalGst > 0 && (
							<div className="flex justify-between text-sm">
								<span>GST</span>
								<span>₹{summary.totalGst.toFixed(2)}</span>
							</div>
						)}
						{summary.totalWaivers > 0 && (
							<div className="flex justify-between text-sm text-green-600">
								<span>Waivers Applied</span>
								<span>-₹{summary.totalWaivers.toFixed(2)}</span>
							</div>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}
