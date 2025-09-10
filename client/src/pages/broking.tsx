import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BrokingDashboard } from "@/components/dashboard/broking";

export default function BrokingPage() {
  return (
    <div className="min-h-screen bg-finance-light" data-testid="broking-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BrokingDashboard />
      </main>
      
      <Footer />
    </div>
  );
}