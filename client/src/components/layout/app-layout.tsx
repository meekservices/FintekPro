import { EnhancedNavigation } from "./enhanced-navigation";
import { Footer } from "./footer";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { KycUpgradeBanner } from "@/components/KycUpgradeBanner";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Bell,
  LogIn,
  Settings,
  ShieldCheck,
  Briefcase,
  Building2,
  ChevronDown,
} from "lucide-react";
import type { UserAlert } from "@shared/schema";
import { ADMIN_PORTAL_ROLES, AGENT_PORTAL_ROLES, PARTNER_PORTAL_ROLES } from "@shared/roles";

interface AppLayoutProps {
  children: React.ReactNode;
}

// Typed sets built from the single source of truth in shared/roles.ts
const ADMIN_ROLE_SET  = new Set<string>(ADMIN_PORTAL_ROLES);
const AGENT_ROLE_SET  = new Set<string>(AGENT_PORTAL_ROLES);
const PARTNER_ROLE_SET = new Set<string>(PARTNER_PORTAL_ROLES);

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  master_agent: 'Master Agent',
  admin: 'Admin',
  tester: 'Tester',
  bd_head: 'BD Head',
  compliance_officer: 'Compliance Officer',
  finance_head: 'Finance Head',
  ops_head: 'Ops Head',
  hr_head: 'HR Head',
  tech_head: 'Tech Head',
  regulatory_auditor: 'Auditor',
  bd_team: 'BD Team',
  compliance_team: 'Compliance Team',
  finance_team: 'Finance Team',
  ops_team: 'Ops Team',
  hr_team: 'HR Team',
  tech_backend: 'Backend Dev',
  tech_frontend: 'Frontend Dev',
  tech_devops: 'DevOps',
  partner: 'Partner',
  partner_ops: 'Partner Ops',
  agent: 'Agent',
  sub_agent: 'Field Executive',
  associate: 'Associate',
  business_client: 'Business Client',
  client: 'Client',
  user: 'User',
};

/** Priority-ordered role list to determine KYC chip label */
function getKycChipProps(user: Record<string, unknown>): { label: string; className: string } {
  const panOk = user.panVerifiedViaSmartKyc === true;
  const aadhaarOk = user.aadhaarVerifiedViaSmartKyc === true;
  if (panOk && aadhaarOk) return { label: 'KYC Verified', className: 'bg-emerald-600 hover:bg-emerald-600 text-white border-0' };
  if (panOk)               return { label: 'PAN Verified', className: '' };
  return                        { label: 'KYC Pending',  className: 'border-dashed' };
}

