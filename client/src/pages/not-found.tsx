import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { EnhancedNavigation } from "@/components/layout/enhanced-navigation";
import { Footer } from "@/components/layout/footer";

export default function NotFound() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('nav-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const handleNavChange = (e: CustomEvent) => {
      setIsNavCollapsed(e.detail.collapsed);
    };

    window.addEventListener('navigation-change', handleNavChange as EventListener);
    return () => {
      window.removeEventListener('navigation-change', handleNavChange as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen bg-finance-light">
      <EnhancedNavigation />
      
      <main className={`min-h-screen w-full flex items-center justify-center ${isNavCollapsed ? 'ml-0 lg:ml-16' : 'ml-0 lg:ml-64'}`}>
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <AlertCircle className="h-8 w-8 text-red-500" data-testid="icon-error" />
              <h1 className="text-2xl font-bold text-gray-900" data-testid="title-404">404 Page Not Found</h1>
            </div>

            <p className="mt-4 text-sm text-gray-600" data-testid="text-description">
              Did you forget to add the page to the router?
            </p>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
}
