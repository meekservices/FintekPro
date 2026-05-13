import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/use-cart";
import {
  Calculator,
  TrendingUp,
  PieChart,
  CreditCard,
  Shield as LucideShield,
  FileText,
  Building2,
  Banknote,
  Target,
  Activity,
  BarChart3,
  Briefcase,
  Home,
  Store,
  ShoppingCart,
  HelpCircle,
  User as UserIcon,
  Settings,
  Bell,
  Plus,
  Search,
  BookOpen,
  DollarSign,
  LineChart,
  Map,
  Clock,
  Star,
  Zap,
  ArrowRight,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href?: string;
  action?: () => void;
  icon: any;
  keywords: string[];
  category: string;
  priority?: number;
  badge?: string;
  shortcut?: string;
}

interface RecentItem {
  id: string;
  label: string;
  href: string;
  timestamp: number;
  icon: any;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { cart, totalItems } = useCart();
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // Load recent items from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("command-palette-recent");
      if (saved) {
        setRecentItems(JSON.parse(saved));
      }
    } catch {
      setRecentItems([]);
    }
  }, []);

  // Save recent items to localStorage
  const saveRecentItems = (items: RecentItem[]) => {
    try {
      localStorage.setItem("command-palette-recent", JSON.stringify(items));
      setRecentItems(items);
    } catch {
      // Ignore localStorage errors
    }
  };

  // Add item to recent
  const addToRecent = (item: Omit<RecentItem, "timestamp">) => {
    const newItem: RecentItem = {
      ...item,
      timestamp: Date.now(),
    };
    
    const filtered = recentItems.filter(r => r.id !== item.id);
    const updated = [newItem, ...filtered].slice(0, 10); // Keep only 10 recent items
    saveRecentItems(updated);
  };

  // Global keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Navigation items
  const navigationItems: CommandItem[] = useMemo(() => [
    // Core Pages
    {
      id: "home",
      label: "Home Dashboard",
      description: "Market overview and quick actions",
      href: "/",
      icon: Home,
      keywords: ["home", "dashboard", "overview", "main"],
      category: "Navigation",
      priority: 10,
      shortcut: "H",
    },
    {
      id: "portfolio",
      label: "My Portfolio",
      description: "View holdings and performance",
      href: "/portfolio",
      icon: PieChart,
      keywords: ["portfolio", "holdings", "investments", "stocks"],
      category: "Navigation",
      priority: 9,
      shortcut: "P",
    },
    {
      id: "markets",
      label: "Live Markets",
      description: "Real-time market data and trading",
      href: "/markets",
      icon: TrendingUp,
      keywords: ["markets", "trading", "stocks", "live", "prices"],
      category: "Navigation",
      priority: 8,
      shortcut: "M",
    },
    {
      id: "mutual-funds",
      label: "Mutual Funds",
      description: "SIP, lumpsum and fund research",
      href: "/mutual-funds",
      icon: BarChart3,
      keywords: ["mutual funds", "sip", "lumpsum", "invest"],
      category: "Navigation",
      priority: 7,
    },
    {
      id: "loans",
      label: "Loan Marketplace",
      description: "Personal and business loans",
      href: "/loans",
      icon: CreditCard,
      keywords: ["loans", "personal", "business", "finance"],
      category: "Navigation",
      priority: 6,
    },
    {
      id: "store",
      label: "Financial Store",
      description: "Browse financial products",
      href: "/store",
      icon: Store,
      keywords: ["store", "products", "shop", "buy"],
      category: "Navigation",
      priority: 5,
    },
    {
      id: "cart",
      label: "Shopping Cart",
      description: `${totalItems || 0} items in cart`,
      href: "/cart",
      icon: ShoppingCart,
      keywords: ["cart", "shopping", "items", "checkout"],
      category: "Navigation",
      priority: 4,
      badge: totalItems && totalItems > 0 ? totalItems.toString() : undefined,
    },

    // Investment Tools
    {
      id: "ipo",
      label: "IPO Center",
      description: "Apply for live IPOs",
      href: "/ipo",
      icon: Target,
      keywords: ["ipo", "initial public offering", "apply"],
      category: "Investments",
    },
    {
      id: "pre-ipo",
      label: "Pre-IPO Investments",
      description: "Unlisted securities",
      href: "/pre-ipo",
      icon: Activity,
      keywords: ["pre-ipo", "unlisted", "securities"],
      category: "Investments",
    },
    {
      id: "wealth",
      label: "Wealth Management",
      description: "Premium investment services",
      href: "/wealth",
      icon: Briefcase,
      keywords: ["wealth", "premium", "investment", "advisory"],
      category: "Investments",
    },

    // Financial Services
    {
      id: "calculators",
      label: "Financial Calculators",
      description: "SIP, EMI, tax and retirement planning",
      href: "/calculators",
      icon: Calculator,
      keywords: ["calculator", "sip", "emi", "tax", "retirement"],
      category: "Tools",
    },
    {
      id: "property",
      label: "Property Services",
      description: "Real estate solutions and financing",
      href: "/property",
      icon: Building2,
      keywords: ["property", "real estate", "home loans"],
      category: "Services",
    },
    {
      id: "insurance",
      label: "Insurance Marketplace",
      description: "Compare insurance from 15+ providers",
      href: "/insurance",
      icon: LucideShield,
      keywords: ["insurance", "health", "life", "motor", "compare"],
      category: "Services",
    },
    {
      id: "tax",
      label: "Smart Tax Filing",
      description: "TaxCloud-powered ITR filing",
      href: "/tax",
      icon: FileText,
      keywords: ["tax", "itr", "filing", "taxcloud"],
      category: "Services",
    },

    // Account & Profile
    {
      id: "profile",
      label: "My Profile",
      description: "Account settings and preferences",
      href: "/profile",
      icon: UserIcon,
      keywords: ["profile", "account", "settings", "preferences"],
      category: "Account",
      shortcut: "U",
    },
    {
      id: "support",
      label: "Support & Help",
      description: "Get help and support",
      href: "/support",
      icon: HelpCircle,
      keywords: ["support", "help", "contact", "assistance"],
      category: "Account",
    },
  ], [totalItems]);

  // Quick actions
  const quickActions: CommandItem[] = useMemo(() => [
    {
      id: "start-sip",
      label: "Start New SIP",
      description: "Begin a systematic investment plan",
      href: "/mutual-funds?action=start-sip",
      icon: Plus,
      keywords: ["start", "sip", "systematic", "investment", "new"],
      category: "Quick Actions",
      priority: 10,
    },
    {
      id: "add-portfolio",
      label: "Add New Portfolio",
      description: "Create a new investment portfolio",
      href: "/portfolio?action=create",
      icon: Plus,
      keywords: ["add", "new", "portfolio", "create"],
      category: "Quick Actions",
      priority: 9,
    },
    {
      id: "apply-loan",
      label: "Apply for Loan",
      description: "Quick loan application",
      href: "/loans?action=apply",
      icon: Plus,
      keywords: ["apply", "loan", "personal", "business"],
      category: "Quick Actions",
      priority: 8,
    },
    {
      id: "check-cibil",
      label: "Check CIBIL Score",
      description: "View your credit score",
      href: "/cibil",
      icon: Star,
      keywords: ["cibil", "credit", "score", "check"],
      category: "Quick Actions",
    },
    {
      id: "market-status",
      label: "Check Market Status",
      description: "View current market status",
      href: "/markets?tab=status",
      icon: Activity,
      keywords: ["market", "status", "open", "closed"],
      category: "Quick Actions",
    },
    {
      id: "calculate-sip",
      label: "Calculate SIP Returns",
      description: "Plan your SIP investments",
      href: "/calculators?tool=sip",
      icon: Calculator,
      keywords: ["calculate", "sip", "returns", "planning"],
      category: "Quick Actions",
    },
    {
      id: "capital-gains",
      label: "View Capital Gains",
      description: "Check tax implications",
      href: "/capital-gains",
      icon: DollarSign,
      keywords: ["capital", "gains", "tax", "profit"],
      category: "Quick Actions",
    },
  ], []);

  // Combine all items
  const allItems = useMemo(() => [...navigationItems, ...quickActions], [navigationItems, quickActions]);

  // Handle item selection
  const handleSelect = (item: CommandItem) => {
    setOpen(false);
    
    if (item.action) {
      item.action();
    } else if (item.href) {
      // Add to recent items
      addToRecent({
        id: item.id,
        label: item.label,
        href: item.href,
        icon: item.icon,
      });
      
      setLocation(item.href);
    }
  };

  // Filter recent items that still exist in navigation
  const validRecentItems = recentItems.filter(recent => 
    allItems.some(item => item.href === recent.href)
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Keyboard shortcut hint */}
      <div className="fixed top-4 right-4 z-40 hidden lg:block">
        <div className="text-xs text-muted-foreground bg-background/80 backdrop-blur-sm border rounded px-2 py-1">
          Press{" "}
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>{" "}
          to search
        </div>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search pages, actions, and tools..." 
          data-testid="command-palette-input"
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Recent Items */}
          {validRecentItems.length > 0 && (
            <CommandGroup heading="Recent">
              {validRecentItems.slice(0, 5).map((item) => (
                <CommandItem
                  key={item.id}
                  value={`recent-${item.id}`}
                  onSelect={() => {
                    setOpen(false);
                    setLocation(item.href);
                  }}
                  data-testid={`command-recent-${item.id}`}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                  </div>
                  <CommandShortcut>
                    <ArrowRight className="h-3 w-3" />
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Quick Actions */}
          <CommandGroup heading="Quick Actions">
            {quickActions
              .sort((a, b) => (b.priority || 0) - (a.priority || 0))
              .slice(0, 6)
              .map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.description} ${item.keywords.join(" ")}`}
                  onSelect={() => handleSelect(item)}
                  data-testid={`command-action-${item.id}`}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    {item.description && (
                      <span className="text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </div>
                  {item.badge && (
                    <Badge variant="secondary" className="ml-auto">
                      {item.badge}
                    </Badge>
                  )}
                  {item.shortcut && (
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
          </CommandGroup>

          <CommandSeparator />

          {/* Navigation Items by Category */}
          {["Navigation", "Investments", "Services", "Tools", "Account"].map((category) => {
            const categoryItems = allItems.filter(item => item.category === category);
            if (categoryItems.length === 0) return null;

            return (
              <CommandGroup key={category} heading={category}>
                {categoryItems
                  .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                  .map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.description} ${item.keywords.join(" ")}`}
                      onSelect={() => handleSelect(item)}
                      data-testid={`command-nav-${item.id}`}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </div>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                      {item.shortcut && (
                        <CommandShortcut>{item.shortcut}</CommandShortcut>
                      )}
                    </CommandItem>
                  ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}

// Hook for other components to trigger command palette
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen(!open);
  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  return { open, toggle, show, hide };
}