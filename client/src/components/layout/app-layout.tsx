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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings, LogOut, LogIn } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface AppLayoutProps {
  children: React.ReactNode;
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
        
        <main className="flex flex-col min-h-screen overflow-y-auto bg-secondary/30">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-3 md:px-6 py-3">
            <div className="flex items-center justify-between gap-2">
              {isMobile && <EnhancedNavigation />}
              
              <div className={isMobile ? 'flex-1' : 'flex-1'}>
                <GlobalSearch />
              </div>

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
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {user ? (
                    <>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{displayName}</p>
                          {user.email && (
                            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                          )}
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation("/profile?tab=settings")} className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
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
