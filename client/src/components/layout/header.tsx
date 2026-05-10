import { useState } from "react";
import { Link, useLocation } from "wouter";
import fintekproLogo from "@assets/fintekpro_main_1772539048013.png";
import { PortalLogo } from "@/components/portal/PortalLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, User as UserIcon, HelpCircle, LogOut, Shield, Store, ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/use-cart";
import { useUnifiedCartCount } from "@/contexts/UnifiedCartContext";
import { type User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MobileNavCards } from "./MobileNavCards";

export function Header() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { totalItems } = useCart();
  const unifiedCartCount = useUnifiedCartCount();
  
  const totalCartCount = (totalItems || 0) + unifiedCartCount;

  const handleLogout = async () => {
    try {
      await logout();
      // Redirect to auth page for consistent security across all portals
      window.location.href = "/auth";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Helper function to get full client name
  const getClientName = () => {
    if (!user) return 'Client';
    const firstName = user.firstName?.trim() || '';
    const lastName = user.lastName?.trim() || '';
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    return firstName || lastName || user.email || 'Client';
  };

  const navigation = [
    { name: "Markets", href: "/markets" },
    { name: "Portfolio", href: "/portfolio" },
    { name: "Broking", href: "/broking" },
    { name: "InvestSmart", href: "/investsmart" },
    { name: "Proposals", href: "/proposals" },
    { name: "Loans", href: "/loans" },
    { name: "Insurance", href: "/policybazaar" },
    { name: "Support", href: "/support" },
  ];

  // Add admin navigation for admin clients
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('superadmin');
  const adminNavigation = isAdmin ? [
    { name: "Admin Panel", href: "/admin" },
    { name: "Supplier Management", href: "/suppliers" }
  ] : [];

  return (
    <header className="bg-background shadow-sm border-b border-border fixed top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center gap-2">
                <PortalLogo size="md" />
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-6">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <span
                    className={`font-medium transition-colors cursor-pointer ${
                      location === item.href
                        ? "text-finance-blue"
                        : "text-foreground hover:text-finance-blue"
                    }`}
                    data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}
                  >
                    {item.name}
                  </span>
                </Link>
              ))}
              {adminNavigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <span
                    className={`font-medium transition-colors cursor-pointer ${
                      location === item.href
                        ? "text-red-600"
                        : "text-red-500 hover:text-red-600"
                    }`}
                    data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}
                  >
                    {item.name}
                  </span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-wrap">
            {/* Store Button */}
            <Link href="/store">
              <Button 
                variant="default" 
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                data-testid="header-store-button"
              >
                <Store className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Store</span>
              </Button>
            </Link>
            
            {/* Cart Button */}
            {isAuthenticated && (
              <Link href="/cart">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="relative whitespace-nowrap"
                  data-testid="header-cart-button"
                >
                  <ShoppingCart className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Cart</span>
                  {totalCartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {totalCartCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}

            {/* Desktop Auth Button */}
            {isLoading ? (
              <div className="hidden md:block w-20 h-9 bg-muted animate-pulse rounded"></div>
            ) : isAuthenticated ? (
              <div className="hidden md:flex items-center gap-2 lg:gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {user?.profileImageUrl && (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile" 
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground truncate max-w-[120px]" data-testid="client-name-header">
                      {getClientName()}
                    </span>
                    {user?.id && (
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]" data-testid="client-userid-header">
                        {user.id}
                      </span>
                    )}
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={handleLogout}
                  data-testid="logout-button"
                >
                  <LogOut className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <Link href="/auth">
                <Button 
                  className="hidden md:inline-flex" 
                  data-testid="login-button"
                >
                  <UserIcon className="h-4 w-4 mr-2" />
                  Login
                </Button>
              </Link>
            )}

            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden" data-testid="mobile-menu-trigger">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col space-y-6 pt-6">

                  {/* Mobile Navigation Cards */}
                  <MobileNavCards
                    items={[
                      ...navigation.map(item => ({ 
                        name: item.name, 
                        href: item.href,
                        tone: 'default' as const
                      })),
                      { 
                        name: "Product Store", 
                        href: "/store",
                        tone: 'store' as const
                      },
                      ...(isAuthenticated ? [{ 
                        name: "Cart", 
                        href: "/cart",
                        tone: 'cart' as const,
                        badge: totalCartCount
                      }] : []),
                      ...adminNavigation.map(item => ({ 
                        name: item.name, 
                        href: item.href,
                        tone: 'admin' as const
                      }))
                    ]}
                    onNavigate={() => setIsOpen(false)}
                    isAuthenticated={isAuthenticated}
                    cartCount={totalCartCount}
                    isAdmin={isAdmin}
                  />

                  {/* Mobile Auth */}
                  {isLoading ? (
                    <div className="w-full h-9 bg-muted animate-pulse rounded"></div>
                  ) : isAuthenticated ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                        {user?.profileImageUrl && (
                          <img 
                            src={user.profileImageUrl} 
                            alt="Profile" 
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-foreground" data-testid="mobile-client-name">
                            {getClientName()}
                          </p>
                          {user?.id && (
                            <p className="text-xs text-muted-foreground" data-testid="mobile-client-userid">
                              {user.id}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                      </div>
                      <Link href="/kyc-dashboard">
                        <Button 
                          className="w-full" 
                          variant="outline"
                          onClick={() => setIsOpen(false)}
                          data-testid="mobile-kyc-dashboard-button"
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          KYC Dashboard
                        </Button>
                      </Link>
                      <Link href="/profile">
                        <Button 
                          className="w-full" 
                          variant="outline"
                          onClick={() => setIsOpen(false)}
                          data-testid="mobile-profile-button"
                        >
                          <UserIcon className="h-4 w-4 mr-2" />
                          Profile
                        </Button>
                      </Link>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => {
                          setIsOpen(false);
                          handleLogout();
                        }}
                        data-testid="mobile-logout-button"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </Button>
                    </div>
                  ) : (
                    <Link href="/auth">
                      <Button 
                        className="w-full" 
                        data-testid="mobile-login-button"
                        onClick={() => setIsOpen(false)}
                      >
                        <UserIcon className="h-4 w-4 mr-2" />
                        Login
                      </Button>
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
