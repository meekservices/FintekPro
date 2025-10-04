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
  PanelLeftOpen,
  Globe,
  Receipt,
  Crown,
  Landmark,
  DollarSign,
  UserCheck,
  Settings
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/use-cart";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface NavigationItem {
  name: string;
  href?: string;
  icon: any;
  description?: string;
  badge?: string;
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

  // FintekPro comprehensive navigation structure
  const navigationGroups: NavigationGroup[] = [
    {
      title: "Core Platform",
      items: [
        {
          name: "Dashboard",
          href: "/",
          icon: Home,
          description: "Portfolio overview and market summary"
        },
        {
          name: "Store",
          icon: Store,
          description: "Financial products and services marketplace",
          subItems: [
            { name: "All Products", href: "/store", description: "View all financial products" },
            { name: "Mutual Funds", href: "/store?tab=mutual-funds", description: "Domestic and international funds" },
            { name: "IPO & Pre-IPO", href: "/store?tab=ipo", description: "Public offerings and pre-IPO opportunities" },
            { name: "Unlisted", href: "/store?tab=unlisted", description: "Unlisted shares and securities" },
            { name: "Debentures", href: "/store?tab=debentures", description: "Non-convertible debentures and bonds" },
            { name: "MLDs", href: "/store?tab=mlds", description: "Market linked debentures" },
            { name: "Global Products", href: "/store?tab=global", description: "International stocks and funds" },
            { name: "Insurance Plans", href: "/store?tab=insurance", description: "Life, health, motor insurance" },
            { name: "Banking Products", href: "/store?tab=banking", description: "Accounts, loans, credit cards" },
            { name: "Professional Services", href: "/store?tab=services", description: "Advisory, consultation, research" }
          ]
        }
      ]
    },
    {
      title: "Investment Solutions",
      items: [
        {
          name: "Wealth Management",
          icon: Briefcase,
          description: "AI-powered investment planning and portfolio management",
          subItems: [
            { name: "Investment Recommendations", href: "/wealth-management", description: "AI allocation system for ₹72,000 surplus", badge: "AI POWERED" },
            { name: "Goal Planning", href: "/wealth-management?tab=goals", description: "Financial goal setting and tracking" },
            { name: "Risk Assessment", href: "/wealth-management?tab=risk", description: "Portfolio risk analysis" },
            { name: "Asset Allocation", href: "/wealth-management?tab=allocation", description: "Core, Alternative, Premium tiers" }
          ]
        },
        {
          name: "Trading & Investments",
          icon: TrendingUp,
          description: "Domestic and global trading platform",
          subItems: [
            { name: "NSE/BSE Trading", href: "/broking", description: "Equity and derivatives trading" },
            { name: "Global Markets", href: "/global-trading", description: "US, Europe, Asia stocks" },
            { name: "IPO Center", href: "/ipo", description: "Current and pre-IPO opportunities" },
            { name: "F&O Trading", href: "/derivatives", description: "Futures and options" },
            { name: "Commodities", href: "/commodities", description: "MCX and NCDEX trading" },
            { name: "Portfolio", href: "/portfolio", description: "Holdings and performance" }
          ]
        }
      ]
    },
    {
      title: "Banking & Financial Services",
      items: [
        {
          name: "Loans and credit",
          icon: CreditCard,
          description: "Comprehensive loan marketplace and banking products",
          subItems: [
            { name: "Loan Recommendations", href: "/loan-recommendations", description: "AI-powered personalized loan suggestions", badge: "AI POWERED" },
            { name: "Bajaj Finance", href: "/bajaj-finance", description: "Personal loans, business loans, FDs" },
            { name: "Tata Capital", href: "/tata-capital", description: "Home loans, LAP, vehicle loans" },
            { name: "Personal Loans", href: "/loans?category=personal", description: "Quick approval personal loans" },
            { name: "Home Loans", href: "/loans?category=home", description: "Best home loan rates" },
            { name: "Business Loans", href: "/loans?category=business", description: "SME and corporate financing" },
            { name: "Loan Comparison", href: "/loan-comparison", description: "Compare offers from multiple lenders" },
            { name: "CIBIL Score", href: "/cibil", description: "Credit monitoring and improvement" }
          ]
        },
        {
          name: "GIFT City IFSC",
          icon: Crown,
          description: "Premium international financial services",
          subItems: [
            { name: "GIFT City AIFs", href: "/gift-city/aif", description: "Alternative Investment Funds with tax benefits", badge: "PREMIUM" },
            { name: "IFSC Banking", href: "/gift-city/banking", description: "ICICI, HDFC, HSBC international units" },
            { name: "Tax Advantages", href: "/gift-city/tax-benefits", description: "10-year tax holiday and exemptions" },
            { name: "Global Exposure", href: "/gift-city/global", description: "International investment structures" },
            { name: "Minimum Investment", href: "/gift-city/eligibility", description: "USD 150K+ investment opportunities" }
          ]
        }
      ]
    },
    {
      title: "Specialized Services",
      items: [
        {
          name: "NRI Services",
          icon: Globe,
          description: "Complete NRI financial ecosystem",
          subItems: [
            { name: "NRI Onboarding", href: "/nri/onboarding", description: "Digital account opening with video KYC" },
            { name: "NRE/NRO Accounts", href: "/nri/banking", description: "Non-resident banking solutions" },
            { name: "FCNR Deposits", href: "/nri/deposits", description: "Foreign currency deposits" },
            { name: "International Remittance", href: "/nri/remittance", description: "Money transfer to India" },
            { name: "NRI Investments", href: "/nri/investments", description: "Mutual funds, stocks, real estate" },
            { name: "Tax & Compliance", href: "/nri/tax", description: "FATCA, CRS, dual taxation" }
          ]
        },
        {
          name: "ITR & Tax Services",
          icon: Receipt,
          description: "AI-powered tax filing and compliance",
          href: "/tax-hub",
          badge: "NEW",
          subItems: [
            { name: "Smart Tax Hub", href: "/tax-hub", description: "Unified AI-powered tax dashboard", badge: "NEW" },
            { name: "Tax Smart Filing", href: "/tax", description: "Intelligent ITR filing with auto-fill" },
            { name: "ITR Services", href: "/itr-tax-services", description: "ITR-1 to ITR-7 filing services" },
            { name: "Tax Data Center", href: "/tax-data-center", description: "AIS, 26AS, mutual fund data" },
            { name: "Tax Documents", href: "/tax-documents", description: "Form 16, 26AS, TDS certificates" },
            { name: "Prefilled ITR", href: "/itr-prefilled", description: "Auto-populated tax forms" }
          ]
        }
      ]
    },
    {
      title: "Profile & Tools",
      items: [
        {
          name: "Profile & KYC",
          icon: UserCheck,
          description: "Complete profile management and compliance",
          subItems: [
            { name: "Basic Information", href: "/profile?tab=basic", description: "Personal and contact details" },
            { name: "Identity & Documents", href: "/profile?tab=kyc", description: "KYC and CKYC verification" },
            { name: "Address Details", href: "/profile?tab=address", description: "Residential and correspondence address" },
            { name: "Financial Profile", href: "/profile?tab=financial", description: "Income, occupation, risk profile" },
            { name: "AML & Compliance", href: "/profile?tab=compliance", description: "PEP, sanctions screening" },
            { name: "Banking & Demat", href: "/profile?tab=accounts", description: "Account details and nominees" }
          ]
        },
        {
          name: "Tools & Calculators",
          icon: Calculator,
          description: "Financial planning and analysis tools",
          subItems: [
            { name: "SIP Calculator", href: "/calculators?tool=sip", description: "Systematic investment planning" },
            { name: "EMI Calculator", href: "/calculators?tool=emi", description: "Loan EMI and eligibility" },
            { name: "Tax Calculator", href: "/calculators?tool=tax", description: "Tax planning and optimization" },
            { name: "Retirement Planner", href: "/calculators?tool=retirement", description: "Retirement corpus planning" },
            { name: "Goal Planner", href: "/calculators?tool=goals", description: "Financial goal achievement" },
            { name: "All Calculators", href: "/calculators", description: "Complete calculator suite" }
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
      {/* Left Sidebar with Sticky Positioning */}
      <aside className={`sticky top-0 h-screen bg-white shadow-lg border-r border-gray-200 overflow-y-auto transition-all duration-300 ease-in-out ${
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
              {/* Cart Button */}
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