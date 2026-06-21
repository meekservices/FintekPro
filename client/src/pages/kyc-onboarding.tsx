/**
 * KYC Onboarding Page — Multi-broker KYC reuse flow
 *
 * Flow:
 *   1. Check vault status — if empty, show mock eKYC initiation
 *   2. User selects broker + segment
 *   3. Call POST /api/orchestrator/diff → show prefilled vs. delta fields
 *   4. User completes only the delta form
 *   5. Submit to POST /api/orchestrator/submit
 *   6. Poll GET /api/orchestrator/status/:brokerId/:brokerClientId
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldDiffItem {
  fieldName: string;
  label: string;
  inputType: string;
  options?: string[];
  required: boolean;
  deltaReason: "missing" | "stale" | "always_required";
  stalenessInfo?: string;
}

interface DiffResult {
  userId: string;
  brokerId: string;
  segment: string;
  prefilledFields: Record<string, unknown>;
  requiredDeltaFields: FieldDiffItem[];
  staleFields: FieldDiffItem[];
  notApplicableFields: string[];
  isReadyToSubmit: boolean;
  calculationTimestamp: string;
  engine_version: string;
}

const BROKERS = [
  {
    id: "iifl",
    label: "IIFL Securities",
    flag: "🇮🇳",
    segments: ["equity", "fo"],
    comingSoon: true,
    comingSoonNote: "API integration in progress — available soon",
  },
  {
    id: "jm_financial",
    label: "JM Financial",
    flag: "🇮🇳",
    segments: ["equity"],
    comingSoon: true,
    comingSoonNote: "Partner API onboarding in progress — available soon",
  },
  {
    id: "alpaca",
    label: "Alpaca (US Equities)",
    flag: "🇺🇸",
    segments: ["us_equities"],
    comingSoon: false,
    comingSoonNote: "",
  },
];


// ─── Delta Form Field ─────────────────────────────────────────────────────────

function DeltaFormField({
  field,
  value,
  onChange,
}: {
  field: FieldDiffItem;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const borderColor =
    field.deltaReason === "always_required"
      ? "border-red-400/50 focus:border-red-400"
      : field.deltaReason === "stale"
      ? "border-amber-400/50 focus:border-amber-400"
      : "border-blue-400/50 focus:border-blue-400";

  const badgeStyle =
    field.deltaReason === "always_required"
      ? "bg-red-500/20 text-red-300 border-red-500/30"
      : field.deltaReason === "stale"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-blue-500/20 text-blue-300 border-blue-500/30";

  const badgeText =
    field.deltaReason === "always_required"
      ? "Required (not from vault)"
      : field.deltaReason === "stale"
      ? `Stale — ${field.stalenessInfo ?? "needs refresh"}`
      : "Missing from vault";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-200">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badgeStyle}`}>
          {badgeText}
        </span>
      </div>

      {field.inputType === "select" && field.options ? (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-slate-800/60 border rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors ${borderColor}`}
        >
          <option value="">Select {field.label}</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt.replace(/_/g, " ")}</option>
          ))}
        </select>
      ) : field.inputType === "boolean" ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${value === true ? "bg-emerald-500 text-white" : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${value === false ? "bg-slate-500 text-white" : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"}`}
          >
            No
          </button>
        </div>
      ) : field.inputType === "document" ? (
        <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${borderColor.replace("border-", "border-dashed border-")}`}>
          <div className="text-2xl mb-1">📎</div>
          <p className="text-xs text-slate-400">Click to upload {field.label}</p>
          <p className="text-[10px] text-slate-500 mt-1">PDF, JPG, PNG — max 10MB</p>
        </div>
      ) : (
        <input
          type={field.inputType === "date" ? "date" : field.inputType === "number" ? "number" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label}`}
          className={`w-full bg-slate-800/60 border rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 ${borderColor}`}
        />
      )}
    </div>
  );
}

// ─── Prefilled Field Badge ────────────────────────────────────────────────────

function PrefilledBadge({ fieldName, value }: { fieldName: string; value: unknown }) {
  const label = fieldName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
      <span className="text-xs text-slate-300 font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400 max-w-[140px] truncate">
          {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}
        </span>
        <span className="text-emerald-400 text-xs">✓</span>
      </div>
    </div>
  );
}

// ─── Coming Soon Banner ───────────────────────────────────────────────────────

function ComingSoonBanner() {
  return (
    <div className="mt-5 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/8 to-orange-500/5 p-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-sm">🔧</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-300 mb-1">Integration in progress</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            IIFL Securities and JM Financial integrations are currently being set up.
            API credentials are being onboarded — these brokers will be available here
            as soon as the integration is live.
          </p>
          <p className="text-[11px] text-slate-500 mt-2">
            In the meantime, you can open a US equities account via <span className="text-slate-300 font-medium">Alpaca</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function KycOnboardingPage() {
  const [step, setStep] = useState<"broker_select" | "diff" | "submit" | "status">("broker_select");
  const [selectedBroker, setSelectedBroker] = useState<string>("");
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [deltaValues, setDeltaValues] = useState<Record<string, unknown>>({});
  const [submissionResult, setSubmissionResult] = useState<{
    brokerClientId?: string;
    status: string;
    cached: boolean;
  } | null>(null);

  // Hard-coded to logged-in user — in production this comes from auth context
  const userId = "current_user_id"; // TODO: replace with useAuth().user?.id

  // ── Diff mutation ────────────────────────────────────────────────────────

  const diffMutation = useMutation<{ data: DiffResult }, Error, { brokerId: string; segment: string }>({
    mutationFn: async ({ brokerId, segment }) => {
      const res = await fetch("/api/orchestrator/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, brokerId, segment }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setDiffResult(data.data);
      setStep("diff");
    },
  });

  // ── Submit mutation ──────────────────────────────────────────────────────

  const submitMutation = useMutation<{ data: typeof submissionResult }, Error>({
    mutationFn: async () => {
      const res = await fetch("/api/orchestrator/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          brokerId: selectedBroker,
          segment: selectedSegment,
          brokerDelta: deltaValues,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setSubmissionResult(data.data);
      setStep("status");
    },
  });

  // ── Broker selection ─────────────────────────────────────────────────────

  if (step === "broker_select") {
    const selectedBrokerObj = BROKERS.find((b) => b.id === selectedBroker);
    const isContinueBlocked = !selectedBroker || diffMutation.isPending || !!selectedBrokerObj?.comingSoon;
    const hasComingSoonBrokers = BROKERS.some((b) => b.comingSoon);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-4">
              <span className="text-blue-400 text-xs font-semibold tracking-wider uppercase">KYC Vault</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Open a Broker Account
            </h1>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Your verified KYC data auto-fills the form. You only provide what's new or broker-specific.
            </p>
          </div>

          {/* Broker cards */}
          <div className="space-y-3 mb-6">
            {BROKERS.map((broker) => {
              const isSelected = selectedBroker === broker.id;
              const isComingSoon = broker.comingSoon;

              return (
                <div
                  key={broker.id}
                  className={`border rounded-2xl p-5 transition-all duration-200 ${
                    isComingSoon
                      ? "border-slate-700/30 bg-slate-800/20 cursor-not-allowed opacity-60"
                      : isSelected
                      ? "border-blue-500/60 bg-blue-500/10 shadow-lg shadow-blue-500/10 cursor-pointer"
                      : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600 cursor-pointer"
                  }`}
                  onClick={() => {
                    if (isComingSoon) return;
                    setSelectedBroker(broker.id);
                    setSelectedSegment(broker.segments[0]);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl ${isComingSoon ? "grayscale" : ""}`}>{broker.flag}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold ${isComingSoon ? "text-slate-500" : "text-white"}`}>
                            {broker.label}
                          </p>
                          {isComingSoon && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {isComingSoon ? broker.comingSoonNote : `Segments: ${broker.segments.join(", ")}`}
                        </p>
                      </div>
                    </div>

                    {isComingSoon ? (
                      <div className="w-6 h-6 rounded-lg bg-slate-700/60 border border-slate-600/40 flex items-center justify-center">
                        <span className="text-slate-500 text-xs">🔒</span>
                      </div>
                    ) : isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Segment selector — only for active, selected brokers */}
                  {!isComingSoon && isSelected && broker.segments.length > 1 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {broker.segments.map((seg) => (
                        <button
                          key={seg}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedSegment(seg); }}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            selectedSegment === seg
                              ? "bg-blue-500 text-white"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {seg.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Coming Soon banner — shown when a coming-soon broker is selected or exists */}
          {(selectedBrokerObj?.comingSoon || hasComingSoonBrokers) && (
            <ComingSoonBanner />
          )}

          <button
            disabled={isContinueBlocked}
            onClick={() => diffMutation.mutate({ brokerId: selectedBroker, segment: selectedSegment })}
            className="w-full py-3.5 mt-5 rounded-2xl font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/20"
          >
            {diffMutation.isPending
              ? "Checking your vault..."
              : selectedBrokerObj?.comingSoon
              ? "Integration Coming Soon"
              : "Continue →"}
          </button>

          {diffMutation.isError && (
            <p className="text-red-400 text-xs text-center mt-3">{diffMutation.error.message}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Diff result (prefilled + delta form) ────────────────────────────────

  if (step === "diff" && diffResult) {
    const prefilledCount = Object.keys(diffResult.prefilledFields).length;
    const deltaCount = diffResult.requiredDeltaFields.length;
    const staleCount = diffResult.staleFields.length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 py-8">
        <div className="w-full max-w-2xl mx-auto space-y-6">
          {/* Progress banner */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">Your KYC Summary</h2>
              <button
                onClick={() => setStep("broker_select")}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ← Change broker
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{prefilledCount}</p>
                <p className="text-[11px] text-slate-400">Auto-filled</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{deltaCount}</p>
                <p className="text-[11px] text-slate-400">Still needed</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{staleCount}</p>
                <p className="text-[11px] text-slate-400">Stale / refresh</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-3 text-right">
              Diff engine v{diffResult.engine_version} · {new Date(diffResult.calculationTimestamp).toLocaleTimeString()}
            </p>
          </div>

          {/* Prefilled fields */}
          {prefilledCount > 0 && (
            <div className="rounded-2xl border border-emerald-500/20 bg-slate-800/30 p-5">
              <h3 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
                <span>✓</span> Auto-filled from your verified profile
              </h3>
              <div className="space-y-1.5">
                {Object.entries(diffResult.prefilledFields).map(([k, v]) => (
                  <PrefilledBadge key={k} fieldName={k} value={v} />
                ))}
              </div>
            </div>
          )}

          {/* Stale fields notice */}
          {staleCount > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs text-amber-300 font-semibold mb-1">⚠ Stale fields detected</p>
              <p className="text-[11px] text-slate-400">
                {staleCount} field(s) in your vault are older than {diffResult.brokerId === "iifl" ? "90 days" : "the broker's freshness window"}.
                These are still pre-filled but you may want to refresh them.
              </p>
            </div>
          )}

          {/* Delta form */}
          {deltaCount > 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">{deltaCount}</span>
                Additional details required
              </h3>
              <div className="space-y-4">
                {diffResult.requiredDeltaFields.map((field) => (
                  <DeltaFormField
                    key={field.fieldName}
                    field={field}
                    value={deltaValues[field.fieldName]}
                    onChange={(val) =>
                      setDeltaValues((prev) => ({ ...prev, [field.fieldName]: val }))
                    }
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
              <p className="text-emerald-300 font-semibold">🎉 Your profile is complete!</p>
              <p className="text-slate-400 text-xs mt-1">
                All required fields are already in your vault.
              </p>
            </div>
          )}

          {/* Compliance notice */}
          <div className="text-[10px] text-slate-500 text-center px-4">
            By continuing, you consent to sharing the above fields with{" "}
            <span className="text-slate-400 font-medium">{BROKERS.find(b => b.id === diffResult.brokerId)?.label}</span>
            {" "}for KYC/account-opening purposes under SEBI/DPDPA 2023 regulations.
            This consent will be recorded in our audit ledger.
          </div>

          <button
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            className="w-full py-3.5 rounded-2xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-emerald-500/20"
          >
            {submitMutation.isPending
              ? "Submitting to broker..."
              : diffResult.isReadyToSubmit
              ? "Submit KYC →"
              : "Submit with details →"}
          </button>

          {submitMutation.isError && (
            <p className="text-red-400 text-xs text-center">{submitMutation.error.message}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Submission status ────────────────────────────────────────────────────

  if (step === "status" && submissionResult) {
    const statusColor =
      submissionResult.status === "approved" || submissionResult.status === "APPROVED"
        ? "text-emerald-400"
        : submissionResult.status === "rejected"
        ? "text-red-400"
        : "text-amber-400";

    const statusIcon =
      submissionResult.status === "approved" || submissionResult.status === "APPROVED"
        ? "✅"
        : submissionResult.status === "rejected"
        ? "❌"
        : "⏳";

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="text-6xl mb-6">{statusIcon}</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {submissionResult.status === "approved" ? "Account Opening Initiated!" : "Submission Received"}
          </h2>
          <p className={`text-lg font-semibold ${statusColor} mb-1`}>
            Status: {submissionResult.status.toUpperCase()}
          </p>
          {submissionResult.brokerClientId && (
            <p className="text-slate-400 text-sm mb-6">
              Reference ID: <span className="text-slate-300 font-mono">{submissionResult.brokerClientId}</span>
            </p>
          )}
          {submissionResult.cached && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-6">
              <p className="text-blue-300 text-xs">
                ℹ️ This submission was already processed. The result above is from our records.
              </p>
            </div>
          )}
          <button
            onClick={() => {
              setStep("broker_select");
              setSelectedBroker("");
              setDiffResult(null);
              setDeltaValues({});
              setSubmissionResult(null);
            }}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
          >
            Open Another Account
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default KycOnboardingPage;
