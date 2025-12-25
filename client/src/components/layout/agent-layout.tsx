import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Trophy
} from "lucide-react";
import { useState, useEffect } from "react";
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
}

interface NavCategory {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

const agentNavCategories: NavCategory[] = [
  {
    title: "Core Operations",
    icon: Home,
    items: [
      { title: "Dashboard", href: "/", icon: Home, description: "Overview and metrics" },
      { title: "Revenue Cockpit", href: "/revenue", icon: Wallet, description: "AUM and commissions" },
      { title: "Leaderboard", href: "/leaderboard", icon: Trophy, description: "Agent rankings" },
      { title: "Commission Calculator", href: "/commission-calculator", icon: Calculator, description: "Calculate earnings" },
      { title: "My Clients", href: "/clients", icon: Users, description: "Client portfolio" },
      { title: "Onboard Client", href: "/onboard-client", icon: UserPlus, description: "New client KYC" },
      { title: "Lead Pipeline", href: "/leads", icon: Target, description: "Track prospects" },
      { title: "Sales Pipeline", href: "/crm/pipeline", icon: TrendingUp, description: "Deal stages" },
      { title: "CRM Analytics", href: "/crm/analytics", icon: BarChart3, description: "CRM insights" },
      { title: "Tasks", href: "/tasks", icon: CheckSquare, description: "Tasks and reminders" },
      { title: "Calendar", href: "/calendar", icon: Calendar, description: "Appointments & scheduling" },
      { title: "Bulk Communication", href: "/bulk-communication", icon: Bell, description: "SMS, Email, WhatsApp" },
    ]
  },
  {
    title: "AI Tools",
    icon: Brain,
    items: [
      { title: "AI Advisory", href: "/investment-advisory", icon: Brain, description: "AI recommendations" },
      { title: "Bond AI", href: "/bond-recommendations", icon: Landmark, description: "Bond portfolio" },
      { title: "Stock AI", href: "/stock-ai", icon: TrendingUp, description: "Stock recommendations" },
      { title: "F&O Analytics", href: "/derivatives", icon: Activity, description: "Futures & Options" },
    ]
  },
  {
    title: "Documents",
    icon: FileText,
    items: [
      { title: "Proposal Builder", href: "/proposal-builder", icon: UserPlus, description: "Create proposals" },
      { title: "Proposals", href: "/proposals", icon: FileText, description: "View proposals" },
      { title: "E-Sign", href: "/esign", icon: FileSignature, description: "Electronic signatures" },
      { title: "Reports", href: "/reports", icon: BarChart3, description: "Client reports" },
      { title: "Demo Progress", href: "/demo-progress", icon: TrendingUp, description: "Track demos" },
    ]
  },
  {
    title: "Settings",
    icon: Settings,
    items: [
      { title: "Profile & Settings", href: "/agent-portal", icon: Settings, description: "Your preferences" },
    ]
  }
];

const allNavItems = agentNavCategories.flatMap(cat => cat.items);

export function AgentLayout({ children }: AgentLayoutProps) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Core Operations"]));
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
      window.location.href = "/";
    },
  });

  const toggleCategory = (title: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  const getNotificationIcon = (type: AgentNotification['type']) => {
    switch (type) {
      case 'lead_assigned': return Target;
      case 'task_due': return CheckSquare;
      case 'meeting_reminder': return Clock;
      case 'proposal_response': return FileText;
      case 'commission_credited': return DollarSign;
      default: return Bell;
    }
  };

  const getNotificationColor = (type: AgentNotification['type']) => {
    switch (type) {
      case 'lead_assigned': return "bg-blue-500/20 text-blue-400";
      case 'task_due': return "bg-amber-500/20 text-amber-400";
      case 'meeting_reminder': return "bg-purple-500/20 text-purple-400";
      case 'proposal_response': return "bg-emerald-500/20 text-emerald-400";
      case 'commission_credited': return "bg-green-500/20 text-green-400";
      default: return "bg-slate-500/20 text-slate-400";
    }
  };

  const formatTimeAgo = (dateString: string) => {
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
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/auth';
    return null;
  }

  const isAgent = user.roles?.includes('agent') || user.roles?.includes('admin') || user.roles?.includes('superadmin');

  if (!isAgent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This agent portal is restricted to registered agents only.
          </p>
          <Button asChild className="w-full">
            <a href="https://fintekpro.com">Go to Main Portal</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
      <NotificationPermissionBanner
        isSupported={isSupported}
        permission={permission}
        isSubscribed={isSubscribed}
        onEnableNotifications={enableNotifications}
        isLoading={pushLoading}
      />

      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-white"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">FintekPro Agent</h1>
              <p className="text-xs text-slate-400">Agent Distribution Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="text-slate-400 hover:text-white gap-2 hidden md:flex"
              data-testid="button-agent-search"
            >
              <Search className="h-4 w-4" />
              <span className="text-xs">Search...</span>
              <kbd className="ml-2 pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-400 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 hover:text-white relative"
                  data-testid="button-agent-notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-emerald-500 border-0">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0 bg-slate-900 border-slate-700" align="end">
                <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Notifications</h3>
                    <p className="text-xs text-slate-400">{unreadCount} unread</p>
                  </div>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllAsRead()}
                      className="text-xs text-slate-400 hover:text-white"
                      data-testid="button-mark-all-read"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <ScrollArea className="max-h-96">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <Bell className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No notifications yet</p>
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
                                ? "hover:bg-slate-800/50" 
                                : "bg-slate-800/50 hover:bg-slate-800"
                            )}
                            data-testid={`notification-${notification.id}`}
                          >
                            <div className={cn("p-2 rounded-full", getNotificationColor(notification.type))}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm",
                                notification.read ? "text-slate-300" : "text-white font-medium"
                              )}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
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
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-3 border-l border-slate-800 pl-4 ml-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">{user?.email}</p>
                <p className="text-xs text-slate-400 capitalize">Agent</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                className="text-slate-400 hover:text-red-400"
                data-testid="button-agent-logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search clients, proposals, tasks..." className="border-0" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => { navigate('/clients'); setSearchOpen(false); }}>
              <Users className="mr-2 h-4 w-4" />
              <span>View All Clients</span>
            </CommandItem>
            <CommandItem onSelect={() => { navigate('/proposal-builder'); setSearchOpen(false); }}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Create New Proposal</span>
            </CommandItem>
            <CommandItem onSelect={() => { navigate('/tasks'); setSearchOpen(false); }}>
              <CheckSquare className="mr-2 h-4 w-4" />
              <span>View Tasks</span>
            </CommandItem>
            <CommandItem onSelect={() => { navigate('/leads'); setSearchOpen(false); }}>
              <Target className="mr-2 h-4 w-4" />
              <span>Lead Pipeline</span>
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
                <span className="ml-auto text-xs text-slate-500">{item.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <div className="flex">
        <aside
          className={cn(
            "bg-slate-900 border-r border-slate-800 transition-all duration-300 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)]",
            sidebarOpen ? "w-72" : "w-0 border-0"
          )}
        >
          {sidebarOpen && (
            <nav className="p-3 space-y-1">
              {agentNavCategories.map((category) => {
                const CategoryIcon = category.icon;
                const isExpanded = expandedCategories.has(category.title);
                const hasActiveItem = category.items.some(item => location === item.href);

                return (
                  <div key={category.title} className="space-y-1">
                    <button
                      onClick={() => toggleCategory(category.title)}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        hasActiveItem 
                          ? "bg-slate-800 text-white" 
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      )}
                      data-testid={`button-category-${category.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="h-4 w-4" />
                        <span>{category.title}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="ml-4 pl-2 border-l border-slate-800 space-y-1">
                        {category.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = location === item.href;

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                                isActive
                                  ? "bg-emerald-600 text-white"
                                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                              )}
                              data-testid={`link-agent-${item.href.split('/').pop() || 'home'}`}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-sm",
                                  isActive ? "text-white font-medium" : "text-slate-300 group-hover:text-white"
                                )}>
                                  {item.title}
                                </p>
                              </div>
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

        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
