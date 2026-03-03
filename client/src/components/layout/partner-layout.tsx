import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import fintekproLogo from "@assets/fintekpro_favicon_1772531115807.png";
import { PortalLogo } from "@/components/portal/PortalLogo";
import { Button } from "@/components/ui/button";
import { getPortalQueryParams } from "@/hooks/useSubdomain";
import {
  Home,
  Bell,
  LogOut,
  Menu,
  X,
  Settings,
  Users,
  HelpCircle,
  BarChart3,
  UserCheck,
  Wallet,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PartnerLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  title: string;
  href?: string;
  icon: any;
  description: string;
  children?: { title: string; href: string; description?: string }[];
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const partnerNavSections: NavSection[] = [
  {
    section: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/partner-portal",
        icon: Home,
        description: "Key metrics & overview"
      }
    ]
  },
  {
    section: "Agent Management",
    items: [
      {
        title: "My Agents",
        href: "/partner/agents",
        icon: Users,
        description: "Recruit & manage agents"
      },
      {
        title: "Agent Performance",
        href: "/partner/agent-performance",
        icon: BarChart3,
        description: "Track agent metrics & P&L"
      },
      {
        title: "Agent Payouts",
        href: "/partner/payouts",
        icon: Wallet,
        description: "Commission payouts & settlements"
      }
    ]
  },
  {
    section: "CA Services",
    items: [
      {
        title: "CA Management",
        href: "/partner/ca-management",
        icon: UserCheck,
        description: "Onboard CAs & assign cases"
      },
      {
        title: "CA Support Tickets",
        href: "/partner/ca-support",
        icon: HelpCircle,
        description: "CA assistance requests"
      }
    ]
  },
  {
    section: "Earnings & Compliance",
    items: [
      {
        title: "Payout Statement",
        href: "/partner-portal?tab=statement",
        icon: Wallet,
        description: "Auditable payout records"
      },
      {
        title: "How Earnings Work",
        href: "/partner-portal?tab=earnings",
        icon: BarChart3,
        description: "Earnings calculation explained"
      },
      {
        title: "Compliance",
        href: "/partner-portal?tab=compliance",
        icon: AlertCircle,
        description: "Regulatory disclosures"
      }
    ]
  },
  {
    section: "Support & Settings",
    items: [
      {
        title: "Support Tickets",
        href: "/partner-portal?tab=support",
        icon: HelpCircle,
        description: "Your support requests"
      },
      {
        title: "Settings & Theme",
        href: "/theme-settings",
        icon: Settings,
        description: "Preferences & visual customization"
      }
    ]
  }
];

export function PartnerLayout({ children }: PartnerLayoutProps) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title) 
        : [...prev, title]
    );
  };

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/logout", { method: "POST" }),
    onSuccess: () => {
      // Redirect to auth page, staying on the partner subdomain
      window.location.href = "/auth" + getPortalQueryParams();
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
    if (typeof window !== 'undefined') {
      window.location.href = '/auth' + getPortalQueryParams();
    }
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500 mx-auto mb-4"></div>
          <p className="text-indigo-300">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const isPartner = user.roles?.includes('partner') || user.roles?.includes('admin') || user.roles?.includes('superadmin');

  if (!isPartner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center justify-center p-4">
        <div className="bg-background rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Access Denied
          </h1>
          <p className="text-muted-foreground mb-6">
            This partner portal is restricted to registered partners only. Please sign in with a partner account.
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
    <div className="min-h-screen bg-indigo-950 text-white">
      <header className="bg-indigo-900 border-b border-indigo-800 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-indigo-300 hover:text-foreground"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-3">
              <PortalLogo size="md" showTagline />
              <div className="hidden">
                <h1 className="text-xl font-bold text-foreground">FintekPro Partner</h1>
                <p className="text-xs text-indigo-300">Business Partner Portal</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/theme-settings">
              <Button variant="ghost" size="icon" className="text-indigo-300 hover:text-foreground" data-testid="btn-theme-settings" title="Theme & Accessibility">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="text-indigo-300 hover:text-foreground relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-violet-500 rounded-full" />
            </Button>

            <div className="flex items-center gap-3 border-l border-indigo-800 pl-4">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{user?.email}</p>
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
            <nav className="p-4 space-y-4">
              {partnerNavSections.map((section) => (
                <div key={section.section}>
                  <h3 className="px-3 mb-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                    {section.section}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.href && location === item.href;
                      const hasChildren = item.children && item.children.length > 0;
                      const isExpanded = expandedItems.includes(item.title);

                      if (hasChildren) {
                        return (
                          <div key={item.title}>
                            <button
                              onClick={() => toggleExpanded(item.title)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group text-left",
                                "text-indigo-300 hover:bg-indigo-800 hover:text-white"
                              )}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className="flex-1 text-sm font-medium text-indigo-200 group-hover:text-foreground">
                                {item.title}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-indigo-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-indigo-400" />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="ml-7 mt-1 space-y-1">
                                {item.children!.map((child) => {
                                  const hasQueryParam = child.href.includes('?');
                                  const childActive = hasQueryParam 
                                    ? location === child.href 
                                    : location === child.href || location.startsWith(child.href);
                                  return (
                                    <Link
                                      key={child.href}
                                      href={child.href}
                                      className={cn(
                                        "block px-3 py-2 rounded-md text-sm transition-colors",
                                        childActive
                                          ? "bg-violet-600 text-white"
                                          : "text-indigo-400 hover:bg-indigo-800 hover:text-white"
                                      )}
                                    >
                                      {child.title}
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
                          href={item.href!}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                            isActive
                              ? "bg-violet-600 text-white"
                              : "text-indigo-300 hover:bg-indigo-800 hover:text-white"
                          )}
                          data-testid={`link-partner-${item.href!.split('/').pop() || 'home'}`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className={cn(
                            "text-sm font-medium",
                            isActive ? "text-foreground" : "text-indigo-200 group-hover:text-foreground"
                          )}>
                            {item.title}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
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
