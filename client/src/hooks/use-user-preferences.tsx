import {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
	type ReactNode,
} from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export type NavPosition = "left" | "top" | "bottom";

export interface DisplayPreferences {
	reduceMotion: boolean;
	highContrast: boolean;
	compactMode: boolean;
}

interface UserPreferences {
	navPosition: NavPosition;
	displayPreferences: DisplayPreferences;
}

interface UserPreferencesContextType {
	navPosition: NavPosition;
	setNavPosition: (position: NavPosition) => void;
	displayPreferences: DisplayPreferences;
	setDisplayPreference: <K extends keyof DisplayPreferences>(
		key: K,
		value: DisplayPreferences[K],
	) => void;
	resetAllPreferences: () => void;
	isLoading: boolean;
	isPending: boolean;
}

const PREFERENCES_CACHE_KEY = "user-preferences";

const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
	reduceMotion: false,
	highContrast: false,
	compactMode: false,
};

const DEFAULT_PREFERENCES: UserPreferences = {
	navPosition: "left",
	displayPreferences: DEFAULT_DISPLAY_PREFERENCES,
};

function getStoredPreferences(): UserPreferences {
	try {
		const cached = localStorage.getItem(PREFERENCES_CACHE_KEY);
		if (cached) {
			const parsed = JSON.parse(cached);
			return {
				navPosition: parsed.navPosition || DEFAULT_PREFERENCES.navPosition,
				displayPreferences: {
					...DEFAULT_DISPLAY_PREFERENCES,
					...(parsed.displayPreferences || {}),
				},
			};
		}
	} catch {
		// ignore
	}
	return DEFAULT_PREFERENCES;
}

function applyDisplayPreferences(prefs: DisplayPreferences) {
	const root = document.documentElement;

	if (prefs.reduceMotion) {
		root.classList.add("reduce-motion");
		root.style.setProperty("--animation-speed", "0");
		root.style.setProperty("--transition-duration", "0.01s");
	} else {
		root.classList.remove("reduce-motion");
		root.style.setProperty("--animation-speed", "1");
		root.style.setProperty("--transition-duration", "0.3s");
	}

	if (prefs.highContrast) {
		root.classList.add("high-contrast");
	} else {
		root.classList.remove("high-contrast");
	}

	if (prefs.compactMode) {
		root.classList.add("compact-mode");
	} else {
		root.classList.remove("compact-mode");
	}
}

const UserPreferencesContext = createContext<
	UserPreferencesContextType | undefined
>(undefined);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
	const { isAuthenticated } = useAuth();
	const [localPreferences, setLocalPreferences] = useState<UserPreferences>(
		() => {
			const stored = getStoredPreferences();
			if (typeof window !== "undefined") {
				applyDisplayPreferences(stored.displayPreferences);
			}
			return stored;
		},
	);

	useEffect(() => {
		applyDisplayPreferences(localPreferences.displayPreferences);
	}, []);

	const { data: preferences, isLoading } = useQuery<UserPreferences>({
		queryKey: ["/api/user/preferences"],
		staleTime: 1000 * 60 * 5,
		retry: false,
		enabled: isAuthenticated,
	});

	useEffect(() => {
		if (preferences?.navPosition) {
			setLocalPreferences((prev) => {
				const merged: UserPreferences = {
					navPosition: preferences.navPosition || prev.navPosition,
					displayPreferences: {
						...prev.displayPreferences,
						...(preferences.displayPreferences || {}),
					},
				};
				localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(merged));
				applyDisplayPreferences(merged.displayPreferences);
				return merged;
			});
		}
	}, [preferences]);

	const saveToStorage = useCallback((prefs: UserPreferences) => {
		localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(prefs));
		applyDisplayPreferences(prefs.displayPreferences);
	}, []);

	const updatePreferencesMutation = useMutation({
		mutationFn: async (newPreferences: Partial<UserPreferences>) => {
			try {
				const response = await apiRequest(
					"PATCH",
					"/api/user/preferences",
					newPreferences,
				);
				return response.json();
			} catch {
				return null;
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
		},
	});

	const setNavPosition = useCallback(
		(position: NavPosition) => {
			setLocalPreferences((prev) => {
				const newPrefs = { ...prev, navPosition: position };
				saveToStorage(newPrefs);
				return newPrefs;
			});
			updatePreferencesMutation.mutate({ navPosition: position });
		},
		[saveToStorage, updatePreferencesMutation],
	);

	const setDisplayPreference = useCallback(
		<K extends keyof DisplayPreferences>(
			key: K,
			value: DisplayPreferences[K],
		) => {
			setLocalPreferences((prev) => {
				const newDisplay = { ...prev.displayPreferences, [key]: value };
				const newPrefs = { ...prev, displayPreferences: newDisplay };
				saveToStorage(newPrefs);
				return newPrefs;
			});
		},
		[saveToStorage],
	);

	const resetAllPreferences = useCallback(() => {
		setLocalPreferences(DEFAULT_PREFERENCES);
		saveToStorage(DEFAULT_PREFERENCES);
		updatePreferencesMutation.mutate(DEFAULT_PREFERENCES);
	}, [saveToStorage, updatePreferencesMutation]);

	return (
		<UserPreferencesContext.Provider
			value={{
				navPosition: localPreferences.navPosition,
				setNavPosition,
				displayPreferences: localPreferences.displayPreferences,
				setDisplayPreference,
				resetAllPreferences,
				isLoading,
				isPending: updatePreferencesMutation.isPending,
			}}
		>
			{children}
		</UserPreferencesContext.Provider>
	);
}

export function useUserPreferences() {
	const context = useContext(UserPreferencesContext);
	if (context === undefined) {
		throw new Error(
			"useUserPreferences must be used within a UserPreferencesProvider",
		);
	}
	return context;
}
