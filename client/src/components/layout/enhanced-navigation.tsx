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
  AlertCircle,
  AlertTriangle,
  FolderOpen,
  Wallet,
  ClipboardList,
  LineChart,
  Package,
  FileCheck,
  Building,
  Coins,
  ScrollText,
  CircleDollarSign,
  UserCog,
  ClipboardCheck,
  BadgePercent,
  Scale,
  Folder,
  LayoutDashboard,
  Sparkles
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
      // Redirect to auth page for consistent security across all portals
      window.location.href = "/auth";
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

  // Role checks
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  const isAgent = user?.roles?.includes('agent') || user?.roles?.includes('partner');
  const isPremium = (user as any)?.kycLevel === 'enhanced' || (user as any)?.kycLevel === 'accredited';
  const isKycComplete = (user as any)?.kycStatus === 'verified' || (user as any)?.kycStatus === 'approved';

  // Store sub-items organized by category
  const storeSubItems: NavigationSubItem[] = [
    // Premium products - only visible to premium users
    ...(isPremium ? [
      { name: "AIF", href: "/aif", description: "Alternative Investment Funds (₹1Cr min)", badge: "PREMIUM" },
      { name: "PMS", href: "/pms", description: "Portfolio Management Services (₹50L min)", badge: "ELITE" },
    ] : []),
    // Equity products
    { name: "Mutual Funds", href: "/mutual-funds", description: "Domestic & international funds" },
    { name: "IPO & Pre-IPO", href: "/ipo", description: "Public offerings" },
    { name: "Unlisted Shares", href: "/unlisted", description: "Pre-IPO securities" },
    // Fixed income
    { name: "Bonds & NCDs", href: "/bonds", description: "Fixed income securities" },
    { name: "MLDs", href: "/mlds", description: "Market Linked Debentures" },
    // Insurance
    { name: "Insurance Hub", href: "/insurance", description: "Life, health, general insurance" }
  ];

  // Trading sub-items (requires KYC)
  const tradingSubItems: NavigationSubItem[] = isKycComplete ? [
    { name: "Equities (NSE/BSE)", href: "/broking", description: "Stock trading" },
    { name: "F&O", href: "/derivatives", description: "Futures & options" },
    { name: "Commodities", href: "/commodities", description: "MCX/NCDEX trading" },
    { name: "Global Markets", href: "/global-trading", description: "International stocks" }
  ] : [
    { name: "Complete KYC to Trade", href: "/onboarding", description: "Verify your identity to start trading", badge: "REQUIRED" }
  ];

  // FintekPro 5-Pillar Navigation Architecture (Config-driven with role-based visibility)
  const navigationGroups: NavigationGroup[] = [
    // ============ PILLAR 1: DASHBOARD ============
    {
      title: "Dashboard",
      items: [
        {
          name: "Home",
          href: "/",
          icon: LayoutDashboard,
          description: "Overview and market summary"
        },
        {
          name: "My Portfolio",
          icon: PieChart,
          description: "Complete investment holdings",
          subItems: [
            { name: "My Holdings", href: "/portfolio/holdings", description: "Unified domestic & global investments" },
            { name: "Goal Planning", href: "/portfolio/goals", description: "Plan & execute financial goals", badge: "AI" },
            { name: "Retirement Planning", href: "/portfolio/retirement", description: "Retirement corpus planning", badge: "AI" },
            { name: "AI Insights", href: "/portfolio/ai-insights", description: "AI-powered investment insights", badge: "AI" },
            { name: "AI Rebalancing", href: "/portfolio/rebalancing", description: "Smart portfolio rebalancing", badge: "AI" }
          ]
        },
        // Proposals visible to all authenticated users - single page with tabs
        // Documents visible to all authenticated users
        ...(isAuthenticated ? [{
          name: "Documents",
          href: "/documents",
          icon: FileCheck,
          description: "Sign and manage documents"
        }] : []),
        // Proposals visible to all authenticated users - single page with tabs
        ...(isAuthenticated ? [{
          name: "My Proposals",
          href: "/my-proposals",
          icon: ClipboardCheck,
          description: "AI, Agent & Self-requested investment recommendations"
        }] : []),
        {
          name: "Net Worth",
          href: "/net-worth",
          icon: Wallet,
          description: "Complete wealth snapshot",
          badge: "NEW"
        },
        {
          name: "Alerts",
          href: "/alerts",
          icon: Bell,
          description: "Price, renewal & tax alerts"
        }
      ]
    },

    // ============ PILLAR 2: INVEST ============
    {
      title: "Invest",
      items: [
        {
          name: "Store",
          icon: Store,
          description: "Investment marketplace",
          subItems: storeSubItems
        },
        {
          name: "Trading",
          icon: TrendingUp,
          description: isKycComplete ? "Equity & derivatives" : "Complete KYC to access trading",
          subItems: tradingSubItems
        },
        {
          name: "GIFT City IFSC",
          href: "/gift-city",
          icon: Crown,
          description: "International financial services"
        }
      ]
    },

    // ============ PILLAR 3: FINANCE ============
    {
      title: "Finance",
      items: [
        {
          name: "Loans",
          href: "/loans",
          icon: Banknote,
          description: "Personal, Home, Car, Business & more"
        },
        {
          name: "Credit Cards",
          href: "/credit-cards",
          icon: CreditCard,
          description: "Compare & apply"
        },
        {
          name: "CIBIL & Credit",
          href: "/cibil",
          icon: BarChart3,
          description: "Credit score monitoring"
        },
        {
          name: "Banking Products",
          href: "/banking-products",
          icon: Building,
          description: "FD, RD, Savings, NRO/NRE"
        }
      ]
    },

    // ============ PILLAR 4: TAX & COMPLIANCE ============
    {
      title: "Tax & Compliance",
      items: [
        {
          name: "ITR Filing",
          icon: FileText,
          description: "Income tax returns",
          subItems: [
            { name: "Self Filing", href: "/tax/itr?mode=self", description: "File ITR-1 to ITR-7 yourself" },
            { name: "CA-Assisted", href: "/tax/itr?mode=ca", description: "Expert filing assistance", badge: "CA" }
          ]
        },
        {
          name: "Form 15CA/15CB",
          href: "/tax/15ca-cb",
          icon: Globe,
          description: "International remittance",
          badge: "CA ASSIST"
        },
        {
          name: "Tax Notices",
          href: "/tax/notices",
          icon: AlertTriangle,
          description: "Manage IT notices"
        },
        {
          name: "Tax Documents",
          href: "/tax/documents",
          icon: FolderOpen,
          description: "Secure vault (8-year retention)"
        },
        {
          name: "CA Desk",
          href: "/tax/ca-desk",
          icon: Users,
          description: "Expert CA services",
          badge: "EXPERT"
        }
      ]
    },

    // ============ PILLAR 5: MANAGE ============
    {
      title: "Manage",
      items: [
        {
          name: "Profile & KYC",
          icon: UserCheck,
          description: "Personal info & verification",
          subItems: [
            { name: "My Profile", href: "/profile", description: "Account details & KYC status" },
            { name: "Onboarding", href: "/onboarding", description: "PAN-based KYC verification" }
          ]
        },
        {
          name: "BBPS & Bills",
          icon: Receipt,
          description: "Bill payments",
          subItems: [
            { name: "Pay Bills", href: "/bbps", description: "Electricity, water, gas, mobile" },
            { name: "Expenses & Budgets", href: "/expenses-budgets", description: "AI expense tracking", badge: "AI" }
          ]
        },
        {
          name: "Family",
          href: "/families",
          icon: Users,
          description: "Family collaboration"
        },
        {
          name: "Reports Hub",
          icon: Folder,
          description: "All reports",
          subItems: [
            { name: "Tracker Portfolio", href: "/reports/tracker-portfolio", description: "PAN-level consolidated holdings" },
            { name: "Transactions", href: "/reports?type=transactions", description: "Transaction history" },
            { name: "Capital Gains", href: "/reports?type=capital-gains", description: "Tax reports" },
            { name: "Compliance", href: "/reports?type=compliance", description: "Regulatory reports" }
          ]
        },
        {
          name: "Alerts & Reports",
          icon: Bell,
          description: "Notifications & automation",
          subItems: [
            { name: "Compound Alerts", href: "/compound-alerts", description: "Multi-condition alerts" },
            { name: "Scheduled Reports", href: "/scheduled-reports", description: "Automated reports" }
          ]
        },
        {
          name: "Customize",
          icon: Settings,
          description: "Personalization",
          subItems: [
            { name: "Dashboard Layout", href: "/dashboard-customize", description: "Arrange widgets" },
            { name: "Theme Settings", href: "/theme-settings", description: "Appearance & accessibility" }
          ]
        }
      ]
    },

    // ============ PILLAR 6: TOOLS ============
    {
      title: "Tools",
      items: [
        {
          name: "Calculators",
          icon: Calculator,
          description: "Financial calculators",
          subItems: [
            { name: "SIP Calculator", href: "/calculators?type=sip", description: "Plan your SIP investments" },
            { name: "EMI Calculator", href: "/calculators?type=emi", description: "Loan EMI planning" },
            { name: "Retirement Planner", href: "/calculators?type=retirement", description: "Plan your retirement corpus" },
            { name: "Tax Calculator", href: "/calculators?type=tax", description: "Estimate tax liability" },
            { name: "All Calculators", href: "/calculators", description: "View all tools" }
          ]
        }
      ]
    },

    // ============ PILLAR 7: HELP & SUPPORT ============
    {
      title: "Help",
      items: [
        {
          name: "Support",
          icon: HelpCircle,
          description: "Get help",
          subItems: [
            { name: "FAQs", href: "/help/faqs", description: "Frequently asked questions" },
            { name: "Contact Support", href: "/help/contact", description: "Reach our support team" },
            { name: "Book CA Consultation", href: "/tax/ca-desk", description: "Expert tax assistance" }
          ]
        }
      ]
    }
  ];

  // ============ AGENT NAVIGATION (Role-based) ============
  if (isAgent) {
    navigationGroups.push({
      title: "Agent Portal",
      items: [
        {
          name: "Agent Dashboard",
          href: "/agent",
          icon: LayoutDashboard,
          description: "Agent overview"
        },
        {
          name: "Prospect Wizard",
          href: "/agent-prospect-wizard",
          icon: Sparkles,
          description: "Complete onboarding workflow",
          badge: "NEW"
        },
        {
          name: "Client Proposals",
          href: "/admin/proposals",
          icon: ClipboardCheck,
          description: "Create & manage proposals"
        },
        {
          name: "Agent Performance",
          href: "/agent-performance",
          icon: BadgePercent,
          description: "Performance metrics"
        },
        {
          name: "Field View",
          href: "/agent-field-view",
          icon: FileText,
          description: "Field activities"
        },
        {
          name: "AI Recommendations",
          href: "/ai-recommendations",
          icon: PieChart,
          description: "AI-powered insights"
        },
        {
          name: "External Portfolios",
          href: "/agent/external-portfolios",
          icon: Briefcase,
          description: "COB & external holdings management"
        }
      ]
    });
  }

  // ============ ADMIN NAVIGATION (Role-based) ============
  if (isAdmin) {
    navigationGroups.push({
      title: "Administration",
      items: [
        {
          name: "Admin Panel",
          href: "/admin",
          icon: UserCog,
          description: "System administration"
        },
        {
          name: "User Management",
          href: "/admin/users",
          icon: Users,
          description: "Manage users & roles"
        },
        {
          name: "Supplier Management",
          href: "/suppliers",
          icon: Building2,
          description: "Vendors & partners"
        },
        {
          name: "Commission Engine",
          href: "/admin/commission-master",
          icon: CircleDollarSign,
          description: "Configure payouts"
        },
        {
          name: "Store Management",
          href: "/admin/store-management",
          icon: Package,
          description: "Manage products"
        },
        {
          name: "Audit Logs",
          href: "/admin/unlisted/audit-log",
          icon: ScrollText,
          description: "Compliance audit trail"
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
              <Link href="/unified-cart">
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
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 py-1 bg-muted/40 dark:bg-gray-800/50 rounded">
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
                            <CollapsibleContent className="space-y-1 ml-2 pl-2 bg-muted/20 dark:bg-gray-800/40 rounded-md py-1">
                              {item.subItems?.map((subItem) => (
                                <div key={subItem.name}>
                                  {subItem.href ? (
                                    <Link href={subItem.href}>
                                      <Button
                                        variant={isItemActive(subItem.href) ? "default" : "ghost"}
                                        size="sm"
                                        className="w-full justify-start text-xs text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white"
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
                                          className="w-full justify-between text-xs text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white"
                                          data-testid={`sidebar-nav-subgroup-${subItem.name.toLowerCase().replace(/\s+/g, '-')}`}
                                        >
                                          <span>{subItem.name}</span>
                                          {openSubItems.includes(subItem.name) ? 
                                            <ChevronDown className="h-3 w-3" /> : 
                                            <ChevronRight className="h-3 w-3" />
                                          }
                                        </Button>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="space-y-1 ml-2 pl-2 bg-muted/30 dark:bg-gray-800/60 rounded-md py-1">
                                        {subItem.subItems?.map((nestedItem) => (
                                          <Link key={nestedItem.name} href={nestedItem.href}>
                                            <Button
                                              variant={isItemActive(nestedItem.href) ? "default" : "ghost"}
                                              size="sm"
                                              className="w-full justify-start text-xs text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white"
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
          <div className="p-2 border-t border-gray-200 dark:border-gray-700">
            {/* Referral Program */}
            <Link href="/referral-program">
              <Button 
                variant="ghost" 
                size="sm"
                className={`${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-start'} mb-1`}
                data-testid="sidebar-referral-button"
                title={isCollapsed ? "Refer & Earn" : undefined}
              >
                <Crown className="h-4 w-4 text-amber-500" />
                {!isCollapsed && <span className="ml-3">Refer & Earn</span>}
              </Button>
            </Link>
            
            {/* Settings - prominently placed at top of footer */}
            <Link href="/settings">
              <Button 
                variant="ghost" 
                size="sm"
                className={`${isCollapsed ? 'w-full justify-center px-0' : 'w-full justify-start'} mb-1`}
                data-testid="sidebar-settings-button"
                title={isCollapsed ? "Settings" : undefined}
              >
                <Settings2 className="h-4 w-4" />
                {!isCollapsed && <span className="ml-3">Settings</span>}
              </Button>
            </Link>
            
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