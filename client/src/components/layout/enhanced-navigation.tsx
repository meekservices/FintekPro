import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import fintekproLogo from "@assets/fintekpro_favicon_1770477461031.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Sparkles,
  X,
  Star,
  GraduationCap,
  Newspaper,
  Search,
  Calendar,
  Pen,
  Send,
  MapPin,
  Database,
  Gauge,
  BookOpen,
  Award,
  Lightbulb,
  Hammer,
  ListChecks,
  Eye,
  Clock,
  Palette,
  Phone,
  UserPlus,
  Layers,
  Zap,
  GitBranch
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/use-cart";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
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

  const storeSubItems: NavigationSubItem[] = [
    ...(isPremium ? [
      { name: "AIF", href: "/aif", description: "Alternative Investment Funds (₹1Cr min)", badge: "PREMIUM" },
      { name: "PMS", href: "/pms", description: "Portfolio Management Services (₹50L min)", badge: "ELITE" },
    ] : []),
    { name: "Mutual Funds", href: "/mutual-funds", description: "Domestic & international funds" },
    { name: "IPO & Pre-IPO", href: "/ipo", description: "Public offerings" },
    { name: "Unlisted Shares", href: "/unlisted", description: "Pre-IPO securities" },
    { name: "REIT / InvIT", href: "/reit-invit", description: "Real estate & infrastructure trusts", badge: "NEW" }
  ];

  const fixedIncomeSubItems: NavigationSubItem[] = [
    { name: "Bonds & NCDs", href: "/bonds", description: "Government & corporate bonds" },
    { name: "Fixed Income Marketplace", href: "/fixed-income", description: "Comprehensive bond marketplace" },
    { name: "MLDs", href: "/mlds", description: "Market Linked Debentures" }
  ];

  const tradingSubItems: NavigationSubItem[] = isKycComplete ? [
    { name: "Equities (NSE/BSE)", href: "/broking", description: "Stock trading" },
    { name: "F&O", href: "/derivatives", description: "Futures & options" },
    { name: "Commodities", href: "/commodities", description: "MCX/NCDEX trading" },
    { name: "Global Markets", href: "/global-trading", description: "International stocks" }
  ] : [
    { name: "Complete KYC to Trade", href: "/onboarding", description: "Verify your identity to start trading", badge: "REQUIRED" }
  ];

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
            { name: "Import Portfolio", href: "/portfolio/import", description: "Import from CAS, brokers & more" },
            { name: "Goal Planning", href: "/portfolio/goals", description: "Plan & execute financial goals", badge: "AI" },
            { name: "Retirement Planning", href: "/portfolio/retirement", description: "Retirement corpus planning", badge: "AI" },
            { name: "AI Insights", href: "/portfolio/ai-insights", description: "AI-powered investment insights", badge: "AI" },
            { name: "AI Rebalancing", href: "/portfolio/rebalancing", description: "Smart portfolio rebalancing", badge: "AI" }
          ]
        },
        {
          name: "Net Worth",
          href: "/net-worth",
          icon: Wallet,
          description: "Complete wealth snapshot"
        },
        ...(isAuthenticated ? [{
          name: "My Proposals",
          href: "/my-proposals",
          icon: ClipboardCheck,
          description: "Investment recommendations"
        }] : []),
        {
          name: "Alerts",
          href: "/alerts",
          icon: Bell,
          description: "Price, renewal & tax alerts"
        },
        {
          name: "Pick of the Day",
          href: "/ai-stock-picks",
          icon: Star,
          description: "AI picks across all products",
          badge: "AI"
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
          name: "Fixed Income",
          icon: Landmark,
          description: "Bonds, NCDs & MLDs",
          subItems: fixedIncomeSubItems
        },
        {
          name: "Trading",
          icon: TrendingUp,
          description: isKycComplete ? "Equity & derivatives" : "Complete KYC to access trading",
          subItems: tradingSubItems
        },
        {
          name: "Insurance Hub",
          href: "/insurance",
          icon: Shield,
          description: "Life, health & general insurance"
        },
        {
          name: "GIFT City IFSC",
          href: "/gift-city",
          icon: Crown,
          description: "International financial services"
        },
        {
          name: "NRI Services",
          href: "/nri-services",
          icon: Globe,
          description: "NRO/NRE & cross-border investments"
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
          name: "BBPS & Bills",
          icon: Receipt,
          description: "Bill payments & tracking",
          subItems: [
            { name: "Pay Bills", href: "/bbps", description: "Electricity, water, gas, mobile" },
            { name: "Expenses & Budgets", href: "/expenses-budgets", description: "AI expense tracking", badge: "AI" }
          ]
        }
      ]
    },

    // ============ PILLAR 4: TAX ============
    {
      title: "Tax",
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
          name: "Capital Gains",
          href: "/reports?type=capital-gains",
          icon: BarChart3,
          description: "Tax reports & harvesting"
        },
        {
          name: "Tax Documents",
          href: "/tax/documents",
          icon: FolderOpen,
          description: "Secure vault (8-year retention)"
        },
        {
          name: "Tax Notices",
          href: "/tax/notices",
          icon: AlertTriangle,
          description: "Manage IT notices"
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

    // ============ PILLAR 5: REPORTS & TOOLS ============
    {
      title: "Reports & Tools",
      items: [
        {
          name: "Reports Hub",
          icon: Folder,
          description: "All reports",
          subItems: [
            { name: "Tracker Portfolio", href: "/reports/tracker-portfolio", description: "PAN-level consolidated holdings" },
            { name: "Transactions", href: "/reports?type=transactions", description: "Transaction history" },
            { name: "Compliance", href: "/reports?type=compliance", description: "Regulatory reports" },
            { name: "Scheduled Reports", href: "/scheduled-reports", description: "Automated reports" }
          ]
        },
        {
          name: "Documents",
          href: "/documents",
          icon: FileCheck,
          description: "Sign & manage documents"
        },
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
        },
      ]
    },

    // ============ PILLAR 6: ACCOUNT ============
    {
      title: "Account",
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
          name: "Family",
          href: "/families",
          icon: Users,
          description: "Family collaboration"
        },
        {
          name: "Customize",
          icon: Palette,
          description: "Personalization",
          subItems: [
            { name: "Dashboard Layout", href: "/dashboard-customize", description: "Arrange widgets" },
            { name: "Theme Settings", href: "/theme-settings", description: "Appearance & accessibility" },
            { name: "Notifications", href: "/notification-preferences", description: "Alert preferences" }
          ]
        },
        {
          name: "Help & Support",
          href: "/support",
          icon: HelpCircle,
          description: "FAQs & contact support"
        }
      ]
    }
  ];

  // ============ AGENT PORTAL (Role-based, 6 sections) ============
  if (isAgent) {
    navigationGroups.push(
      {
        title: "Agent: Overview",
        items: [
          { name: "Agent Dashboard", href: "/agent", icon: LayoutDashboard, description: "Agent overview" },
          { name: "Performance", href: "/agent-performance", icon: BadgePercent, description: "Performance metrics" },
          { name: "Leaderboard", href: "/agent/leaderboard", icon: Award, description: "Top agents ranking" },
          { name: "Revenue Cockpit", href: "/agent/revenue", icon: DollarSign, description: "Revenue analytics" }
        ]
      },
      {
        title: "Agent: Clients",
        items: [
          { name: "Prospect Wizard", href: "/agent-prospect-wizard", icon: Sparkles, description: "Complete onboarding workflow", badge: "NEW" },
          { name: "Client Pipeline", href: "/agent/crm/pipeline", icon: Target, description: "CRM pipeline management" },
          { name: "My Clients", href: "/agent/clients", icon: Users, description: "Client directory" },
          { name: "CRM Analytics", href: "/agent/crm/analytics", icon: Eye, description: "CRM analytics & insights" },
          { name: "Tasks", href: "/agent/tasks", icon: ListChecks, description: "Task management" },
          { name: "Onboard Client", href: "/agent/onboard-client", icon: UserPlus, description: "New client onboarding" },
          { name: "External Portfolios", href: "/agent/external-portfolios", icon: Briefcase, description: "COB & external holdings" }
        ]
      },
      {
        title: "Agent: Advisory",
        items: [
          { name: "Proposals", href: "/agent/proposals", icon: ClipboardCheck, description: "Create & manage proposals" },
          { name: "AI Recommendations", href: "/ai-recommendations", icon: Sparkles, description: "AI-powered insights", badge: "AI" },
          { name: "Pick of the Day", href: "/agent/picks", icon: Star, description: "Daily investment picks" },
          { name: "Research Workspace", href: "/agent/research-lists", icon: Search, description: "Research & watchlists" },
          { name: "Screener", href: "/agent/screener", icon: BarChart3, description: "Stock screener" },
          { name: "Report Builder", href: "/agent/report-builder", icon: FileText, description: "Custom reports" }
        ]
      },
      {
        title: "Agent: Loans (DSA)",
        items: [
          { name: "Loan Applications", href: "/agent/loan-applications", icon: ClipboardList, description: "Track applications" },
          { name: "Loan Marketplace", href: "/agent/loan-marketplace", icon: Store, description: "Multi-bank products" },
          { name: "Apply for Client", href: "/agent/loan-apply", icon: Banknote, description: "New loan application" },
          { name: "Builder Finance", href: "/agent/loan-apply?type=developer", icon: Building2, description: "Project & developer finance", badge: "NEW" },
          { name: "DSA Performance", href: "/agent/dsa-performance", icon: Activity, description: "DSA analytics" },
          { name: "Payout Claims", href: "/agent/payout-claims", icon: CircleDollarSign, description: "Commission claims" }
        ]
      },
      {
        title: "Agent: Operations",
        items: [
          { name: "Calendar", href: "/agent/calendar", icon: Calendar, description: "Schedule & appointments" },
          { name: "Meetings", href: "/agent/meetings", icon: Phone, description: "Client meetings" },
          { name: "eSign", href: "/agent/esign", icon: Pen, description: "Digital signatures" },
          { name: "Bulk Communication", href: "/agent/bulk-communication", icon: Send, description: "Mass outreach" },
          { name: "Field View", href: "/agent-field-view", icon: MapPin, description: "Field activities" },
          { name: "Orders", href: "/agent/orders", icon: ShoppingCart, description: "Order management" },
          { name: "KYC Management", href: "/agent/kyc", icon: UserCheck, description: "Client KYC tracking" }
        ]
      },
      {
        title: "Agent: Knowledge",
        items: [
          { name: "Knowledge Hub", href: "/agent/knowledge-hub", icon: BookOpen, description: "Market intelligence" },
          { name: "Market Brief", href: "/agent/knowledge-hub/market-brief", icon: Newspaper, description: "Daily AI market brief", badge: "AI" },
          { name: "Training", href: "/agent/training", icon: GraduationCap, description: "Training & certifications" },
          { name: "Product Knowledge", href: "/agent/knowledge-hub/products", icon: Lightbulb, description: "Product deep-dives" }
        ]
      }
    );
  }

  // ============ ADMIN PANEL (Role-based, 5 sections) ============
  if (isAdmin) {
    navigationGroups.push(
      {
        title: "Admin: System",
        items: [
          { name: "Admin Dashboard", href: "/admin", icon: LayoutDashboard, description: "System overview" },
          { name: "User Management", href: "/admin/users", icon: Users, description: "Manage users & roles" },
          { name: "Audit Logs", href: "/admin/unlisted/audit-log", icon: ScrollText, description: "Compliance audit trail" },
          { name: "API Usage", href: "/admin/api-usage", icon: Activity, description: "API monitoring" },
          { name: "Engine Health", href: "/admin/engine-health-check", icon: Gauge, description: "System health check" }
        ]
      },
      {
        title: "Admin: Products",
        items: [
          { name: "Store Management", href: "/admin/store-management", icon: Package, description: "Manage products" },
          { name: "MF Admin", href: "/admin/mf-enrichment", icon: PieChart, description: "Mutual fund data" },
          { name: "Bond Admin", href: "/admin/bond-seed", icon: Landmark, description: "Bond marketplace admin" },
          { name: "Unlisted Admin", href: "/admin/unlisted/companies", icon: Building, description: "Unlisted shares" },
          { name: "Listed Stocks", href: "/admin/listed-stocks-seed", icon: TrendingUp, description: "Stock data management" },
          { name: "MF Benchmarks", href: "/admin/mf-benchmarks", icon: BarChart3, description: "Benchmark management" }
        ]
      },
      {
        title: "Admin: Financial",
        items: [
          { name: "Partner Hierarchy", href: "/admin/partner-hierarchy", icon: GitBranch, description: "Manage partners & commissions" },
          { name: "Commission Engine", href: "/admin/commission-master", icon: CircleDollarSign, description: "Configure payouts" },
          { name: "Agent Payouts", href: "/admin/agent-payouts", icon: Banknote, description: "Payout management" },
          { name: "Platform Fees", href: "/admin/global-fee-model", icon: DollarSign, description: "Fee configuration" },
          { name: "Loan Management", href: "/admin/loan-marketplace", icon: ClipboardList, description: "DSA loan admin" },
          { name: "Prospect Dashboard", href: "/admin/prospect-dashboard", icon: Target, description: "Prospect analytics" }
        ]
      },
      {
        title: "Admin: Compliance",
        items: [
          { name: "Supplier Management", href: "/suppliers", icon: Building2, description: "Vendors & partners" },
          { name: "Compliance Dashboard", href: "/admin/compliance-dashboard", icon: Scale, description: "Regulatory compliance" },
          { name: "Regulatory Compliance", href: "/admin/unlisted/regulatory-compliance", icon: Shield, description: "Compliance rules" },
          { name: "KYC Compliance", href: "/admin/kyc-compliance", icon: AlertCircle, description: "KYC monitoring" }
        ]
      },
      {
        title: "Admin: Data",
        items: [
          { name: "Data Enrichment", href: "/admin/data-enrichment", icon: Database, description: "Data quality management" },
          { name: "System Health", href: "/admin/system-health", icon: Zap, description: "System monitoring" },
          { name: "Zoho Import", href: "/admin/zoho-import", icon: Layers, description: "Zoho data sync" },
          { name: "Parser Admin", href: "/admin/parser-config", icon: FileText, description: "Document parser config" }
        ]
      }
    );
  }

  const isItemActive = (href: string) => {
    if (href === "/" && location === "/") return true;
    if (href !== "/" && location.startsWith(href)) return true;
    return false;
  };

  const handleMobileNavClick = () => {
    setMobileOpen(false);
  };

  const NavigationContent = ({ inSheet = false }: { inSheet?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* User Profile Section */}
      {isAuthenticated && user && (inSheet || !isCollapsed) && (
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
                : 'Welcome!'}
            </p>
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <Collapsible 
                open={openGroups.includes(group.title)}
                onOpenChange={() => toggleGroup(group.title)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`w-full justify-between text-sm font-semibold text-muted-foreground hover:text-foreground ${inSheet || !isCollapsed ? '' : 'justify-center px-0'}`}
                  >
                    <span className={inSheet || !isCollapsed ? '' : 'sr-only'}>{group.title}</span>
                    {(inSheet || !isCollapsed) && (
                      <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.includes(group.title) ? 'rotate-180' : ''}`} />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1">
                  {group.items.map((item) => (
                    <div key={item.name}>
                      {item.subItems ? (
                        <Collapsible
                          open={openSubItems.includes(item.name)}
                          onOpenChange={() => toggleSubItem(item.name)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`w-full justify-between ${inSheet || !isCollapsed ? '' : 'justify-center px-0'}`}
                            >
                              <div className="flex items-center">
                                <item.icon className="h-4 w-4" />
                                {(inSheet || !isCollapsed) && <span className="ml-3">{item.name}</span>}
                              </div>
                              {(inSheet || !isCollapsed) && (
                                <ChevronRight className={`h-4 w-4 transition-transform ${openSubItems.includes(item.name) ? 'rotate-90' : ''}`} />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-6 space-y-1">
                            {item.subItems.map((subItem) => (
                              <div key={subItem.name}>
                                {subItem.href ? (
                                  <Link href={subItem.href} onClick={inSheet ? handleMobileNavClick : undefined}>
                                    <Button
                                      variant={isItemActive(subItem.href) ? "default" : "ghost"}
                                      size="sm"
                                      className="w-full justify-start text-xs"
                                    >
                                      {subItem.name}
                                      {subItem.badge && (
                                        <Badge variant="secondary" className="ml-auto text-xs">
                                          {subItem.badge}
                                        </Badge>
                                      )}
                                    </Button>
                                  </Link>
                                ) : subItem.subItems ? (
                                  <Collapsible>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                                        {subItem.name}
                                        <ChevronRight className="h-3 w-3" />
                                      </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pl-4 space-y-1">
                                      {subItem.subItems.map((nestedItem) => (
                                        <Link key={nestedItem.name} href={nestedItem.href} onClick={inSheet ? handleMobileNavClick : undefined}>
                                          <Button
                                            variant={isItemActive(nestedItem.href) ? "default" : "ghost"}
                                            size="sm"
                                            className="w-full justify-start text-xs"
                                          >
                                            {nestedItem.name}
                                          </Button>
                                        </Link>
                                      ))}
                                    </CollapsibleContent>
                                  </Collapsible>
                                ) : null}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      ) : item.href ? (
                        <Link href={item.href} onClick={inSheet ? handleMobileNavClick : undefined}>
                          <Button
                            variant={isItemActive(item.href) ? "default" : "ghost"}
                            size="sm"
                            className={`w-full ${inSheet || !isCollapsed ? 'justify-start' : 'justify-center px-0'}`}
                            title={isCollapsed && !inSheet ? item.name : undefined}
                          >
                            <item.icon className="h-4 w-4" />
                            {(inSheet || !isCollapsed) && <span className="ml-3">{item.name}</span>}
                            {(inSheet || !isCollapsed) && item.badge && (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {item.badge}
                              </Badge>
                            )}
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom Actions */}
      <div className="p-2 border-t border-border">
        <Link href="/referral-program" onClick={inSheet ? handleMobileNavClick : undefined}>
          <Button 
            variant="ghost" 
            size="sm"
            className={`${inSheet || !isCollapsed ? 'w-full justify-start' : 'w-full justify-center px-0'} mb-1`}
            title={isCollapsed && !inSheet ? "Refer & Earn" : undefined}
          >
            <Crown className="h-4 w-4 text-amber-500" />
            {(inSheet || !isCollapsed) && <span className="ml-3">Refer & Earn</span>}
          </Button>
        </Link>
        
        <Link href="/settings" onClick={inSheet ? handleMobileNavClick : undefined}>
          <Button 
            variant="ghost" 
            size="sm"
            className={`${inSheet || !isCollapsed ? 'w-full justify-start' : 'w-full justify-center px-0'} mb-1`}
            title={isCollapsed && !inSheet ? "Settings" : undefined}
          >
            <Settings2 className="h-4 w-4" />
            {(inSheet || !isCollapsed) && <span className="ml-3">Settings</span>}
          </Button>
        </Link>
        
        {isAuthenticated ? (
          <Button 
            variant="ghost" 
            size="sm"
            className={`${inSheet || !isCollapsed ? 'w-full justify-start' : 'w-full justify-center px-0'}`}
            onClick={() => {
              handleLogout();
              if (inSheet) handleMobileNavClick();
            }}
            title={isCollapsed && !inSheet ? "Logout" : undefined}
          >
            <LogOut className="h-4 w-4" />
            {(inSheet || !isCollapsed) && <span className="ml-3">Logout</span>}
          </Button>
        ) : (
          <Link href="/auth" onClick={inSheet ? handleMobileNavClick : undefined}>
            <Button 
              className={`${inSheet || !isCollapsed ? 'w-full justify-start' : 'w-full justify-center px-0'}`}
              size="sm"
              title={isCollapsed && !inSheet ? "Login" : undefined}
            >
              <UserIcon className="h-4 w-4" />
              {(inSheet || !isCollapsed) && <span className="ml-3">Login</span>}
            </Button>
          </Link>
        )}
        
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center justify-between">
              <Link href="/" onClick={handleMobileNavClick} className="flex items-center gap-3">
                <img src={fintekproLogo} alt="FintekPro" className="h-10 w-10 rounded-lg object-contain flex-shrink-0" />
                <span className="text-lg font-bold text-primary">FintekPro</span>
              </Link>
            </SheetTitle>
          </SheetHeader>
          <NavigationContent inSheet={true} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      {/* Left Sidebar with Sticky Positioning */}
      <aside className={`sticky top-0 h-screen bg-card shadow-lg border-r border-border overflow-y-auto transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo and Toggle */}
          <div className="flex items-center min-h-[64px] px-4 py-3 border-b border-border justify-between">
            {!isCollapsed && (
              <Link href="/" className="flex items-center gap-3">
                <img src={fintekproLogo} alt="FintekPro" className="h-10 w-10 rounded-lg object-contain flex-shrink-0" />
                <h1 className="text-lg font-bold text-finance-blue cursor-pointer truncate" data-testid="logo">
                  FintekPro
                </h1>
              </Link>
            )}
            {isCollapsed && (
              <Link href="/">
                <img src={fintekproLogo} alt="FintekPro" className="h-10 w-10 rounded-lg object-contain" />
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
          
          <NavigationContent />
        </div>
      </aside>
    </>
  );
}