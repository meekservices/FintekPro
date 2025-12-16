import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Home,
  Bell,
  LogOut,
  Menu,
  X,
  Package,
  MessageCircle,
  BarChart3,
  Settings,
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Building2,
  ClipboardList,
  Handshake,
  PieChart,
  Target,
  Wallet,
  HelpCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PartnerLayoutProps {
  children: React.ReactNode;
}

const partnerNavItems = [
  {
    title: "Dashboard",
    href: "/partner",
    icon: Home,
    description: "Overview and key metrics"
  },
  {
    title: "Products",
    href: "/partner/products",
    icon: Package,
    description: "Manage your product catalog"
  },
  {
    title: "Orders",
    href: "/partner/orders",
    icon: ClipboardList,
    description: "Track customer orders"
  },
  {
    title: "Revenue",
    href: "/partner/revenue",
    icon: DollarSign,
    description: "Revenue and settlements",
    children: [
      {
        title: "Earnings",
        href: "/partner/revenue/earnings",
        icon: TrendingUp,
        description: "Revenue breakdown"
      },
      {
        title: "Settlements",
        href: "/partner/revenue/settlements",
        icon: Wallet,
        description: "Payment history"
      },
      {
        title: "Commissions",
        href: "/partner/revenue/commissions",
        icon: Target,
        description: "Commission structure"
      }
    ]
  },
  {
    title: "Clients",
    href: "/partner/clients",
    icon: Users,
    description: "Customer relationships"
  },
  {
    title: "Leads",
    href: "/partner/leads",
    icon: Handshake,
    description: "Lead management"
  },
  {
    title: "Analytics",
    href: "/partner/analytics",
    icon: BarChart3,
    description: "Performance insights",
    children: [
      {
        title: "Sales Analytics",
        href: "/partner/analytics/sales",
        icon: TrendingUp,
        description: "Sales performance"
      },
      {
        title: "Product Analytics",
        href: "/partner/analytics/products",
        icon: PieChart,
        description: "Product performance"
      },
      {
        title: "Client Analytics",
        href: "/partner/analytics/clients",
        icon: Users,
        description: "Client insights"
      }
    ]
  },
  {
    title: "Reports",
    href: "/partner/reports",
    icon: FileText,
    description: "Download reports"
  },
  {
    title: "Support",
    href: "/partner/support",
    icon: MessageCircle,
    description: "Support tickets"
  },
  {
    title: "CA Support",
    href: "/partner/ca-support",
    icon: HelpCircle,
    description: "CA assistance requests"
  },
  {
    title: "Company Profile",
    href: "/partner/company",
    icon: Building2,
    description: "Business information"
  },
  {
    title: "Settings",
    href: "/partner/settings",
    icon: Settings,
    description: "Account preferences"
  }
];

export function PartnerLayout({ children }: PartnerLayoutProps) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  useEffect(() => {
    partnerNavItems.forEach(item => {
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
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/auth';
    return null;
  }

  const isPartner = user.roles?.includes('partner') || user.roles?.includes('admin') || user.roles?.includes('superadmin');

  if (!isPartner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This partner portal is restricted to registered partners only.
          </p>
          <Button asChild className="w-full">
            <a href="https://fintekpro.com">Go to Main Portal</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-950 text-gray-100">
      <header className="bg-indigo-900 border-b border-indigo-800 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-indigo-300 hover:text-white"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">FintekPro Partner</h1>
              <p className="text-xs text-indigo-300">Business Partner Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-indigo-300 hover:text-white relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-violet-500 rounded-full" />
            </Button>

            <div className="flex items-center gap-3 border-l border-indigo-800 pl-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user?.email}</p>
                <p className="text-xs text-indigo-300 capitalize">Partner</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                className="text-indigo-300 hover:text-red-400"
                data-testid="button-partner-logout"
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
            "bg-indigo-900 border-r border-indigo-800 transition-all duration-300 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)]",
            sidebarOpen ? "w-72" : "w-0 border-0"
          )}
        >
          {sidebarOpen && (
            <nav className="p-4 space-y-1">
              {partnerNavItems.map((item) => {
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
                            ? "bg-violet-600/20 text-violet-400"
                            : "text-indigo-300 hover:bg-indigo-800 hover:text-white"
                        )}
                        data-testid={`button-partner-menu-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                          <p className={cn(
                            "text-sm font-medium",
                            isChildActive ? "text-violet-400" : "text-indigo-200 group-hover:text-white"
                          )}>
                            {item.title}
                          </p>
                          <p className="text-xs mt-0.5 text-indigo-400">
                            {item.description}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-indigo-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-indigo-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-indigo-700 pl-4">
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
                                    ? "bg-violet-600 text-white"
                                    : "text-indigo-300 hover:bg-indigo-800 hover:text-white"
                                )}
                                data-testid={`link-partner-${child.href.split('/').pop()}`}
                              >
                                <ChildIcon className="h-4 w-4 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "text-sm",
                                    isChildItemActive ? "text-white font-medium" : "text-indigo-200 group-hover:text-white"
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
                        ? "bg-violet-600 text-white"
                        : "text-indigo-300 hover:bg-indigo-800 hover:text-white"
                    )}
                    data-testid={`link-partner-${item.href.split('/').pop()}`}
                  >
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        isActive ? "text-white" : "text-indigo-200 group-hover:text-white"
                      )}>
                        {item.title}
                      </p>
                      <p className={cn(
                        "text-xs mt-0.5",
                        isActive ? "text-violet-100" : "text-indigo-400 group-hover:text-indigo-300"
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
