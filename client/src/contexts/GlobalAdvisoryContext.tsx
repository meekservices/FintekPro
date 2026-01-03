import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { 
  useEnabledMarkets, 
  useUserMarketPreferences, 
  useSelectMarket, 
  useHasAcknowledged,
  useMarketEligibility,
  type Market,
  type UserMarketPreferences,
  type MarketEligibility,
  type JurisdictionFeatureFlags
} from "@/hooks/use-global-advisory";
import { GlobalAdvisoryDisclaimer, ExecutionRedirectModal } from "@/components/global-advisory/GlobalAdvisoryDisclaimer";

interface GlobalAdvisoryContextType {
  selectedMarket: Market | null;
  preferences: UserMarketPreferences | null;
  markets: Market[];
  isLoading: boolean;
  isGlobalMode: boolean;
  canExecute: boolean;
  advisoryLevel: string;
  isAnalyticsMode: boolean;
  eligibleMarkets: MarketEligibility[];
  jurisdictionFlags: JurisdictionFeatureFlags;
  currentMarketEligibility: MarketEligibility | null;
  displayCurrency: string;
  switchMarket: (marketCode: string) => Promise<void>;
  checkDisclaimerAndProceed: (marketCode: string, onProceed: () => void) => void;
  showExecutionRedirect: () => void;
  isProductAllowed: (productCategory: string) => boolean;
}

const GlobalAdvisoryContext = createContext<GlobalAdvisoryContextType | null>(null);

interface GlobalAdvisoryProviderProps {
  children: ReactNode;
}

export function GlobalAdvisoryProvider({ children }: GlobalAdvisoryProviderProps) {
  const { data: marketsData, isLoading: marketsLoading } = useEnabledMarkets();
  const { data: preferencesData, isLoading: preferencesLoading } = useUserMarketPreferences();
  const { data: eligibilityData, isLoading: eligibilityLoading } = useMarketEligibility();
  const selectMarketMutation = useSelectMarket();
  
  const [disclaimerState, setDisclaimerState] = useState<{
    isOpen: boolean;
    marketCode: string;
    marketName: string;
    onProceed: (() => void) | null;
  }>({ isOpen: false, marketCode: "", marketName: "", onProceed: null });
  
  const [executionRedirectOpen, setExecutionRedirectOpen] = useState(false);
  
  const markets = marketsData?.markets || [];
  const preferences = preferencesData?.preferences || null;
  const selectedMarketCode = preferences?.selectedMarket || "IN";
  const selectedMarket = markets.find(m => m.marketCode === selectedMarketCode) || markets.find(m => m.marketCode === "IN") || null;
  
  const isGlobalMode = selectedMarketCode !== "IN";
  const canExecute = selectedMarket?.executionAllowed || false;
  const advisoryLevel = selectedMarket?.advisoryLevel || "FULL";
  const isAnalyticsMode = eligibilityData?.eligibility?.isAnalyticsMode ?? !canExecute;
  const displayCurrency = preferences?.displayCurrency || selectedMarket?.baseCurrency || "INR";
  
  const eligibleMarkets = eligibilityData?.eligibility?.markets || [];
  const currentMarketEligibility = eligibleMarkets.find(m => m.marketCode === selectedMarketCode) || null;
  
  const jurisdictionFlags: JurisdictionFeatureFlags = useMemo(() => ({
    canExecuteTrades: canExecute,
    canViewAnalytics: selectedMarket?.isEnabled ?? false,
    canAccessRealTimeData: advisoryLevel === "FULL",
    canAccessResearch: selectedMarket?.isEnabled ?? false,
    canAccessAlerts: selectedMarket?.isEnabled ?? false,
    hasEtfOnlyRestriction: currentMarketEligibility?.restrictions?.some(r => r.includes("ETF")) ?? false,
    requiresAccreditedStatus: currentMarketEligibility?.restrictions?.some(r => r.includes("accredited")) ?? false,
    requiredAcknowledgments: isGlobalMode ? ["global_advisory_disclaimer"] : [],
  }), [canExecute, selectedMarket, advisoryLevel, currentMarketEligibility, isGlobalMode]);
  
  const { data: ackData } = useHasAcknowledged(
    selectedMarketCode, 
    "global_advisory_disclaimer"
  );
  
  const switchMarket = useCallback(async (marketCode: string) => {
    await selectMarketMutation.mutateAsync(marketCode);
  }, [selectMarketMutation]);
  
  const checkDisclaimerAndProceed = useCallback((marketCode: string, onProceed: () => void) => {
    if (marketCode === "IN") {
      onProceed();
      return;
    }
    
    const market = markets.find(m => m.marketCode === marketCode);
    if (!market) return;
    
    if (ackData?.hasAcknowledged) {
      onProceed();
      return;
    }
    
    setDisclaimerState({
      isOpen: true,
      marketCode,
      marketName: market.marketName,
      onProceed,
    });
  }, [markets, ackData]);
  
  const showExecutionRedirect = useCallback(() => {
    setExecutionRedirectOpen(true);
  }, []);
  
  const isProductAllowed = useCallback((productCategory: string): boolean => {
    if (!currentMarketEligibility) return selectedMarketCode === "IN";
    return currentMarketEligibility.allowedProducts.includes(productCategory);
  }, [currentMarketEligibility, selectedMarketCode]);
  
  const handleDisclaimerAccept = () => {
    setDisclaimerState(prev => {
      prev.onProceed?.();
      return { isOpen: false, marketCode: "", marketName: "", onProceed: null };
    });
  };
  
  const handleDisclaimerDecline = () => {
    setDisclaimerState({ isOpen: false, marketCode: "", marketName: "", onProceed: null });
  };
  
  return (
    <GlobalAdvisoryContext.Provider
      value={{
        selectedMarket,
        preferences,
        markets,
        isLoading: marketsLoading || preferencesLoading || eligibilityLoading,
        isGlobalMode,
        canExecute,
        advisoryLevel,
        isAnalyticsMode,
        eligibleMarkets,
        jurisdictionFlags,
        currentMarketEligibility,
        displayCurrency,
        switchMarket,
        checkDisclaimerAndProceed,
        showExecutionRedirect,
        isProductAllowed,
      }}
    >
      {children}
      
      <GlobalAdvisoryDisclaimer
        marketCode={disclaimerState.marketCode}
        marketName={disclaimerState.marketName}
        isOpen={disclaimerState.isOpen}
        onAccept={handleDisclaimerAccept}
        onDecline={handleDisclaimerDecline}
      />
      
      <ExecutionRedirectModal
        marketCode={selectedMarket?.marketCode || ""}
        marketName={selectedMarket?.marketName || ""}
        isOpen={executionRedirectOpen}
        onClose={() => setExecutionRedirectOpen(false)}
      />
    </GlobalAdvisoryContext.Provider>
  );
}

export function useGlobalAdvisory() {
  const context = useContext(GlobalAdvisoryContext);
  if (!context) {
    throw new Error("useGlobalAdvisory must be used within a GlobalAdvisoryProvider");
  }
  return context;
}
