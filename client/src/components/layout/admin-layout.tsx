import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation, useSearch } from "wouter";
import fintekproLogo from "@assets/fintekpro_admin_1772539048012.png";
import { PortalLogo } from "@/components/portal/PortalLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getPortalQueryParams } from "@/hooks/useSubdomain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Settings,
  BookOpen,
  Users,
  BarChart3,
  ShieldCheck,
  Shield,
  Database,
  Activity,
  Key,
  FileCheck,
  LogOut,
  Menu,
  X,
  Home,
  Bell,
  AlertCircle,
  AlertTriangle,
  DollarSign,
  Workflow,
  TrendingUp,
  Mail,
  MessageSquare,
  Building2,
  Target,
  PieChart,
  Store,
  Briefcase,
  ClipboardList,
  History,
  Handshake,
  ChevronDown,
  ChevronRight,
  Landmark,
  ShoppingCart,
  Lightbulb,
  Award,
  Search,
  Megaphone,
  LayoutDashboard,
  Cog,
  Package,
  CheckCircle,
  UserCheck,
  Bug,
  Wallet,
  Inbox,
  FileSignature,
  Palette,
  FileText,
  Scale,
  ShieldAlert,
  GitBranch,
  ArrowRightLeft,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  title: string;
  href: string;
  icon: any;
  description: string;
  children?: NavItem[];
}

