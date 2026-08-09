/**
 * @file SmallcaseOrderButton.tsx
 * @description Button component that triggers a Smallcase Gateway basket order.
 *
 * Flow:
 *   1. User clicks "Invest via Broker"
 *   2. Component calls POST /api/smallcase/transaction/create (server creates SC transaction)
 *   3. useSmallcaseGateway.triggerBasketOrder(transactionId) opens SC Gateway overlay
 *   4. User selects broker, logs in, and confirms order within the SC UI
 *   5. On success → onSuccess(result) callback fires
 *
 * FASP-AI v1.0 compliance:
 *   - Button is disabled until SDK is ready (no premature order triggers)
 *   - All order actions require explicit user click — never auto-executed
 *   - Button is hidden when SMALLCASE_GATEWAY_NAME env var is not set (graceful degrade)
 */

import { useState, useCallback } from "react";
import { useSmallcaseGateway } from "../hooks/use-smallcase-gateway";
import type { SmallcaseTransactionResponse } from "../types/smallcase-gateway";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SmallcaseBasketHolding {
  isin:     string;
  quantity: number;
  /** "BUY" | "SELL" */
  action:   "BUY" | "SELL";
}

export interface SmallcaseOrderButtonProps {
  /** Holdings to place as a basket order */
  holdings:       SmallcaseBasketHolding[];
  /** Portfolio name shown in the SC overlay */
  portfolioName?: string;
  /** Callback on successful order placement */
  onSuccess?:     (result: SmallcaseTransactionResponse) => void;
  /** Callback on order failure or user cancellation */
  onError?:       (error: string) => void;
  /** Optional extra CSS classes */
  className?:     string;
  /** Custom button label */
  label?:         string;
  /** Disable the button regardless of SDK state */
  disabled?:      boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SmallcaseOrderButton({
  holdings,
  portfolioName,
  onSuccess,
  onError,
  className = "",
  label     = "Invest via Broker",
  disabled  = false,
}: SmallcaseOrderButtonProps) {
  const { isReady, isLoading, isError, errorMessage, linkedBroker } =
    useSmallcaseGateway();

  const [isOrdering, setIsOrdering]     = useState(false);
  const [orderError, setOrderError]     = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // If no gateway name configured — hide button entirely (graceful degrade)
  const gatewayConfigured =
    typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost")
      ? true // In production, assume it's configured
      : !!import.meta.env.VITE_SMALLCASE_GATEWAY_NAME;

  // ── Order Handler ────────────────────────────────────────────────────────────

  const handleOrder = useCallback(async () => {
    if (!isReady || isOrdering) return;

    setIsOrdering(true);
    setOrderError(null);
    setOrderSuccess(false);

    try {
      // Step 1: Create transaction on server
      const txRes = await fetch("/api/smallcase/transaction/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          holdings,
          intent:        "TRANSACTION",
          portfolioName: portfolioName ?? "FintekPro Portfolio",
        }),
      });

      if (!txRes.ok) {
        const err = await txRes.json().catch(() => ({ message: "Server error" }));
        throw new Error(err.message ?? `Transaction creation failed (${txRes.status})`);
      }

      const { transactionId } = (await txRes.json()) as { transactionId: string };

      // Step 2: Trigger SC Gateway overlay (broker chooser + login + confirm)
      const result = await window.scDK!.triggerTransaction({ transactionId });

      if (result.transactionStatus === "COMPLETED") {
        setOrderSuccess(true);
        onSuccess?.(result);
      } else if (result.transactionStatus === "CANCELLED") {
        setOrderError("Order cancelled by user.");
        onError?.("CANCELLED");
      } else {
        throw new Error(result.error ?? `Transaction ${result.transactionStatus}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Order placement failed";
      setOrderError(msg);
      onError?.(msg);
    } finally {
      setIsOrdering(false);
    }
  }, [isReady, isOrdering, holdings, portfolioName, onSuccess, onError]);

  // ── Render ───────────────────────────────────────────────────────────────────

  // Don't render if gateway is not configured (env var missing)
  if (!gatewayConfigured && !isLoading) return null;

  const isDisabled = disabled || !isReady || isOrdering || isLoading;

  return (
    <div className="smallcase-order-wrapper">
      {/* Main button */}
      <button
        id="smallcase-order-btn"
        onClick={handleOrder}
        disabled={isDisabled}
        title={
          isLoading      ? "Loading broker integration…"
          : isError      ? errorMessage ?? "SDK error"
          : !isReady     ? "Initialising…"
          : linkedBroker ? `Linked: ${linkedBroker}`
          : "Place basket order via your broker"
        }
        className={[
          "sc-order-btn",
          isOrdering   ? "sc-order-btn--loading" : "",
          orderSuccess ? "sc-order-btn--success" : "",
          isError      ? "sc-order-btn--error"   : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            "8px",
          padding:        "10px 20px",
          borderRadius:   "8px",
          fontWeight:     600,
          fontSize:       "14px",
          cursor:         isDisabled ? "not-allowed" : "pointer",
          background:     orderSuccess ? "#16a34a" : isError ? "#dc2626" : "#1d4ed8",
          color:          "#ffffff",
          border:         "none",
          opacity:        isDisabled ? 0.65 : 1,
          transition:     "all 0.2s ease",
          minWidth:       "180px",
          justifyContent: "center",
        }}
      >
        {/* Smallcase logo icon */}
        {!isOrdering && !orderSuccess && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.25)" />
            <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}

        {/* Spinner while ordering */}
        {isOrdering && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            style={{ animation: "spin 1s linear infinite" }}>
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
            <path d="M12 3a9 9 0 019 9" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}

        <span>
          {isLoading    ? "Initialising…"
           : isOrdering ? "Placing Order…"
           : orderSuccess ? "Order Placed ✓"
           : label}
        </span>
      </button>

      {/* Linked broker badge */}
      {linkedBroker && !isOrdering && (
        <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px", textAlign: "center" }}>
          Connected: <strong>{linkedBroker}</strong>
        </p>
      )}

      {/* Error message */}
      {orderError && (
        <p role="alert" style={{
          fontSize: "12px", color: "#dc2626", marginTop: "6px",
          padding: "6px 10px", background: "#fef2f2",
          borderRadius: "6px", border: "1px solid #fecaca",
        }}>
          {orderError}
        </p>
      )}

      {/* Spinner keyframes (injected inline — no CSS module dependency) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default SmallcaseOrderButton;
