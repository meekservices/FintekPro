import { Link, useLocation } from "wouter";
import fintekproLogo from "@assets/fintekpro_favicon_1772531115807.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { 
  Home,
  PieChart,
  TrendingUp,
  Calculator,
  Menu,
  User as UserIcon,
  LogOut,
  Settings,
  ShoppingCart,
  Bell,
  HelpCircle,
  ChevronRight,
  Sun,
  Moon,
  Sparkles,
  FileText
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/theme-context";
import { useCart } from "@/hooks/use-cart";
import { Badge } from "@/components/ui/badge";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface BottomNavLayoutProps {
  children: React.ReactNode;
}

const bottomNavItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "Invest", href: "/wealth-management", icon: TrendingUp },
  { name: "Portfolio", href: "/comprehensive-portfolio", icon: PieChart },
  { name: "Tools", href: "/calculators", icon: Calculator },
];

const moreMenuItems = [
  { name: "Discover", href: "/discover", icon: Sparkles },
  { name: "Smart Proposals", href: "/smart-proposals", icon: FileText },
  { name: "Profile", href: "/profile", icon: UserIcon },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Notifications", href: "/notification-preferences", icon: Bell },
  { name: "Cart", href: "/cart", icon: ShoppingCart },
  { name: "Tax Hub", href: "/intelligent-tax-hub", icon: Calculator },
  { name: "Support", href: "/support", icon: HelpCircle },
];

export function BottomNavLayout({ children }: BottomNavLayoutProps) {
  const [location] = useLocation();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { totalItems } = useCart();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      queryClient.clear();
      logout();
      // Redirect to auth page for consistent security across all portals
      window.location.href = "/auth";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background pb-16">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
            <img src={fintekproLogo} alt="FintekPro" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-lg">FintekPro</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              data-testid="button-theme-toggle"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            {isAuthenticated && totalItems > 0 && (
              <Link href="/cart">
                <Button variant="ghost" size="icon" className="relative" data-testid="button-cart">
                  <ShoppingCart className="h-5 w-5" />
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {totalItems}
                  </Badge>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 bg-secondary/30 overflow-y-auto">
        <div className="container py-4 px-4">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-inset-bottom">
        <div className="container grid grid-cols-5 h-16">
          {bottomNavItems.map((item) => {
            const isActive = location === item.href || 
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={`flex flex-col items-center justify-center h-full w-full gap-1 transition-colors ${
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`bottom-nav-${item.name.toLowerCase()}`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                  <span className="text-xs font-medium">{item.name}</span>
                </button>
              </Link>
            );
          })}

          <Sheet open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="flex flex-col items-center justify-center h-full w-full gap-1 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="bottom-nav-more"
              >
                <Menu className="h-5 w-5" />
                <span className="text-xs font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-xl">
              <div className="py-4">
                {isAuthenticated && (
                  <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-muted/50 rounded-lg mx-2">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                )}

                <nav className="space-y-1 px-2">
                  {moreMenuItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant="ghost"
                        className="w-full justify-between h-12"
                        onClick={() => setMoreMenuOpen(false)}
                        data-testid={`more-menu-${item.name.toLowerCase()}`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-5 w-5 text-muted-foreground" />
                          <span>{item.name}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </Link>
                  ))}
                </nav>

                {isAuthenticated && (
                  <div className="mt-4 pt-4 border-t px-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        handleLogout();
                      }}
                      data-testid="more-menu-logout"
                    >
                      <LogOut className="h-5 w-5" />
                      Logout
                    </Button>
                  </div>
                )}

                {!isAuthenticated && (
                  <div className="mt-4 pt-4 border-t px-2">
                    <Link href="/auth">
                      <Button className="w-full" onClick={() => setMoreMenuOpen(false)} data-testid="more-menu-login">
                        Login / Sign Up
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      <FloatingChatWidget />
      <GuidedTour />
    </div>
  );
}
