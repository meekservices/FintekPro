import { useState, useEffect, useCallback } from "react";
import { APP_VERSION, VERSION_CHECK_INTERVAL } from "@shared/version";

interface VersionInfo {
	version: string;
	buildTimestamp: string;
	serverTime: string;
}

interface VersionCheckResult {
	isOutdated: boolean;
	currentVersion: string;
	serverVersion: string | null;
	lastChecked: Date | null;
	isChecking: boolean;
	error: string | null;
	checkNow: () => Promise<void>;
	dismissUpdate: () => void;
	forceUpdate: () => void;
}

export function useVersionCheck(): VersionCheckResult {
	const [serverVersion, setServerVersion] = useState<string | null>(null);
	const [lastChecked, setLastChecked] = useState<Date | null>(null);
	const [isChecking, setIsChecking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isDismissed, setIsDismissed] = useState(false);

	const checkVersion = useCallback(async () => {
		setIsChecking(true);
		setError(null);

		// Retry up to 3 times with exponential backoff (2s, 4s).
		// Prevents spurious "Update Available" toasts during the ~20s Cloud Run
		// cold-start / rolling-deploy window when the server transiently returns 503.
		const MAX_RETRIES = 3;
		let lastErr: Error | null = null;

		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				const response = await fetch("/api/version", {
					cache: "no-store",
					headers: {
						"Cache-Control": "no-cache",
						Pragma: "no-cache",
					},
				});

				if (response.status === 503 && attempt < MAX_RETRIES) {
					// Server cold-starting — wait and retry silently
					await new Promise((r) => setTimeout(r, 2000 * attempt));
					continue;
				}

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				const data = await response.json();

				if (data.success && data.data?.version) {
					setServerVersion(data.data.version);
					setLastChecked(new Date());
				}

				lastErr = null;
				break; // success
			} catch (err) {
				lastErr = err instanceof Error ? err : new Error("Version check failed");
				if (attempt < MAX_RETRIES) {
					await new Promise((r) => setTimeout(r, 2000 * attempt));
				}
			}
		}

		if (lastErr) {
			// All retries exhausted — set error but do NOT mark as outdated
			setError(lastErr.message);
		}

		setIsChecking(false);
	}, []);


	const forceUpdate = useCallback(async () => {
		console.log("[VersionCheck] Force update triggered");

		if ("serviceWorker" in navigator) {
			try {
				const registration = await navigator.serviceWorker.getRegistration();
				if (registration) {
					// If a new SW is waiting, activate it
					const worker = registration.waiting || registration.installing;
					if (worker) {
						worker.postMessage({ type: "SKIP_WAITING" });
						// Small delay to let the SW activate before reload
						await new Promise((r) => setTimeout(r, 300));
					}
					// Tell the active SW to clear all caches so stale bundles are purged
					if (registration.active) {
						registration.active.postMessage({ type: "CLEAR_CACHE" });
					}
					// Small delay to let cache clearing finish
					await new Promise((r) => setTimeout(r, 200));
				}
			} catch (err) {
				console.error("[VersionCheck] Service worker communication failed:", err);
			}
		}

		// Unregister old SW so the next load starts fresh
		if ("serviceWorker" in navigator) {
			try {
				const registrations = await navigator.serviceWorker.getRegistrations();
				for (const reg of registrations) {
					await reg.unregister();
				}
			} catch {
				// non-fatal
			}
		}

		// Hard reload — clears HTTP cache
		sessionStorage.removeItem("versionDismissed");
		window.location.reload();
	}, []);

	const dismissUpdate = useCallback(() => {
		if (serverVersion) {
			setIsDismissed(true);
			sessionStorage.setItem("versionDismissed", serverVersion);
		}
	}, [serverVersion]);

	useEffect(() => {
		if (serverVersion) {
			const dismissed = sessionStorage.getItem("versionDismissed");
			if (dismissed === serverVersion) {
				setIsDismissed(true);
			} else if (dismissed && dismissed !== serverVersion) {
				setIsDismissed(false);
				sessionStorage.removeItem("versionDismissed");
			}
		}
	}, [serverVersion]);

	useEffect(() => {
		checkVersion();

		const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);

		return () => clearInterval(interval);
	}, [checkVersion]);

	// Only trigger if server version is newer than client version
	const s = (serverVersion || "").split(".").map(Number);
	const c = APP_VERSION.split(".").map(Number);

	let isNewer = false;
	for (let i = 0; i < Math.max(s.length, c.length); i++) {
		const sVal = s[i] || 0;
		const cVal = c[i] || 0;
		if (sVal > cVal) {
			isNewer = true;
			break;
		}
		if (sVal < cVal) {
			break;
		}
	}

	const isOutdated = !isDismissed && serverVersion !== null && isNewer;

	return {
		isOutdated,
		currentVersion: APP_VERSION,
		serverVersion,
		lastChecked,
		isChecking,
		error,
		checkNow: checkVersion,
		dismissUpdate,
		forceUpdate,
	};
}
