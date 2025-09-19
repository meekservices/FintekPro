import { useState, useEffect } from "react";
import { AgriculturalInsights } from "@/components/dashboard/agricultural-insights";
import { EnhancedNavigation } from "@/components/layout/enhanced-navigation";

export default function AgriculturalInsightsPage() {
  // Navigation state for responsive layout
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('navigation-collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Listen for navigation state changes
  useEffect(() => {
    const handleNavChange = (event: CustomEvent) => {
      setIsNavCollapsed(event.detail.isCollapsed);
    };
    
    window.addEventListener('navigation-state-changed', handleNavChange as EventListener);
    return () => window.removeEventListener('navigation-state-changed', handleNavChange as EventListener);
  }, []);
  return (
    <div className="min-h-screen bg-gray-50">
      <EnhancedNavigation />
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0 ${isNavCollapsed ? 'ml-16 lg:ml-0' : 'ml-64 lg:ml-0'}`}>
        <AgriculturalInsights />
      </main>
    </div>
  );
}