interface NavCategory {
  id: string;
  title: string;
  icon: any;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { title: "Overview", href: "/admin/dashboard", icon: Home, description: "Metrics synced from Zoho" },
      { title: "Activity Centre", href: "/admin/activity-centre", icon: Activity, description: "AI-powered activity insights" },
      { title: "AI Insights", href: "/admin/ai-insights", icon: Lightbulb, description: "AI-powered trends" },
    ]
  },
  {
    id: "crm",
    title: "CRM & Leads",
    icon: Users,
    items: [
      { title: "Lead Pipeline", href: "/admin/zoho-dashboard", icon: Workflow, description: "From Zoho CRM" },
      { title: "Stakeholders", href: "/admin/stakeholders", icon: Users, description: "Clients, partners & agents" },
      { title: "Prospect Dashboard", href: "/admin/prospect-dashboard", icon: Target, description: "All prospects & leads" },
      { title: "Agent Performance", href: "/admin/agent-performance", icon: BarChart3, description: "Agent metrics & tracking" },
      { title: "Task Oversight", href: "/admin/task-oversight", icon: ClipboardList, description: "Monitor agents' tasks" },
    ]
  },
  {
    id: "operations",
    title: "Operations",
    icon: Briefcase,
    items: [
      { title: "Manual KYC Reviews", href: "/admin/kyc-compliance", icon: FileCheck, description: "Review manual document submissions" },
      { title: "Smart KYC Sessions", href: "/admin/kyc-v2-management", icon: ShieldAlert, description: "Video KYC, automated sessions & approvals" },
      { title: "Institutional Data", href: "/admin/institutional-data", icon: Database, description: "Corp actions, ratings & master" },
      { title: "Transaction Queue", href: "/admin/financial-operations", icon: ClipboardList, description: "Pending transactions" },
      { title: "E-Sign Documents", href: "/admin/esign-management", icon: FileSignature, description: "Electronic signatures" },
      { title: "Store Management", href: "/admin/store-management", icon: Store, description: "Categories & products" },
      {
        title: "Unlisted Marketplace",
        href: "/admin/unlisted/dashboard",
        icon: Briefcase,
        description: "Pre-IPO & unlisted shares",
        children: [
          { title: "Dashboard", href: "/admin/unlisted/dashboard", icon: Home, description: "Overview & metrics" },
          { title: "Companies", href: "/admin/unlisted/companies", icon: Building2, description: "Manage listings" },
          { title: "Orders", href: "/admin/unlisted/orders", icon: ShoppingCart, description: "Buy/Sell orders" },
          { title: "Negotiations", href: "/admin/unlisted/negotiations", icon: Handshake, description: "Price negotiations" },
        ]
      },
      {
        title: "Bond Marketplace",
        href: "/admin/bonds/dashboard",
        icon: Landmark,
        description: "Bonds, NCDs & G-Secs",
        children: [
          { title: "Dashboard", href: "/admin/bonds/dashboard", icon: Home, description: "Overview & metrics" },
          { title: "Sell Listings", href: "/admin/bonds/sell-listings", icon: Store, description: "Bond sell listings" },
          { title: "Buy Requests", href: "/admin/bonds/buy-requests", icon: ShoppingCart, description: "Bond buy requests" },
          { title: "Deals", href: "/admin/bonds/deals", icon: Handshake, description: "Matched deals" },
        ]
      },
      { title: "DSA Loan Dashboard", href: "/admin/dsa-loans", icon: Landmark, description: "Multi-bank loan routing" },
      { title: "Duplicate Detection", href: "/admin/duplicates", icon: AlertCircle, description: "Detect & resolve duplicates" },
      { title: "MF Data Enrichment", href: "/admin/mf-enrichment", icon: Database, description: "MF returns sync status" },
      { title: "MF Analytics Ops", href: "/admin/mf-analytics-ops", icon: Database, description: "Run bulk analytics jobs" },
      {
        title: "US Broker (Alpaca)",
        href: "/admin/broker-dashboard",
        icon: Wallet,
        description: "Fully-disclosed broker-dealer",
        children: [
          { title: "Alpaca Hub (Full View)", href: "/admin/alpaca-hub", icon: Building2, description: "Accounts, orders, positions, compliance" },
          { title: "Accounts & Compliance", href: "/admin/broker-dashboard?tab=accounts", icon: Users, description: "Account list & compliance status" },
          { title: "Journals & Transfers", href: "/admin/broker-dashboard?tab=journals", icon: ArrowRightLeft, description: "Journal entries & fund transfers" },
          { title: "Corporate Actions", href: "/admin/broker-dashboard?tab=corporate-actions", icon: FileText, description: "Dividends, splits & reorgs" },
          { title: "Revenue & Pricing", href: "/admin/broker-dashboard?tab=revenue", icon: TrendingUp, description: "Revenue, MRR & tier breakdown" },
          { title: "BD Setup & Config", href: "/admin/broker-dashboard?tab=app-registration", icon: Settings, description: "Broker-dealer registration & config" },
        ]
      },
      {
        title: "KFintech / IRIS",
        href: "/admin/iris",
        icon: Landmark,
        description: "MF, SIP & investor oversight",
        children: [
          { title: "IRIS Overview", href: "/admin/iris", icon: Landmark, description: "Investor & SIP oversight dashboard" },
        ]
      },
    ]
  },
  {
    id: "intelligence",
    title: "Intelligence",
    icon: Lightbulb,
    items: [
      { title: "MCA Intelligence", href: "/admin/mca-intelligence", icon: Landmark, description: "Query Console, Radar & Wallet" },
      { title: "Lead Prospecting", href: "/admin/lead-prospecting", icon: Building2, description: "B2B company search" },
      { title: "Prospect Analytics", href: "/admin/prospect-analytics", icon: TrendingUp, description: "Lead scoring & insights" },
      { title: "Client Intelligence", href: "/admin/client-intelligence", icon: Target, description: "Client analysis" },
      { title: "AI Tracking", href: "/admin/ai-recommendation-tracking", icon: BarChart3, description: "AI recommendation success" },
    ]
  },
  {
    id: "marketing",
    title: "Marketing",
    icon: Megaphone,
    items: [
      { title: "Overview", href: "/admin/marketing-dashboard", icon: TrendingUp, description: "Campaigns dashboard" },
      { title: "Email Campaigns", href: "/admin/email-campaigns", icon: Mail, description: "Email marketing" },
      { title: "WhatsApp/SMS", href: "/admin/whatsapp-campaigns", icon: MessageSquare, description: "WhatsApp & SMS campaigns" },
      { title: "SMS Inbox", href: "/admin/sms-inbox", icon: Inbox, description: "Incoming messages" },
      { title: "Analytics", href: "/admin/marketing-analytics", icon: PieChart, description: "Performance tracking" },
    ]
  },
  {
    id: "finance",
    title: "Finance",
    icon: DollarSign,
    items: [
      { title: "Partner Hierarchy", href: "/admin/partner-hierarchy", icon: GitBranch, description: "Partner approvals & commissions" },
      { title: "Commission Master", href: "/admin/commission-master", icon: TrendingUp, description: "Commission configuration" },
      { title: "Revenue Analytics", href: "/admin/revenue-analytics", icon: BarChart3, description: "Revenue & performance" },
      { title: "Partner Payouts", href: "/admin/payouts", icon: Wallet, description: "Agent & partner payouts" },
      { title: "Firm DP Inventory", href: "/admin/firm-inventory", icon: Package, description: "MS FintekPro Advisors LLP holdings & Zoho sync" },
      { title: "Zoho Books", href: "/admin/zoho-books", icon: BookOpen, description: "Accounting sync" },
      { title: "Global Fee Model", href: "/admin/global-fee-model", icon: DollarSign, description: "Advisory fee settings" },
    ]
  },
  {
    id: "compliance",
    title: "Compliance",
    icon: Shield,
    items: [
      { title: "Regulatory Dashboard", href: "/admin/compliance-dashboard", icon: Shield, description: "SEBI/RBI compliance" },
      { title: "Audit Norms", href: "/admin/regulatory-audit-norms", icon: Scale, description: "SEBI/AMFI/PMLA/RBI norms" },
      { title: "SEBI MF Compliance", href: "/admin/sebi-mf-compliance", icon: Scale, description: "SEBI 2026 MF categorisation" },
      { title: "Unlisted Compliance", href: "/admin/unlisted/compliance-alerts", icon: AlertTriangle, description: "Blocked trades" },
      { title: "Bond Audit Log", href: "/admin/bonds/audit-log", icon: History, description: "Bond audit trail" },
      { title: "Unlisted Audit Log", href: "/admin/unlisted/audit-log", icon: History, description: "Unlisted audit trail" },
      { title: "CA Partners", href: "/admin/ca-management", icon: Award, description: "CA partner management" },
    ]
  },
  {
    id: "settings",
    title: "Settings",
    icon: Cog,
    items: [
      { title: "Theme & Accessibility", href: "/admin/theme-settings", icon: Palette, description: "Visual customization" },
      { title: "Users & Access", href: "/admin/users", icon: Users, description: "User management" },
      { title: "Role Permissions", href: "/admin/appointments", icon: UserCheck, description: "Role approvals" },
      { title: "Integration Config", href: "/admin/api-config", icon: Key, description: "Zoho, Cashfree & APIs" },
      { title: "KYC Flow", href: "/admin/kyc-flow", icon: FileCheck, description: "Unified KYC provider config" },
      { title: "System Health", href: "/admin/system-health", icon: Activity, description: "Performance monitoring" },
      { title: "Engine Health", href: "/admin/engine-health-check", icon: Activity, description: "Calculation engine validation" },
      { title: "Pricing Engine", href: "/admin/pricing-engine", icon: DollarSign, description: "Golden Pricing Dashboard" },
      { title: "API Usage", href: "/admin/api-usage", icon: Activity, description: "API cost tracking" },
      { title: "Feature Flags", href: "/admin/feature-flags", icon: Lightbulb, description: "A/B testing controls" },
      { title: "PDF Parser", href: "/admin/parser-config", icon: FileText, description: "Unified PDF parser settings" },
      { title: "Database", href: "/admin/database", icon: Database, description: "Database management" },
      { title: "Data Providers", href: "/admin/data-providers", icon: Activity, description: "Provider health & fallback" },
      { title: "WhatsApp Setup", href: "/admin/whatsapp-setup", icon: MessageSquare, description: "Link WhatsApp device & scan QR" },
    ]
  },
];

