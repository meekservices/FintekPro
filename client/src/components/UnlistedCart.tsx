import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedCart } from "@/contexts/UnifiedCartContext";
import {
	ShoppingCart,
	Trash2,
	Minus,
	Plus,
	ShoppingBag,
	AlertTriangle,
	CheckCircle2,
	XCircle,
	Loader2,
	Building2,
	IndianRupee,
	Package,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CartItem {
	id: string;
	companyId: string;
	companyName: string;
	companySector?: string;
	currentPrice?: string;
	quantity: number;
	maxPrice: string;
	targetPrice?: string;
	notes?: string;
	createdAt: string;
}

interface CartSummary {
	totalItems: number;
	totalValue: number;
	estimatedFees: number;
}

interface CartResponse {
	items: CartItem[];
	summary: CartSummary;
}

export function UnlistedCart() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [acknowledgedDisclosures, setAcknowledgedDisclosures] = useState(false);
	const [showCheckout, setShowCheckout] = useState(false);

	const { data, isLoading, error } = useQuery<{
		success: boolean;
		data: CartResponse;
	}>({
		queryKey: ["/api/unlisted/cart"],
	});

	const updateMutation = useMutation({
		mutationFn: async ({
			id,
			quantity,
			maxPrice,
		}: { id: string; quantity?: number; maxPrice?: string }) => {
			return apiRequest(`/api/unlisted/cart/${id}`, {
				method: "PATCH",
				body: JSON.stringify({ quantity, maxPrice }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/cart"] });
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to update item",
				variant: "destructive",
			});
		},
	});

	const removeMutation = useMutation({
		mutationFn: async (id: string) => {
			return apiRequest(`/api/unlisted/cart/${id}`, { method: "DELETE" });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/cart"] });
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/cart/count"] });
			toast({ title: "Removed", description: "Item removed from cart" });
		},
	});

	const clearMutation = useMutation({
		mutationFn: async () => {
			return apiRequest("/api/unlisted/cart", { method: "DELETE" });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/cart"] });
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/cart/count"] });
			toast({
				title: "Cart Cleared",
				description: "All items removed from cart",
			});
		},
	});

	const checkoutMutation = useMutation({
		mutationFn: async () => {
			return apiRequest("/api/unlisted/cart/checkout", {
				method: "POST",
				body: JSON.stringify({
					acknowledgedDisclosureIds: [
						"risk-disclosure-1",
						"risk-disclosure-2",
						"liquidity-risk",
						"price-volatility",
					],
				}),
			});
		},
		onSuccess: (response: any) => {
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/cart"] });
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/cart/count"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/unlisted/my-buy-requests"],
			});

			const summary = response?.data?.summary;
			toast({
				title: "Checkout Complete",
				description: `${summary?.successful || 0} buy request(s) created successfully`,
			});
			setShowCheckout(false);
			setAcknowledgedDisclosures(false);
		},
		onError: (error: any) => {
			toast({
				title: "Checkout Failed",
				description: error?.message || "Failed to process checkout",
				variant: "destructive",
			});
		},
	});

	const cart = data?.data;
	const items = cart?.items || [];
	const summary = cart?.summary;

	const handleQuantityChange = (item: CartItem, delta: number) => {
		const newQuantity = Math.max(1, item.quantity + delta);
		updateMutation.mutate({ id: item.id, quantity: newQuantity });
	};

	const formatCurrency = (value: number | string | undefined) => {
		if (!value) return "₹0";
		const num = typeof value === "string" ? Number.parseFloat(value) : value;
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(num);
	};

	if (isLoading) {
		return (
			<Card className="w-full">
				<CardContent className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertTriangle className="h-4 w-4" />
				<AlertDescription>
					Failed to load cart. Please try again.
				</AlertDescription>
			</Alert>
		);
	}

	if (items.length === 0) {
		return (
			<Card className="w-full">
				<CardContent className="flex flex-col items-center justify-center py-12 text-center">
					<ShoppingCart className="h-16 w-16 text-muted-foreground/30 mb-4" />
					<h3 className="text-lg font-medium mb-2">Your cart is empty</h3>
					<p className="text-sm text-muted-foreground mb-4">
						Browse unlisted companies and add shares to your cart for batch
						checkout
					</p>
					<Button
						variant="outline"
						onClick={() => (window.location.href = "/unlisted/browse")}
						data-testid="button-browse-companies"
					>
						<Building2 className="h-4 w-4 mr-2" />
						Browse Companies
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<ShoppingBag className="h-5 w-5" />
							Unlisted Cart
							<Badge variant="secondary">
								{items.length} item{items.length !== 1 ? "s" : ""}
							</Badge>
						</CardTitle>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => clearMutation.mutate()}
							disabled={clearMutation.isPending}
							data-testid="button-clear-cart"
						>
							<Trash2 className="h-4 w-4 mr-1" />
							Clear All
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{items.map((item) => (
						<div
							key={item.id}
							className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30"
							data-testid={`cart-item-${item.id}`}
						>
							<div className="flex-1 min-w-0">
								<div className="flex items-start justify-between gap-2">
									<div>
										<h4 className="font-medium truncate">{item.companyName}</h4>
										{item.companySector && (
											<p className="text-xs text-muted-foreground">
												{item.companySector}
											</p>
										)}
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-destructive hover:text-destructive"
										onClick={() => removeMutation.mutate(item.id)}
										disabled={removeMutation.isPending}
										data-testid={`button-remove-${item.id}`}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>

								<div className="mt-3 flex flex-wrap items-center gap-4">
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">Qty:</span>
										<div className="flex items-center gap-1">
											<Button
												variant="outline"
												size="icon"
												className="h-7 w-7"
												onClick={() => handleQuantityChange(item, -1)}
												disabled={
													item.quantity <= 1 || updateMutation.isPending
												}
												data-testid={`button-decrease-${item.id}`}
											>
												<Minus className="h-3 w-3" />
											</Button>
											<span className="w-12 text-center font-medium">
												{item.quantity}
											</span>
											<Button
												variant="outline"
												size="icon"
												className="h-7 w-7"
												onClick={() => handleQuantityChange(item, 1)}
												disabled={updateMutation.isPending}
												data-testid={`button-increase-${item.id}`}
											>
												<Plus className="h-3 w-3" />
											</Button>
										</div>
									</div>

									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">
											Max Price:
										</span>
										<div className="flex items-center gap-1">
											<IndianRupee className="h-3 w-3 text-muted-foreground" />
											<Input
												type="number"
												value={item.maxPrice}
												onChange={(e) =>
													updateMutation.mutate({
														id: item.id,
														maxPrice: e.target.value,
													})
												}
												className="w-24 h-7 text-sm"
												data-testid={`input-price-${item.id}`}
											/>
										</div>
									</div>

									{item.currentPrice && (
										<span className="text-xs text-muted-foreground">
											Current: {formatCurrency(item.currentPrice)}
										</span>
									)}
								</div>

								<div className="mt-2 text-right">
									<span className="text-sm font-medium">
										Subtotal:{" "}
										{formatCurrency(
											item.quantity * Number.parseFloat(item.maxPrice),
										)}
									</span>
								</div>
							</div>
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Order Summary</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">
							Items ({summary?.totalItems})
						</span>
						<span>{formatCurrency(summary?.totalValue || 0)}</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Estimated Fees (2%)</span>
						<span>{formatCurrency(summary?.estimatedFees || 0)}</span>
					</div>
					<Separator />
					<div className="flex justify-between font-medium">
						<span>Total</span>
						<span>
							{formatCurrency(
								(summary?.totalValue || 0) + (summary?.estimatedFees || 0),
							)}
						</span>
					</div>
				</CardContent>

				{!showCheckout ? (
					<CardFooter>
						<Button
							className="w-full"
							onClick={() => setShowCheckout(true)}
							data-testid="button-proceed-checkout"
						>
							<Package className="h-4 w-4 mr-2" />
							Proceed to Checkout
						</Button>
					</CardFooter>
				) : (
					<CardFooter className="flex-col gap-4">
						<Alert>
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription className="text-sm">
								<strong>Risk Disclosure:</strong> Unlisted shares carry higher
								risks including limited liquidity, price volatility, and
								regulatory uncertainties. Past performance does not guarantee
								future results.
							</AlertDescription>
						</Alert>

						<div className="flex items-start gap-2 w-full">
							<Checkbox
								id="disclosure"
								checked={acknowledgedDisclosures}
								onCheckedChange={(checked) =>
									setAcknowledgedDisclosures(checked === true)
								}
								data-testid="checkbox-disclosure"
							/>
							<label
								htmlFor="disclosure"
								className="text-sm leading-none cursor-pointer"
							>
								I have read and understood the risk disclosures for unlisted
								securities trading as per SEBI regulations
							</label>
						</div>

						<div className="flex gap-2 w-full">
							<Button
								variant="outline"
								onClick={() => setShowCheckout(false)}
								className="flex-1"
								data-testid="button-cancel-checkout"
							>
								Cancel
							</Button>
							<Button
								onClick={() => checkoutMutation.mutate()}
								disabled={
									!acknowledgedDisclosures || checkoutMutation.isPending
								}
								className="flex-1"
								data-testid="button-confirm-checkout"
							>
								{checkoutMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
								) : (
									<CheckCircle2 className="h-4 w-4 mr-2" />
								)}
								Create Buy Requests
							</Button>
						</div>
					</CardFooter>
				)}
			</Card>
		</div>
	);
}

export function CartBadge() {
	const { data } = useQuery<{ success: boolean; data: { count: number } }>({
		queryKey: ["/api/unlisted/cart/count"],
		refetchInterval: 30000,
	});

	const count = data?.data?.count || 0;

	if (count === 0) return null;

	return (
		<Badge
			variant="destructive"
			className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
		>
			{count > 9 ? "9+" : count}
		</Badge>
	);
}

export function AddToCartButton({
	companyId,
	companyName,
	companySector,
	suggestedPrice,
	className,
}: {
	companyId: string;
	companyName: string;
	companySector?: string;
	suggestedPrice?: string;
	className?: string;
}) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { addItem: addToUnifiedCart } = useUnifiedCart();
	const [quantity, setQuantity] = useState(10);

	const addMutation = useMutation({
		mutationFn: async () => {
			return apiRequest("/api/unlisted/cart", {
				method: "POST",
				body: JSON.stringify({
					companyId,
					quantity,
					maxPrice: suggestedPrice || "1000",
				}),
			});
		},
		onSuccess: async () => {
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/cart"] });
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/cart/count"] });

			try {
				const priceStr = suggestedPrice || "1000";
				const priceNum = Number.parseFloat(priceStr);
				const validPrice = Number.isNaN(priceNum) ? 1000 : priceNum;
				const totalAmount = (quantity * validPrice).toString();
				const cartItem = {
					productCategory: "unlisted" as const,
					unlistedCompanyId: companyId,
					displayName: companyName,
					amount: totalAmount,
					quantity: quantity,
					source: "client" as const,
					status: "active" as const,
				};
				await addToUnifiedCart(cartItem);
				queryClient.invalidateQueries({ queryKey: ["/api/unified-cart"] });
				queryClient.invalidateQueries({
					queryKey: ["/api/unified-cart/count"],
				});
				toast({
					title: "Added to Cart",
					description: `${quantity} shares of ${companyName} added to cart`,
				});
			} catch (error) {
				console.error("Failed to add to unified cart:", error);
				toast({
					title: "Partially Added",
					description: `${quantity} shares added to unlisted cart, but unified tracking failed.`,
				});
			}
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to add to cart. Please try again.",
				variant: "destructive",
			});
		},
	});

	return (
		<Button
			variant="outline"
			onClick={() => addMutation.mutate()}
			disabled={addMutation.isPending}
			className={className}
			data-testid={`button-add-to-cart-${companyId}`}
		>
			{addMutation.isPending ? (
				<Loader2 className="h-4 w-4 animate-spin mr-2" />
			) : (
				<ShoppingCart className="h-4 w-4 mr-2" />
			)}
			Add to Cart
		</Button>
	);
}
