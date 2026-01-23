import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type TextSize = "small" | "medium" | "large";

interface AccessibilitySettings {
  textBrightness: number; // 0-100, where 50 is default
  textSize: TextSize;
  reduceTransparency: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
  accessibility: AccessibilitySettings;
  setAccessibility: (settings: Partial<AccessibilitySettings>) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "fintekpro-theme";
const ACCESSIBILITY_STORAGE_KEY = "fintekpro-accessibility";

const defaultAccessibility: AccessibilitySettings = {
  textBrightness: 50,
  textSize: "medium",
  reduceTransparency: false,
  highContrast: false,
  reducedMotion: false,
};

function getStoredAccessibility(): AccessibilitySettings {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (stored) {
      try {
        return { ...defaultAccessibility, ...JSON.parse(stored) };
      } catch {
        return defaultAccessibility;
      }
    }
  }
  return defaultAccessibility;
}

function applyAccessibilityStyles(settings: AccessibilitySettings, isDark: boolean) {
  const root = document.documentElement;
  
  // Text brightness: 0 = darker, 50 = default, 100 = lighter
  const brightnessOffset = (settings.textBrightness - 50) * 0.6; // -30 to +30
  const baseLightness = isDark ? 80 : 20;
  const mutedLightness = isDark ? (65 + brightnessOffset) : (45 - brightnessOffset);
  const foregroundLightness = isDark ? Math.min(98, 90 + brightnessOffset / 2) : Math.max(5, 17 - brightnessOffset / 2);
  
  root.style.setProperty('--muted-foreground', `hsl(215, 15%, ${Math.max(30, Math.min(90, mutedLightness))}%)`);
  root.style.setProperty('--foreground', `hsl(210, 40%, ${Math.max(5, Math.min(98, foregroundLightness))}%)`);
  
  // Text size
  const sizeMap = { small: '14px', medium: '16px', large: '18px' };
  root.style.setProperty('--base-font-size', sizeMap[settings.textSize]);
  root.style.fontSize = sizeMap[settings.textSize];
  
  // Reduce transparency
  if (settings.reduceTransparency) {
    root.style.setProperty('--card', isDark ? 'hsl(222, 47%, 16%)' : 'hsl(0, 0%, 100%)');
    root.style.setProperty('--muted', isDark ? 'hsl(217, 33%, 22%)' : 'hsl(210, 20%, 96%)');
    root.style.setProperty('--secondary', isDark ? 'hsl(217, 33%, 24%)' : 'hsl(210, 20%, 96%)');
  } else {
    root.style.setProperty('--card', isDark ? 'hsla(222, 47%, 16%, 0.85)' : 'hsl(0, 0%, 100%)');
    root.style.setProperty('--muted', isDark ? 'hsla(217, 33%, 22%, 0.7)' : 'hsl(210, 20%, 96%)');
    root.style.setProperty('--secondary', isDark ? 'hsla(217, 33%, 24%, 0.8)' : 'hsl(210, 20%, 96%)');
  }
  
  // High contrast
  if (settings.highContrast) {
    root.style.setProperty('--border', isDark ? 'hsl(217, 33%, 50%)' : 'hsl(214, 32%, 70%)');
    root.classList.add('high-contrast');
  } else {
    root.style.setProperty('--border', isDark ? 'hsl(217, 33%, 35%)' : 'hsl(214, 32%, 85%)');
    root.classList.remove('high-contrast');
  }
  
  // Reduced motion
  if (settings.reducedMotion) {
    root.classList.add('reduce-motion');
  } else {
    root.classList.remove('reduce-motion');
  }
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function getStoredTheme(): Theme {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    const stored = getStoredTheme();
    return stored === "system" ? getSystemTheme() : stored;
  });
  const [accessibility, setAccessibilityState] = useState<AccessibilitySettings>(() => getStoredAccessibility());

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  const setAccessibility = (updates: Partial<AccessibilitySettings>) => {
    const newSettings = { ...accessibility, ...updates };
    setAccessibilityState(newSettings);
    localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(newSettings));
  };

  useEffect(() => {
    const root = document.documentElement;
    const resolved = theme === "system" ? getSystemTheme() : theme;
    
    setResolvedTheme(resolved);
    
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    // Apply accessibility settings whenever theme changes
    applyAccessibilityStyles(accessibility, resolved === "dark");
  }, [theme, accessibility]);

  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = (e: MediaQueryListEvent) => {
      const newResolvedTheme = e.matches ? "dark" : "light";
      setResolvedTheme(newResolvedTheme);
      
      if (newResolvedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      
      // Apply accessibility settings when system theme changes
      applyAccessibilityStyles(accessibility, newResolvedTheme === "dark");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, accessibility]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, accessibility, setAccessibility }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