const allNavItems = navCategories.flatMap(cat => 
  cat.items.flatMap(item => item.children ? [item, ...item.children] : [item])
);

interface Notification {
  id: string;
  type: 'kyc' | 'compliance' | 'order' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const currentSearch = useSearch();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['dashboard']));
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: kycResponse } = useQuery<{ success: boolean; data: { pendingKyc: number; activeAlerts: number } }>({
    queryKey: ["/api/admin/kyc/dashboard"],
    refetchInterval: 60000,
  });

  const { data: pendingOrdersResponse } = useQuery<{ total: number; unlistedPending: number; bondPending: number }>({
    queryKey: ["/api/admin/pending-orders/count"],
    refetchInterval: 60000,
  });

  const { data: smsInboxResponse } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/twilio/admin/messages/unread-count"],
    refetchInterval: 30000,
  });

  const smsUnreadCount = smsInboxResponse?.unreadCount || 0;

  const notifications: Notification[] = useMemo(() => {
    const items: Notification[] = [];
    const pendingKyc = kycResponse?.data?.pendingKyc || 0;
    const activeAlerts = kycResponse?.data?.activeAlerts || 0;
    const pendingOrders = pendingOrdersResponse?.total || 0;
    
    if (pendingKyc > 0) {
      items.push({
        id: 'kyc-pending',
        type: 'kyc',
        title: 'Pending KYC Reviews',
        message: `${pendingKyc} KYC submission${pendingKyc > 1 ? 's' : ''} awaiting review`,
        timestamp: new Date(),
        read: false,
        link: '/admin/kyc-compliance'
      });
    }
    if (activeAlerts > 0) {
      items.push({
        id: 'compliance-alerts',
        type: 'compliance',
        title: 'Compliance Alerts',
        message: `${activeAlerts} active alert${activeAlerts > 1 ? 's' : ''} require attention`,
        timestamp: new Date(),
        read: false,
        link: '/admin/duplicates'
      });
    }
    if (pendingOrders > 0) {
      items.push({
        id: 'pending-orders',
        type: 'order',
        title: 'Pending Orders',
        message: `${pendingOrders} order${pendingOrders > 1 ? 's' : ''} awaiting action`,
        timestamp: new Date(),
        read: false,
        link: '/admin/unlisted/orders'
      });
    }
    return items;
  }, [kycResponse, pendingOrdersResponse]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const hrefPath = (href: string) => href.split('?')[0];

  const isHrefActive = (href: string): boolean => {
    const path = hrefPath(href);
    if (location !== path && !location.startsWith(path + '/')) return false;
    const queryPart = href.includes('?') ? href.split('?')[1] : null;
    if (!queryPart) return true;
    const hrefParams = new URLSearchParams(queryPart);
    const currentParams = new URLSearchParams(currentSearch);
    for (const [key, value] of hrefParams.entries()) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  };

  useEffect(() => {
    navCategories.forEach(category => {
      category.items.forEach(item => {
        if (item.children) {
          const isChildActive = item.children.some(child => 
            location === hrefPath(child.href) || location.startsWith(hrefPath(child.href) + '/')
          );
          if (isChildActive) {
            setExpandedCategories(prev => new Set([...prev, category.id]));
            setExpandedMenus(prev => new Set([...prev, item.title]));
          }
        }
        if (location === hrefPath(item.href)) {
          setExpandedCategories(prev => new Set([...prev, category.id]));
        }
      });
    });
  }, [location]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const toggleMenu = (title: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };
  
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/logout", { method: "POST" }),
    onSuccess: () => {
      // Redirect to auth page, staying on the admin subdomain
      window.location.href = "/auth" + getPortalQueryParams();
    },
  });

  const handleSearchSelect = (href: string) => {
    setSearchOpen(false);
    navigate(href);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(open => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth' + getPortalQueryParams();
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user.roles?.includes('admin') || user.roles?.includes('superadmin');
  
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center justify-center p-4">
        <div className="bg-background rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Access Denied
          </h1>
          <p className="text-muted-foreground mb-2">
            This admin portal is restricted to administrators only.
          </p>
          {user.email && (
            <p className="text-sm text-muted-foreground mb-6">
              You are signed in as <strong>{user.email}</strong>, which does not have admin access.
            </p>
          )}
          <div className="space-y-3">
            <Button className="w-full" onClick={() => { window.location.href = '/api/logout'; }}>
              Sign Out and Switch Account
            </Button>
            <Button variant="outline" asChild className="w-full">
              <a href="https://fintekpro.com">Go to Main Portal</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="bg-background border-border p-0 max-w-lg" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Search Admin Features</DialogTitle>
          <Command className="bg-transparent">
            <CommandInput placeholder="Search admin features..." className="border-0" />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              {navCategories.map(category => (
                <CommandGroup key={category.id} heading={category.title}>
                  {category.items.map(item => (
                    <CommandItem 
                      key={item.href}
                      value={`${item.title} ${item.description}`}
                      onSelect={() => handleSearchSelect(item.href)}
                      className="cursor-pointer"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground"
              data-testid="btn-toggle-sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-3">
              <PortalLogo size="md" showTagline />
              <div className="hidden">
                <h1 className="text-xl font-bold text-foreground">FintekPro Admin</h1>
                <p className="text-xs text-muted-foreground">System Administration Portal</p>
              </div>
            </div>
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground border-border hover:bg-card"
              onClick={() => setSearchOpen(true)}
              data-testid="btn-global-search"
            >
              <Search className="h-4 w-4 mr-2" />
              <span>Search features...</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-card px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>
          {/* Mobile search icon */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground"
            data-testid="btn-global-search-mobile"
          >
            <Search className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative" data-testid="btn-notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-background border-border">
                <DropdownMenuLabel className="text-muted-foreground">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-muted" />
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">All caught up!</p>
                  </div>
                ) : (
                  notifications.map(notification => (
                    <DropdownMenuItem 
                      key={notification.id}
                      className="flex items-start gap-3 p-3 cursor-pointer hover:bg-card"
                      onClick={() => notification.link && navigate(notification.link)}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                        notification.type === 'kyc' && "bg-orange-400",
                        notification.type === 'compliance' && "bg-red-400",
                        notification.type === 'order' && "bg-blue-400",
                        notification.type === 'system' && "bg-muted-foreground"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{notification.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{notification.message}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2 h-9 hover:bg-card rounded-lg"
                  data-testid="button-admin-profile-menu"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="text-left hidden md:block">
                    <p className="text-xs font-medium text-foreground leading-tight max-w-[100px] truncate">
                      {user?.email?.split('@')[0] || 'Admin'}
                    </p>
                    <p className="text-[10px] text-blue-400 font-medium capitalize">
                      {user?.roles?.includes('superadmin') ? 'Super Admin' : 'Admin'}
                    </p>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-background border-border shadow-xl" sideOffset={8}>
                <DropdownMenuLabel className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {user?.email?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {user?.firstName && user?.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user?.email?.split('@')[0] || 'Admin'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                      <p className="text-[10px] text-blue-400 font-medium capitalize mt-0.5">
                        {user?.roles?.includes('superadmin') ? 'Super Admin' : 'Admin'}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2.5 px-3 py-2 cursor-pointer">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Admin Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/theme-settings" className="flex items-center gap-2.5 px-3 py-2 cursor-pointer">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Theme & Accessibility</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/users" className="flex items-center gap-2.5 px-3 py-2 cursor-pointer">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Admin Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center gap-2.5 px-3 py-2 text-red-500 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                  onClick={() => logoutMutation.mutate()}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm font-medium">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex min-h-0">
        {/* Mobile backdrop overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            "bg-background border-r border-border transition-all duration-300 overflow-y-auto",
            "md:sticky md:top-[73px] md:h-[calc(100vh-73px)]",
            "max-md:fixed max-md:top-[73px] max-md:left-0 max-md:h-[calc(100vh-73px)] max-md:z-50 max-md:shadow-2xl",
            sidebarOpen
              ? "md:w-72 max-md:w-72 max-md:translate-x-0"
              : "md:w-0 md:border-0 max-md:-translate-x-full max-md:w-72"
          )}
        >
          {sidebarOpen && (
            <nav className="p-3 space-y-2">
              {navCategories.map(category => {
                const CategoryIcon = category.icon;
                const isCategoryExpanded = expandedCategories.has(category.id);
                const hasActiveItem = category.items.some(item => 
                  location === hrefPath(item.href) || 
                  item.children?.some(child => location === hrefPath(child.href) || location.startsWith(hrefPath(child.href) + '/'))
                );
                
                return (
                  <div key={category.id} className="space-y-1">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
                        hasActiveItem 
                          ? "bg-blue-600/10 text-blue-400" 
                          : "text-muted-foreground hover:bg-card hover:text-foreground"
                      )}
                      data-testid={`btn-category-${category.id}`}
                    >
                      <CategoryIcon className="h-4 w-4" />
                      <span className="text-sm font-semibold flex-1">{category.title}</span>
                      {isCategoryExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    
                    {isCategoryExpanded && (
                      <div className="ml-2 space-y-0.5">
                        {category.items.map(item => {
                          const Icon = item.icon;
                          const hasChildren = item.children && item.children.length > 0;
                          const isExpanded = expandedMenus.has(item.title);
                          const isActive = location === hrefPath(item.href);
                          const isChildActive = hasChildren && item.children?.some(
                            child => location === hrefPath(child.href) || location.startsWith(hrefPath(child.href) + '/')
                          );
                          
                          if (hasChildren) {
                            return (
                              <div key={item.title}>
                                <button
                                  onClick={() => toggleMenu(item.title)}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
                                    isChildActive
                                      ? "bg-blue-600/20 text-blue-400"
                                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                                  )}
                                  data-testid={`btn-menu-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Icon className="h-4 w-4 flex-shrink-0" />
                                  <span className="text-sm flex-1">{item.title}</span>
                                  {isExpanded ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </button>
                                
                                {isExpanded && (
                                  <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-3">
                                    {item.children?.map(child => {
                                      const ChildIcon = child.icon;
                                      const isChildItemActive = isHrefActive(child.href);
                                      
                                      return (
                                        <Link
                                          key={child.href}
                                          href={child.href}
                                          className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm",
                                            isChildItemActive
                                              ? "bg-blue-600 text-white"
                                              : "text-muted-foreground hover:bg-card hover:text-foreground"
                                          )}
                                          data-testid={`link-admin-${child.href.split('/').pop()}`}
                                        >
                                          <ChildIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                          <span>{child.title}</span>
                                        </Link>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          
                          const showBadge = item.href === '/admin/sms-inbox' && smsUnreadCount > 0;
                          
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                                isActive
                                  ? "bg-blue-600 text-white"
                                  : "text-muted-foreground hover:bg-card hover:text-foreground"
                              )}
                              data-testid={`link-admin-${item.href.split('/').pop()}`}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className="text-sm flex-1">{item.title}</span>
                              {showBadge && (
                                <Badge className="h-5 min-w-[20px] flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                                  {smsUnreadCount > 99 ? '99+' : smsUnreadCount}
                                </Badge>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          )}
        </aside>

        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto px-3 py-4 sm:p-6">
          <div className="w-full max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
