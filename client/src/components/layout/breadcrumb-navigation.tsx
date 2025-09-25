import { useMemo } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { 
  Home,
  TrendingUp,
  PieChart,
  CreditCard,
  Shield,
  FileText,
  Calculator,
  Building2,
  Banknote,
  Target,
  Activity,
  BarChart3,
  Briefcase,
  Store,
  ShoppingCart,
  HelpCircle,
  User as UserIcon,
  Settings,
  Bell,
  ChevronRight,
} from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: any;
  badge?: string;
}

interface RouteConfig {
  pattern: string | RegExp;
  breadcrumbs: (pathname: string, searchParams?: URLSearchParams) => BreadcrumbItem[];
}

export function BreadcrumbNavigation() {
  const [location] = useLocation();
  
  // Parse current location
  const url = new URL(`http://localhost${location}`);
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // Route configurations for generating breadcrumbs
  const routeConfigs: RouteConfig[] = useMemo(() => [
    // Home
    {
      pattern: /^\/$/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home }
      ]
    },

    // Portfolio routes
    {
      pattern: /^\/portfolio/,
      breadcrumbs: (pathname: string, searchParams?: URLSearchParams) => {
        const breadcrumbs: BreadcrumbItem[] = [
          { label: "Dashboard", href: "/", icon: Home },
          { label: "Portfolio", href: "/portfolio", icon: PieChart }
        ];

        const tab = searchParams?.get("tab");
        if (tab === "allocation") {
          breadcrumbs.push({ label: "Asset Allocation" });
        } else if (tab === "trades") {
          breadcrumbs.push({ label: "Trade Book" });
        } else if (tab === "performance") {
          breadcrumbs.push({ label: "Performance" });
        } else if (pathname.includes("comprehensive")) {
          breadcrumbs[1] = { label: "Comprehensive Portfolio", href: "/comprehensive-portfolio", icon: PieChart };
        }

        const action = searchParams?.get("action");
        if (action === "create") {
          breadcrumbs.push({ label: "Create Portfolio" });
        }

        return breadcrumbs;
      }
    },

    // Markets routes
    {
      pattern: /^\/markets/,
      breadcrumbs: (pathname: string, searchParams?: URLSearchParams) => {
        const breadcrumbs: BreadcrumbItem[] = [
          { label: "Dashboard", href: "/", icon: Home },
          { label: "Live Markets", href: "/markets", icon: TrendingUp }
        ];

        const tab = searchParams?.get("tab");
        if (tab === "movers") {
          breadcrumbs.push({ label: "Market Movers" });
        } else if (tab === "status") {
          breadcrumbs.push({ label: "Market Status" });
        }

        const view = searchParams?.get("view");
        if (view === "charts") {
          breadcrumbs.push({ label: "Technical Charts" });
        }

        return breadcrumbs;
      }
    },

    // Investment routes
    {
      pattern: /^\/mutual-funds/,
      breadcrumbs: (pathname: string, searchParams?: URLSearchParams) => {
        const breadcrumbs: BreadcrumbItem[] = [
          { label: "Dashboard", href: "/", icon: Home },
          { label: "Mutual Funds", href: "/mutual-funds", icon: BarChart3 }
        ];

        const tab = searchParams?.get("tab");
        if (tab === "research") {
          breadcrumbs.push({ label: "Fund Research" });
        } else if (tab === "sips") {
          breadcrumbs.push({ label: "My SIPs" });
        }

        const action = searchParams?.get("action");
        if (action === "start-sip") {
          breadcrumbs.push({ label: "Start SIP" });
        }

        return breadcrumbs;
      }
    },

    {
      pattern: /^\/ipo/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "IPO Center", href: "/ipo", icon: Target }
      ]
    },

    {
      pattern: /^\/pre-ipo/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Pre-IPO", href: "/pre-ipo", icon: Activity }
      ]
    },

    {
      pattern: /^\/unlisted/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Unlisted Shares", href: "/unlisted", icon: Activity }
      ]
    },

    {
      pattern: /^\/wealth/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Wealth Management", href: "/wealth", icon: Briefcase }
      ]
    },

    {
      pattern: /^\/aif/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Wealth Management", href: "/wealth", icon: Briefcase },
        { label: "AIF Investments", href: "/aif" }
      ]
    },

    // Financial Services
    {
      pattern: /^\/loans/,
      breadcrumbs: (pathname: string, searchParams?: URLSearchParams) => {
        const breadcrumbs: BreadcrumbItem[] = [
          { label: "Dashboard", href: "/", icon: Home },
          { label: "Loans", href: "/loans", icon: CreditCard }
        ];

        const category = searchParams?.get("category");
        if (category === "personal") {
          breadcrumbs.push({ label: "Personal Loans" });
        } else if (category === "business") {
          breadcrumbs.push({ label: "Business Loans" });
        } else if (category === "home") {
          breadcrumbs.push({ label: "Home Loans" });
        } else if (category === "vehicle") {
          breadcrumbs.push({ label: "Vehicle Loans" });
        } else if (category === "education") {
          breadcrumbs.push({ label: "Education Loans" });
        } else if (category === "lap") {
          breadcrumbs.push({ label: "Loan Against Property" });
        }

        const action = searchParams?.get("action");
        if (action === "apply") {
          breadcrumbs.push({ label: "Apply" });
        }

        if (pathname.includes("comparison")) {
          breadcrumbs[1] = { label: "Loan Comparison", href: "/loan-comparison" };
        } else if (pathname.includes("dashboard")) {
          breadcrumbs[1] = { label: "Loan Dashboard", href: "/loan-dashboard" };
        } else if (pathname.includes("application")) {
          breadcrumbs[1] = { label: "Loan Application", href: "/loan-application" };
        }

        return breadcrumbs;
      }
    },

    {
      pattern: /^\/property/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Property Services", href: "/property", icon: Building2 }
      ]
    },

    {
      pattern: /^\/insurance/,
      breadcrumbs: (pathname) => {
        const breadcrumbs: BreadcrumbItem[] = [
          { label: "Dashboard", href: "/", icon: Home },
          { label: "Insurance", href: "/insurance", icon: Shield }
        ];

        if (pathname.includes("/health")) {
          breadcrumbs.push({ label: "Health Insurance" });
        } else if (pathname.includes("/life")) {
          breadcrumbs.push({ label: "Life Insurance" });
        } else if (pathname.includes("/motor")) {
          breadcrumbs.push({ label: "Motor Insurance" });
        } else if (pathname.includes("/travel")) {
          breadcrumbs.push({ label: "Travel Insurance" });
        } else if (pathname.includes("/home")) {
          breadcrumbs.push({ label: "Home Insurance" });
        }

        return breadcrumbs;
      }
    },

    // Tax and Financial Services
    {
      pattern: /^\/tax/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Tax Services", href: "/tax", icon: FileText }
      ]
    },

    {
      pattern: /^\/tax-data-center/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Tax Services", href: "/tax", icon: FileText },
        { label: "Tax Data Center", href: "/tax-data-center" }
      ]
    },

    {
      pattern: /^\/tax-documents/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Tax Services", href: "/tax", icon: FileText },
        { label: "Tax Documents", href: "/tax-documents" }
      ]
    },

    {
      pattern: /^\/capital-gains/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Reports", icon: FileText },
        { label: "Capital Gains", href: "/capital-gains" }
      ]
    },

    // Tools and Services
    {
      pattern: /^\/calculators/,
      breadcrumbs: (pathname: string, searchParams?: URLSearchParams) => {
        const breadcrumbs: BreadcrumbItem[] = [
          { label: "Dashboard", href: "/", icon: Home },
          { label: "Calculators", href: "/calculators", icon: Calculator }
        ];

        const tool = searchParams?.get("tool");
        if (tool === "sip") {
          breadcrumbs.push({ label: "SIP Calculator" });
        } else if (tool === "emi") {
          breadcrumbs.push({ label: "EMI Calculator" });
        } else if (tool === "tax") {
          breadcrumbs.push({ label: "Tax Calculator" });
        }

        const category = searchParams?.get("category");
        if (category === "property") {
          breadcrumbs.push({ label: "Property Calculators" });
        }

        return breadcrumbs;
      }
    },

    // Store and Cart
    {
      pattern: /^\/store/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Financial Store", href: "/store", icon: Store }
      ]
    },

    {
      pattern: /^\/cart/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Shopping Cart", href: "/cart", icon: ShoppingCart }
      ]
    },

    // Account and Profile
    {
      pattern: /^\/profile/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "My Profile", href: "/profile", icon: UserIcon }
      ]
    },

    {
      pattern: /^\/support/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Support", href: "/support", icon: HelpCircle }
      ]
    },

    // Admin routes
    {
      pattern: /^\/admin/,
      breadcrumbs: (pathname) => {
        const breadcrumbs: BreadcrumbItem[] = [
          { label: "Dashboard", href: "/", icon: Home },
          { label: "Administration", href: "/admin", icon: Settings }
        ];

        if (pathname.includes("suppliers")) {
          breadcrumbs.push({ label: "Supplier Management" });
        } else if (pathname.includes("proposals")) {
          breadcrumbs.push({ label: "Proposals Management" });
        }

        return breadcrumbs;
      }
    },

    // Service pages
    {
      pattern: /^\/nsdl-services/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Services", icon: Settings },
        { label: "NSDL Services", href: "/nsdl-services" }
      ]
    },

    {
      pattern: /^\/cdsl-services/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Services", icon: Settings },
        { label: "CDSL Services", href: "/cdsl-services" }
      ]
    },

    {
      pattern: /^\/cams-services/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Services", icon: Settings },
        { label: "CAMS Services", href: "/cams-services" }
      ]
    },

    {
      pattern: /^\/kfintech-services/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Services", icon: Settings },
        { label: "Kfintech Services", href: "/kfintech-services" }
      ]
    },

    // Other pages
    {
      pattern: /^\/broking/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Live Markets", href: "/markets", icon: TrendingUp },
        { label: "Broking Terminal", href: "/broking" }
      ]
    },

    {
      pattern: /^\/fund-comparison/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Mutual Funds", href: "/mutual-funds", icon: BarChart3 },
        { label: "Fund Comparison", href: "/fund-comparison" }
      ]
    },

    {
      pattern: /^\/portfolio-comparison/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Portfolio", href: "/portfolio", icon: PieChart },
        { label: "Portfolio Comparison", href: "/portfolio-comparison" }
      ]
    },

    {
      pattern: /^\/agricultural-insights/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Market Research", href: "/agricultural-insights" }
      ]
    },

    {
      pattern: /^\/achievements/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Achievements", href: "/achievements" }
      ]
    },

    {
      pattern: /^\/cibil/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "CIBIL Score", href: "/cibil" }
      ]
    },

    {
      pattern: /^\/proposals/,
      breadcrumbs: () => [
        { label: "Dashboard", href: "/", icon: Home },
        { label: "Investment Proposals", href: "/proposals" }
      ]
    },

  ], []);

  // Find matching route config
  const currentBreadcrumbs = useMemo(() => {
    for (const config of routeConfigs) {
      if (typeof config.pattern === "string") {
        if (pathname === config.pattern) {
          return config.breadcrumbs(pathname, searchParams);
        }
      } else if (config.pattern.test(pathname)) {
        return config.breadcrumbs(pathname, searchParams);
      }
    }

    // Default breadcrumb for unknown routes
    return [
      { label: "Dashboard", href: "/", icon: Home },
      { label: "Page" }
    ];
  }, [pathname, searchParams, routeConfigs]);

  // Don't show breadcrumbs for home page
  if (pathname === "/" || currentBreadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 py-2 px-1 text-sm text-muted-foreground" data-testid="breadcrumb-navigation">
      <Breadcrumb>
        <BreadcrumbList>
          {currentBreadcrumbs.map((crumb, index) => {
            const isLast = index === currentBreadcrumbs.length - 1;
            const Icon = crumb.icon;

            return (
              <BreadcrumbItem key={index} data-testid={`breadcrumb-item-${index}`}>
                {!isLast && crumb.href ? (
                  <>
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href} className="flex items-center gap-2 hover:text-foreground transition-colors">
                        {Icon && <Icon className="h-3 w-3" />}
                        {crumb.label}
                        {crumb.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {crumb.badge}
                          </Badge>
                        )}
                      </Link>
                    </BreadcrumbLink>
                    <BreadcrumbSeparator>
                      <ChevronRight className="h-3 w-3" />
                    </BreadcrumbSeparator>
                  </>
                ) : (
                  <BreadcrumbPage className="flex items-center gap-2 text-foreground font-medium">
                    {Icon && <Icon className="h-3 w-3" />}
                    {crumb.label}
                    {crumb.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {crumb.badge}
                      </Badge>
                    )}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}