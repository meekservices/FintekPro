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
  LogOut,
  Settings,
  ShieldCheck,
  Briefcase,
  Building2,
  ChevronDown,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface AppLayoutProps {
  children: React.ReactNode;
}

const ADMIN_ROLES = [
  'superadmin', 'master_agent', 'admin', 'tester',
  'bd_head', 'compliance_officer', 'finance_head', 'ops_head', 'hr_head', 'tech_head',
  'regulatory_auditor', 'bd_team', 'compliance_team', 'finance_team', 'ops_team',
  'hr_team', 'tech_backend', 'tech_frontend', 'tech_devops',
] as const;

function getKycChipLabel(user: any): { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } {
  const panOk = user?.panVerifiedViaSmartKyc;
  const aadhaarOk = user?.aadhaarVerifiedViaSmartKyc;
  if (panOk && aadhaarOk) return { label: 'KYC Verified', variant: 'default' };
  if (panOk) return { label: 'PAN Verified', variant: 'secondary' };
  return { label: 'KYC Pending', variant: 'outline' };
}

function getPrimaryRoleLabel(roles: string[] | undefined): string {
  if (!roles || roles.length === 0) return 'Client';
  const priority = [
    ['superadmin', 'Super Admin'],
    ['master_agent', 'Master Agent'],
    ['admin', 'Admin'],
    ['tester', 'Tester'],
    ['bd_head', 'BD Head'],
    ['compliance_officer', 'Compliance Officer'],
    ['finance_head', 'Finance Head'],
    ['ops_head', 'Ops Head'],
    ['hr_head', 'HR Head'],
    ['tech_head', 'Tech Head'],
    ['regulatory_auditor', 'Auditor'],
    ['partner', 'Partner'],
    ['partner_ops', 'Partner Ops'],
    ['agent', 'Agent'],
    ['sub_agent', 'Field Executive'],
    ['associate', 'Associate'],
    ['business_client', 'Business Client'],
    ['client', 'Client'],
  ] as [string, string][];
  for (const [id, label] of priority) {
    if (roles.includes(id)) return label;
  }
  return 'Client';
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();
  const isProfilePage = location.startsWith('/profile');
  const { user } = useAuth();

  const initials = user
    ? `${(user.firstName || '').charAt(0)}${(user.lastName || '').charAt(0)}`.toUpperCase() || 'U'
    : 'U';

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User'
    : 'Guest';

  const kycChip = user ? getKycChipLabel(user) : null;
  const primaryRole = getPrimaryRoleLabel(user?.roles);

  // Portal access checks for switcher links in dropdown
  const hasAdminRole = user?.roles?.some(r => ADMIN_ROLES.includes(r as any));
  const hasAgentRole = user?.roles?.some(r => ['agent', 'sub_agent', 'associate'].includes(r));
  const hasPartnerRole = user?.roles?.some(r => ['partner', 'partner_ops'].includes(r));
  const portalCategoryCount = [hasAdminRole, hasAgentRole, hasPartnerRole].filter(Boolean).length;
  const showPortalSwitcher = portalCategoryCount >= 2;

  const handleLogout = async () => {
    if (!user) return;
    try {
      await apiRequest("POST", "/api/logout");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/auth");
    } catch (e) {
      // silent
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className={`min-h-screen ${isMobile ? 'flex flex-col' : 'grid grid-cols-[auto_1fr]'}`}>
        {!isMobile && <EnhancedNavigation />}
        
        <main className="flex flex-col min-h-screen overflow-y-auto overflow-x-hidden min-w-0 bg-secondary/30">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-3 md:px-6 py-3">
            <div className="flex items-center justify-between gap-2">
              {isMobile && <EnhancedNavigation />}
              
              <div className={isMobile ? 'flex-1' : 'flex-1'}>
                <GlobalSearch />
              </div>

              <div className="flex items-center gap-2">
                {/* Notification bell */}
                <button
                  className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setLocation('/alerts')}
                  title="Alerts & Notifications"
                >
                  <Bell className="h-5 w-5" />
                </button>

                {/* Avatar dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer">
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
                    {user ? (
                      <>
                        {/* Header: name + email + KYC + role */}
                        <DropdownMenuLabel className="font-normal p-3">
                          <div className="flex flex-col gap-1.5">
                            <p className="text-sm font-semibold leading-none text-foreground">{displayName}</p>
                            {user.email && (
                              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {kycChip && (
                                <Badge
                                  variant={kycChip.variant}
                                  className={`text-[10px] px-1.5 py-0 h-4 ${kycChip.variant === 'default' ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
                                >
                                  {kycChip.label}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                {primaryRole}
                              </Badge>
                            </div>
                          </div>
                        </DropdownMenuLabel>

                        <DropdownMenuSeparator />

                        {/* Account Settings (consolidated) */}
                        <DropdownMenuItem onClick={() => setLocation("/profile?tab=settings")} className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          Account Settings
                        </DropdownMenuItem>

                        {/* Portal switcher links */}
                        {showPortalSwitcher && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1 font-semibold">
                              My Portals
                            </DropdownMenuLabel>
                            {hasAgentRole && (
                              <DropdownMenuItem asChild>
                                <a href="/?agent=true" target="_blank" rel="noopener noreferrer" className="cursor-pointer flex items-center gap-2">
                                  <Briefcase className="h-4 w-4 text-emerald-500" />
                                  <span>Agent Portal</span>
                                </a>
                              </DropdownMenuItem>
                            )}
                            {hasPartnerRole && (
                              <DropdownMenuItem asChild>
                                <a href="/?partner=true" target="_blank" rel="noopener noreferrer" className="cursor-pointer flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-blue-500" />
                                  <span>Partner Portal</span>
                                </a>
                              </DropdownMenuItem>
                            )}
                            {hasAdminRole && (
                              <DropdownMenuItem asChild>
                                <a href="/?admin=true" target="_blank" rel="noopener noreferrer" className="cursor-pointer flex items-center gap-2">
                                  <ShieldCheck className="h-4 w-4 text-orange-500" />
                                  <span>Admin Panel</span>
                                </a>
                              </DropdownMenuItem>
                            )}
                          </>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                          <LogOut className="mr-2 h-4 w-4" />
                          Log Out
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuLabel className="font-normal">
                          <p className="text-sm font-medium leading-none">Welcome</p>
                          <p className="text-xs leading-none text-muted-foreground mt-1">Sign in to access your account</p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setLocation("/auth")} className="cursor-pointer">
                          <LogIn className="mr-2 h-4 w-4" />
                          Sign In
                        </DropdownMenuItem>
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
