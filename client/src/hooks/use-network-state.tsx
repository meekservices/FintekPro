import {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
	ReactNode,
	useRef,
} from "react";

export type NetworkStatus = "online" | "offline" | "slow" | "server-error" | "initializing";

interface NetworkState {
	status: NetworkStatus;
	isOnline: boolean;
	isOffline: boolean;
	isSlow: boolean;
	isServerError: boolean;
	effectiveType: string | null;
	downlink: number | null;
	rtt: number | null;
	lastChecked: Date;
	retryCount: number;
}

interface NetworkContextValue extends NetworkState {
	checkConnection: () => Promise<NetworkStatus>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

interface NetworkProviderProps {
	children: ReactNode;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1500;
// Require 2 consecutive slow health-checks before flagging as slow.
// This prevents a single cold-start or transient spike from triggering
// the banner when the user is operating at 200 Mbps+.
const SLOW_CONFIRM_COUNT = 2;
const HEALTH_TIMEOUT_MS = 9000; // raised from 5000 – allows Cloud Run cold-start
const SLOW_THRESHOLD_MS = 4500; // raised from 2000 – genuine slow only

export function NetworkProvider({ children }: NetworkProviderProps) {
	const [state, setState] = useState<NetworkState>(() => ({
		// Start as 'initializing' — never trust navigator.onLine alone.
		// navigator.onLine is unreliable in Chrome (extensions, service workers,
		// and certain network environments cause false negatives on load).
		// The real status is determined after the first /api/health check.
		status: "initializing" as NetworkStatus,
		isOnline: true, // optimistic until proven otherwise
		isOffline: false,
		isSlow: false,
		isServerError: false,
		effectiveType: null,
		downlink: null,
		rtt: null,
		lastChecked: new Date(),
		retryCount: 0,
	}));
	// Consecutive slow-check counter – prevents single spike from showing banner
	const consecutiveSlowRef = useRef<number>(0);

	const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const getNetworkInfo = useCallback(() => {
		const connection =
			(navigator as any).connection ||
			(navigator as any).mozConnection ||
			(navigator as any).webkitConnection;

		if (connection) {
			return {
				effectiveType: connection.effectiveType || null,
				downlink: connection.downlink || null,
				rtt: connection.rtt || null,
			};
		}
		return { effectiveType: null, downlink: null, rtt: null };
	}, []);

	const determineStatus = useCallback(
		(
			isOnline: boolean,
			networkInfo: {
				effectiveType: string | null;
				downlink: number | null;
				rtt: number | null;
			},
		): NetworkStatus => {
			if (!isOnline) return "offline";

			if (networkInfo.effectiveType) {
				if (
					networkInfo.effectiveType === "slow-2g" ||
					networkInfo.effectiveType === "2g"
				) {
					return "slow";
				}
				if (
					networkInfo.effectiveType === "3g" &&
					networkInfo.rtt &&
					networkInfo.rtt > 400
				) {
					return "slow";
				}
			}

			if (networkInfo.downlink !== null && networkInfo.downlink < 0.5) {
				return "slow";
			}

			if (networkInfo.rtt !== null && networkInfo.rtt > 500) {
				return "slow";
			}

			return "online";
		},
		[],
	);

	const checkConnectionWithRetry = useCallback(
		async (retryCount: number = 0): Promise<NetworkStatus> => {
			const isOnline = navigator.onLine;
			const networkInfo = getNetworkInfo();

			if (!isOnline) {
				const newStatus = "offline";
				setState((prev) => ({
					...prev,
					status: newStatus,
					isOnline: false,
					isOffline: true,
					isSlow: false,
					isServerError: false,
					...networkInfo,
					lastChecked: new Date(),
					retryCount: 0,
				}));
				return newStatus;
			}

			try {
				const startTime = performance.now();
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

				const response = await fetch("/api/health", {
					method: "HEAD",
					signal: controller.signal,
					cache: "no-store",
				});

				clearTimeout(timeoutId);
				const responseTime = performance.now() - startTime;

				if (response.status >= 500 && response.status < 600) {
					if (retryCount < MAX_RETRIES) {
						setState((prev) => ({
							...prev,
							status: "server-error",
							isOnline: true,
							isOffline: false,
							isSlow: false,
							isServerError: true,
							...networkInfo,
							lastChecked: new Date(),
							retryCount: retryCount + 1,
						}));

						retryTimeoutRef.current = setTimeout(() => {
							checkConnectionWithRetry(retryCount + 1);
						}, RETRY_DELAY);

						return "server-error";
					}
					setState((prev) => ({
						...prev,
						status: "server-error",
						isOnline: true,
						isOffline: false,
						isSlow: false,
						isServerError: true,
						...networkInfo,
						lastChecked: new Date(),
						retryCount: retryCount,
					}));
					return "server-error";
				}

				let status: NetworkStatus = determineStatus(true, networkInfo);
				if (responseTime > SLOW_THRESHOLD_MS) {
					// Only mark slow after SLOW_CONFIRM_COUNT consecutive slow checks
					consecutiveSlowRef.current += 1;
					if (consecutiveSlowRef.current >= SLOW_CONFIRM_COUNT) {
						status = "slow";
					} else {
						// First slow check – stay online, wait for next poll
						status = "online";
					}
				} else {
					// Fast response – reset consecutive counter
					consecutiveSlowRef.current = 0;
				}

				setState((prev) => ({
					...prev,
					status,
					isOnline: true,
					isOffline: false,
					isSlow: status === "slow",
					isServerError: false,
					...networkInfo,
					lastChecked: new Date(),
					retryCount: 0,
				}));

				return status;
			} catch (error: any) {
				// AbortError = request timed out → treat as slow, retry once
				if (error?.name === "AbortError") {
					if (retryCount < 1) {
						setState((prev) => ({
							...prev,
							status: "slow",
							isOnline: true,
							isOffline: false,
							isSlow: true,
							isServerError: false,
							...networkInfo,
							lastChecked: new Date(),
							retryCount: retryCount + 1,
						}));
						retryTimeoutRef.current = setTimeout(() => {
							checkConnectionWithRetry(retryCount + 1);
						}, RETRY_DELAY);
						return "slow";
					}
					setState((prev) => ({
						...prev,
						status: "slow",
						isOnline: true,
						isOffline: false,
						isSlow: true,
						isServerError: false,
						...networkInfo,
						lastChecked: new Date(),
						retryCount,
					}));
					return "slow";
				}

				// TypeError with 'Failed to fetch' or 'ERR_NAME_NOT_RESOLVED' = DNS/network error.
				// Do NOT retry — the domain is genuinely unreachable; retrying only floods the console.
				if (
					!navigator.onLine ||
					error?.message?.includes("Failed to fetch") ||
					error?.name === "TypeError"
				) {
					const newStatus = navigator.onLine ? "server-error" : "offline";
					setState((prev) => ({
						...prev,
						status: newStatus,
						isOnline: navigator.onLine,
						isOffline: !navigator.onLine,
						isSlow: false,
						isServerError: navigator.onLine,
						...networkInfo,
						lastChecked: new Date(),
						retryCount: 0,
					}));
					return newStatus;
				}

				// Unknown error — mark server-error, no retry
				setState((prev) => ({
					...prev,
					status: "server-error",
					isOnline: true,
					isOffline: false,
					isSlow: false,
					isServerError: true,
					...networkInfo,
					lastChecked: new Date(),
					retryCount,
				}));
				return "server-error";
			}
		},
		[getNetworkInfo, determineStatus],
	);

	const checkConnection = useCallback(async (): Promise<NetworkStatus> => {
		if (retryTimeoutRef.current) {
			clearTimeout(retryTimeoutRef.current);
			retryTimeoutRef.current = null;
		}
		return checkConnectionWithRetry(0);
	}, [checkConnectionWithRetry]);

	useEffect(() => {
		const handleOnline = () => {
			checkConnection();
		};

		const handleOffline = () => {
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current);
				retryTimeoutRef.current = null;
			}
			setState((prev) => ({
				...prev,
				status: "offline",
				isOnline: false,
				isOffline: true,
				isSlow: false,
				isServerError: false,
				lastChecked: new Date(),
				retryCount: 0,
			}));
		};

		const handleConnectionChange = () => {
			checkConnection();
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		const connection =
			(navigator as any).connection ||
			(navigator as any).mozConnection ||
			(navigator as any).webkitConnection;

		if (connection) {
			connection.addEventListener("change", handleConnectionChange);
		}

		checkConnection();

		const intervalId = setInterval(checkConnection, 30000);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
			if (connection) {
				connection.removeEventListener("change", handleConnectionChange);
			}
			clearInterval(intervalId);
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current);
			}
		};
	}, [checkConnection]);

	return (
		<NetworkContext.Provider value={{ ...state, checkConnection }}>
			{children}
		</NetworkContext.Provider>
	);
}

export function useNetworkState() {
	const context = useContext(NetworkContext);
	if (!context) {
		throw new Error("useNetworkState must be used within a NetworkProvider");
	}
	return context;
}

export function useIsOnline(): boolean {
	const { isOnline } = useNetworkState();
	return isOnline;
}

export function useIsOffline(): boolean {
	const { isOffline } = useNetworkState();
	return isOffline;
}

export function useNetworkStatus(): NetworkStatus {
	const { status } = useNetworkState();
	return status;
}

export function useIsServerError(): boolean {
	const { isServerError } = useNetworkState();
	return isServerError;
}
