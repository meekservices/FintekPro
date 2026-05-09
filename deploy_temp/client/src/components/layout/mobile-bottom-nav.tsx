import { Link, useLocation } from "wouter";
import { Home, PieChart, TrendingUp, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/use-cart";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/portfolio", icon: PieChart, label: "Portfolio", matchPrefix: true },
  { href: "/markets", icon: TrendingUp, label: "Markets" },
  { href: "/unified-cart", icon: ShoppingCart, label: "Cart", showBadge: true },
  { href: "/profile", icon: User, label: "Profile" },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const { cart } = useCart();
  
  const cartItemCount = cart?.items?.length || 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = item.href === "/" 
            ? location === "/" 
            : location.startsWith(item.href);
          
          const Icon = item.icon;
          
          if (item.href === "/profile" && !isAuthenticated) {
            return (
              <Link key={item.href} href="/auth">
                <div className="flex flex-col items-center justify-center min-w-[60px] py-1">
                  <Icon className={cn(
                    "h-5 w-5 transition-colors",
                    "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-[10px] mt-1 transition-colors",
                    "text-muted-foreground"
                  )}>
                    Login
                  </span>
                </div>
              </Link>
            );
          }
          
          return (
            <Link key={item.href} href={item.href}>
              <div className="relative flex flex-col items-center justify-center min-w-[60px] py-1">
                <div className="relative">
                  <Icon className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  {item.showBadge && cartItemCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                    >
                      {cartItemCount > 9 ? "9+" : cartItemCount}
                    </Badge>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] mt-1 transition-colors",
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
