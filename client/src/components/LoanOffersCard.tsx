import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import {
	CreditCard,
	TrendingDown,
	Calendar,
	CheckCircle2,
	ArrowRight,
} from "lucide-react";

interface LoanOffer {
	id: string;
	userId: string;
	lenderName: string;
	offerAmount: number;
	interestRate: number;
	tenureMonths: number;
	emi: number;
	processingFee: number;
	features: string[];
	status: "pending" | "in_progress" | "approved" | "disbursed" | "rejected";
	partnerApplicationUrl: string;
	expiryDate: string;
	isViewed: boolean;
	viewedAt: string | null;
	createdAt: string;
}

export function LoanOffersCard() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [processingOfferId, setProcessingOfferId] = useState<string | null>(
		null,
	);

	const { data: offers = [], isLoading } = useQuery<LoanOffer[]>({
		queryKey: ["/api/loan-offers"],
		select: (data: any) => (Array.isArray(data) ? data : data?.offers || []),
	});

	const proceedMutation = useMutation({
		mutationFn: async (offerId: string) => {
			return apiRequest("POST", `/api/loan-offers/${offerId}/proceed`);
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({ queryKey: ["/api/loan-offers"] });
			toast({
				title: "Application Initiated",
				description: `You'll be redirected to the lender's application portal.`,
			});

			if (data.redirectUrl) {
				setTimeout(() => {
					window.open(data.redirectUrl, "_blank");
				}, 1500);
			}
			setProcessingOfferId(null);
		},
		onError: (error) => {
			console.error("Error proceeding with loan:", error);
			toast({
				title: "Error",
				description: "Failed to initiate application. Please try again.",
				variant: "destructive",
			});
			setProcessingOfferId(null);
		},
	});

	const handleProceed = (offerId: string) => {
		setProcessingOfferId(offerId);
		proceedMutation.mutate(offerId);
	};

	if (isLoading) {
		return (
			<Card className="w-full">
				<CardHeader>
					<Skeleton className="h-6 w-64" />
					<Skeleton className="h-4 w-96 mt-2" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-32 w-full" />
				</CardContent>
			</Card>
		);
	}

	if (!offers || offers.length === 0) {
		return null;
	}

	const activeOffers = offers.filter(
		(offer) => offer.status === "pending" || offer.status === "in_progress",
	);

	if (activeOffers.length === 0) {
		return null;
	}

	return (
		<Card className="w-full" data-testid="card-loan-offers">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle
							className="text-2xl flex items-center gap-2"
							data-testid="text-loan-offers-title"
						>
							<CreditCard className="h-6 w-6 text-primary" />
							Your Pre-Approved Loan Offers
						</CardTitle>
						<CardDescription data-testid="text-loan-offers-description">
							Compare personalized loan offers from leading lenders and choose
							the best option
						</CardDescription>
					</div>
					<Badge
						variant="secondary"
						className="text-sm"
						data-testid="badge-offers-count"
					>
						{activeOffers.length}{" "}
						{activeOffers.length === 1 ? "Offer" : "Offers"} Available
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
					<table
						className="w-full border-collapse"
						data-testid="table-loan-offers"
					>
						<thead>
							<tr className="border-b bg-muted/50">
								<th className="text-left p-3 font-semibold">Lender</th>
								<th className="text-right p-3 font-semibold">Loan Amount</th>
								<th className="text-right p-3 font-semibold">Interest Rate</th>
								<th className="text-right p-3 font-semibold">Tenure</th>
								<th className="text-right p-3 font-semibold">EMI</th>
								<th className="text-right p-3 font-semibold">Processing Fee</th>
								<th className="text-left p-3 font-semibold">Key Features</th>
								<th className="text-center p-3 font-semibold">Action</th>
							</tr>
						</thead>
						<tbody>
							{activeOffers.map((offer, index) => (
								<tr
									key={offer.id}
									className="border-b hover:bg-muted/30 transition-colors"
									data-testid={`row-loan-offer-${offer.id}`}
								>
									<td className="p-3">
										<div className="flex flex-col">
											<span
												className="font-medium"
												data-testid={`text-lender-${offer.id}`}
											>
												{offer.lenderName}
											</span>
											{offer.status === "in_progress" && (
												<Badge variant="outline" className="w-fit mt-1 text-xs">
													In Progress
												</Badge>
											)}
										</div>
									</td>
									<td
										className="p-3 text-right font-semibold text-lg"
										data-testid={`text-amount-${offer.id}`}
									>
										{formatCurrency(offer.offerAmount)}
									</td>
									<td
										className="p-3 text-right"
										data-testid={`text-rate-${offer.id}`}
									>
										<div className="flex items-center justify-end gap-1">
											<TrendingDown className="h-4 w-4 text-green-600" />
											<span className="font-medium">{offer.interestRate}%</span>
										</div>
										<span className="text-xs text-muted-foreground">
											per annum
										</span>
									</td>
									<td
										className="p-3 text-right"
										data-testid={`text-tenure-${offer.id}`}
									>
										<div className="flex items-center justify-end gap-1">
											<Calendar className="h-4 w-4 text-muted-foreground" />
											<span>{offer.tenureMonths} months</span>
										</div>
									</td>
									<td
										className="p-3 text-right font-medium"
										data-testid={`text-emi-${offer.id}`}
									>
										{formatCurrency(offer.emi)}
										<div className="text-xs text-muted-foreground">
											per month
										</div>
									</td>
									<td
										className="p-3 text-right"
										data-testid={`text-fee-${offer.id}`}
									>
										{formatCurrency(offer.processingFee)}
									</td>
									<td className="p-3">
										<ul
											className="space-y-1"
											data-testid={`list-features-${offer.id}`}
										>
											{offer.features.slice(0, 3).map((feature, idx) => (
												<li
													key={idx}
													className="flex items-start gap-1 text-sm"
												>
													<CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
													<span className="text-muted-foreground">
														{feature}
													</span>
												</li>
											))}
										</ul>
									</td>
									<td className="p-3 text-center">
										<Button
											onClick={() => handleProceed(offer.id)}
											disabled={
												processingOfferId === offer.id ||
												proceedMutation.isPending
											}
											size="sm"
											className="gap-2"
											data-testid={`button-proceed-${offer.id}`}
										>
											{processingOfferId === offer.id ? (
												<>Processing...</>
											) : (
												<>
													Proceed
													<ArrowRight className="h-4 w-4" />
												</>
											)}
										</Button>
										{offer.expiryDate && (
											<div className="text-xs text-muted-foreground mt-1">
												Valid till{" "}
												{new Date(offer.expiryDate).toLocaleDateString()}
											</div>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="mt-4 p-4 bg-muted/30 rounded-lg">
					<p className="text-sm text-muted-foreground">
						<strong>Note:</strong> These are pre-approved offers based on your
						credit profile. Final approval is subject to the lender's
						verification process. Clicking "Proceed" will redirect you to the
						lender's application portal.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
