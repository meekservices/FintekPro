import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Users,
  BarChart3,
  ShieldCheck,
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
  Handshake
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: Home,
    description: "Overview and metrics"
  },
  {
    title: "Stakeholders",
    href: "/admin/stakeholders",
    icon: Users,
    description: "Manage clients, partners, agents & suppliers"
  },
  {
    title: "Duplicate Accounts",
    href: "/admin/duplicates",
    icon: AlertCircle,
    description: "Detect & resolve duplicate registrations"
  },
  {
    title: "KYC & Compliance",
    href: "/admin/kyc-compliance",
    icon: FileCheck,
    description: "Review KYC submissions & compliance"
  },
  {
    title: "Financial Operations",
    href: "/admin/financial-operations",
    icon: DollarSign,
    description: "Orders, payments, revenue & refunds"
  },
  {
    title: "Users & Access",
    href: "/admin/users",
    icon: Users,
    description: "User management"
  },
  {
    title: "API Configuration",
    href: "/admin/api-config",
    icon: Key,
    description: "Manage API keys & services"
  },
  {
    title: "Store Management",
    href: "/admin/store-management",
    icon: Store,
    description: "Control categories, products & visibility"
  },
  {
    title: "Unlisted Dashboard",
    href: "/admin/unlisted/dashboard",
    icon: Briefcase,
    description: "Unlisted marketplace overview & metrics"
  },
  {
    title: "Unlisted Orders",
    href: "/admin/unlisted/orders",
    icon: ClipboardList,
    description: "Manage sell listings & buy requests"
  },
  {
    title: "Unlisted Negotiations",
    href: "/admin/unlisted/negotiations",
    icon: Handshake,
    description: "Seller/buyer price negotiations"
  },
  {
    title: "Unlisted Audit Log",
    href: "/admin/unlisted/audit-log",
    icon: History,
    description: "Compliance & trading event history"
  },
  {
    title: "Unlisted Companies",
    href: "/admin/unlisted/companies",
    icon: Building2,
    description: "Manage company listings & pricing"
  },
  {
    title: "Zoho Integration",
    href: "/admin/zoho-dashboard",
    icon: Workflow,
    description: "CRM, Books, Desk & WorkDrive"
  },
  {
    title: "Marketing Dashboard",
    href: "/admin/marketing-dashboard",
    icon: TrendingUp,
    description: "Campaign overview & performance"
  },
  {
    title: "Email Campaigns",
    href: "/admin/email-campaigns",
    icon: Mail,
    description: "Zoho Campaigns integration"
  },
  {
    title: "WhatsApp Campaigns",
    href: "/admin/whatsapp-campaigns",
    icon: MessageSquare,
    description: "AiSensy Business API broadcasts"
  },
  {
    title: "Lead Prospecting",
    href: "/admin/lead-prospecting",
    icon: Building2,
    description: "Probe42 B2B company search"
  },
  {
    title: "Client Intelligence",
    href: "/admin/client-intelligence",
    icon: Target,
    description: "Client financial health analysis"
  },
  {
    title: "Marketing Analytics",
    href: "/admin/marketing-analytics",
    icon: PieChart,
    description: "Cross-channel performance tracking"
  },
  {
    title: "Production Readiness",
    href: "/admin/production-readiness",
    icon: ShieldCheck,
    description: "Service status & deployment"
  },
  {
    title: "System Health",
    href: "/admin/system-health",
    icon: Activity,
    description: "Performance & monitoring"
  },
  {
    title: "Reports & Analytics",
    href: "/admin/reports",
    icon: BarChart3,
    description: "Platform analytics"
  },
  {
    title: "Compliance",
    href: "/admin/compliance",
    icon: FileCheck,
    description: "Regulatory compliance"
  },
  {
    title: "Database",
    href: "/admin/database",
    icon: Database,
    description: "Database management"
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/logout", { method: "POST" }),
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  // Wait for auth to load
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // First check: Must be logged in
  if (!user) {
    window.location.href = '/auth';
    return null;
  }

  // Second check: Must have admin role
  const isAdmin = user.roles?.includes('admin') || user.roles?.includes('superadmin');
  
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This admin portal is restricted to administrators only.
          </p>
          <Button asChild className="w-full">
            <a href="https://fintekpro.com">Go to Main Portal</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Admin Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">FintekPro Admin</h1>
              <p className="text-xs text-gray-400">System Administration Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
            
            <div className="flex items-center gap-3 border-l border-gray-800 pl-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user?.email}</p>
                <p className="text-xs text-gray-400 capitalize">
                  {user?.roles?.includes('superadmin') ? 'Super Admin' : 'Admin'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                className="text-gray-400 hover:text-red-400"
                data-testid="button-logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Admin Sidebar */}
        <aside
          className={cn(
            "bg-gray-900 border-r border-gray-800 transition-all duration-300 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)]",
            sidebarOpen ? "w-72" : "w-0 border-0"
          )}
        >
          {sidebarOpen && (
            <nav className="p-4 space-y-2">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 rounded-lg transition-colors group",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    )}
                    data-testid={`link-admin-${item.href.split('/').pop()}`}
                  >
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        isActive ? "text-white" : "text-gray-300 group-hover:text-white"
                      )}>
                        {item.title}
                      </p>
                      <p className={cn(
                        "text-xs mt-0.5",
                        isActive ? "text-blue-100" : "text-gray-500 group-hover:text-gray-400"
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

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
