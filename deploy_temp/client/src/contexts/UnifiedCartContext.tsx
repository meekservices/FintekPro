import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { UnifiedCartItem, InsertUnifiedCartItem, ProductCategory } from "@shared/schema";

interface CheckoutResult {
  message: string;
  orders: any[];
  count: number;
}

interface UnifiedCartContextType {
  items: UnifiedCartItem[];
  isLoading: boolean;
  error: Error | null;
  cartCount: number;
  getItemsByCategory: (category: ProductCategory) => UnifiedCartItem[];
  addItem: (item: Omit<InsertUnifiedCartItem, "userId">) => Promise<UnifiedCartItem>;
  updateItem: (id: string, updates: Partial<InsertUnifiedCartItem>) => Promise<UnifiedCartItem>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  approveItem: (id: string) => Promise<UnifiedCartItem>;
  checkout: (cartItemIds: string[]) => Promise<CheckoutResult>;
  isAddingItem: boolean;
  isUpdatingItem: boolean;
  isRemovingItem: boolean;
  isCheckingOut: boolean;
  refetch: () => void;
}

const UnifiedCartContext = createContext<UnifiedCartContextType | undefined>(undefined);

export function UnifiedCartProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const { data: cartData, isLoading, error, refetch } = useQuery<{ items: UnifiedCartItem[]; count: number }>({
    queryKey: ["/api/unified-cart"],
    staleTime: 30 * 1000,
    refetchOnMount: false,
    placeholderData: { items: [], count: 0 },
    enabled: isAuthenticated,
  });

  const items = cartData?.items || [];
  const cartCount = cartData?.count || items.length;

  const getItemsByCategory = (category: ProductCategory): UnifiedCartItem[] => {
    return items.filter((item) => item.productCategory === category);
  };

  const addItemMutation = useMutation({
    mutationFn: async (item: Omit<InsertUnifiedCartItem, "userId">) => {
      const response = await apiRequest("/api/unified-cart", {
        method: "POST",
        body: JSON.stringify(item),
      });
      return response.item as UnifiedCartItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-cart"] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertUnifiedCartItem> }) => {
      const response = await apiRequest(`/api/unified-cart/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      return response.item as UnifiedCartItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-cart"] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/unified-cart/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-cart"] });
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/unified-cart", {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-cart"] });
    },
  });

  const approveItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/unified-cart/${id}/approve`, {
        method: "POST",
      });
      return response.item as UnifiedCartItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-cart"] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (cartItemIds: string[]) => {
      const response = await apiRequest("/api/unified-cart/checkout", {
        method: "POST",
        body: JSON.stringify({ cartItemIds }),
      });
      return response as CheckoutResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unified-orders"] });
    },
  });

  const addItem = async (item: Omit<InsertUnifiedCartItem, "userId">) => {
    return addItemMutation.mutateAsync(item);
  };

  const updateItem = async (id: string, updates: Partial<InsertUnifiedCartItem>) => {
    return updateItemMutation.mutateAsync({ id, updates });
  };

  const removeItem = async (id: string) => {
    return removeItemMutation.mutateAsync(id);
  };

  const clearCart = async () => {
    return clearCartMutation.mutateAsync();
  };

  const approveItem = async (id: string) => {
    return approveItemMutation.mutateAsync(id);
  };

  const checkout = async (cartItemIds: string[]) => {
    return checkoutMutation.mutateAsync(cartItemIds);
  };

  return (
    <UnifiedCartContext.Provider
      value={{
        items,
        isLoading,
        error: error as Error | null,
        cartCount,
        getItemsByCategory,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        approveItem,
        checkout,
        isAddingItem: addItemMutation.isPending,
        isUpdatingItem: updateItemMutation.isPending,
        isRemovingItem: removeItemMutation.isPending,
        isCheckingOut: checkoutMutation.isPending,
        refetch,
      }}
    >
      {children}
    </UnifiedCartContext.Provider>
  );
}

export function useUnifiedCart() {
  const context = useContext(UnifiedCartContext);
  if (context === undefined) {
    throw new Error("useUnifiedCart must be used within a UnifiedCartProvider");
  }
  return context;
}

export function useUnifiedCartCount() {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/unified-cart/count"],
    enabled: isAuthenticated,
  });
  return data?.count || 0;
}
