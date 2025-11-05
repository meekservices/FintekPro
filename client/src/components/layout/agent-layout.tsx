import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Home,
  Users,
  DollarSign,
  FileText,
  TrendingUp,
  LogOut,
  Menu,
  X,
  IndianRupee,
  Wallet
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
    href: "/agent/dashboard",
    icon: Home,
    description: "Earnings & performance overview"
  },
  {
    title: "My Clients",
    href: "/agent/clients",
    icon: Users,
    description: "Client portfolios & AUM"
  },
  {
    title: "Commission Reports",
    href: "/agent/commissions",
    icon: DollarSign,
    description: "Trail & upfront commissions"
  },
  {
    title: "Referrals",
    href: "/agent/referrals",
    icon: TrendingUp,
    description: "Referral tracking & rewards"
  },
  {
    title: "Payout History",
    href: "/agent/payouts",
    icon: Wallet,
    description: "Payment statements"
  }
];

export function AgentLayout({ children }: AgentLayoutProps) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/logout"),
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  if (!user) {
    window.location.href = '/auth';
    return null;
  }

  const isAgent = user.roles?.includes('agent') || user.roles?.includes('sub_agent');
  
  if (!isAgent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You don't have agent access. Please contact support.
          </p>
          <Button onClick={() => navigate("/")}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        <div className="flex h-16 items-center justify-between border-b px-4">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <IndianRupee className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">Agent Portal</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto"
            data-testid="button-toggle-sidebar"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {agentNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3",
                    !sidebarOpen && "justify-center"
                  )}
                  data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <div className="flex-1 text-left">
                      <div className="font-medium">{item.title}</div>
                      {isActive && (
                        <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      )}
                    </div>
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <div className={cn(
            "mb-3 text-sm",
            !sidebarOpen && "text-center"
          )}>
            {sidebarOpen ? (
              <>
                <div className="font-medium truncate">{user.firstName || user.userId}</div>
                <div className="text-xs text-muted-foreground truncate">{user.email || user.mobile}</div>
              </>
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-sm font-medium text-primary">
                  {(user.firstName?.[0] || user.userId?.[0] || 'A').toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          <Button
            variant="outline"
            className={cn(
              "w-full gap-2",
              !sidebarOpen && "justify-center"
            )}
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && "Logout"}
          </Button>
        </div>
      </aside>

      <main className={cn(
        "flex-1 overflow-y-auto transition-all duration-300",
        sidebarOpen ? "ml-64" : "ml-16"
      )}>
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
