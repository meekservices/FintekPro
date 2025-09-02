import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface CartItem {
  id: string;
  quantity: number;
  investmentAmount: string | null;
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
  };
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

  const cartQuery = useQuery<CartResponse>({
    queryKey: ["/api/cart"],
  });

  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity = 1, investmentAmount }: {
      productId: string;
      quantity?: number;
      investmentAmount?: string;
    }) => {
      const response = await apiRequest("POST", "/api/cart/items", { productId, quantity, investmentAmount });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  const updateCartItemMutation = useMutation({
    mutationFn: async ({ itemId, quantity, investmentAmount }: {
      itemId: string;
      quantity?: number;
      investmentAmount?: string;
    }) => {
      const response = await apiRequest("PUT", `/api/cart/items/${itemId}`, { quantity, investmentAmount });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  const removeFromCartMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiRequest("DELETE", `/api/cart/items/${itemId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/cart");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  return {
    cart: cartQuery.data,
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