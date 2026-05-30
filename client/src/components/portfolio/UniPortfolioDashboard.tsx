import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrokerBreakdown {
  brokerId: string;
  count: number;
  valueInr: number;
  configured: boolean;
}

interface DriftAsset {
  asset: string;
  current: number;
  target: number;
  delta: number;
}

interface RebalanceTrade {
  assetName: string;
  action: "buy" | "sell" | "hold";
  tradeValue: number;
  allocationDiff: number;
  priority: number;
  rationale: string;
  taxImpact: { taxEfficiency: "high" | "medium" | "low"; estimatedTax: number };
}

interface UniPortfolioData {
  portfolioId: string;
  userId: string;
  generatedAt: string;
  summary: {
    totalValueInr: number;
    totalCostInr: number;
    unrealizedPnlInr: number;
    unrealizedPnlPct: number;
    totalValueUsd: number;
    fxRateUsdInr: number;
    assetClassWeights: Record<string, number>;
    countryWeights: { IN: number; US: number; OTHER: number };
    brokerBreakdown: BrokerBreakdown[];
  };
  analysis: {
    drift: {
      has_drifted: boolean;
      largest_drift: number;
      drifting_assets: DriftAsset[];
    };
    rebalancing: {
      needsRebalance: boolean;
      urgency: "immediate" | "recommended" | "optional" | "none";
      trades: RebalanceTrade[];
      summary: { numberOfTrades: number; estimatedTotalTax: number };
      recommendations: string[];
    };
    concentration: { symbol: string; name: string; brokerId: string; valueInr: number; pct: number }[];
    staleBrokers: string[];
    riskProfile: { riskScore: number; investmentHorizon: number; segment: string };
  };
  meta: {
    engine_version: string;
    calculation_timestamp: string;
    brokers_polled: string[];
    disclaimer: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BROKER_COLORS: Record<string, string> = {
  IRIS: "#6366f1",
  ALPACA: "#10b981",
  IIFL: "#f59e0b",
};

const ALLOC_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"
];

function fmt(n: number, decimals = 0) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n.toFixed(decimals)}`;
}

function urgencyColor(u: string) {
  if (u === "immediate") return "#ef4444";
  if (u === "recommended") return "#f59e0b";
  if (u === "optional") return "#6366f1";
  return "#10b981";
}

function driftColor(delta: number) {
  const abs = Math.abs(delta);
  if (abs >= 10) return "#ef4444";
  if (abs >= 5) return "#f59e0b";
  return "#10b981";
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface UniPortfolioDashboardProps {
  riskScore?: number;
  horizon?: number;
  segment?: string;
}

export function UniPortfolioDashboard({
  riskScore = 50,
  horizon = 5,
  segment = "retail",
}: UniPortfolioDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "drift" | "rebalance" | "holdings">("overview");

  const { data: response, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/portfolio/unified", riskScore, horizon, segment],
    queryFn: async () => {
      const res = await fetch(
        `/api/portfolio/unified?riskScore=${riskScore}&horizon=${horizon}&segment=${segment}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load portfolio");
      return res.json() as Promise<{ success: boolean; data: UniPortfolioData }>;
    },
    staleTime: 4 * 60 * 1000, // 4 min — slightly less than server's 5 min cache
    retry: 2,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/portfolio/unified/refresh?riskScore=${riskScore}&horizon=${horizon}&segment=${segment}`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error("Refresh failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/unified"] });
      refetch();
    },
  });

  const portfolio = response?.data;

  if (isLoading) return <LoadingState />;
  if (error || !portfolio) return <ErrorState onRetry={refetch} />;

  const hasDrift = portfolio.analysis.drift.has_drifted;
  const urgency = portfolio.analysis.rebalancing.urgency;

  return (
    <div style={styles.container}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <div style={styles.portfolioId}>
            🔗 Portfolio ID: <code style={styles.code}>{portfolio.portfolioId}</code>
          </div>
          <div style={styles.netWorth}>{fmt(portfolio.summary.totalValueInr)}</div>
          <div style={{
            fontSize: 14,
            color: portfolio.summary.unrealizedPnlInr >= 0 ? "#10b981" : "#ef4444",
            marginTop: 4,
          }}>
            {portfolio.summary.unrealizedPnlInr >= 0 ? "▲" : "▼"}
            {fmt(Math.abs(portfolio.summary.unrealizedPnlInr))}
            {" "}({portfolio.summary.unrealizedPnlPct >= 0 ? "+" : ""}
            {portfolio.summary.unrealizedPnlPct.toFixed(2)}%)
          </div>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          style={styles.refreshBtn}
        >
          {refreshMutation.isPending ? "⟳ Refreshing…" : "⟳ Refresh"}
        </button>
      </div>

      {/* ── Drift / Rebalance Alert Banner ── */}
      {hasDrift && (
        <div style={{ ...styles.alertBanner, borderColor: urgencyColor(urgency) }}>
          <span style={{ color: urgencyColor(urgency), fontWeight: 700 }}>
            {urgency === "immediate" ? "🚨" : urgency === "recommended" ? "⚠️" : "💡"}
            {" "}Portfolio Drift Detected
          </span>
          <span style={{ marginLeft: 12, color: "#94a3b8", fontSize: 13 }}>
            Max drift: {portfolio.analysis.drift.largest_drift.toFixed(1)}% · {portfolio.analysis.rebalancing.summary.numberOfTrades} trades recommended
          </span>
          <button
            onClick={() => setActiveTab("rebalance")}
            style={styles.viewRebalanceBtn}
          >
            View Rebalancing Plan →
          </button>
        </div>
      )}

      {/* ── Broker Badges ── */}
      <div style={styles.brokerRow}>
        {portfolio.summary.brokerBreakdown.map(b => (
          <div key={b.brokerId} style={styles.brokerBadge}>
            <div style={{ ...styles.brokerDot, background: BROKER_COLORS[b.brokerId] ?? "#94a3b8" }} />
            <div>
              <div style={styles.brokerName}>{b.brokerId}</div>
              <div style={styles.brokerMeta}>{b.count} holdings · {fmt(b.valueInr)}</div>
            </div>
          </div>
        ))}
        {portfolio.analysis.staleBrokers.length > 0 && (
          <div style={styles.staleBadge}>
            ⚠ Partial data: {portfolio.analysis.staleBrokers.join(", ")}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={styles.tabBar}>
        {(["overview", "drift", "rebalance", "holdings"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
          >
            {tab === "overview" && "🌐 Overview"}
            {tab === "drift" && `📊 Drift${hasDrift ? " 🔴" : ""}`}
            {tab === "rebalance" && "⚖️ Rebalance"}
            {tab === "holdings" && "📋 Holdings"}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div style={styles.content}>
        {activeTab === "overview" && <OverviewTab portfolio={portfolio} />}
        {activeTab === "drift" && <DriftTab portfolio={portfolio} />}
        {activeTab === "rebalance" && <RebalanceTab portfolio={portfolio} />}
        {activeTab === "holdings" && <HoldingsTab portfolio={portfolio} />}
      </div>

      {/* ── Footer Disclaimer ── */}
      <div style={styles.disclaimer}>{portfolio.meta.disclaimer}</div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ portfolio }: { portfolio: UniPortfolioData }) {
  const weights = portfolio.summary.assetClassWeights;
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const country = portfolio.summary.countryWeights;
  const total = portfolio.summary.totalValueInr;

  return (
    <div style={styles.grid2}>
      {/* Asset Allocation Ring Chart */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Asset Allocation</div>
        <AllocationRing entries={entries} total={total} />
      </div>

      {/* Country Breakdown */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Country Exposure</div>
        <CountryBar country={country} />
        <div style={{ marginTop: 20 }}>
          <div style={styles.cardTitle}>Top Concentration</div>
          {portfolio.analysis.concentration.map((c, i) => (
            <div key={i} style={styles.concRow}>
              <div style={styles.concLeft}>
                <div style={{ ...styles.brokerDot, background: BROKER_COLORS[c.brokerId] ?? "#94a3b8" }} />
                <div>
                  <div style={styles.concSymbol}>{c.symbol}</div>
                  <div style={styles.concBroker}>{c.brokerId}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#f1f5f9", fontSize: 14 }}>{fmt(c.valueInr)}</div>
                <div style={{ color: c.pct > 20 ? "#ef4444" : "#94a3b8", fontSize: 12 }}>{c.pct.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Drift Tab ────────────────────────────────────────────────────────────────

function DriftTab({ portfolio }: { portfolio: UniPortfolioData }) {
  const drift = portfolio.analysis.drift;
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>
        Portfolio Drift Analysis
        <span style={{ marginLeft: 12, fontSize: 12, color: drift.has_drifted ? "#ef4444" : "#10b981" }}>
          {drift.has_drifted ? "⚠ Drift Detected" : "✓ Within Bounds"}
        </span>
      </div>
      <div style={styles.driftGrid}>
        {drift.drifting_assets.map((a, i) => (
          <div key={i} style={styles.driftCard}>
            <div style={styles.driftLabel}>{a.asset}</div>
            <div style={styles.driftBars}>
              <div style={{ ...styles.driftBar, width: `${Math.min(a.current, 100)}%`, background: "#6366f1" }} />
              <div style={{ ...styles.driftBar, width: `${Math.min(a.target, 100)}%`, background: "rgba(99,102,241,0.3)", marginTop: 3 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              <span>Current {a.current.toFixed(1)}%</span>
              <span style={{ color: driftColor(a.delta), fontWeight: 600 }}>
                {a.delta > 0 ? "+" : ""}{a.delta.toFixed(1)}%
              </span>
              <span>Target {a.target.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rebalance Tab ────────────────────────────────────────────────────────────

function RebalanceTab({ portfolio }: { portfolio: UniPortfolioData }) {
  const r = portfolio.analysis.rebalancing;
  if (!r.needsRebalance && r.trades.length === 0) {
    return (
      <div style={{ ...styles.card, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <div style={{ color: "#10b981", fontSize: 18, fontWeight: 600, marginTop: 12 }}>Portfolio is balanced</div>
        <div style={{ color: "#94a3b8", marginTop: 8 }}>No rebalancing required at this time.</div>
      </div>
    );
  }
  return (
    <div>
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={styles.cardTitle}>Rebalancing Plan</div>
          <div style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: urgencyColor(r.urgency) + "22", color: urgencyColor(r.urgency), fontWeight: 600 }}>
            {r.urgency.toUpperCase()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
          <Stat label="Trades" value={r.summary.numberOfTrades.toString()} />
          <Stat label="Est. Tax" value={fmt(r.summary.estimatedTotalTax)} />
        </div>
        {r.trades.map((t, i) => (
          <TradeCard key={i} trade={t} />
        ))}
        {r.recommendations.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={styles.cardTitle}>AI Recommendations</div>
            {r.recommendations.map((rec, i) => (
              <div key={i} style={styles.recRow}>💡 {rec}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Holdings Tab ─────────────────────────────────────────────────────────────

function HoldingsTab({ portfolio }: { portfolio: UniPortfolioData }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Holdings ({portfolio.holdings?.length ?? 0})</div>
      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {["Name", "Broker", "Type", "Qty", "Value (INR)", "P&L"].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(portfolio.holdings ?? []).map((h: any, i: number) => (
              <tr key={i} style={i % 2 === 0 ? {} : { background: "rgba(255,255,255,0.02)" }}>
                <td style={styles.td}>{h.name}</td>
                <td style={styles.td}>
                  <span style={{ ...styles.brokerPill, background: (BROKER_COLORS[h.brokerId] ?? "#64748b") + "22", color: BROKER_COLORS[h.brokerId] ?? "#64748b" }}>
                    {h.brokerId}
                  </span>
                </td>
                <td style={styles.td}>{h.assetClass ?? h.allocationGroup}</td>
                <td style={styles.td}>{Number(h.quantity).toFixed(4)}</td>
                <td style={styles.td}>{fmt(h.currentValueInr ?? 0)}</td>
                <td style={{ ...styles.td, color: (h.unrealizedPnlInr ?? 0) >= 0 ? "#10b981" : "#ef4444" }}>
                  {h.unrealizedPnlInr != null ? `${(h.unrealizedPnlInr >= 0 ? "+" : "")}${fmt(h.unrealizedPnlInr)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AllocationRing({ entries, total }: { entries: [string, number][]; total: number }) {
  const size = 160;
  const cx = size / 2, cy = size / 2, r = 60;
  let cumulative = 0;

  const slices = entries.map(([label, pct], i) => {
    const startAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const endAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = pct > 50 ? 1 : 0;
    return { label, pct, d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: ALLOC_COLORS[i % ALLOC_COLORS.length] };
  });

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <svg width={size} height={size}>
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} opacity={0.9} />)}
        <circle cx={cx} cy={cy} r={40} fill="#0f172a" />
        <text x={cx} y={cy + 5} textAnchor="middle" fill="#f1f5f9" fontSize={12} fontWeight={700}>
          {fmt(total)}
        </text>
      </svg>
      <div style={{ flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
              <span style={{ color: "#94a3b8", fontSize: 12 }}>{s.label}</span>
            </div>
            <span style={{ color: "#f1f5f9", fontSize: 12 }}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CountryBar({ country }: { country: { IN: number; US: number; OTHER: number } }) {
  const bars = [
    { label: "🇮🇳 India", pct: country.IN, color: "#6366f1" },
    { label: "🇺🇸 US", pct: country.US, color: "#10b981" },
    { label: "🌍 Other", pct: country.OTHER, color: "#f59e0b" },
  ];
  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
        {bars.map((b, i) => b.pct > 0 && (
          <div key={i} style={{ width: `${b.pct}%`, background: b.color }} />
        ))}
      </div>
      {bars.map((b, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>{b.label}</span>
          <span style={{ color: "#f1f5f9", fontSize: 12 }}>{b.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function TradeCard({ trade }: { trade: RebalanceTrade }) {
  const actionColor = trade.action === "buy" ? "#10b981" : trade.action === "sell" ? "#ef4444" : "#6366f1";
  return (
    <div style={styles.tradeCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "#f1f5f9", fontWeight: 600 }}>{trade.assetName}</div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{trade.rationale}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: actionColor, fontWeight: 700, textTransform: "uppercase", fontSize: 13 }}>
            {trade.action}
          </div>
          <div style={{ color: "#f1f5f9", fontSize: 14 }}>{fmt(trade.tradeValue)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#64748b" }}>
        <span>Δ {trade.allocationDiff > 0 ? "+" : ""}{trade.allocationDiff.toFixed(1)}%</span>
        <span>Tax: {trade.taxImpact.taxEfficiency === "high" ? "🟢" : trade.taxImpact.taxEfficiency === "medium" ? "🟡" : "🔴"} {fmt(trade.taxImpact.estimatedTax)}</span>
        <span>Priority: {trade.priority}</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ ...styles.container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
      <div style={styles.spinner} />
      <div style={{ color: "#94a3b8", marginTop: 16 }}>Loading portfolio from all brokers…</div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ ...styles.container, textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ color: "#ef4444", fontSize: 16, marginTop: 12 }}>Failed to load portfolio</div>
      <button onClick={onRetry} style={{ ...styles.refreshBtn, marginTop: 16 }}>Try Again</button>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#0f172a", borderRadius: 16, padding: 24, color: "#f1f5f9", fontFamily: "'Inter', sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  portfolioId: { fontSize: 11, color: "#64748b", marginBottom: 4 },
  code: { background: "#1e293b", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: 11 },
  netWorth: { fontSize: 36, fontWeight: 800, background: "linear-gradient(135deg, #6366f1, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  refreshBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, transition: "all 0.2s" },
  alertBanner: { background: "#1e293b", border: "1px solid", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 },
  viewRebalanceBtn: { marginLeft: "auto", background: "transparent", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  brokerRow: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  brokerBadge: { background: "#1e293b", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" },
  brokerDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  brokerName: { fontWeight: 700, fontSize: 13 },
  brokerMeta: { color: "#64748b", fontSize: 11 },
  staleBadge: { background: "#fbbf2422", color: "#f59e0b", borderRadius: 10, padding: "10px 14px", fontSize: 12 },
  tabBar: { display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #1e293b", paddingBottom: 4 },
  tab: { background: "none", border: "none", color: "#64748b", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 },
  activeTab: { background: "#1e293b", color: "#f1f5f9" },
  content: {},
  card: { background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontWeight: 700, fontSize: 14, color: "#94a3b8", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  concRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #0f172a" },
  concLeft: { display: "flex", gap: 10, alignItems: "center" },
  concSymbol: { fontWeight: 600, fontSize: 14 },
  concBroker: { color: "#64748b", fontSize: 11 },
  driftGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  driftCard: { background: "#0f172a", borderRadius: 8, padding: 12 },
  driftLabel: { fontWeight: 600, fontSize: 12, color: "#94a3b8", marginBottom: 8 },
  driftBars: {},
  driftBar: { height: 8, borderRadius: 4, transition: "width 0.5s ease" },
  tradeCard: { background: "#0f172a", borderRadius: 8, padding: 14, marginBottom: 10 },
  recRow: { color: "#94a3b8", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #1e293b" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", color: "#64748b", padding: "8px 12px", fontWeight: 600, borderBottom: "1px solid #1e293b" },
  td: { padding: "10px 12px", color: "#f1f5f9", borderBottom: "1px solid #0f172a" },
  brokerPill: { padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 },
  disclaimer: { color: "#334155", fontSize: 10, marginTop: 16, lineHeight: 1.5 },
  spinner: { width: 40, height: 40, border: "3px solid #1e293b", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
};

export default UniPortfolioDashboard;
