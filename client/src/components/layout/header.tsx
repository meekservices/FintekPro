import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, User as UserIcon, HelpCircle, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { type User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function Header() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAuthenticated, isLoading } = useAuth();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navigation = [
    { name: "Markets", href: "/markets" },
    { name: "Portfolio", href: "/portfolio" },
    { name: "Wealth Management", href: "/wealth" },
    { name: "Calculators", href: "/calculators" },
    { name: "Agricultural Insights", href: "/agricultural-insights" },
    { name: "IPO", href: "/ipo" },
    { name: "Mutual Funds", href: "/mutual-funds" },
    { name: "Bonds", href: "/bonds" },
    { name: "Loans", href: "/loans" },
    { name: "NSDL Services", href: "/nsdl-services" },
    { name: "CDSL Services", href: "/cdsl-services" },
  ];

  // Add admin navigation for admin clients
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const adminNavigation = isAdmin ? [{ name: "Admin Panel", href: "/admin" }] : [];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <Link href="/">
                <h1 className="text-2xl font-bold text-finance-blue cursor-pointer" data-testid="logo">
                  FintekPro
                </h1>
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
                        : "text-gray-700 hover:text-finance-blue"
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

          <div className="flex items-center space-x-4">

            {/* Desktop Auth Button */}
            {isLoading ? (
              <div className="hidden md:block w-20 h-9 bg-gray-200 animate-pulse rounded"></div>
            ) : isAuthenticated ? (
              <div className="hidden md:flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {user?.profileImageUrl && (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile" 
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {user?.firstName || user?.email || 'Client'}
                  </span>
                </div>
                <Link href="/profile">
                  <Button 
                    variant="outline" 
                    size="sm"
                    data-testid="profile-button"
                  >
                    <UserIcon className="h-4 w-4 mr-2" />
                    Profile
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  data-testid="logout-button"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
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
                <div className="flex flex-col space-y-4 pt-6">

                  {/* Mobile Navigation */}
                  <nav className="flex flex-col space-y-2">
                    {navigation.map((item) => (
                      <Link key={item.name} href={item.href}>
                        <div
                          className={`block px-3 py-2 rounded-md font-medium transition-colors cursor-pointer ${
                            location === item.href
                              ? "bg-finance-blue text-white"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                          onClick={() => setIsOpen(false)}
                          data-testid={`mobile-nav-${item.name.toLowerCase().replace(" ", "-")}`}
                        >
                          {item.name}
                        </div>
                      </Link>
                    ))}
                  </nav>

                  {/* Mobile Auth */}
                  {isLoading ? (
                    <div className="w-full h-9 bg-gray-200 animate-pulse rounded"></div>
                  ) : isAuthenticated ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                        {user?.profileImageUrl && (
                          <img 
                            src={user.profileImageUrl} 
                            alt="Profile" 
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {user?.firstName || 'Client'}
                          </p>
                          <p className="text-sm text-gray-500">{user?.email}</p>
                        </div>
                      </div>
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
