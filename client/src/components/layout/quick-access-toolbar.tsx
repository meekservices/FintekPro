import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/use-cart";
import {
  TrendingUp,
  PieChart,
  BarChart3,
  Plus,
  Calculator,
  Target,
  Activity,
  Bell,
  Search,
  Zap,
  Star,
  DollarSign,
  FileText,
  ShoppingCart,
  CreditCard,
  Timer,
} from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  icon: any;
  href?: string;
  action?: () => void;
  shortcut?: string;
  badge?: string | number;
  priority: number;
  category: "trading" | "investment" | "tools" | "quick";
}

export function QuickAccessToolbar() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { cart } = useCart();
  const [recentActions, setRecentActions] = useState<string[]>([]);

  // Load recent actions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("quick-access-recent");
      if (saved) {
        setRecentActions(JSON.parse(saved));
      }
    } catch {
      setRecentActions([]);
    }
  }, []);

  // Save recent actions
  const addToRecent = (actionId: string) => {
    const filtered = recentActions.filter(id => id !== actionId);
    const updated = [actionId, ...filtered].slice(0, 5);
    try {
      localStorage.setItem("quick-access-recent", JSON.stringify(updated));
      setRecentActions(updated);
    } catch {
      // Ignore localStorage errors
    }
  };

  // Quick actions configuration
  const quickActions: QuickAction[] = [
    // Trading & Markets
    {
      id: "markets",
      label: "Live Markets",
      icon: TrendingUp,
      href: "/markets",
      shortcut: "M",
      priority: 10,
      category: "trading",
    },
    {
      id: "portfolio",
      label: "My Portfolio",
      icon: PieChart,
      href: "/portfolio",
      shortcut: "P",
      priority: 9,
      category: "trading",
    },
    {
      id: "broking",
      label: "Trading Terminal",
      icon: Activity,
      href: "/broking",
      priority: 8,
      category: "trading",
    },

    // Investment Quick Actions
    {
      id: "start-sip",
      label: "Start SIP",
      icon: Plus,
      href: "/mutual-funds?action=start-sip",
      priority: 10,
      category: "investment",
    },
    {
      id: "mutual-funds",
      label: "Mutual Funds",
      icon: BarChart3,
      href: "/mutual-funds",
      priority: 9,
      category: "investment",
    },
    {
      id: "ipo",
      label: "IPO Apply",
      icon: Target,
      href: "/ipo",
      priority: 8,
      category: "investment",
    },

    // Tools
    {
      id: "sip-calculator",
      label: "SIP Calculator",
      icon: Calculator,
      href: "/calculators?tool=sip",
      priority: 10,
      category: "tools",
    },
    {
      id: "cibil-score",
      label: "CIBIL Score",
      icon: Star,
      href: "/cibil",
      priority: 9,
      category: "tools",
    },
    {
      id: "capital-gains",
      label: "Capital Gains",
      icon: DollarSign,
      href: "/capital-gains",
      priority: 8,
      category: "tools",
    },
    {
      id: "tax-filing",
      label: "Tax Filing",
      icon: FileText,
      href: "/tax",
      priority: 7,
      category: "tools",
    },

    // Quick access
    {
      id: "cart",
      label: "Shopping Cart",
      icon: ShoppingCart,
      href: "/cart",
      badge: cart?.totalItems || 0,
      priority: 10,
      category: "quick",
    },
    {
      id: "apply-loan",
      label: "Apply Loan",
      icon: CreditCard,
      href: "/loans?action=apply",
      priority: 9,
      category: "quick",
    },
  ];

  // Handle action click
  const handleActionClick = (action: QuickAction) => {
    addToRecent(action.id);
    if (action.action) {
      action.action();
    }
  };

  // Get actions by category with recent priority
  const getActionsByCategory = (category: string) => {
    return quickActions
      .filter(action => action.category === category)
      .sort((a, b) => {
        // Prioritize recent actions
        const aRecent = recentActions.indexOf(a.id);
        const bRecent = recentActions.indexOf(b.id);
        
        if (aRecent !== -1 && bRecent !== -1) {
          return aRecent - bRecent; // More recent first
        }
        if (aRecent !== -1) return -1; // a is recent, b is not
        if (bRecent !== -1) return 1;  // b is recent, a is not
        
        return b.priority - a.priority; // Default priority sort
      });
  };

  // Get contextual actions based on current page
  const getContextualActions = () => {
    const contextual: QuickAction[] = [];
    
    if (location === "/") {
      contextual.push(...getActionsByCategory("quick").slice(0, 2));
      contextual.push(...getActionsByCategory("trading").slice(0, 2));
    } else if (location.startsWith("/portfolio")) {
      contextual.push(
        quickActions.find(a => a.id === "start-sip")!,
        quickActions.find(a => a.id === "markets")!,
        quickActions.find(a => a.id === "capital-gains")!
      );
    } else if (location.startsWith("/markets")) {
      contextual.push(
        quickActions.find(a => a.id === "broking")!,
        quickActions.find(a => a.id === "portfolio")!,
        quickActions.find(a => a.id === "ipo")!
      );
    } else if (location.startsWith("/mutual-funds")) {
      contextual.push(
        quickActions.find(a => a.id === "sip-calculator")!,
        quickActions.find(a => a.id === "portfolio")!,
        quickActions.find(a => a.id === "start-sip")!
      );
    } else {
      // Default contextual actions
      contextual.push(...getActionsByCategory("trading").slice(0, 2));
      contextual.push(...getActionsByCategory("tools").slice(0, 1));
    }

    return contextual.filter(Boolean);
  };

  if (!isAuthenticated) {
    return null;
  }

  const contextualActions = getContextualActions();

  return (
    <div className="sticky top-0 z-30 bg-background/95/95 backdrop-blur-sm border-b border-border" data-testid="quick-access-toolbar">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            {contextualActions.slice(0, 6).map((action, index) => (
              <div key={action.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={action.href!}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="relative h-8 px-3"
                        onClick={() => handleActionClick(action)}
                        data-testid={`quick-action-${action.id}`}
                      >
                        <action.icon className="h-4 w-4" />
                        <span className="ml-2 hidden sm:inline">{action.label}</span>
                        {action.badge && Number(action.badge) > 0 && (
                          <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 text-xs flex items-center justify-center">
                            {action.badge}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{action.label}</p>
                    {action.shortcut && (
                      <p className="text-xs text-muted-foreground">
                        {action.shortcut}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
                {index < contextualActions.slice(0, 6).length - 1 && (
                  <Separator orientation="vertical" className="h-4 mx-1" />
                )}
              </div>
            ))}
          </div>

          {/* Separator */}
          <Separator orientation="vertical" className="h-6" />

          {/* Quick Add Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-green-600 hover:text-green-700 hover:bg-green-50" data-testid="quick-add-button">
                <Plus className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Quick Add</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Quick actions menu</p>
              <p className="text-xs text-muted-foreground">Start SIP, Apply loan, etc.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-2">
          {/* Search trigger - opens command palette */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3"
                onClick={() => {
                  // Trigger command palette
                  const event = new KeyboardEvent('keydown', {
                    key: 'k',
                    metaKey: true,
                    bubbles: true
                  });
                  document.dispatchEvent(event);
                }}
                data-testid="quick-search-button"
              >
                <Search className="h-4 w-4" />
                <span className="ml-2 hidden md:inline">Search</span>
                <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 ml-2 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Search everything</p>
              <p className="text-xs text-muted-foreground">⌘K / Ctrl+K</p>
            </TooltipContent>
          </Tooltip>

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3 relative" data-testid="notifications-button">
                <Bell className="h-4 w-4" />
                {/* Example notification badge */}
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 text-xs flex items-center justify-center">
                  3
                </Badge>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Notifications</p>
              <p className="text-xs text-muted-foreground">3 new updates</p>
            </TooltipContent>
          </Tooltip>

          {/* Quick actions indicator */}
          <div className="hidden lg:flex items-center text-xs text-muted-foreground">
            <Zap className="h-3 w-3 mr-1" />
            <span>Quick</span>
          </div>
        </div>
      </div>

      {/* Market Status Bar (optional) */}
      <div className="bg-green-50 border-t border-green-200 px-4 py-1 hidden lg:block">
        <div className="flex items-center justify-between text-xs text-green-800">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              <span>Markets Open</span>
            </div>
            <div>NIFTY: 24,350 (+125)</div>
            <div>SENSEX: 79,890 (+245)</div>
          </div>
          <div className="flex items-center space-x-2">
            <Timer className="h-3 w-3" />
            <span>Closes in 2h 30m</span>
          </div>
        </div>
      </div>
    </div>
  );
}