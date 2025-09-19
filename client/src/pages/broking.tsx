import { EnhancedNavigation } from "@/components/layout/enhanced-navigation";
import { Footer } from "@/components/layout/footer";
import { BrokingDashboard } from "@/components/dashboard/broking";

export default function BrokingPage() {
  return (
    <div className="min-h-screen bg-finance-light" data-testid="broking-page">
      <EnhancedNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0 lg:ml-64">
        <BrokingDashboard />
      </main>
      
      <Footer />
    </div>
  );
}