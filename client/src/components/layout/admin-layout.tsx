import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle
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
    id: "core",
    title: "Core Operations",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard", href: "/admin/dashboard", icon: Home, description: "Overview and metrics" },
      { title: "Stakeholders", href: "/admin/stakeholders", icon: Users, description: "Clients, partners, agents & suppliers" },
      { title: "KYC & Compliance", href: "/admin/kyc-compliance", icon: FileCheck, description: "Review KYC submissions" },
      { title: "Financial Operations", href: "/admin/financial-operations", icon: DollarSign, description: "Orders, payments & refunds" },
      { title: "Duplicate Accounts", href: "/admin/duplicates", icon: AlertCircle, description: "Detect & resolve duplicates" },
      { title: "Users & Access", href: "/admin/users", icon: Users, description: "User management" },
    ]
  },
  {
    id: "agents",
    title: "Agent Management",
    icon: Users,
    items: [
      { title: "Agent Performance", href: "/admin/agent-performance", icon: BarChart3, description: "Performance metrics" },
      { title: "Demo Proposals", href: "/admin/demo-proposals", icon: Target, description: "Track proposals & conversions" },
      { title: "Task Oversight", href: "/admin/task-oversight", icon: ClipboardList, description: "Monitor agents' tasks" },
      { title: "CA Partners", href: "/admin/ca-management", icon: Award, description: "CA partner management" },
      { title: "Commission Master", href: "/admin/commission-master", icon: TrendingUp, description: "Commission configuration" },
    ]
  },
  {
    id: "marketplaces",
    title: "Marketplaces",
    icon: Store,
    items: [
      { title: "Store Management", href: "/admin/store-management", icon: Store, description: "Categories & products" },
      {
        title: "Unlisted Marketplace",
        href: "/admin/unlisted/dashboard",
        icon: Briefcase,
        description: "Pre-IPO & unlisted shares",
        children: [
          { title: "Dashboard", href: "/admin/unlisted/dashboard", icon: Home, description: "Overview & metrics" },
          { title: "Companies", href: "/admin/unlisted/companies", icon: Building2, description: "Manage listings" },
          { title: "Orders", href: "/admin/unlisted/orders", icon: ClipboardList, description: "Buy/Sell orders" },
          { title: "Negotiations", href: "/admin/unlisted/negotiations", icon: Handshake, description: "Price negotiations" },
          { title: "Compliance Alerts", href: "/admin/unlisted/compliance-alerts", icon: AlertTriangle, description: "Blocked trades" },
          { title: "Audit Log", href: "/admin/unlisted/audit-log", icon: History, description: "Event history" }
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
          { title: "Audit Log", href: "/admin/bonds/audit-log", icon: History, description: "Audit trail" }
        ]
      },
    ]
  },
  {
    id: "marketing",
    title: "Marketing & Leads",
    icon: Megaphone,
    items: [
      { title: "Marketing Dashboard", href: "/admin/marketing-dashboard", icon: TrendingUp, description: "Campaign overview" },
      { title: "Email Campaigns", href: "/admin/email-campaigns", icon: Mail, description: "Zoho Campaigns" },
      { title: "WhatsApp Campaigns", href: "/admin/whatsapp-campaigns", icon: MessageSquare, description: "AiSensy broadcasts" },
      { title: "Lead Prospecting", href: "/admin/lead-prospecting", icon: Building2, description: "B2B company search" },
      { title: "Prospect Analytics", href: "/admin/prospect-analytics", icon: TrendingUp, description: "Lead scoring" },
      { title: "Client Intelligence", href: "/admin/client-intelligence", icon: Target, description: "Client analysis" },
      { title: "Marketing Analytics", href: "/admin/marketing-analytics", icon: PieChart, description: "Performance tracking" },
    ]
  },
  {
    id: "integrations",
    title: "Integrations",
    icon: Workflow,
    items: [
      { title: "Zoho Integration", href: "/admin/zoho-dashboard", icon: Workflow, description: "CRM & WorkDrive" },
      { title: "Zoho Books", href: "/admin/zoho-books", icon: BookOpen, description: "Accounting & Finance" },
      { title: "API Configuration", href: "/admin/api-config", icon: Key, description: "API keys & services" },
      { title: "Aadhaar Providers", href: "/admin/aadhaar-config", icon: Shield, description: "Aadhaar verification config" },
    ]
  },
  {
    id: "system",
    title: "System & Settings",
    icon: Cog,
    items: [
      { title: "AI Insights", href: "/admin/ai-insights", icon: Lightbulb, description: "AI-powered trends" },
      { title: "Production Readiness", href: "/admin/production-readiness", icon: ShieldCheck, description: "Service status" },
      { title: "System Health", href: "/admin/system-health", icon: Activity, description: "Performance monitoring" },
      { title: "Reports & Analytics", href: "/admin/reports", icon: BarChart3, description: "Platform analytics" },
      { title: "Compliance", href: "/admin/compliance", icon: FileCheck, description: "Regulatory compliance" },
      { title: "Database", href: "/admin/database", icon: Database, description: "Database management" },
      { title: "Replit Suggestions", href: "/admin/replit-suggestions", icon: Lightbulb, description: "Improvement initiatives" },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['core']));
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

  useEffect(() => {
    navCategories.forEach(category => {
      category.items.forEach(item => {
        if (item.children) {
          const isChildActive = item.children.some(child => 
            location === child.href || location.startsWith(child.href + '/')
          );
          if (isChildActive) {
            setExpandedCategories(prev => new Set([...prev, category.id]));
            setExpandedMenus(prev => new Set([...prev, item.title]));
          }
        }
        if (location === item.href) {
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
      window.location.href = "/";
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/auth';
    return null;
  }

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
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 p-0 max-w-lg">
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
                      <span className="ml-2 text-xs text-gray-500">{item.description}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white"
              data-testid="btn-toggle-sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">FintekPro Admin</h1>
              <p className="text-xs text-gray-400">System Administration Portal</p>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8">
            <Button
              variant="outline"
              className="w-full justify-start text-gray-400 border-gray-700 hover:bg-gray-800"
              onClick={() => setSearchOpen(true)}
              data-testid="btn-global-search"
            >
              <Search className="h-4 w-4 mr-2" />
              <span>Search features...</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-600 bg-gray-800 px-1.5 font-mono text-[10px] font-medium text-gray-400">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white relative" data-testid="btn-notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-gray-900 border-gray-700">
                <DropdownMenuLabel className="text-gray-300">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">All caught up!</p>
                  </div>
                ) : (
                  notifications.map(notification => (
                    <DropdownMenuItem 
                      key={notification.id}
                      className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-800"
                      onClick={() => notification.link && navigate(notification.link)}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                        notification.type === 'kyc' && "bg-orange-400",
                        notification.type === 'compliance' && "bg-red-400",
                        notification.type === 'order' && "bg-blue-400",
                        notification.type === 'system' && "bg-gray-400"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200">{notification.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{notification.message}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
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
        <aside
          className={cn(
            "bg-gray-900 border-r border-gray-800 transition-all duration-300 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)]",
            sidebarOpen ? "w-72" : "w-0 border-0"
          )}
        >
          {sidebarOpen && (
            <nav className="p-3 space-y-2">
              {navCategories.map(category => {
                const CategoryIcon = category.icon;
                const isCategoryExpanded = expandedCategories.has(category.id);
                const hasActiveItem = category.items.some(item => 
                  location === item.href || 
                  item.children?.some(child => location === child.href || location.startsWith(child.href + '/'))
                );
                
                return (
                  <div key={category.id} className="space-y-1">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
                        hasActiveItem 
                          ? "bg-blue-600/10 text-blue-400" 
                          : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
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
                                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
                                    isChildActive
                                      ? "bg-blue-600/20 text-blue-400"
                                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                  )}
                                  data-testid={`btn-menu-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Icon className="h-4 w-4 flex-shrink-0" />
                                  <span className="text-sm flex-1">{item.title}</span>
                                  {isExpanded ? (
                                    <ChevronDown className="h-3 w-3 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-gray-500" />
                                  )}
                                </button>
                                
                                {isExpanded && (
                                  <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-700 pl-3">
                                    {item.children?.map(child => {
                                      const ChildIcon = child.icon;
                                      const isChildItemActive = location === child.href;
                                      
                                      return (
                                        <Link
                                          key={child.href}
                                          href={child.href}
                                          className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm",
                                            isChildItemActive
                                              ? "bg-blue-600 text-white"
                                              : "text-gray-400 hover:bg-gray-800 hover:text-white"
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
                          
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                                isActive
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                              )}
                              data-testid={`link-admin-${item.href.split('/').pop()}`}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className="text-sm">{item.title}</span>
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