/** Returns a display label for each role the user holds (max 3 to avoid overflow) */
function getRoleBadgeLabels(roles: string[] | undefined): string[] {
  if (!roles || roles.length === 0) return ['Client'];
  const labels = roles
    .filter(r => r !== 'user')  // 'user' is the base role, not worth showing
    .map(r => ROLE_LABELS[r] ?? r)
    .slice(0, 3);
  return labels.length > 0 ? labels : ['Client'];
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();
  const isProfilePage = location.startsWith('/profile');
  const { user } = useAuth();

  // Notification badge: count of active alerts triggered in the last 24 h
  const { data: activeAlerts } = useQuery<UserAlert[]>({
    queryKey: ['/api/alerts', { status: 'active' }],
    queryFn: () => fetch('/api/alerts?status=active').then(r => r.ok ? r.json() : []),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const bellBadgeCount = (activeAlerts ?? []).filter(
    a => a.lastTriggeredAt != null && new Date(a.lastTriggeredAt).getTime() > dayAgo
  ).length;

  const initials = user
    ? `${(user.firstName ?? '').charAt(0)}${(user.lastName ?? '').charAt(0)}`.toUpperCase() || 'U'
    : 'U';
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User'
    : 'Guest';

  // KYC status chip
  const kycChip = user ? getKycChipProps(user as unknown as Record<string, unknown>) : null;

  // Role badges (up to 3)
  const roleBadgeLabels = getRoleBadgeLabels(user?.roles ?? undefined);

  // Portal access — typed sets, no `as any`
  const roles: string[] = user?.roles ?? [];
  const hasAdminRole  = roles.some(r => ADMIN_ROLE_SET.has(r));
  const hasAgentRole  = roles.some(r => AGENT_ROLE_SET.has(r));
  const hasPartnerRole = roles.some(r => PARTNER_ROLE_SET.has(r));
  const portalCategoryCount = [hasAdminRole, hasAgentRole, hasPartnerRole].filter(Boolean).length;
  const showPortalSwitcher = portalCategoryCount >= 2;

  return (
    <div className="min-h-screen bg-background">
      <div className={`min-h-screen ${isMobile ? 'flex flex-col' : 'grid grid-cols-[auto_1fr]'}`}>
        {!isMobile && <EnhancedNavigation />}

        <main className="flex flex-col min-h-screen overflow-y-auto overflow-x-hidden min-w-0 bg-secondary/30">
          {/* Sticky top header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-3 md:px-6 py-3">
            <div className="flex items-center justify-between gap-2">
              {isMobile && <EnhancedNavigation />}

              <div className="flex-1">
                <GlobalSearch />
              </div>

              <div className="flex items-center gap-2">
                {/* Notification bell with triggered-alert badge */}
                <button
                  className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setLocation('/alerts')}
                  title="Alerts & Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {bellBadgeCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground leading-none">
                      {bellBadgeCount > 9 ? '9+' : bellBadgeCount}
                    </span>
                  )}
                </button>

                {/* Avatar dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer">
                      <Avatar className="h-9 w-9 border-2 border-primary/20 hover:border-primary/50 transition-colors">
                        {user?.profileImageUrl && (
                          <AvatarImage src={user.profileImageUrl} alt={displayName} />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-64">
                    {!user && (
                      <>
                        <DropdownMenuLabel className="font-normal">
                          <p className="text-sm font-medium leading-none">Welcome</p>
                          <p className="text-xs text-muted-foreground mt-1">Sign in to access your account</p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setLocation('/auth')} className="cursor-pointer">
                          <LogIn className="mr-2 h-4 w-4" />
                          Sign In
                        </DropdownMenuItem>
                      </>
                    )}
                    {/* Authenticated user content */}
                    {user && (
                      <>
                        {/* User header — name, email, KYC chip, role badge(s) */}
                        <DropdownMenuLabel className="font-normal p-3">
                          <div className="flex flex-col gap-1.5">
                            <p className="text-sm font-semibold leading-none text-foreground">{displayName}</p>
                            {user.email && (
                              <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {/* KYC status chip */}
                              {kycChip && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 h-4 ${kycChip.className}`}
                                >
                                  {kycChip.label}
                                </Badge>
                              )}
                              {/* One badge per distinct role the user holds */}
                              {roleBadgeLabels.map(label => (
                                <Badge
                                  key={label}
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4"
                                >
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </DropdownMenuLabel>

                        <DropdownMenuSeparator />

                        {/* Account Settings (consolidated — replaces separate Profile + Settings links) */}
                        <DropdownMenuItem
                          onClick={() => setLocation('/profile?tab=settings')}
                          className="cursor-pointer"
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Account Settings
                        </DropdownMenuItem>

                        {/* Portal switcher — only for users with 2+ distinct portal categories */}
                        {showPortalSwitcher && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1 font-semibold">
                              My Portals
                            </DropdownMenuLabel>
                            {hasAgentRole && (
                              <DropdownMenuItem asChild>
                                <a
                                  href="/?agent=true"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cursor-pointer flex items-center gap-2"
                                >
                                  <Briefcase className="h-4 w-4 text-emerald-500" />
                                  <span>Agent Portal</span>
                                </a>
                              </DropdownMenuItem>
                            )}
                            {hasPartnerRole && (
                              <DropdownMenuItem asChild>
                                <a
                                  href="/?partner=true"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cursor-pointer flex items-center gap-2"
                                >
                                  <Building2 className="h-4 w-4 text-blue-500" />
                                  <span>Partner Portal</span>
                                </a>
                              </DropdownMenuItem>
                            )}
                            {hasAdminRole && (
                              <DropdownMenuItem asChild>
                                <a
                                  href="/?admin=true"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cursor-pointer flex items-center gap-2"
                                >
                                  <ShieldCheck className="h-4 w-4 text-orange-500" />
                                  <span>Admin Panel</span>
                                </a>
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        {/* Log Out intentionally omitted — already in sidebar nav */}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {!isProfilePage && <KycUpgradeBanner />}

          <div className={`flex-1 ${isMobile ? 'p-3 pb-20' : 'p-6'}`}>
            {children}
          </div>

          {!isMobile && <Footer />}
        </main>
      </div>

      {isMobile && <MobileBottomNav />}

      <FloatingChatWidget />

      <GuidedTour />
    </div>
  );
}
