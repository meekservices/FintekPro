import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Minus, Plus, ShoppingCart, ArrowLeft, CreditCard } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Cart() {
  const { cart, isLoading, updateCartItem, removeFromCart, clearCart, isUpdatingCartItem, isRemovingFromCart } = useCart();
  const { toast } = useToast();
  const [updatingItems, setUpdatingItems] = useState<Record<string, boolean>>({});

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setUpdatingItems(prev => ({ ...prev, [itemId]: true }));
    updateCartItem({ itemId, quantity: newQuantity }, {
      onSuccess: () => {
        setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
      },
      onError: () => {
        setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
        toast({
          title: "Error",
          description: "Failed to update quantity",
          variant: "destructive",
        });
      }
    });
  };

  const handleInvestmentAmountChange = async (itemId: string, newAmount: string) => {
    updateCartItem({ itemId, investmentAmount: newAmount }, {
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to update investment amount",
          variant: "destructive",
        });
      }
    });
  };

  const handleRemoveItem = (itemId: string) => {
    removeFromCart(itemId, {
      onSuccess: () => {
        toast({
          title: "Removed",
          description: "Item removed from cart",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to remove item",
          variant: "destructive",
        });
      }
    });
  };

  const handleClearCart = () => {
    clearCart(undefined, {
      onSuccess: () => {
        toast({
          title: "Cart Cleared",
          description: "All items removed from cart",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to clear cart",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-finance-light">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-finance-light" data-testid="cart-page">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/store">
            <Button variant="ghost" className="mb-4" data-testid="button-back-to-store">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Store
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Cart</h1>
          <p className="text-gray-600">Review your selected financial products</p>
        </div>

        {!cart || cart.items.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
              <p className="text-gray-600 mb-6">Add some financial products to get started</p>
              <Link href="/store">
                <Button className="bg-finance-blue hover:bg-finance-blue/90" data-testid="button-browse-products">
                  Browse Products
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Cart Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Cart Items ({cart.totalItems})</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleClearCart}
                  data-testid="button-clear-cart"
                >
                  Clear Cart
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cart.items.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`cart-item-${item.product.id}`}
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{item.product.name}</h3>
                        <p className="text-sm text-gray-600">{item.product.shortDescription}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <Badge variant="outline">{item.product.category}</Badge>
                          <span className="text-sm text-gray-500">by {item.product.provider}</span>
                          <Badge className={
                            item.product.riskLevel === "low" ? "bg-green-100 text-green-700" :
                            item.product.riskLevel === "medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }>
                            {item.product.riskLevel} risk
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1 || updatingItems[item.id]}
                            data-testid={`button-decrease-quantity-${item.product.id}`}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            disabled={updatingItems[item.id]}
                            data-testid={`button-increase-quantity-${item.product.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Investment Amount */}
                        <div className="w-32">
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={item.investmentAmount || item.product.minimumInvestment || ''}
                            onChange={(e) => handleInvestmentAmountChange(item.id, e.target.value)}
                            min={item.product.minimumInvestment || undefined}
                            data-testid={`input-investment-amount-${item.product.id}`}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Min: ₹{parseInt(item.product.minimumInvestment || '0').toLocaleString()}
                          </p>
                        </div>

                        {/* Remove Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isRemovingFromCart}
                          data-testid={`button-remove-${item.product.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cart Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Cart Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Items:</span>
                    <span className="font-medium">{cart.totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Investment:</span>
                    <span className="font-medium">₹{cart.totalValue.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total:</span>
                      <span>₹{cart.totalValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 space-y-3">
                  <Button 
                    className="w-full bg-finance-blue hover:bg-finance-blue/90"
                    size="lg"
                    data-testid="button-proceed-to-checkout"
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    Proceed to Checkout
                  </Button>
                  <Link href="/store">
                    <Button variant="outline" className="w-full" data-testid="button-continue-shopping">
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}