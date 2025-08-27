import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { X, ChevronLeft, ChevronRight, Play, SkipForward } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'hover' | 'scroll';
  optional?: boolean;
}

interface TutorialOverlayProps {
  isActive: boolean;
  onClose: () => void;
  onComplete: () => void;
  steps: TutorialStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
}

export function TutorialOverlay({ 
  isActive, 
  onClose, 
  onComplete, 
  steps, 
  currentStep, 
  onStepChange 
}: TutorialOverlayProps) {
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const targetElement = document.querySelector(currentStepData.target) as HTMLElement;
    if (targetElement) {
      setHighlightedElement(targetElement);
      
      // Calculate tooltip position
      const rect = targetElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      let top = 0;
      let left = 0;
      
      switch (currentStepData.position) {
        case 'top':
          top = rect.top + scrollTop - 120;
          left = rect.left + scrollLeft + rect.width / 2 - 150;
          break;
        case 'bottom':
          top = rect.bottom + scrollTop + 20;
          left = rect.left + scrollLeft + rect.width / 2 - 150;
          break;
        case 'left':
          top = rect.top + scrollTop + rect.height / 2 - 80;
          left = rect.left + scrollLeft - 320;
          break;
        case 'right':
          top = rect.top + scrollTop + rect.height / 2 - 80;
          left = rect.right + scrollLeft + 20;
          break;
      }
      
      setTooltipPosition({ top, left });
      
      // Scroll element into view
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add highlight class
      targetElement.classList.add('tutorial-highlight');
    }

    return () => {
      if (targetElement) {
        targetElement.classList.remove('tutorial-highlight');
      }
    };
  }, [isActive, currentStep, currentStepData]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      onStepChange(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!isActive || !currentStepData) return null;

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 tutorial-overlay" />
      
      {/* Tutorial tooltip */}
      <div 
        className="fixed z-50 w-80"
        style={{ 
          top: `${tooltipPosition.top}px`, 
          left: `${tooltipPosition.left}px`,
          maxWidth: '320px'
        }}
        data-testid="tutorial-tooltip"
      >
        <Card className="border-2 border-finance-blue shadow-2xl">
          <CardContent className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <Badge variant="secondary" className="bg-finance-blue text-white">
                Step {currentStep + 1} of {steps.length}
              </Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                className="h-6 w-6 p-0"
                data-testid="tutorial-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Progress bar */}
            <Progress value={progress} className="mb-4 h-2" />
            
            {/* Content */}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-2" data-testid="tutorial-title">
                {currentStepData.title}
              </h3>
              <p className="text-sm text-gray-600" data-testid="tutorial-description">
                {currentStepData.description}
              </p>
              
              {currentStepData.action && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                  {currentStepData.action === 'click' && '👆 Click on the highlighted element'}
                  {currentStepData.action === 'hover' && '🖱️ Hover over the highlighted element'}
                  {currentStepData.action === 'scroll' && '📜 Scroll to see more content'}
                </div>
              )}
            </div>
            
            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                data-testid="tutorial-previous"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  data-testid="tutorial-skip"
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  Skip
                </Button>
                
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="bg-finance-blue hover:bg-blue-700"
                  data-testid="tutorial-next"
                >
                  {currentStep < steps.length - 1 ? (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Complete
                      <Play className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}