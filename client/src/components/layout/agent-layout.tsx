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
  Settings,
  AlertCircle,
  Brain,
  UserPlus,
  Wallet,
  Target,
  CheckSquare,
  Landmark,
  TrendingUp
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AgentLayoutProps {
  children: React.ReactNode;
}

const agentNavItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
    description: "Overview and performance metrics"
  },
  {
    title: "Revenue Cockpit",
    href: "/revenue",
    icon: Wallet,
    description: "AUM, commissions, and business performance"
  },
  {
    title: "My Clients",
    href: "/clients",
    icon: Users,
    description: "Manage your client portfolio"
  },
  {
    title: "Lead Pipeline",
    href: "/leads",
    icon: Target,
    description: "Track and convert prospects"
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    description: "Manage tasks and reminders"
  },
  {
    title: "Demo Proposals",
    href: "/prospect-proposals",
    icon: UserPlus,
    description: "Create proposals to acquire new clients"
  },
  {
    title: "AI Advisory",
    href: "/investment-advisory",
    icon: Brain,
    description: "AI-powered investment recommendations"
  },
  {
    title: "Bond AI",
    href: "/bond-recommendations",
    icon: Landmark,
    description: "AI-powered bond portfolio recommendations"
  },
  {
    title: "Demo Progress",
    href: "/demo-progress",
    icon: TrendingUp,
    description: "Track demo conversions and performance"
  },
  {
    title: "Proposals",
    href: "/proposals",
    icon: FileText,
    description: "Investment proposals and recommendations"
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    description: "Generate and share client reports"
  },
  {
    title: "Settings",
    href: "/agent-portal",
    icon: Settings,
    description: "Profile and preferences"
  }
];

export function AgentLayout({ children }: AgentLayoutProps) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
                const isActive = location === item.href;

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
                    data-testid={`link-agent-${item.href.split('/').pop() || 'home'}`}
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
