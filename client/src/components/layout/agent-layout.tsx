import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import fintekproLogo from "@assets/fintekpro_agent_1772539048012.png";
import { PortalLogo } from "@/components/portal/PortalLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPortalQueryParams } from "@/hooks/useSubdomain";
import {
  Users,
  BarChart3,
  Home,
  Bell,
  LogOut,
  Menu,
  X,
  FileText,
  Settings,
  AlertCircle,
  Brain,
  UserPlus,
  Wallet,
  Target,
  CheckSquare,
  Landmark,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronRight,
  Search,
  UserCheck,
  Plus,
  Calculator,
  Calendar,
  FileSignature,
  DollarSign,
  Clock,
  Trophy,
  GraduationCap,
  BookOpen,
  Lightbulb,
  Shield,
  FileCheck,
  Star,
  Palette,
  Banknote,
  ClipboardList,
  Video,
  Send,
  Sparkles,
  Mail,
  Microscope,
  Filter,
  ListChecks,
  ShieldAlert,
  Briefcase,
  HeartPulse,
  BellRing,
  Crosshair,
  UserCog,
  CircleCheck,
  FileEdit,
  Info,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePushNotifications, type AgentNotification } from "@/hooks/usePushNotifications";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import type { LucideIcon } from "lucide-react";

interface AgentLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
}

