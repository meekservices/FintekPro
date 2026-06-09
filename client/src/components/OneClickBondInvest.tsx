import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Zap,
	Loader2,
	CheckCircle,
	AlertCircle,
	IndianRupee,
	Shield as LucideShield,
	Clock,
	Percent,
	CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUnifiedCart } from "@/contexts/UnifiedCartContext";
import { useOrderGuard } from "@/hooks/use-order-guard";
import { OrderBlocker } from "@/components/OrderBlocker";

interface BondData {
	isin: string;
	name?: string;
	bondName?: string;
	securityName?: string;
	issuer?: string;
	bondType?: string;
	type?: string;
	currentPrice?: number;
	lastPrice?: number;
	lastTradedPrice?: number;
	faceValue?: number;
	couponRate?: number | string;
	yieldToMaturity?: number | string;
	ytm?: number | string;
	rating?: string;
	creditRating?: string;
	maturityDate?: string;
}

interface OneClickBondInvestProps {
	bond: BondData;
	variant?: "button" | "icon";
	size?: "sm" | "default" | "lg";
	className?: string;
}

interface CommissionConfig {
	bondType: string;
	brokerageBps: number;
	platformFeeFixed: number;
	platformFeePercent: number;
	gstRate: number;
	minFee: number;
	maxFee: number;
}

interface UserProfile {
	id: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	mobile?: string;
	pan?: string;
	dematAccountNumber?: string;
	dpId?: string;
	bankAccountNumber?: string;
	bankIfscCode?: string;
	bankName?: string;
}

const STAMP_DUTY_RATES: Record<
	string,
	{ rate: number; isExempt: boolean; reason?: string }
> = {
	g_sec: { rate: 0, isExempt: true, reason: "Government Securities exempt" },
	t_bill: { rate: 0, isExempt: true, reason: "Treasury Bills exempt" },
	sdl: { rate: 0, isExempt: true, reason: "State Development Loans exempt" },
	sgb: { rate: 0, isExempt: true, reason: "Sovereign Gold Bonds exempt" },
	corporate: { rate: 1, isExempt: false },
	ncd: { rate: 1, isExempt: false },
	tax_free: { rate: 1, isExempt: false },
	infrastructure: { rate: 1, isExempt: false },
};

function calculateFees(
	amount: number,
	config: CommissionConfig | undefined,
	bondType?: string,
) {
	if (!config || amount <= 0) {
		return {
			principal: amount || 0,
			brokerage: 0,
			platformFee: 0,
			stampDuty: 0,
			stampDutyExempt: false,
			gst: 0,
			totalFees: 0,
			grandTotal: amount || 0,
		};
	}

	let brokerage = (amount * config.brokerageBps) / 10000;
	brokerage = Math.max(config.minFee, Math.min(config.maxFee, brokerage));
	const platformFee =
		config.platformFeeFixed + (amount * config.platformFeePercent) / 100;

	const typeKey = bondType?.toLowerCase().replace(/[- ]/g, "_") || "corporate";
	const stampDutyInfo = STAMP_DUTY_RATES[typeKey] || STAMP_DUTY_RATES.corporate;
	const stampDuty = stampDutyInfo.isExempt
		? 0
		: (amount * stampDutyInfo.rate) / 10000;

	const gst = ((brokerage + platformFee) * config.gstRate) / 100;
	const totalFees = brokerage + platformFee + gst + stampDuty;

	return {
		principal: amount,
		brokerage: Math.round(brokerage * 100) / 100,
		platformFee: Math.round(platformFee * 100) / 100,
		stampDuty: Math.round(stampDuty * 100) / 100,
		stampDutyExempt: stampDutyInfo.isExempt,
		stampDutyReason: stampDutyInfo.reason,
		gst: Math.round(gst * 100) / 100,
		totalFees: Math.round(totalFees * 100) / 100,
		grandTotal: Math.round((amount + totalFees) * 100) / 100,
	};
}

