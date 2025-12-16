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
  Settings,
  Settings2,
  Users,
  Bell,
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/use-cart";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface NavigationSubItem {
  name: string;
  href?: string;
  description?: string;
  badge?: string;
  subItems?: {
    name: string;
    href: string;
    description?: string;
    badge?: string;
  }[];
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: any;
  description?: string;
  badge?: string;
  subItems?: NavigationSubItem[];
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
  const [openSubItems, setOpenSubItems] = useState<string[]>([]);
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
      await apiRequest("/api/logout", { method: "POST" });
      queryClient.setQueryData(["/api/user"], null);
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

  const toggleSubItem = (subItemName: string) => {
    setOpenSubItems(prev => 
      prev.includes(subItemName) 
        ? prev.filter(s => s !== subItemName)
        : [...prev, subItemName]
    );
  };

  // FintekPro process flow-based navigation structure
  const navigationGroups: NavigationGroup[] = [
    {
      title: "Getting Started",
      items: [
        {
          name: "Dashboard",
          href: "/",
          icon: Home,
          description: "Portfolio overview and market summary"
        },
        {
          name: "Profile & KYC",
          icon: UserCheck,
          description: "Complete your profile and KYC verification",
          subItems: [
            { name: "My Profile", href: "/profile", description: "Personal info, KYC status & verification", badge: "UNIFIED" },
            { name: "My Net Worth", href: "/net-worth", description: "Complete wealth tracking with assets, liabilities & AI insights", badge: "NEW" },
            { name: "Onboarding", href: "/onboarding", description: "PAN-based intelligent KYC for all entity types" }
          ]
        }
      ]
    },
    {
      title: "Research & Planning",
      items: [
        {
          name: "Wealth Management",
          icon: Briefcase,
          description: "AI-powered investment planning and portfolio management",
          subItems: [
            { name: "My Portfolio", href: "/portfolio", description: "Holdings and performance tracking" },
            { name: "Asset Allocation", href: "/wealth-management?tab=dashboard", description: "Core, Alternative, Premium investments" },
            { name: "AI Recommendations", href: "/wealth-management?tab=recommendations", description: "Smart allocation system", badge: "AI POWERED" },
            { name: "Goal Planning", href: "/wealth-management?tab=goals", description: "Financial goal setting" },
            { name: "Retirement Planning", href: "/wealth-management?tab=retirement", description: "Retirement corpus planning" },
            { name: "Obligations", href: "/wealth-management?tab=obligations", description: "Track loans, EMIs & recurring payments" }
          ]
        },
        {
          name: "Tools & Reports",
          icon: Calculator,
          description: "Financial planning and analysis tools",
          subItems: [
            { name: "Calculators", href: "/calculators", description: "SIP, EMI, Tax & more calculators" },
            { name: "Reports Hub", href: "/reports", description: "Transaction, capital gains & compliance reports" }
          ]
        }
      ]
    },
    {
      title: "Products & Marketplace",
      items: [
        {
          name: "Store",
          icon: Store,
          description: "Financial products and services marketplace",
          subItems: [
            { name: "All Products", href: "/store", description: "View all financial products" },
            { name: "AIF", href: "/aif", description: "Alternative Investment Funds - Vendor-supplied (₹10L min)", badge: "PREMIUM" },
            { name: "PMS", href: "/wealth-management", description: "Portfolio Management Services - AMC-supplied (₹50L min)", badge: "ELITE" },
            { name: "Mutual Funds", href: "/mutual-funds", description: "Domestic and international funds" },
            { name: "IPO & Pre-IPO", href: "/ipo", description: "Public offerings and opportunities" },
            { name: "Unlisted Shares", href: "/unlisted", description: "Unlisted securities" },
            { name: "Bonds & NCDs", href: "/bonds", description: "Non-convertible debentures" },
            { name: "MLDs", href: "/mlds", description: "Market linked debentures" },
            { name: "Global Products", href: "/global-trading", description: "International stocks and funds" },
            { name: "Insurance Hub", href: "/insurance", description: "Life, health, motor insurance" },
            { name: "Banking Products", href: "/banking-products", description: "Accounts, deposits, cards" },
            { name: "Professional Services", href: "/professional-services", description: "Advisory and research" }
          ]
        }
      ]
    },
    {
      title: "Investing & Trading",
      items: [
        {
          name: "Trading & Investments",
          icon: TrendingUp,
          description: "Domestic and global trading platform",
          subItems: [
            { name: "NSE/BSE Trading", href: "/broking", description: "Equity and derivatives trading" },
            { name: "Global Markets", href: "/global-trading", description: "US, Europe, Asia stocks" },
            { name: "IPO Center", href: "/ipo", description: "Current and pre-IPO opportunities" },
            { name: "F&O Trading", href: "/derivatives", description: "Futures and options" },
            { name: "Commodities", href: "/commodities", description: "MCX and NCDEX trading" }
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
          description: "Comprehensive loan marketplace",
          subItems: [
            { name: "Personal Loan", href: "/loans?type=personal", description: "Instant approval, minimal docs" },
            { name: "Home Loan", href: "/loans?type=home", description: "Best rates for property purchase" },
            { name: "Car Loan", href: "/loans?type=car", description: "New and used vehicle financing" },
            { name: "Loan Against Property", href: "/loans?type=lap", description: "Leverage your property value" },
            { name: "Loan Against Securities", href: "/loans?type=las", description: "Pledge shares/mutual funds" },
            { name: "Business Loan", href: "/loans?type=business", description: "SME and corporate financing" },
            { name: "Education Loan", href: "/loans?type=education", description: "Study in India or abroad" },
            { name: "Gold Loan", href: "/loans?type=gold", description: "Quick cash against gold" },
            { name: "Credit Card", href: "/credit-cards", description: "Compare and apply for cards" },
            { name: "Loan Comparison", href: "/loan-comparison", description: "Compare offers from lenders" }
          ]
        },
        {
          name: "Credit Management",
          icon: BarChart3,
          description: "Credit score and report management",
          subItems: [
            { name: "CIBIL Score", href: "/cibil", description: "Credit monitoring and improvement" },
            { name: "Credit Report", href: "/credit-report", description: "Detailed credit history" }
          ]
        },
        {
          name: "GIFT City IFSC",
          icon: Crown,
          description: "Premium international financial services",
          subItems: [
            { name: "GIFT City Overview", href: "/gift-city", description: "Premium international services", badge: "PREMIUM" },
            { name: "AIFs", href: "/gift-city?tab=aif", description: "Alternative Investment Funds" },
            { name: "IFSC Banking", href: "/gift-city?tab=banking", description: "International banking units" },
            { name: "Tax Benefits", href: "/gift-city?tab=tax-benefits", description: "10-year tax holiday" },
            { name: "Global Exposure", href: "/gift-city?tab=global", description: "International structures" }
          ]
        }
      ]
    },
    {
      title: "Tax & Compliance",
      items: [
        {
          name: "ITR & Tax Services",
          icon: Receipt,
          description: "AI-powered tax filing and compliance",
          badge: "NEW",
          subItems: [
            {
              name: "Filing Workflows",
              description: "Quick and intelligent tax filing options",
              subItems: [
                { name: "One-Click Tax Filing", href: "/one-click-tax-filing", description: "Quick 6-step wizard", badge: "⚡ RECOMMENDED" },
                { name: "Tax Smart Filing", href: "/tax", description: "Consent-driven filing with AI optimization" }
              ]
            },
            {
              name: "AI Insights & Prefill",
              description: "Smart tax assistance and auto-population",
              subItems: [
                { name: "Smart Tax Hub", href: "/tax-hub", description: "AI dashboard with health score", badge: "NEW" },
                { name: "Prefilled ITR", href: "/itr-prefilled", description: "Review & edit auto-populated forms" }
              ]
            },
            {
              name: "Data & Records",
              description: "Tax data sources and document management",
              subItems: [
                { name: "Tax Data Center", href: "/tax-data-center", description: "View AIS, 26AS, Form 16" },
                { name: "Tax Documents", href: "/tax-documents", description: "Manage uploaded documents" }
              ]
            },
            {
              name: "ITR Filing Services",
              href: "/itr-tax-services",
              description: "Comprehensive ITR-1 to ITR-7 filing services"
            },
            {
              name: "TDS Compliance",
              href: "/tds-compliance",
              description: "TDS calculator, Form 16/16A, return filing",
              badge: "NEW"
            }
          ]
        }
      ]
    },
    {
      title: "Utilities & Services",
      items: [
        {
          name: "Bill Payments (BBPS)",
          icon: Receipt,
          description: "Pay utility bills with auto expense tracking",
          badge: "INTEGRATED",
          subItems: [
            { name: "Pay Bills", href: "/bbps", description: "Electricity, water, gas, mobile, DTH, broadband" },
            { name: "Expenses & Budgets", href: "/expenses-budgets", description: "AI-powered expense tracking and budgeting", badge: "AI POWERED" },
            { name: "Bill History", href: "/bbps?tab=history", description: "Transaction history and receipts" },
            { name: "Recurring Payments", href: "/bbps?tab=recurring", description: "Set up auto-pay for bills" }
          ]
        }
      ]
    },
    {
      title: "Family & Collaboration",
      items: [
        {
          name: "Family Collaboration",
          icon: Users,
          description: "Collaborate with family on finances",
          subItems: [
            { name: "My Families", href: "/families", description: "View and manage family groups" },
            { name: "Shared Goals", href: "/families?tab=goals", description: "Track family financial goals" },
            { name: "Family Budgets", href: "/families?tab=budgets", description: "Manage household budgets" }
          ]
        }
      ]
    },
    {
      title: "Monitoring & Alerts",
      items: [
        {
          name: "Alerts & Notifications",
          icon: Bell,
          description: "Market alerts and spending notifications",
          badge: "NEW",
          subItems: [
            { name: "My Alerts", href: "/alerts", description: "View and manage active alerts" },
            { name: "Alert History", href: "/alerts?tab=history", description: "Past notifications and triggers" },
            { name: "Notification Settings", href: "/alerts?tab=settings", description: "Configure alert channels" },
            { name: "Alert Templates", href: "/alerts?tab=templates", description: "Pre-configured alert types" }
          ]
        }
      ]
    },
    {
      title: "Settings & Support",
      items: [
        {
          name: "Settings",
          href: "/settings",
          icon: Settings2,
          description: "Account and application settings"
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
      <aside className={`sticky top-0 h-screen bg-card shadow-lg border-r border-border overflow-y-auto transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo and Toggle */}
          <div className="flex items-center h-16 px-4 border-b border-border justify-between">
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
            <div className="flex items-center space-x-3 p-4 border-b border-border bg-muted/50">
              {user?.profileImageUrl && (
                <img 
                  src={user.profileImageUrl} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate text-sm">UID: {user?.userId || user?.id || 'N/A'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.previousLoginAt 
                    ? `Last login: ${new Date(user.previousLoginAt).toLocaleString('en-IN', { 
                        dateStyle: 'short', 
                        timeStyle: 'short' 
                      })}`
                    : 'First login'}
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="p-2 border-b border-border">
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
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
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
                              className={`${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-between'} ${
                                item.name === 'Store' 
                                  ? 'bg-green-600 hover:bg-green-700 text-white hover:text-white dark:bg-green-600 dark:hover:bg-green-700' 
                                  : ''
                              }`}
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
                                <div key={subItem.name}>
                                  {subItem.href ? (
                                    <Link href={subItem.href}>
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
                                  ) : (
                                    <Collapsible 
                                      open={openSubItems.includes(subItem.name)} 
                                      onOpenChange={() => toggleSubItem(subItem.name)}
                                    >
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="w-full justify-between text-xs"
                                          data-testid={`sidebar-nav-subgroup-${subItem.name.toLowerCase().replace(/\s+/g, '-')}`}
                                        >
                                          <span>{subItem.name}</span>
                                          {openSubItems.includes(subItem.name) ? 
                                            <ChevronDown className="h-3 w-3" /> : 
                                            <ChevronRight className="h-3 w-3" />
                                          }
                                        </Button>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="space-y-1 ml-4">
                                        {subItem.subItems?.map((nestedItem) => (
                                          <Link key={nestedItem.name} href={nestedItem.href}>
                                            <Button
                                              variant={isItemActive(nestedItem.href) ? "default" : "ghost"}
                                              size="sm"
                                              className="w-full justify-start text-xs"
                                              data-testid={`sidebar-nav-${nestedItem.name.toLowerCase().replace(/\s+/g, '-')}`}
                                            >
                                              {nestedItem.name}
                                              {nestedItem.badge && (
                                                <Badge variant="secondary" className="ml-auto text-xs">
                                                  {nestedItem.badge}
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