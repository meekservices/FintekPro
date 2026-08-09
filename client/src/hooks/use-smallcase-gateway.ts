/**
 * @file use-smallcase-gateway.ts
 * @description React hook for integrating the Smallcase Gateway SDK.
 *
 * Purpose:
 *   - Polls window.scDK until the CDN script finishes loading (async script tag)
 *   - Initialises the SDK with a server-generated JWT auth token
 *   - Exposes triggerBasketOrder() and linkBroker() for use in components
 *
 * Usage:
 *   const { isReady, triggerBasketOrder } = useSmallcaseGateway();
 *
 * FASP-AI v1.0: The hook never auto-executes orders. All order triggers
 * require explicit user action via SmallcaseOrderButton.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  SmallcaseTransactionResponse,
  SmallcaseInitResponse,
} from "../types/smallcase-gateway";

// ── Config ─────────────────────────────────────────────────────────────────────

/** How often to poll for window.scDK after CDN script is injected (ms) */
const SCDK_POLL_INTERVAL_MS = 200;

/** Give up waiting for CDN after this many ms (network failure / CSP block) */
const SCDK_POLL_TIMEOUT_MS = 10_000;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SmallcaseGatewayState {
  /** true once window.scDK is loaded AND init() has resolved successfully */
  isReady: boolean;
  /** true while waiting for CDN script or init() to complete */
  isLoading: boolean;
  /** true if CDN load timed out or init() failed */
  isError: boolean;
  /** Human-readable error message */
  errorMessage: string | null;
  /** Broker name if user already has a linked account */
  linkedBroker: string | null;
}

export interface SmallcaseGatewayActions {
  /**
   * Executes a basket order transaction.
   * Requires a transactionId from /api/smallcase/transaction/create.
   * Opens the Smallcase broker UI overlay natively.
   *
   * @param transactionId - Server-generated SC transaction ID
   * @returns Resolved order result with smallcaseAuthId
   */
  triggerBasketOrder(transactionId: string): Promise<SmallcaseTransactionResponse>;

  /**
   * Triggers broker linking (LOGIN intent).
   * Returns the smallcaseAuthId to persist in the user profile.
   *
   * @param transactionId - Server-generated LOGIN transaction ID
   * @returns smallcaseAuthId string
   */
  linkBroker(transactionId: string): Promise<string>;

  /**
   * Re-initialises the SDK (e.g. after auth token refresh).
   * Call when the user's smallcaseAuthId changes.
   */
  reinitialise(): Promise<void>;
}

export type UseSmallcaseGatewayReturn = SmallcaseGatewayState & SmallcaseGatewayActions;

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * @hook useSmallcaseGateway
 *
 * Manages the full Smallcase Gateway SDK lifecycle:
 *   1. Polls window.scDK until CDN script loads
 *   2. Fetches a guest/connected auth token from /api/smallcase/auth/token
 *   3. Initialises the SDK
 *   4. Exposes typed order execution methods
 *
 * @param gatewayName - Your Smallcase gateway name (from env). Defaults to env var.
 */
export function useSmallcaseGateway(
  gatewayName?: string,
): UseSmallcaseGatewayReturn {
  const [state, setState] = useState<SmallcaseGatewayState>({
    isReady:      false,
    isLoading:    true,
    isError:      false,
    errorMessage: null,
    linkedBroker: null,
  });

  const initDoneRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(Date.now());

  // ── Step 1: Poll until window.scDK is defined ────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    pollStartRef.current = Date.now();

    pollTimerRef.current = setInterval(async () => {
      // Timeout guard
      if (Date.now() - pollStartRef.current > SCDK_POLL_TIMEOUT_MS) {
        clearInterval(pollTimerRef.current!);
        setState(s => ({
          ...s,
          isLoading:    false,
          isError:      true,
          errorMessage: "Smallcase SDK failed to load. Check your network connection.",
        }));
        return;
      }

      if (window.scDK !== undefined) {
        clearInterval(pollTimerRef.current!);
        if (!initDoneRef.current) {
          initDoneRef.current = true;
          await initialiseSdk();
        }
      }
    }, SCDK_POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 2: Fetch auth token + call scDK.init() ──────────────────────────────
  const initialiseSdk = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, isError: false, errorMessage: null }));

    try {
      // Fetch guest/connected auth token from our server
      const tokenRes = await fetch("/api/smallcase/auth/token", {
        method:  "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!tokenRes.ok) {
        throw new Error(`Auth token fetch failed: ${tokenRes.status}`);
      }

      const { authToken, environment } = (await tokenRes.json()) as {
        authToken:   string;
        environment: "production" | "development";
      };

      if (!window.scDK) throw new Error("window.scDK still undefined after poll");

      const initResp: SmallcaseInitResponse = await window.scDK.init({
        gatewayName:  gatewayName ?? "fintekpro",
        authToken,
        environment:  environment ?? "production",
        config:       { showLogo: true },
      });

      setState({
        isReady:      true,
        isLoading:    false,
        isError:      false,
        errorMessage: null,
        linkedBroker: initResp.brokerName ?? null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "SDK init failed";
      setState(s => ({
        ...s,
        isReady:      false,
        isLoading:    false,
        isError:      true,
        errorMessage: message,
      }));
    }
  }, [gatewayName]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const triggerBasketOrder = useCallback(
    async (transactionId: string): Promise<SmallcaseTransactionResponse> => {
      if (!window.scDK) throw new Error("Smallcase SDK not ready");

      const result = await window.scDK.triggerTransaction({ transactionId });

      // Persist smallcaseAuthId to user profile if returned
      if (result.smallcaseAuthId) {
        await fetch("/api/smallcase/auth/save", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ smallcaseAuthId: result.smallcaseAuthId }),
        }).catch(() => {
          // Non-fatal — auth save is best-effort
          console.warn("[SmallcaseGateway] Failed to persist smallcaseAuthId");
        });
      }

      return result;
    },
    [],
  );

  const linkBroker = useCallback(
    async (transactionId: string): Promise<string> => {
      const result = await triggerBasketOrder(transactionId);
      if (!result.smallcaseAuthId) {
        throw new Error("Broker linking did not return a smallcaseAuthId");
      }
      return result.smallcaseAuthId;
    },
    [triggerBasketOrder],
  );

  const reinitialise = useCallback(async () => {
    initDoneRef.current = false;
    await initialiseSdk();
  }, [initialiseSdk]);

  return { ...state, triggerBasketOrder, linkBroker, reinitialise };
}
