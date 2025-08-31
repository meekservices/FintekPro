import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { IBTrading } from "@/components/dashboard/ib-trading";

export default function IBTradingPage() {
  return (
    <div className="min-h-screen bg-finance-light" data-testid="ib-trading-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <IBTrading />
      </main>
      
      <Footer />
    </div>
  );
}