interface NavCategory {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

const agentNavCategories: NavCategory[] = [
  {
    title: "Dashboard",
    icon: Home,
    items: [
      { title: "Overview", href: "/agent", icon: Home, description: "Overview and metrics" },
      { title: "Tracker", href: "/agent/tracker", icon: TrendingUp, description: "MFCentral AUM, SIP & trail tracker", badge: "NEW" },
      { title: "My Profile", href: "/agent/kyc", icon: UserCheck, description: "Your personal & professional profile" },
      { title: "Pick of the Day", href: "/agent/picks", icon: Star, description: "Daily investment picks" },
      { title: "Leaderboard", href: "/agent/leaderboard", icon: Trophy, description: "Agent rankings" },
    ]
  },
  {
    title: "Leads & CRM",
    icon: Target,
    items: [
      { title: "Lead Pipeline", href: "/agent/leads", icon: TrendingUp, description: "Manage your lead pipeline" },
      { title: "Zoho CRM", href: "/agent/zoho-crm", icon: Target, description: "All leads from Zoho" },
      { title: "Tasks", href: "/agent/tasks", icon: CheckSquare, description: "Tasks and reminders" },
      { title: "Calendar", href: "/agent/calendar", icon: Calendar, description: "Appointments" },
      { title: "Meetings", href: "/agent/meetings", icon: Video, description: "Video meetings with clients" },
    ]
  },
  {
    title: "Clients",
    icon: Users,
    items: [
      { title: "My Clients", href: "/agent/clients", icon: Users, description: "Client portfolio" },
      { title: "Onboard Client", href: "/agent/onboard-client", icon: UserPlus, description: "New client KYC" },
      { title: "KYC Rejection", href: "/kyc-rejections", icon: ShieldAlert, description: "Reject client KYC sessions" },
    ]
  },
  {
    title: "Proposals",
    icon: FileText,
    items: [
      { title: "Create Proposal", href: "/agent/proposal-builder", icon: Plus, description: "Multi-product proposals" },
      { title: "My Proposals", href: "/agent/proposals", icon: FileCheck, description: "View proposals" },
      { title: "E-Sign", href: "/agent/esign", icon: FileSignature, description: "Electronic signatures" },
    ]
  },
  {
    title: "Loans",
    icon: Banknote,
    items: [
      { title: "Submit Loan Lead", href: "/agent/loan-apply", icon: Plus, description: "Submit client loan application" },
      { title: "Track Applications", href: "/agent/loan-applications", icon: ClipboardList, description: "Monitor your leads" },
      { title: "DSA Performance", href: "/agent/dsa-performance", icon: BarChart3, description: "Your loan metrics" },
    ]
  },
  {
    title: "Operations",
    icon: Wallet,
    items: [
      { title: "Revenue", href: "/agent/revenue", icon: Wallet, description: "AUM and commissions" },
      { title: "My Payouts", href: "/agent/payouts", icon: DollarSign, description: "Earnings & payouts" },
      { title: "Reports", href: "/agent/reports", icon: BarChart3, description: "Client reports" },
      { title: "AI Advisory", href: "/agent/investment-advisory", icon: Brain, description: "AI recommendations" },
      { title: "ITR Services", href: "/agent/tax-cases", icon: FileText, description: "ITR filing & tax services" },
      { title: "Festival Greetings", href: "/agent/festival-greetings", icon: Sparkles, description: "Send festival wishes" },
      { title: "Bulk Communication", href: "/agent/bulk-communication", icon: Mail, description: "Email/SMS campaigns" },
      { title: "Agent Marketing Profile", href: "/agent/advisor-profile", icon: Briefcase, description: "Photo, credentials & public microsite" },
      { title: "SIP Health Monitor", href: "/agent/sip-health", icon: HeartPulse, description: "Client SIP status dashboard" },
      { title: "Market Alert Center", href: "/agent/market-alerts", icon: BellRing, description: "Significant moves in client holdings" },
      { title: "Portfolio Drift", href: "/agent/portfolio-drift", icon: Crosshair, description: "Detect allocation drift across clients" },
    ]
  },
  {
    title: "Research",
    icon: Microscope,
    items: [
      { title: "Research Lists", href: "/agent/research-lists", icon: ListChecks, description: "Curated instrument lists" },
      { title: "Research Note", href: "/research/generate", icon: FileText, description: "Institutional PPT & PDF reports", badge: "AI" },
      { title: "Screener", href: "/agent/screener", icon: Filter, description: "Filter instruments" },
      { title: "Analytics", href: "/agent/research-analytics", icon: BarChart3, description: "Performance analysis" },
    ]
  },
  {
    title: "Knowledge",
    icon: BookOpen,
    items: [
      { title: "Knowledge Hub", href: "/agent/knowledge-hub", icon: BookOpen, description: "Market briefs & insights" },
      { title: "Training", href: "/agent/training", icon: GraduationCap, description: "Training & certification" },
      { title: "Settings", href: "/agent/settings", icon: Settings, description: "Your preferences" },
      { title: "Theme & Accessibility", href: "/agent/theme-settings", icon: Palette, description: "Visual customization" },
    ]
  }
];

const allNavItems = agentNavCategories.flatMap(cat => cat.items);

const mobileNavItems = [
  { title: "Home", href: "/agent", icon: Home },
  { title: "Clients", href: "/agent/clients", icon: Users },
  { title: "Leads", href: "/agent/leads", icon: Target },
  { title: "Proposals", href: "/agent/proposals", icon: FileText },
  { title: "More", href: "/agent/settings", icon: Settings },
];

const MobileBottomNav = memo(function MobileBottomNav({ location }: { location: string }) {
  const [, navigate] = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-slate-900/95 backdrop-blur-md border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/agent" && location.startsWith(item.href));
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                isActive ? "text-emerald-400" : "text-muted-foreground active:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

export function AgentLayout({ children }: AgentLayoutProps) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) return false;
      const saved = localStorage.getItem('agent-sidebar-open');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agent-expanded-categories');
      return saved ? new Set(JSON.parse(saved)) : new Set(["Dashboard", "Leads & CRM"]);
    }
    return new Set(["Dashboard", "Leads & CRM"]);
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem('agent-sidebar-open', String(sidebarOpen));
    }
  }, [sidebarOpen]);
  
  // Persist expanded categories
  useEffect(() => {
    localStorage.setItem('agent-expanded-categories', JSON.stringify(Array.from(expandedCategories)));
  }, [expandedCategories]);

  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading: pushLoading,
    notifications,
    unreadCount,
    enableNotifications,
    markAsRead,
    markAllAsRead
  } = usePushNotifications();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault();
        setSearchOpen(open => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    agentNavCategories.forEach(category => {
      const isActive = category.items.some(item => location === item.href);
      if (isActive) {
        setExpandedCategories(prev => new Set(Array.from(prev).concat(category.title)));
      }
    });
  }, [location]);

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/logout", { method: "POST" }),
    onSuccess: () => {
      // Redirect to auth page, staying on the agent subdomain
      window.location.href = "/auth" + getPortalQueryParams();
    },
  });

  const toggleCategory = useCallback((title: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  }, []);

  const getNotificationIcon = useCallback((type: AgentNotification['type']) => {
    switch (type) {
      case 'lead_assigned': return Target;
      case 'task_due': return CheckSquare;
      case 'meeting_reminder': return Clock;
      case 'proposal_response': return FileText;
      case 'commission_credited': return DollarSign;
      default: return Bell;
    }
  }, []);

  const getNotificationColor = useCallback((type: AgentNotification['type']) => {
    switch (type) {
      case 'lead_assigned': return "bg-blue-500/20 text-blue-400";
      case 'task_due': return "bg-amber-500/20 text-amber-400";
      case 'meeting_reminder': return "bg-purple-500/20 text-purple-400";
      case 'proposal_response': return "bg-emerald-500/20 text-emerald-400";
      case 'commission_credited': return "bg-green-500/20 text-green-400";
      default: return "bg-muted/20 text-muted-foreground";
    }
  }, []);

  const formatTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }, []);

  const notificationList = useMemo(() => (
    notifications.length === 0 ? (
      <div className="p-6 text-center">
        <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">No notifications yet</p>
      </div>
    ) : (
      <div className="p-2 space-y-1">
        {notifications.map(notification => {
          const Icon = getNotificationIcon(notification.type);
          return (
            <Link
              key={notification.id}
              href={notification.link || '/'}
              onClick={() => {
                if (!notification.read) {
                  markAsRead(notification.id);
                }
                setNotificationsOpen(false);
              }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg transition-colors",
                notification.read 
                  ? "hover:bg-card/50" 
                  : "bg-card/50 hover:bg-card"
              )}
              data-testid={`notification-${notification.id}`}
            >
              <div className={cn("p-2 rounded-full", getNotificationColor(notification.type))}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm",
                  notification.read ? "text-muted-foreground" : "text-foreground font-medium"
                )}>
                  {notification.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimeAgo(notification.createdAt)}
                </p>
              </div>
              {!notification.read && (
                <span className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </div>
    )
  ), [notifications, getNotificationIcon, getNotificationColor, formatTimeAgo, markAsRead]);

  const sidebarContent = useMemo(() => (
    <nav className="px-2 sm:px-3 pt-1 pb-3">
      {agentNavCategories.map((category) => {
        const CategoryIcon = category.icon;
        const isExpanded = expandedCategories.has(category.title);
        const hasActiveItem = category.items.some(item => location === item.href);

        return (
          <div key={category.title}>
            <button
              onClick={() => toggleCategory(category.title)}
              className={cn(
                "flex items-center justify-between w-full px-3 py-2 sm:py-1.5 rounded-md text-sm font-medium transition-all duration-200 touch-manipulation",
                hasActiveItem 
                  ? "bg-card/80 text-foreground" 
                  : "text-muted-foreground hover:bg-card/40 hover:text-foreground active:bg-card/60"
              )}
              data-testid={`button-category-${category.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex items-center gap-2">
                <CategoryIcon className={cn("h-4 w-4", hasActiveItem && "text-emerald-400")} />
                <span className="text-[13px] sm:text-sm">{category.title}</span>
              </div>
              <ChevronRight className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-90"
              )} />
            </button>

            {isExpanded && (
              <div className="ml-3 pl-3 border-l border-border/40">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        if (window.innerWidth < 768) {
                          setSidebarOpen(false);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-150 group touch-manipulation",
                        isActive
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-foreground shadow-sm shadow-emerald-500/20"
                          : "text-muted-foreground hover:bg-card/60 hover:text-foreground active:bg-card/80"
                      )}
                      data-testid={`link-agent-${item.href.split('/').pop() || 'home'}`}
                    >
                      <Icon className={cn(
                        "h-3.5 w-3.5 flex-shrink-0",
                        isActive ? "text-foreground" : "text-muted-foreground group-hover:text-emerald-400"
                      )} />
                      <span className={cn(
                        "text-[13px] flex-1",
                        isActive ? "font-medium" : ""
                      )}>
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className={cn(
                          "text-[9px] font-bold px-1 py-0.5 rounded leading-none",
                          item.badge === "AI"
                            ? "bg-blue-600 text-white"
                            : item.badge === "LIVE"
                            ? "bg-red-500 text-white animate-pulse"
                            : "bg-emerald-600 text-white"
                        )}>
                          {item.badge}
                        </span>
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
  ), [expandedCategories, location, toggleCategory, setSidebarOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Skeleton Header */}
        <header className="bg-background border-b border-border sticky top-0 z-50">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-card rounded animate-pulse" />
              <div>
                <div className="h-5 w-32 bg-card rounded animate-pulse mb-1" />
                <div className="h-3 w-24 bg-card rounded animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-card rounded-full animate-pulse" />
              <div className="w-8 h-8 bg-card rounded-full animate-pulse" />
            </div>
          </div>
        </header>
        
        <div className="flex">
          {/* Skeleton Sidebar */}
          <aside className="w-64 bg-background border-r border-border min-h-[calc(100vh-64px)] p-4">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-20 bg-card rounded animate-pulse" />
                  <div className="h-8 w-full bg-card rounded animate-pulse" />
                  <div className="h-8 w-full bg-card rounded animate-pulse" />
                </div>
              ))}
            </div>
          </aside>
          
          {/* Skeleton Main Content */}
          <main className="flex-1 p-6">
            <div className="space-y-6">
              <div className="h-8 w-48 bg-card rounded animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-card rounded-lg animate-pulse" />
                ))}
              </div>
              <div className="h-64 bg-card rounded-lg animate-pulse" />
            </div>
          </main>
        </div>
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
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const isAgent = user.roles?.includes('agent') || user.roles?.includes('admin') || user.roles?.includes('superadmin') || user.roles?.includes('partner');

  if (!isAgent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center justify-center p-4">
        <div className="bg-background rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Access Denied
          </h1>
          <p className="text-muted-foreground mb-6">
            This agent portal is restricted to registered agents only. Please sign in with an agent account.
          </p>
          <div className="space-y-3">
            <Button asChild className="w-full">
              <a href="/auth">Sign In</a>
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
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <NotificationPermissionBanner
        isSupported={isSupported}
        permission={permission}
        isSubscribed={isSubscribed}
        onEnableNotifications={enableNotifications}
        isLoading={pushLoading}
      />

      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-border z-50 shadow-lg shadow-black/20 backdrop-blur supports-[backdrop-filter]:bg-slate-900/95 flex-shrink-0">
        <div className="flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2.5">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all h-9 w-9 sm:h-9 sm:w-9"
              data-testid="toggle-agent-sidebar"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2 sm:gap-3">
              <PortalLogo size="md" showTagline />
              <div className="hidden">
                <h1 className="text-sm sm:text-lg font-semibold text-foreground tracking-tight">FintekPro</h1>
                <p className="text-[9px] sm:text-[10px] text-emerald-400 font-medium uppercase tracking-wider hidden sm:block">Agent Portal</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile search button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              className="text-muted-foreground hover:text-foreground hover:bg-card/50 h-9 w-9 sm:hidden rounded-lg"
              data-testid="button-agent-search-mobile"
            >
              <Search className="h-4 w-4" />
            </Button>
            
            {/* Desktop search bar */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="text-muted-foreground hover:text-foreground hover:bg-card/50 gap-2 hidden sm:flex h-9 px-3 rounded-lg border border-border/50 bg-card/30"
              data-testid="button-agent-search"
            >
              <Search className="h-4 w-4" />
              <span className="text-xs text-muted-foreground hidden md:inline">Search...</span>
              <kbd className="ml-2 pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground lg:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            <Link href="/agent/theme-settings" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-card/50 h-9 w-9 rounded-lg" data-testid="btn-theme-settings" title="Theme & Accessibility">
                <Palette className="h-4 w-4" />
              </Button>
            </Link>

            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-foreground hover:bg-card/50 h-9 w-9 rounded-lg relative"
                  data-testid="button-agent-notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 sm:h-4 sm:w-4 flex items-center justify-center p-0 text-[10px] bg-emerald-500 border-0 animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-1rem)] sm:w-96 max-w-96 p-0 bg-background border-border" align="end" sideOffset={8}>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Notifications</h3>
                    <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
                  </div>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllAsRead()}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      data-testid="button-mark-all-read"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <ScrollArea className="max-h-96">
                  {notificationList}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <div className="border-l border-border/50 pl-2 sm:pl-4 ml-1 sm:ml-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2 h-9 hover:bg-card/50 text-foreground rounded-lg"
                    data-testid="button-agent-profile-menu"
                  >
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-emerald-600 to-slate-700 flex items-center justify-center text-white text-xs sm:text-sm font-semibold shadow-inner flex-shrink-0">
                      {user?.email?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div className="text-left hidden md:block">
                      <p className="text-xs font-medium text-foreground leading-tight max-w-[90px] truncate">{user?.email?.split('@')[0] || 'Agent'}</p>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        <p className="text-[10px] text-emerald-400 font-medium">Active</p>
                      </div>
                    </div>
                    <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-64 bg-background border-border shadow-xl" sideOffset={8}>
                  {/* Profile header */}
                  <DropdownMenuLabel className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {user?.email?.charAt(0).toUpperCase() || 'A'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {user?.firstName && user?.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user?.email?.split('@')[0] || 'Agent'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          <span className="text-[10px] text-emerald-500 font-medium">Agent · Active</span>
                        </div>
                      </div>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  {/* KYC Quick Actions */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-1.5 font-semibold">
                      KYC Actions
                    </DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href="/agent/onboard-client" className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                        <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                          <UserPlus className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Start Client KYC</p>
                          <p className="text-xs text-muted-foreground">Onboard & complete KYC</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/agent/clients" className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                        <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <CircleCheck className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">KYC Status</p>
                          <p className="text-xs text-muted-foreground">View client KYC progress</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/kyc-rejections" className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                        <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                          <ShieldAlert className="h-4 w-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">KYC Rejections</p>
                          <p className="text-xs text-muted-foreground">Retry failed KYC cases</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  {/* Account links */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-1.5 font-semibold">
                      My Account
                    </DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href="/agent/kyc" className="flex items-center gap-2.5 px-3 py-2 cursor-pointer">
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">My Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/agent/settings" className="flex items-center gap-2.5 px-3 py-2 cursor-pointer">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/agent/theme-settings" className="flex items-center gap-2.5 px-3 py-2 cursor-pointer">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Theme & Accessibility</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="flex items-center gap-2.5 px-3 py-2 text-red-500 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                    onClick={() => logoutMutation.mutate()}
                    data-testid="button-agent-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm font-medium">Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search clients, proposals, tasks..." className="border-0" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => { navigate('/agent/zoho-crm'); setSearchOpen(false); }}>
              <Target className="mr-2 h-4 w-4" />
              <span>Zoho CRM Leads</span>
            </CommandItem>
            <CommandItem onSelect={() => { navigate('/agent/proposal-builder'); setSearchOpen(false); }}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Create Proposal</span>
            </CommandItem>
            <CommandItem onSelect={() => { navigate('/agent/clients'); setSearchOpen(false); }}>
              <Users className="mr-2 h-4 w-4" />
              <span>My Clients</span>
            </CommandItem>
            <CommandItem onSelect={() => { navigate('/agent/tasks'); setSearchOpen(false); }}>
              <CheckSquare className="mr-2 h-4 w-4" />
              <span>Tasks</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Navigation">
            {allNavItems.map(item => (
              <CommandItem
                key={item.href}
                onSelect={() => { navigate(item.href); setSearchOpen(false); }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{item.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" 
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          data-testid="agent-sidebar"
          className={cn(
            "bg-card flex-shrink-0 overflow-y-auto shadow-lg border-r border-border scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent transition-all duration-300 ease-in-out",
            "md:relative md:h-full",
            "max-md:fixed max-md:left-0 max-md:top-[49px] max-md:z-50 max-md:h-[calc(100vh-49px)] max-md:w-[280px] max-md:shadow-2xl max-md:transition-transform max-md:duration-300 max-md:ease-in-out",
            sidebarOpen 
              ? "md:w-60 md:min-w-[240px] max-md:translate-x-0" 
              : "md:w-0 md:min-w-0 md:overflow-hidden md:border-0 md:shadow-none max-md:-translate-x-full"
          )}
        >
          {sidebarContent}
        </aside>

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-secondary/30 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <div className="w-full max-w-7xl mx-auto px-3 py-3 sm:p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav location={location} />
    </div>
  );
}
