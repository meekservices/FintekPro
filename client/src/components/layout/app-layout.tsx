import { EnhancedNavigation } from "./enhanced-navigation";
import { Footer } from "./footer";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { KycUpgradeBanner } from "@/components/KycUpgradeBanner";
import { GlobalSearch } from "@/components/GlobalSearch";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen grid grid-cols-[auto_1fr] bg-background">
      {/* Sidebar - automatically sizes based on content */}
      <EnhancedNavigation />
      
      {/* Main content area - takes remaining space */}
      <main className="flex flex-col min-h-screen overflow-y-auto bg-secondary/30">
        {/* Header with Global Search */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-6 py-3">
          <div className="flex items-center justify-end">
            <GlobalSearch />
          </div>
        </div>
        
        {/* KYC Upgrade Banner - shown for users with incomplete KYC */}
        <KycUpgradeBanner />
        
        <div className="flex-1 p-6">
          {children}
        </div>
        <Footer />
      </main>
      
      {/* Floating AI Chat Widget */}
      <FloatingChatWidget />
      
      {/* Guided Tour for New Users */}
      <GuidedTour />
    </div>
  );
}