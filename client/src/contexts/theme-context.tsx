import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";
type TextSize = "small" | "medium" | "large";

interface AccessibilitySettings {
	textBrightness: number; // 0-100, where 50 is default
	textSize: TextSize;
	transparency: number; // 0-100, where 0 = full transparency, 100 = solid backgrounds
	contrast: number; // 0-100, where 0 = normal, 100 = maximum contrast
	motion: number; // 0-100, where 0 = full animations, 100 = no animations
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
	transparency: 0,
	contrast: 0,
	motion: 0,
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

function applyAccessibilityStyles(
	settings: AccessibilitySettings,
	isDark: boolean,
) {
	const root = document.documentElement;

	const brightnessOffset = (settings.textBrightness - 50) * 0.6;
	const mutedLightness = isDark ? 65 + brightnessOffset : 45 - brightnessOffset;
	const foregroundLightness = isDark
		? Math.min(98, 90 + brightnessOffset / 2)
		: Math.max(5, 17 - brightnessOffset / 2);

	const clampedMuted = Math.max(30, Math.min(90, mutedLightness));
	const clampedFg = Math.max(5, Math.min(98, foregroundLightness));
	root.style.setProperty("--muted-foreground", `215 15% ${clampedMuted}%`);
	root.style.setProperty("--foreground", `210 40% ${clampedFg}%`);

	const sizeMap = { small: "14px", medium: "16px", large: "18px" };
	root.style.setProperty("--base-font-size", sizeMap[settings.textSize]);
	root.style.fontSize = sizeMap[settings.textSize];

	const transparencyLevel = settings.transparency / 100;
	if (isDark) {
		const cardAlpha = 0.85 + 0.15 * transparencyLevel;
		const mutedAlpha = 0.7 + 0.3 * transparencyLevel;
		const secondaryAlpha = 0.8 + 0.2 * transparencyLevel;
		root.style.setProperty("--card", `222 47% 16% / ${cardAlpha}`);
		root.style.setProperty("--muted", `217 33% 22% / ${mutedAlpha}`);
		root.style.setProperty("--secondary", `217 33% 24% / ${secondaryAlpha}`);
	} else {
		root.style.setProperty("--card", "0 0% 100%");
		root.style.setProperty("--muted", "210 20% 96%");
		root.style.setProperty("--secondary", "210 20% 96%");
	}

	const contrastLevel = settings.contrast / 100;
	const borderLightness = isDark
		? 35 + 15 * contrastLevel
		: 85 - 15 * contrastLevel;
	root.style.setProperty("--border", `217 33% ${borderLightness}%`);

	let userPrefsHighContrast = false;
	let userPrefsReduceMotion = false;
	try {
		const stored = localStorage.getItem("user-preferences");
		if (stored) {
			const parsed = JSON.parse(stored);
			userPrefsHighContrast = parsed.displayPreferences?.highContrast === true;
			userPrefsReduceMotion = parsed.displayPreferences?.reduceMotion === true;
		}
	} catch {}

	if (contrastLevel > 0.5 || userPrefsHighContrast) {
		root.classList.add("high-contrast");
	} else {
		root.classList.remove("high-contrast");
	}

	const motionLevel = settings.motion / 100;

	if (userPrefsReduceMotion) {
		root.style.setProperty("--animation-speed", "0");
		root.style.setProperty("--transition-duration", "0.01s");
	} else {
		root.style.setProperty("--animation-speed", `${1 - motionLevel}`);
		root.style.setProperty(
			"--transition-duration",
			`${Math.max(0.01, 0.3 * (1 - motionLevel))}s`,
		);
	}

	if (motionLevel > 0.5 || userPrefsReduceMotion) {
		root.classList.add("reduce-motion");
	} else {
		root.classList.remove("reduce-motion");
	}
}

function getSystemTheme(): "light" | "dark" {
	if (typeof window !== "undefined" && window.matchMedia) {
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
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
	const [accessibility, setAccessibilityState] =
		useState<AccessibilitySettings>(() => getStoredAccessibility());

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
		localStorage.setItem(THEME_STORAGE_KEY, newTheme);
	};

	const setAccessibility = (updates: Partial<AccessibilitySettings>) => {
		const newSettings = { ...accessibility, ...updates };
		setAccessibilityState(newSettings);
		localStorage.setItem(
			ACCESSIBILITY_STORAGE_KEY,
			JSON.stringify(newSettings),
		);
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
		<ThemeContext.Provider
			value={{
				theme,
				setTheme,
				resolvedTheme,
				accessibility,
				setAccessibility,
			}}
		>
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
