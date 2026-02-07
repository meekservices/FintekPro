import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2,
  TrendingUp,
  Shield,
  PieChart,
  Calculator,
  HelpCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  targetSelector?: string;
  position: 'center' | 'top' | 'bottom';
}

const TOUR_STORAGE_KEY = 'fintekpro-tour-completed';

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to FintekPro!',
    description: 'Your all-in-one financial services platform. Let us show you around the key features to help you get started.',
    icon: TrendingUp,
    position: 'center'
  },
  {
    id: 'quick-actions',
    title: 'Quick Actions',
    description: 'Access your most-used features instantly. Add investments, view your portfolio, generate tax reports, and more with just one click.',
    icon: Calculator,
    targetSelector: '[data-testid="quick-actions-widget"]',
    position: 'bottom'
  },
  {
    id: 'kyc-progress',
    title: 'Complete Your KYC',
    description: 'Track your KYC verification progress. Higher KYC levels unlock premium features like AIF, PMS, and unlisted shares trading.',
    icon: Shield,
    targetSelector: '[data-testid="kyc-progress-widget"]',
    position: 'bottom'
  },
  {
    id: 'navigation',
    title: 'Navigate with Ease',
    description: 'Use the sidebar to explore all services - from mutual funds to IPOs, bonds to loans. Toggle dark mode at the bottom!',
    icon: PieChart,
    targetSelector: '[data-testid="sidebar-theme-toggle"]',
    position: 'top'
  },
  {
    id: 'support',
    title: 'Need Help?',
    description: 'Our AI assistant is always available via the chat widget in the corner. You can also reach our support team anytime.',
    icon: HelpCircle,
    targetSelector: '[data-testid="sidebar-support-button"]',
    position: 'top'
  }
];

export function GuidedTour() {
  const { isAuthenticated, user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const tourCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    const isNewUser = user && !tourCompleted;
    
    if (isNewUser) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    const step = tourSteps[currentStep];
    if (step?.targetSelector && isVisible) {
      const element = document.querySelector(step.targetSelector) as HTMLElement;
      if (element) {
        setHighlightedElement(element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setHighlightedElement(null);
    }
  }, [currentStep, isVisible]);

  const handleNext = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
    setHighlightedElement(null);
  }, []);

  const handleSkip = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
    setHighlightedElement(null);
  }, []);

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const StepIcon = step.icon;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-[9998] transition-opacity duration-300"
        onClick={handleSkip}
        data-testid="tour-overlay"
      />

      {/* Highlight ring around target element */}
      {highlightedElement && (
        <div
          className="fixed z-[9999] pointer-events-none ring-4 ring-blue-500 ring-offset-4 rounded-lg animate-pulse"
          style={{
            top: highlightedElement.offsetTop - 8,
            left: highlightedElement.offsetLeft - 8,
            width: highlightedElement.offsetWidth + 16,
            height: highlightedElement.offsetHeight + 16,
          }}
        />
      )}

      {/* Tour card */}
      <Card 
        className={`fixed z-[10000] w-[90%] max-w-md shadow-2xl border-2 border-blue-500 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
          step.position === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
          step.position === 'top' ? 'top-24 left-1/2 -translate-x-1/2' :
          'bottom-24 left-1/2 -translate-x-1/2'
        }`}
        data-testid="guided-tour-card"
      >
        <CardContent className="pt-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900 rounded-xl">
                <StepIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <Badge variant="secondary" className="mb-1">
                  Step {currentStep + 1} of {tourSteps.length}
                </Badge>
                <h3 className="font-semibold text-lg">{step.title}</h3>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 -mt-1 -mr-2"
              onClick={handleSkip}
              data-testid="tour-close-btn"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Description */}
          <p className="text-muted-foreground mb-6 leading-relaxed">
            {step.description}
          </p>

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
              data-testid="tour-skip-btn"
            >
              Skip tour
            </Button>
            
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handlePrev}
                  data-testid="tour-prev-btn"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button 
                size="sm"
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="tour-next-btn"
              >
                {currentStep === tourSteps.length - 1 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Got it!
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export function TourTrigger() {
  const handleStartTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    window.location.reload();
  };

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleStartTour}
      className="gap-2"
      data-testid="restart-tour-btn"
    >
      <HelpCircle className="h-4 w-4" />
      Take a Tour
    </Button>
  );
}
