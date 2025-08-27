import { useState, useEffect } from 'react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'hover' | 'scroll';
  optional?: boolean;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to FinanceHub',
    description: 'Your comprehensive financial platform with market data, portfolio management, and depository services all in one place.',
    target: '[data-testid="home-page"]',
    position: 'bottom'
  },
  {
    id: 'market-ticker',
    title: 'Live Market Updates',
    description: 'Stay updated with real-time market movements. Our ticker shows live prices for major stocks and indices.',
    target: '[data-testid="market-ticker"]',
    position: 'bottom',
    action: 'hover'
  },
  {
    id: 'portfolio-summary',
    title: 'Portfolio Overview',
    description: 'Track your investments with our comprehensive portfolio dashboard showing your holdings, performance, and allocation.',
    target: '[data-testid="portfolio-summary"]',
    position: 'left'
  },
  {
    id: 'market-chart',
    title: 'Interactive Charts',
    description: 'Analyze market trends with our interactive charts. Click on different timeframes to view historical data.',
    target: '[data-testid="market-chart"]',
    position: 'right',
    action: 'click'
  },
  {
    id: 'api-status',
    title: 'API Integration Status',
    description: 'See all our integrated financial APIs providing real-time data from Finnhub, MF Central, NSDL, and CDSL.',
    target: '[data-testid="api-status-section"]',
    position: 'top'
  },
  {
    id: 'services-grid',
    title: 'Financial Services',
    description: 'Access our comprehensive range of financial services including mutual funds, stocks, bonds, and depository services.',
    target: '[data-testid="services-grid"]',
    position: 'top'
  },
  {
    id: 'market-news',
    title: 'Latest Financial News',
    description: 'Stay informed with the latest financial news and market updates from trusted sources.',
    target: '[data-testid="market-news"]',
    position: 'top'
  },
  {
    id: 'calculators',
    title: 'Financial Calculators',
    description: 'Use our powerful calculators for SIP, EMI, retirement planning, and tax calculations to make informed decisions.',
    target: '[data-testid="calculators-section"]',
    position: 'top',
    action: 'click'
  }
];

const TUTORIAL_STORAGE_KEY = 'financehub-tutorial-completed';

export function useTutorial() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
    setIsCompleted(completed);
  }, []);

  const startTutorial = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const closeTutorial = () => {
    setIsActive(false);
  };

  const completeTutorial = () => {
    setIsActive(false);
    setIsCompleted(true);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
  };

  const goToStep = (step: number) => {
    if (step >= 0 && step < TUTORIAL_STEPS.length) {
      setCurrentStep(step);
    }
  };

  const resetTutorial = () => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setIsCompleted(false);
    setCurrentStep(0);
  };

  return {
    isActive,
    currentStep,
    isCompleted,
    steps: TUTORIAL_STEPS,
    startTutorial,
    closeTutorial,
    completeTutorial,
    goToStep,
    resetTutorial
  };
}