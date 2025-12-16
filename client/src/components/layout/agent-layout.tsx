import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Users,
  BarChart3,
  Home,
  Bell,
  LogOut,
  Menu,
  X,
  FileText,
  Building2,
  DollarSign,
  Settings,
  UserPlus,
  Briefcase,
  TrendingUp,
  PieChart,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Target,
  ClipboardList,
  CreditCard,
  Shield,
  Clock,
  Wallet
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AgentLayoutProps {
  children: React.ReactNode;
}

const agentNavItems = [
  {
    title: "Dashboard",
    href: "/agent",
    icon: Home,
    description: "Overview and performance metrics"
  },
  {
    title: "My Clients",
    href: "/agent/clients",
    icon: Users,
    description: "Manage your client portfolio"
  },
  {
    title: "Lead Management",
    href: "/agent/leads",
    icon: UserPlus,
    description: "Track and convert prospects"
  },
  {
    title: "Proposals",
    href: "/agent/proposals",
    icon: FileText,
    description: "Investment proposals and recommendations"
  },
  {
    title: "Products",
    href: "/agent/products",
    icon: Briefcase,
    description: "Browse & recommend products",
    children: [
      {
        title: "Mutual Funds",
        href: "/agent/products/mutual-funds",
        icon: PieChart,
        description: "MF schemes & SIPs"
      },
      {
        title: "Insurance",
        href: "/agent/products/insurance",
        icon: Shield,
        description: "Life & general insurance"
      },
      {
        title: "Loans",
        href: "/agent/products/loans",
        icon: CreditCard,
        description: "Personal & home loans"
      },
      {
        title: "Fixed Income",
        href: "/agent/products/fixed-income",
        icon: Wallet,
        description: "Bonds & fixed deposits"
      }
    ]
  },
  {
    title: "Transactions",
    href: "/agent/transactions",
    icon: ClipboardList,
    description: "View all transactions"
  },
  {
    title: "Commission",
    href: "/agent/commission",
    icon: DollarSign,
    description: "Earnings and payouts",
    children: [
      {
        title: "Earnings",
        href: "/agent/commission/earnings",
        icon: TrendingUp,
        description: "Commission breakdown"
      },
      {
        title: "Payouts",
        href: "/agent/commission/payouts",
        icon: Wallet,
        description: "Payout history"
      },
      {
        title: "Pending",
        href: "/agent/commission/pending",
        icon: Clock,
        description: "Pending commissions"
      }
    ]
  },
  {
    title: "Reports",
    href: "/agent/reports",
    icon: BarChart3,
    description: "Performance analytics"
  },
  {
    title: "Targets",
    href: "/agent/targets",
    icon: Target,
    description: "Goals and achievements"
  },
  {
    title: "Sub-Agents",
    href: "/agent/sub-agents",
    icon: Building2,
    description: "Manage your team"
  },
  {
    title: "Settings",
    href: "/agent/settings",
    icon: Settings,
    description: "Profile and preferences"
  }
];

export function AgentLayout({ children }: AgentLayoutProps) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  useEffect(() => {
    agentNavItems.forEach(item => {
      if (item.children) {
        const isChildActive = item.children.some(child => location === child.href || location.startsWith(child.href + '/'));
        if (isChildActive) {
          setExpandedMenus(prev => {
            const next = new Set(Array.from(prev));
            next.add(item.title);
            return next;
          });
        }
      }
    });
  }, [location]);

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
      window.location.href = "/";
    },
  });

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

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
            </Button>

            <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
              <div className="text-right">
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

      <div className="flex">
        <aside
          className={cn(
            "bg-slate-900 border-r border-slate-800 transition-all duration-300 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)]",
            sidebarOpen ? "w-72" : "w-0 border-0"
          )}
        >
          {sidebarOpen && (
            <nav className="p-4 space-y-1">
              {agentNavItems.map((item) => {
                const Icon = item.icon;
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedMenus.has(item.title);
                const isActive = location === item.href;
                const isChildActive = hasChildren && item.children?.some(
                  child => location === child.href || location.startsWith(child.href + '/')
                );

                if (hasChildren) {
                  return (
                    <div key={item.title}>
                      <button
                        onClick={() => toggleMenu(item.title)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group",
                          isChildActive
                            ? "bg-emerald-600/20 text-emerald-400"
                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        )}
                        data-testid={`button-agent-menu-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                          <p className={cn(
                            "text-sm font-medium",
                            isChildActive ? "text-emerald-400" : "text-slate-300 group-hover:text-white"
                          )}>
                            {item.title}
                          </p>
                          <p className="text-xs mt-0.5 text-slate-500">
                            {item.description}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-4">
                          {item.children?.map((child) => {
                            const ChildIcon = child.icon;
                            const isChildItemActive = location === child.href;

                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                                  isChildItemActive
                                    ? "bg-emerald-600 text-white"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                )}
                                data-testid={`link-agent-${child.href.split('/').pop()}`}
                              >
                                <ChildIcon className="h-4 w-4 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "text-sm",
                                    isChildItemActive ? "text-white font-medium" : "text-slate-300 group-hover:text-white"
                                  )}>
                                    {child.title}
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 rounded-lg transition-colors group",
                      isActive
                        ? "bg-emerald-600 text-white"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                    data-testid={`link-agent-${item.href.split('/').pop()}`}
                  >
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        isActive ? "text-white" : "text-slate-300 group-hover:text-white"
                      )}>
                        {item.title}
                      </p>
                      <p className={cn(
                        "text-xs mt-0.5",
                        isActive ? "text-emerald-100" : "text-slate-500 group-hover:text-slate-400"
                      )}>
                        {item.description}
                      </p>
                    </div>
                  </Link>
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
