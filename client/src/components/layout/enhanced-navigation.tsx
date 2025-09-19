import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { 
  Menu, 
  ChevronDown, 
  ChevronRight,
  TrendingUp, 
  PieChart, 
  CreditCard, 
  Shield, 
  FileText, 
  Calculator,
  Building2,
  Banknote,
  Target,
  Activity,
  BarChart3,
  Briefcase,
  Home,
  Store,
  ShoppingCart,
  HelpCircle,
  User as UserIcon,
  LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/use-cart";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface NavigationItem {
  name: string;
  href?: string;
  icon: any;
  description?: string;
  subItems?: {
    name: string;
    href: string;
    description?: string;
    badge?: string;
  }[];
}

interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

export function EnhancedNavigation() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const { user, isAuthenticated, isLoading } = useAuth();
  const { cart } = useCart();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev => 
      prev.includes(groupTitle) 
        ? prev.filter(g => g !== groupTitle)
        : [...prev, groupTitle]
    );
  };

  // ICICI Direct-inspired navigation structure
  const navigationGroups: NavigationGroup[] = [
    {
      title: "Trading & Markets",
      items: [
        {
          name: "Dashboard",
          href: "/",
          icon: Home,
          description: "Market overview and quick actions"
        },
        {
          name: "Portfolio Management",
          icon: PieChart,
          description: "Holdings, performance and analytics",
          subItems: [
            { name: "My Portfolio", href: "/portfolio", description: "View holdings and performance" },
            { name: "Asset Allocation", href: "/portfolio?tab=allocation", description: "Diversification analysis" },
            { name: "Capital Gains", href: "/capital-gains", description: "Tax reports and analytics" },
            { name: "Trade Book", href: "/portfolio?tab=trades", description: "Transaction history" }
          ]
        },
        {
          name: "Live Markets",
          icon: TrendingUp,
          description: "Real-time market data and trading",
          subItems: [
            { name: "Market Dashboard", href: "/markets", description: "Live market data" },
            { name: "Broking Terminal", href: "/broking", description: "Advanced trading platform" },
            { name: "Technical Charts", href: "/markets?view=charts", description: "Charting and analysis" },
            { name: "Market Movers", href: "/markets?tab=movers", description: "Top gainers and losers" }
          ]
        },
        {
          name: "IPO Center",
          icon: Target,
          description: "IPO and pre-IPO opportunities",
          subItems: [
            { name: "Current IPOs", href: "/ipo", description: "Apply for live IPOs" },
            { name: "Pre-IPO Investments", href: "/pre-ipo", description: "Unlisted securities" },
            { name: "Unlisted Shares", href: "/unlisted", description: "Secondary market trades" }
          ]
        }
      ]
    },
    {
      title: "Investments",
      items: [
        {
          name: "Mutual Funds",
          icon: BarChart3,
          description: "SIP, lumpsum and fund research",
          subItems: [
            { name: "Invest Now", href: "/mutual-funds", description: "Browse and invest in funds" },
            { name: "SIP Calculator", href: "/calculators?tool=sip", description: "Plan systematic investments" },
            { name: "Fund Research", href: "/mutual-funds?tab=research", description: "Detailed fund analysis" },
            { name: "My SIPs", href: "/mutual-funds?tab=sips", description: "Manage SIP investments" }
          ]
        },
        {
          name: "Wealth Management",
          icon: Briefcase,
          description: "Premium investment services",
          subItems: [
            { name: "InvestSmart", href: "/investsmart", description: "Goal-based investing" },
            { name: "AIF Investments", href: "/aif", description: "Alternative Investment Funds" },
            { name: "Investment Proposals", href: "/proposals", description: "Custom investment plans" }
          ]
        }
      ]
    },
    {
      title: "Financial Services",
      items: [
        {
          name: "Loans & Credit",
          icon: CreditCard,
          description: "Personal, home and business loans",
          subItems: [
            { name: "All Loans", href: "/loans", description: "Compare and apply" },
            { name: "Bajaj Finance", href: "/bajaj-finance", description: "EMI calculator and loans" },
            { name: "Tata Capital", href: "/tata-capital", description: "Business and personal loans" },
            { name: "Loan Dashboard", href: "/loan-dashboard", description: "Track applications" }
          ]
        },
        {
          name: "Insurance",
          icon: Shield,
          description: "Life, health and motor insurance",
          subItems: [
            { name: "PolicyBazaar", href: "/policybazaar", description: "Compare insurance plans" },
            { name: "CIBIL Score", href: "/cibil", description: "Credit score monitoring" }
          ]
        },
        {
          name: "Banking Services",
          icon: Building2,
          description: "Net banking and payments",
          subItems: [
            { name: "ICICI Banking", href: "/icici-banking", description: "Account services" },
            { name: "HDFC Banking", href: "/hdfc-banking", description: "Account services" },
            { name: "BBPS Payments", href: "/bbps", description: "Bill payment services" },
            { name: "DigiLocker", href: "/digilocker", description: "Document management" }
          ]
        }
      ]
    },
    {
      title: "Tools & Services",
      items: [
        {
          name: "Financial Calculators",
          icon: Calculator,
          description: "SIP, EMI, tax and retirement planning",
          subItems: [
            { name: "All Calculators", href: "/calculators", description: "Complete calculator suite" },
            { name: "SIP Calculator", href: "/calculators?tool=sip", description: "Systematic investment planning" },
            { name: "EMI Calculator", href: "/calculators?tool=emi", description: "Loan EMI calculation" },
            { name: "Tax Calculator", href: "/calculators?tool=tax", description: "Tax planning tools" }
          ]
        },
        {
          name: "Reports & Analysis",
          icon: FileText,
          description: "Research and market insights",
          subItems: [
            { name: "Market Research", href: "/agricultural-insights", description: "Sector analysis" },
            { name: "NSDL Services", href: "/nsdl-services", description: "Demat account services" },
            { name: "CDSL Services", href: "/cdsl-services", description: "Demat account services" }
          ]
        },
        {
          name: "Store & Products",
          icon: Store,
          description: "Financial products marketplace",
          subItems: [
            { name: "Product Store", href: "/store", description: "Browse financial products" },
            { name: "Shopping Cart", href: "/cart", description: "Review selected products" }
          ]
        }
      ]
    }
  ];

  // Add admin navigation for admin users
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  if (isAdmin) {
    navigationGroups.push({
      title: "Administration",
      items: [
        {
          name: "Admin Panel",
          href: "/admin",
          icon: UserIcon,
          description: "System administration"
        },
        {
          name: "Supplier Management",
          href: "/suppliers",
          icon: Building2,
          description: "Manage suppliers and vendors"
        }
      ]
    });
  }

  const isItemActive = (href: string) => {
    if (href === "/" && location === "/") return true;
    if (href !== "/" && location.startsWith(href)) return true;
    return false;
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/">
              <h1 className="text-2xl font-bold text-finance-blue cursor-pointer" data-testid="logo">
                FintekPro
              </h1>
            </Link>
          </div>

          {/* Desktop Navigation - Quick Links */}
          <nav className="hidden lg:flex space-x-1">
            <Link href="/markets">
              <Button 
                variant={isItemActive("/markets") ? "default" : "ghost"} 
                size="sm"
                className="text-sm"
                data-testid="nav-markets"
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Markets
              </Button>
            </Link>
            <Link href="/portfolio">
              <Button 
                variant={isItemActive("/portfolio") ? "default" : "ghost"} 
                size="sm"
                className="text-sm"
                data-testid="nav-portfolio"
              >
                <PieChart className="h-4 w-4 mr-1" />
                Portfolio
              </Button>
            </Link>
            <Link href="/mutual-funds">
              <Button 
                variant={isItemActive("/mutual-funds") ? "default" : "ghost"} 
                size="sm"
                className="text-sm"
                data-testid="nav-mutual-funds"
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Mutual Funds
              </Button>
            </Link>
            <Link href="/loans">
              <Button 
                variant={isItemActive("/loans") ? "default" : "ghost"} 
                size="sm"
                className="text-sm"
                data-testid="nav-loans"
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Loans
              </Button>
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-2">
            {/* Store Button */}
            <Link href="/store">
              <Button 
                variant="default" 
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="header-store-button"
              >
                <Store className="h-4 w-4 mr-1" />
                Store
              </Button>
            </Link>
            
            {/* Cart Button */}
            {isAuthenticated && (
              <Link href="/cart">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="relative"
                  data-testid="header-cart-button"
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Cart
                  {cart && cart.totalItems > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                      {cart.totalItems}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}

            {/* User Menu */}
            {isLoading ? (
              <div className="hidden md:block w-20 h-9 bg-gray-200 animate-pulse rounded"></div>
            ) : isAuthenticated ? (
              <div className="hidden md:flex items-center space-x-2">
                <div className="flex items-center space-x-2 px-3 py-1 bg-gray-50 rounded-lg">
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
                  <Button variant="outline" size="sm" data-testid="profile-button">
                    <UserIcon className="h-4 w-4" />
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  data-testid="logout-button"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Link href="/auth">
                <Button className="hidden md:inline-flex" data-testid="login-button">
                  <UserIcon className="h-4 w-4 mr-2" />
                  Login
                </Button>
              </Link>
            )}

            {/* Navigation Menu - Available on all screens */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="navigation-menu-trigger">
                  <Menu className="h-5 w-5" />
                  <span className="hidden md:inline ml-2">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 lg:w-96 overflow-y-auto">
                <div className="flex flex-col space-y-6 pt-6">
                  {/* User Profile Section */}
                  {isAuthenticated && user && (
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                      {user?.profileImageUrl && (
                        <img 
                          src={user.profileImageUrl} 
                          alt="Profile" 
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {user?.firstName || 'Client'}
                        </p>
                        <p className="text-sm text-gray-500">{user?.email}</p>
                      </div>
                    </div>
                  )}

                  {/* Navigation Groups */}
                  {navigationGroups.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-2">
                        {group.title}
                      </h3>
                      {group.items.map((item) => (
                        <div key={item.name}>
                          {item.href ? (
                            <Link href={item.href}>
                              <Button
                                variant={isItemActive(item.href) ? "default" : "ghost"}
                                className="w-full justify-start"
                                onClick={() => setIsOpen(false)}
                                data-testid={`mobile-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                <item.icon className="h-4 w-4 mr-3" />
                                {item.name}
                              </Button>
                            </Link>
                          ) : (
                            <Collapsible 
                              open={openGroups.includes(item.name)} 
                              onOpenChange={() => toggleGroup(item.name)}
                            >
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="w-full justify-between"
                                  data-testid={`mobile-nav-group-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <div className="flex items-center">
                                    <item.icon className="h-4 w-4 mr-3" />
                                    {item.name}
                                  </div>
                                  {openGroups.includes(item.name) ? 
                                    <ChevronDown className="h-4 w-4" /> : 
                                    <ChevronRight className="h-4 w-4" />
                                  }
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-1 ml-4">
                                {item.subItems?.map((subItem) => (
                                  <Link key={subItem.name} href={subItem.href}>
                                    <Button
                                      variant={isItemActive(subItem.href) ? "default" : "ghost"}
                                      size="sm"
                                      className="w-full justify-start"
                                      onClick={() => setIsOpen(false)}
                                      data-testid={`mobile-nav-${subItem.name.toLowerCase().replace(/\s+/g, '-')}`}
                                    >
                                      {subItem.name}
                                      {subItem.badge && (
                                        <Badge variant="secondary" className="ml-auto text-xs">
                                          {subItem.badge}
                                        </Badge>
                                      )}
                                    </Button>
                                  </Link>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Mobile Auth Actions */}
                  {isAuthenticated ? (
                    <div className="space-y-2 pt-4 border-t">
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
                    <div className="pt-4 border-t">
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
                    </div>
                  )}

                  {/* Support */}
                  <div className="pt-4 border-t">
                    <Link href="/support">
                      <Button 
                        variant="ghost" 
                        className="w-full"
                        onClick={() => setIsOpen(false)}
                        data-testid="mobile-support-button"
                      >
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Support & Help
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}