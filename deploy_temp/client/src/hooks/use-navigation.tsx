import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface NavigationContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  getContentClasses: () => string;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Retrieve from localStorage on initialization
    const saved = localStorage.getItem('navigation-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    // Save to localStorage whenever state changes
    localStorage.setItem('navigation-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const getContentClasses = () => {
    if (isCollapsed) {
      return "lg:ml-16"; // When collapsed, less margin
    } else {
      return "lg:ml-64"; // When expanded, full margin
    }
  };

  return (
    <NavigationContext.Provider value={{ isCollapsed, setIsCollapsed, getContentClasses }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}