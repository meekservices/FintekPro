import { useState, useEffect } from "react";
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
  LogOut,
  PanelLeftClose,
  PanelLeftOpen
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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('navigation-collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const { user, isAuthenticated, isLoading } = useAuth();
  const { cart } = useCart();

  useEffect(() => {
    try {
      localStorage.setItem('navigation-collapsed', JSON.stringify(isCollapsed));
      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new CustomEvent('navigation-state-changed', { detail: { isCollapsed } }));
    } catch {
      // Ignore localStorage errors
    }
  }, [isCollapsed]);

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
    <>
      {/* Left Sidebar for All Screen Sizes */}
      <aside className={`fixed left-0 top-0 h-full bg-white shadow-lg border-r border-gray-200 z-50 overflow-y-auto transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo and Toggle */}
          <div className="flex items-center h-16 px-4 border-b border-gray-200 justify-between">
            {!isCollapsed && (
              <Link href="/">
                <h1 className="text-xl font-bold text-finance-blue cursor-pointer" data-testid="logo">
                  FintekPro
                </h1>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              data-testid="toggle-sidebar"
              className="flex-shrink-0"
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          {/* User Profile Section */}
          {isAuthenticated && user && !isCollapsed && (
            <div className="flex items-center space-x-3 p-4 border-b border-gray-200 bg-gray-50">
              {user?.profileImageUrl && (
                <img 
                  src={user.profileImageUrl} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate text-sm">
                  {user?.firstName || 'Client'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="p-2 border-b border-gray-200">
            <div className="space-y-1">
              {/* Store Button */}
              <Link href="/store">
                <Button 
                  variant="default" 
                  size="sm"
                  className={`bg-green-600 hover:bg-green-700 text-white ${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-start'}`}
                  data-testid="sidebar-store-button"
                >
                  <Store className="h-4 w-4" />
                  {!isCollapsed && <span className="ml-2">Store</span>}
                </Button>
              </Link>
              
              {/* Cart Button */}
              {isAuthenticated && (
                <Link href="/cart">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={`relative ${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-start'}`}
                    data-testid="sidebar-cart-button"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {!isCollapsed && <span className="ml-2">Cart</span>}
                    {cart && cart.totalItems > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 text-xs flex items-center justify-center">
                        {cart.totalItems}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Navigation Content */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-4">
              {navigationGroups.map((group) => (
                <div key={group.title} className="space-y-2">
                  {!isCollapsed && (
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">
                      {group.title}
                    </h3>
                  )}
                  {group.items.map((item) => (
                    <div key={item.name}>
                      {item.href ? (
                        <Link href={item.href}>
                          <Button
                            variant={isItemActive(item.href) ? "default" : "ghost"}
                            size="sm"
                            className={`${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-start'}`}
                            data-testid={`sidebar-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                            title={isCollapsed ? item.name : undefined}
                          >
                            <item.icon className="h-4 w-4" />
                            {!isCollapsed && <span className="ml-3">{item.name}</span>}
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
                              size="sm"
                              className={`${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-between'}`}
                              data-testid={`sidebar-nav-group-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                              title={isCollapsed ? item.name : undefined}
                            >
                              <div className="flex items-center">
                                <item.icon className="h-4 w-4" />
                                {!isCollapsed && <span className="ml-3">{item.name}</span>}
                              </div>
                              {!isCollapsed && (
                                openGroups.includes(item.name) ? 
                                  <ChevronDown className="h-3 w-3" /> : 
                                  <ChevronRight className="h-3 w-3" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          {!isCollapsed && (
                            <CollapsibleContent className="space-y-1 ml-4">
                              {item.subItems?.map((subItem) => (
                                <Link key={subItem.name} href={subItem.href}>
                                  <Button
                                    variant={isItemActive(subItem.href) ? "default" : "ghost"}
                                    size="sm"
                                    className="w-full justify-start text-xs"
                                    data-testid={`sidebar-nav-${subItem.name.toLowerCase().replace(/\s+/g, '-')}`}
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
                          )}
                        </Collapsible>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="p-2 border-t border-gray-200">
            {isAuthenticated ? (
              <div className="space-y-1">
                <Link href="/profile">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-start'}`}
                    data-testid="sidebar-profile-button"
                    title={isCollapsed ? "Profile" : undefined}
                  >
                    <UserIcon className="h-4 w-4" />
                    {!isCollapsed && <span className="ml-3">Profile</span>}
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={`${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-start'}`}
                  onClick={handleLogout}
                  data-testid="sidebar-logout-button"
                  title={isCollapsed ? "Logout" : undefined}
                >
                  <LogOut className="h-4 w-4" />
                  {!isCollapsed && <span className="ml-3">Logout</span>}
                </Button>
              </div>
            ) : (
              <Link href="/auth">
                <Button 
                  className={`${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-start'}`}
                  size="sm"
                  data-testid="sidebar-login-button"
                  title={isCollapsed ? "Login" : undefined}
                >
                  <UserIcon className="h-4 w-4" />
                  {!isCollapsed && <span className="ml-3">Login</span>}
                </Button>
              </Link>
            )}
            
            {/* Support */}
            <Link href="/support">
              <Button 
                variant="ghost" 
                size="sm"
                className={`${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-start'}`}
                data-testid="sidebar-support-button"
                title={isCollapsed ? "Support & Help" : undefined}
              >
                <HelpCircle className="h-4 w-4" />
                {!isCollapsed && <span className="ml-3">Support & Help</span>}
              </Button>
            </Link>
          </div>
        </div>
      </aside>

    </>
  );
}