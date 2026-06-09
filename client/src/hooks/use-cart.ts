import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export interface CartItem {
	id: string;
	itemType: string;
	productId: string | null;
	proposalId: string | null;
	investmentId: string | null;
	quantity: number;
	investmentAmount: string | null;
	metadata: any;
	addedAt: string;
	product: {
		id: string;
		name: string;
		shortDescription: string;
		category: string;
		productType: string;
		price: string | null;
		minimumInvestment: string | null;
		riskLevel: string;
		expectedReturns: string | null;
		provider: string;
		features: string[] | null;
	} | null;
}

export interface Cart {
	id: string;
	userId: string;
	createdAt: string;
	updatedAt: string;
}

export interface CartResponse {
	cart: Cart;
	items: CartItem[];
	totalItems: number;
	totalValue: number;
}

export function useCart() {
	const queryClient = useQueryClient();
	const { isAuthenticated } = useAuth();

	const cartQuery = useQuery<CartResponse>({
		queryKey: ["/api/cart"],
		enabled: isAuthenticated,
	});

	const addToCartMutation = useMutation({
		mutationFn: async ({
			productId,
			quantity = 1,
			investmentAmount,
		}: {
			productId: string;
			quantity?: number;
			investmentAmount?: string;
		}) => {
			return apiRequest("/api/cart/items", {
				method: "POST",
				body: JSON.stringify({ productId, quantity, investmentAmount }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
		},
	});

	const updateCartItemMutation = useMutation({
		mutationFn: async ({
			itemId,
			quantity,
			investmentAmount,
		}: {
			itemId: string;
			quantity?: number;
			investmentAmount?: string;
		}) => {
			return apiRequest(`/api/cart/items/${itemId}`, {
				method: "PUT",
				body: JSON.stringify({ quantity, investmentAmount }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
		},
	});

	const removeFromCartMutation = useMutation({
		mutationFn: async (itemId: string) => {
			return apiRequest(`/api/cart/items/${itemId}`, {
				method: "DELETE",
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
		},
	});

	const clearCartMutation = useMutation({
		mutationFn: async () => {
			return apiRequest("/api/cart", {
				method: "DELETE",
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
		},
	});

	return {
		cart: cartQuery.data?.cart,
		items: cartQuery.data?.items || [],
		totalItems: cartQuery.data?.totalItems || 0,
		totalValue: cartQuery.data?.totalValue || 0,
		isLoading: cartQuery.isLoading,
		error: cartQuery.error,
		addToCart: addToCartMutation.mutate,
		isAddingToCart: addToCartMutation.isPending,
		updateCartItem: updateCartItemMutation.mutate,
		isUpdatingCartItem: updateCartItemMutation.isPending,
		removeFromCart: removeFromCartMutation.mutate,
		isRemovingFromCart: removeFromCartMutation.isPending,
		clearCart: clearCartMutation.mutate,
		isClearingCart: clearCartMutation.isPending,
	};
}
