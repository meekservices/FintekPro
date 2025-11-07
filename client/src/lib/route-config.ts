export interface RouteConfig {
  path: string;
  name: string;
  requiresAuth: boolean;
  requiresKyc: boolean;
  icon?: string;
}

// Public routes - accessible to everyone (authenticated or not)
export const PUBLIC_ROUTES: RouteConfig[] = [
  { path: "/", name: "Home", requiresAuth: false, requiresKyc: false },
  { path: "/market", name: "Market", requiresAuth: false, requiresKyc: false },
  { path: "/auth", name: "Login", requiresAuth: false, requiresKyc: false },
  { path: "/register", name: "Register", requiresAuth: false, requiresKyc: false },
];

// KYC-gated routes - require authentication AND KYC completion
export const KYC_REQUIRED_ROUTES: RouteConfig[] = [
  { path: "/portfolio", name: "Portfolio", requiresAuth: true, requiresKyc: true },
  { path: "/products", name: "Products", requiresAuth: true, requiresKyc: true },
  { path: "/mutual-funds", name: "Mutual Funds", requiresAuth: true, requiresKyc: true },
  { path: "/stocks", name: "Stocks", requiresAuth: true, requiresKyc: true },
  { path: "/bonds", name: "Bonds", requiresAuth: true, requiresKyc: true },
  { path: "/ipos", name: "IPOs", requiresAuth: true, requiresKyc: true },
  { path: "/transactions", name: "Transactions", requiresAuth: true, requiresKyc: true },
  { path: "/orders", name: "Orders", requiresAuth: true, requiresKyc: true },
  { path: "/rebalance", name: "Rebalance", requiresAuth: true, requiresKyc: true },
  { path: "/calculators", name: "Calculators", requiresAuth: true, requiresKyc: true },
  { path: "/cart", name: "Cart", requiresAuth: true, requiresKyc: true },
  { path: "/wishlist", name: "Wishlist", requiresAuth: true, requiresKyc: true },
];

// Auth-only routes - require authentication but NOT KYC
export const AUTH_ONLY_ROUTES: RouteConfig[] = [
  { path: "/onboarding", name: "KYC Wizard", requiresAuth: true, requiresKyc: false },
  { path: "/kyc-dashboard", name: "KYC Dashboard", requiresAuth: true, requiresKyc: false },
  { path: "/settings", name: "Settings", requiresAuth: true, requiresKyc: false },
  { path: "/profile", name: "Profile", requiresAuth: true, requiresKyc: false },
];

export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => path.startsWith(route.path));
}

export function requiresKyc(path: string): boolean {
  return KYC_REQUIRED_ROUTES.some(route => path.startsWith(route.path));
}

export function requiresAuth(path: string): boolean {
  return [...KYC_REQUIRED_ROUTES, ...AUTH_ONLY_ROUTES].some(route => 
    path.startsWith(route.path)
  );
}
