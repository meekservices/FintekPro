import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import fintekproLogo from "@assets/fintekpro_main_1772539048013.png";
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
  GitBranch,
  Grid3x3,
  HeartPulse,
  Crosshair,
  BellRing,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { ADMIN_PORTAL_ROLES, AGENT_PORTAL_ROLES, PARTNER_PORTAL_ROLES } from "@shared/roles";

// Sets built from shared/roles.ts — single source of truth for portal-role mapping
const ADMIN_PORTAL_ROLE_SET  = new Set<string>(ADMIN_PORTAL_ROLES);
const AGENT_PORTAL_ROLE_SET  = new Set<string>(AGENT_PORTAL_ROLES);
const PARTNER_PORTAL_ROLE_SET = new Set<string>(PARTNER_PORTAL_ROLES);

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

  // Role checks for conditional nav items
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

  // Portal access checks for "My Portals" launcher — sourced from shared/roles.ts
  const hasAdminRole = user?.roles?.some(r => ADMIN_PORTAL_ROLE_SET.has(r));
  const hasAgentRole = user?.roles?.some(r => AGENT_PORTAL_ROLE_SET.has(r));
  const hasPartnerRole = user?.roles?.some(r => PARTNER_PORTAL_ROLE_SET.has(r));
  // Show "My Portals" when user has any extra portal role beyond the client portal
  // (client portal is the current context, so even one additional portal qualifies)
  const hasMultiPortalAccess = !!(hasAdminRole || hasAgentRole || hasPartnerRole);

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
        {/* My Portals launcher */}
        {isAuthenticated && hasMultiPortalAccess && (
          <div className={`mb-2 ${inSheet || !isCollapsed ? 'border border-border/60 rounded-lg p-2 bg-muted/30' : ''}`}>
            {(inSheet || !isCollapsed) && (
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-1 mb-1.5 flex items-center gap-1">
                <Layers className="h-3 w-3" /> My Portals
              </p>
            )}
            {hasAgentRole && (
              <a href="/?agent=true" target="_blank" rel="noopener noreferrer">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${inSheet || !isCollapsed ? 'w-full justify-start' : 'w-full justify-center px-0'} mb-0.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10`}
                  title={isCollapsed && !inSheet ? "Agent Portal" : undefined}
                >
                  <Briefcase className="h-4 w-4" />
                  {(inSheet || !isCollapsed) && <span className="ml-3 text-xs">Agent Portal</span>}
                </Button>
              </a>
            )}
            {hasPartnerRole && (
              <a href="/?partner=true" target="_blank" rel="noopener noreferrer">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${inSheet || !isCollapsed ? 'w-full justify-start' : 'w-full justify-center px-0'} mb-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10`}
                  title={isCollapsed && !inSheet ? "Partner Portal" : undefined}
                >
                  <Building2 className="h-4 w-4" />
                  {(inSheet || !isCollapsed) && <span className="ml-3 text-xs">Partner Portal</span>}
                </Button>
              </a>
            )}
            {hasAdminRole && (
              <a href="/?admin=true" target="_blank" rel="noopener noreferrer">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${inSheet || !isCollapsed ? 'w-full justify-start' : 'w-full justify-center px-0'} text-orange-600 dark:text-orange-400 hover:bg-orange-500/10`}
                  title={isCollapsed && !inSheet ? "Admin Panel" : undefined}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {(inSheet || !isCollapsed) && <span className="ml-3 text-xs">Admin Panel</span>}
                </Button>
              </a>
            )}
          </div>
        )}

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