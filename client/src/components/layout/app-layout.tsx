import { EnhancedNavigation } from "./enhanced-navigation";
import { Footer } from "./footer";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { KycUpgradeBanner } from "@/components/KycUpgradeBanner";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const isProfilePage = location.startsWith('/profile');
  
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop: Grid with sidebar, Mobile: Single column */}
      <div className={`min-h-screen ${isMobile ? 'flex flex-col' : 'grid grid-cols-[auto_1fr]'}`}>
        {/* Sidebar - hidden on mobile, shown on desktop */}
        {!isMobile && <EnhancedNavigation />}
        
        {/* Main content area */}
        <main className="flex flex-col min-h-screen overflow-y-auto bg-secondary/30">
          {/* Header with Navigation toggle and Global Search */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-3 md:px-6 py-3">
            <div className="flex items-center justify-between gap-2">
              {/* Mobile: Show navigation trigger */}
              {isMobile && <EnhancedNavigation />}
              
              {/* Global Search - full width on mobile */}
              <div className={isMobile ? 'flex-1' : ''}>
                <GlobalSearch />
              </div>
            </div>
          </div>
          
          {/* KYC Upgrade Banner - hidden on profile page which has its own KYC dashboard */}
          {!isProfilePage && <KycUpgradeBanner />}
          
          {/* Content with responsive padding */}
          <div className={`flex-1 ${isMobile ? 'p-3 pb-20' : 'p-6'}`}>
            {children}
          </div>
          
          {/* Footer - hidden on mobile to make room for bottom nav */}
          {!isMobile && <Footer />}
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}
      
      {/* Floating AI Chat Widget */}
      <FloatingChatWidget />
      
      {/* Guided Tour for New Users */}
      <GuidedTour />
    </div>
  );
}