export function OneClickBondInvest({
	bond,
	variant = "button",
	size = "default",
	className = "",
}: OneClickBondInvestProps) {
	const [showDialog, setShowDialog] = useState(false);
	const [quantity, setQuantity] = useState(1);
	const [showSuccess, setShowSuccess] = useState(false);
	const [addToCartInstead, setAddToCartInstead] = useState(false);
	const { toast } = useToast();
	const { addItem: addToUnifiedCart, isAddingItem } = useUnifiedCart();
	const orderGuard = useOrderGuard();

	const { data: userProfile } = useQuery<UserProfile>({
		queryKey: ["/api/user"],
	});

	const { data: commissionConfig } = useQuery<CommissionConfig[]>({
		queryKey: ["/api/admin/bond-commission"],
		staleTime: 300000,
	});

	const bondName =
		bond.name ||
		bond.bondName ||
		bond.securityName ||
		bond.issuer ||
		"Bond Investment";
	const currentPrice =
		bond.currentPrice || bond.lastPrice || bond.lastTradedPrice || 0;
	const faceValue = bond.faceValue || 1000;
	const bondType = (bond.bondType || bond.type || "corporate")
		.toLowerCase()
		.replace(/[- ]/g, "_");
	const yieldValue = bond.yieldToMaturity || bond.ytm || 0;

	const config = useMemo(() => {
		if (!commissionConfig) return undefined;
		return (
			commissionConfig.find((c: any) => c.bondType === bondType) ||
			commissionConfig.find((c: any) => c.bondType === "corporate")
		);
	}, [commissionConfig, bondType]);

	const orderAmount = currentPrice * quantity;
	const fees = calculateFees(orderAmount, config, bondType);

	const orderMutation = useMutation({
		mutationFn: async (orderData: any) => {
			return apiRequest("/api/bonds/orders", {
				method: "POST",
				body: JSON.stringify(orderData),
			});
		},
		onSuccess: () => {
			setShowSuccess(true);
			queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
			queryClient.invalidateQueries({ queryKey: ["/api/unified-orders"] });
			setTimeout(() => {
				setShowSuccess(false);
				setShowDialog(false);
				setQuantity(1);
				orderGuard.clearError();
			}, 2000);
		},
		onError: (error: any) => {
			orderGuard.handleError(error, true);
		},
	});

	const handleQuickInvest = () => {
		if (!userProfile) {
			toast({
				title: "Login Required",
				description: "Please login to invest in bonds.",
				variant: "destructive",
			});
			return;
		}
		setShowDialog(true);
	};

	const handleConfirmOrder = async () => {
		if (orderGuard.isBlocked) {
			return;
		}

		if (addToCartInstead) {
			const isNcd = bondType.includes("ncd") || bondType.includes("debenture");
			try {
				await addToUnifiedCart({
					bondIsin: isNcd ? undefined : bond.isin,
					ncdIsin: isNcd ? bond.isin : undefined,
					displayName: bondName,
					amount: orderAmount.toString(),
					quantity: quantity,
					productCategory: isNcd ? "ncd" : "bond",
					source: "client",
					metadata: {
						isin: bond.isin,
						bondType: bond.bondType || bond.type,
						rating: bond.rating || bond.creditRating,
						yieldToMaturity: yieldValue,
						faceValue: faceValue,
						maturityDate: bond.maturityDate,
						couponRate: bond.couponRate,
						issuer: bond.issuer,
						orderType: "market",
						unitPrice: currentPrice,
					} as Record<string, any>,
				});

				queryClient.invalidateQueries({ queryKey: ["/api/unified-cart"] });
				toast({
					title: "Added to Cart",
					description: `${bondName} added to your cart successfully`,
				});
				setShowDialog(false);
				setQuantity(1);
			} catch (err) {
				toast({
					title: "Error",
					description: "Failed to add to cart. Please try again.",
					variant: "destructive",
				});
			}
			return;
		}

		const orderData = {
			isin: bond.isin,
			bondType: bond.bondType || bond.type,
			quantity: quantity,
			orderType: "market",
			price: currentPrice,
			dematAccountNumber: userProfile?.dematAccountNumber,
			dpId: userProfile?.dpId,
		};

		orderMutation.mutate(orderData);
	};

	const getRatingColor = (rating: string) => {
		if (!rating) return "bg-muted text-muted-foreground";
		if (rating.includes("AAA") || rating === "SOV")
			return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
		if (rating.includes("AA"))
			return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
		if (rating.includes("A"))
			return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
		return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300";
	};

	return (
		<>
			{variant === "button" ? (
				<Button
					onClick={handleQuickInvest}
					size={size}
					className={`bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-foreground ${className}`}
					data-testid={`quick-invest-${bond.isin}`}
				>
					<Zap className="h-4 w-4 mr-2" />
					Quick Invest
				</Button>
			) : (
				<Button
					onClick={handleQuickInvest}
					size="icon"
					variant="ghost"
					className={`text-green-600 hover:bg-green-50 dark:bg-green-950/30 ${className}`}
					data-testid={`quick-invest-icon-${bond.isin}`}
				>
					<Zap className="h-5 w-5" />
				</Button>
			)}

			<Dialog
				open={showDialog}
				onOpenChange={(open) => {
					setShowDialog(open);
					if (!open) orderGuard.clearError();
				}}
			>
				<DialogContent className="sm:max-w-[480px]">
					{showSuccess ? (
						<div className="py-8 text-center">
							<div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
								<CheckCircle className="h-10 w-10 text-green-600" />
							</div>
							<h3 className="text-xl font-semibold text-foreground mb-2">
								Order Placed Successfully!
							</h3>
							<p className="text-muted-foreground">
								Your bond order has been submitted for processing.
							</p>
						</div>
					) : (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<Zap className="h-5 w-5 text-green-600" />
									Quick Bond Investment
								</DialogTitle>
								<DialogDescription>
									Pre-filled order form for fast execution
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-4">
								<Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30/50">
									<CardContent className="p-4">
										<div className="flex justify-between items-start mb-2">
											<div className="flex-1">
												<h4 className="font-semibold text-foreground line-clamp-2">
													{bondName}
												</h4>
												<p className="text-sm text-muted-foreground">
													{bond.isin}
												</p>
											</div>
											<Badge
												className={getRatingColor(
													bond.rating || bond.creditRating || "",
												)}
											>
												{bond.rating || bond.creditRating || "NR"}
											</Badge>
										</div>
										<div className="grid grid-cols-3 gap-4 mt-3">
											<div>
												<p className="text-xs text-muted-foreground">Price</p>
												<p className="font-semibold">
													₹{currentPrice.toLocaleString()}
												</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">Yield</p>
												<p className="font-semibold text-green-600">
													{yieldValue}%
												</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">
													Face Value
												</p>
												<p className="font-semibold">
													₹{faceValue.toLocaleString()}
												</p>
											</div>
										</div>
									</CardContent>
								</Card>

								<div className="space-y-3">
									<div>
										<Label
											htmlFor="quick-quantity"
											className="text-sm font-medium"
										>
											Quantity
										</Label>
										<div className="flex items-center gap-2 mt-1">
											<Button
												variant="outline"
												size="icon"
												className="h-10 w-10"
												onClick={() => setQuantity(Math.max(1, quantity - 1))}
												disabled={quantity <= 1}
												data-testid="decrease-quantity"
											>
												-
											</Button>
											<Input
												id="quick-quantity"
												type="number"
												min="1"
												value={quantity}
												onChange={(e) =>
													setQuantity(
														Math.max(1, Number.parseInt(e.target.value) || 1),
													)
												}
												className="text-center w-20"
												data-testid="input-quick-quantity"
											/>
											<Button
												variant="outline"
												size="icon"
												className="h-10 w-10"
												onClick={() => setQuantity(quantity + 1)}
												data-testid="increase-quantity"
											>
												+
											</Button>
											<div className="text-sm text-muted-foreground ml-2">
												bonds
											</div>
										</div>
									</div>

									{userProfile && (
										<div className="bg-muted rounded-lg p-3 space-y-2">
											<div className="flex items-center gap-2 mb-2">
												<CreditCard className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm font-medium text-muted-foreground">
													Investor Details (Pre-filled)
												</span>
											</div>
											{(userProfile.firstName || userProfile.lastName) && (
												<div className="flex justify-between text-sm">
													<span className="text-muted-foreground">Name</span>
													<span className="font-medium">
														{[userProfile.firstName, userProfile.lastName]
															.filter(Boolean)
															.join(" ")}
													</span>
												</div>
											)}
											{userProfile.pan && (
												<div className="flex justify-between text-sm">
													<span className="text-muted-foreground">PAN</span>
													<span className="font-mono text-muted-foreground">
														{userProfile.pan}
													</span>
												</div>
											)}
											{userProfile.dematAccountNumber && (
												<div className="flex justify-between text-sm">
													<span className="text-muted-foreground">
														Demat Account
													</span>
													<span className="font-mono text-muted-foreground">
														{userProfile.dematAccountNumber}
													</span>
												</div>
											)}
										</div>
									)}
								</div>

								<Separator />

								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											Order Amount ({quantity} × ₹
											{currentPrice.toLocaleString()})
										</span>
										<span className="font-medium">
											₹{fees.principal.toLocaleString()}
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Brokerage</span>
										<span>₹{fees.brokerage.toFixed(2)}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Platform Fee</span>
										<span>₹{fees.platformFee.toFixed(2)}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground flex items-center gap-1">
											Stamp Duty
											{fees.stampDutyExempt && (
												<Badge
													variant="secondary"
													className="text-xs px-1 py-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
												>
													Exempt
												</Badge>
											)}
										</span>
										<span
											className={fees.stampDutyExempt ? "text-green-600" : ""}
										>
											₹{fees.stampDuty.toFixed(2)}
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">GST (18%)</span>
										<span>₹{fees.gst.toFixed(2)}</span>
									</div>
									<Separator />
									<div className="flex justify-between font-semibold text-lg">
										<span>Total Payable</span>
										<span className="text-blue-600">
											₹{fees.grandTotal.toLocaleString()}
										</span>
									</div>
								</div>

								<div className="flex items-center justify-between p-3 bg-muted rounded-lg">
									<div className="flex items-center gap-2">
										<LucideShield className="h-4 w-4 text-blue-600" />
										<span className="text-sm text-muted-foreground">
											Add to cart instead
										</span>
									</div>
									<Switch
										checked={addToCartInstead}
										onCheckedChange={setAddToCartInstead}
										data-testid="toggle-add-to-cart"
									/>
								</div>

								{!userProfile?.dematAccountNumber && !addToCartInstead && (
									<div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
										<AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
										<p className="text-sm text-amber-700 dark:text-amber-300">
											No demat account linked. Please update your profile to
											enable direct investment.
										</p>
									</div>
								)}

								{orderGuard.isBlocked && (
									<OrderBlocker
										error={orderGuard.error}
										onDismiss={orderGuard.clearError}
										onRetry={handleConfirmOrder}
										variant="inline"
									/>
								)}
							</div>

							<DialogFooter className="gap-2">
								<Button
									variant="outline"
									onClick={() => {
										orderGuard.clearError();
										setShowDialog(false);
									}}
									data-testid="cancel-quick-invest"
								>
									Cancel
								</Button>
								<Button
									onClick={handleConfirmOrder}
									disabled={
										orderMutation.isPending ||
										isAddingItem ||
										orderGuard.isBlocked
									}
									className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
									data-testid="confirm-quick-invest"
								>
									{orderMutation.isPending || isAddingItem ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Processing...
										</>
									) : addToCartInstead ? (
										<>
											<LucideShield className="h-4 w-4 mr-2" />
											Add to Cart
										</>
									) : (
										<>
											<Zap className="h-4 w-4 mr-2" />
											Confirm Investment
										</>
									)}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

export default OneClickBondInvest;
