import { AgriculturalInsights } from "@/components/dashboard/agricultural-insights";
import { Header } from "@/components/layout/header";

export default function AgriculturalInsightsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AgriculturalInsights />
      </main>
    </div>
  );
}