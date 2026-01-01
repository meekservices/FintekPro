import { EnhancedNavigation } from "./enhanced-navigation";
import { Footer } from "./footer";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { KycUpgradeBanner } from "@/components/KycUpgradeBanner";

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