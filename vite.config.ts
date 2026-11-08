import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: [
      {
        find: "@shared/schema",
        replacement: path.resolve(import.meta.dirname, "shared/form-schemas.ts"),
      },
      {
        find: "@shared",
        replacement: path.resolve(import.meta.dirname, "shared"),
      },
      {
        find: "@",
        replacement: path.resolve(import.meta.dirname, "client", "src"),
      },
      {
        find: "@assets",
        replacement: path.resolve(import.meta.dirname, "attached_assets"),
      },
    ],
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2500,
    minify: "esbuild",
    cssMinify: "esbuild",
    target: "es2022",
    rollupOptions: {
      output: {
        // Group modules into logical service bundles instead of 300+ micro-chunks.
        // Each bucket is cached independently — users only re-download what changed.
        manualChunks(id: string) {
          // ── Vendor: stable libraries, long-lived browser cache ──────────
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) return "vendor-react";

          if (
            id.includes("/node_modules/@tanstack/") ||
            id.includes("/node_modules/wouter") ||
            id.includes("/node_modules/react-hook-form/") ||
            id.includes("/node_modules/@hookform/")
          ) return "vendor-query";

          if (
            id.includes("/node_modules/@radix-ui/") ||
            id.includes("/node_modules/lucide-react") ||
            id.includes("/node_modules/class-variance-authority") ||
            id.includes("/node_modules/clsx") ||
            id.includes("/node_modules/tailwind-merge") ||
            id.includes("/node_modules/cmdk") ||
            id.includes("/node_modules/vaul") ||
            id.includes("/node_modules/sonner")
          ) return "vendor-ui";

          if (
            id.includes("/node_modules/recharts") ||
            id.includes("/node_modules/d3-") ||
            id.includes("/node_modules/victory")
          ) return "vendor-charts";

          // ── Shared app code ─────────────────────────────────────────────────────
          // Components, hooks, and lib are used across many page chunks. Assigning
          // them here — before the page rules — prevents any single page chunk from
          // "owning" a shared module, which is the root cause of circular chunk
          // loading (chunk-portfolio ↔ chunk-admin etc.) and TDZ runtime crashes.
          //
          // ── Heavy domain component directories (isolated to avoid monolithic shared chunk) ──
          if (id.includes("/client/src/components/dashboard/")) return "chunk-dashboard";
          if (id.includes("/client/src/components/us-trading/")) return "chunk-us-trading";
          if (id.includes("/client/src/components/portfolio/") || id.includes("/client/src/components/portfolio-sync/")) return "chunk-portfolio-comp";
          if (id.includes("/client/src/components/proposal-builder/") || id.includes("/client/src/components/proposal/")) return "chunk-proposals";
          if (id.includes("/client/src/components/wealth/") || id.includes("/client/src/components/recommendations/")) return "chunk-wealth";
          if (id.includes("/client/src/components/loan/")) return "chunk-loans";
          if (id.includes("/client/src/components/ca/")) return "chunk-ca";
          if (id.includes("/client/src/components/picks/") || id.includes("/client/src/components/screener/")) return "chunk-picks";
          if (id.includes("/client/src/components/research/") || id.includes("/client/src/components/macro/")) return "chunk-research";
          if (id.includes("/client/src/components/store/")) return "chunk-store";
          if (id.includes("/client/src/components/regulatory/")) return "chunk-regulatory";
          if (id.includes("/client/src/components/admin/")) return "chunk-admin-comp";

          // Feature components collocated with page chunks to prevent circular dependencies
          if (
            id.includes("/client/src/components/agent/") ||
            id.includes("/client/src/components/kyc/") ||
            id.includes("/client/src/components/esign/")
          ) return undefined;

          // ── True shared primitives & utilities ──
          if (
            id.includes("/client/src/components/") ||
            id.includes("/client/src/hooks/") ||
            id.includes("/client/src/lib/")
          ) return "chunk-shared";

          // ── App service chunks — only downloaded when the user visits that section ──

          // Admin sub-chunks (splitting admin into focused domain bundles)
          if (
            id.includes("/pages/admin-kyc") || id.includes("/pages/admin-aadhaar") ||
            id.includes("/pages/admin-ckyc") || id.includes("/pages/admin-pan-config") ||
            id.includes("/pages/admin/ckyc") || id.includes("/pages/admin/kyc") ||
            id.includes("/pages/admin/compliance") || id.includes("/pages/admin/audit") ||
            id.includes("/pages/admin/approval") || id.includes("/pages/admin/agent-oversight")
          ) {
            return "admin-kyc";
          }
          if (
            id.includes("/pages/admin-loan") || id.includes("/pages/admin-dlm") ||
            id.includes("/pages/admin/loan") || id.includes("/pages/admin/dlm")
          ) {
            return "admin-loans";
          }
          if (
            id.includes("/pages/admin-payout") || id.includes("/pages/admin-mf-") ||
            id.includes("/pages/admin-ai-") || id.includes("/pages/admin-api-usage") ||
            id.includes("/pages/admin-zoho") || id.includes("/pages/admin-data-") ||
            id.includes("/pages/admin-mapping") || id.includes("/pages/admin-master-dsa") ||
            id.includes("/pages/admin/commission") || id.includes("/pages/admin/payout") ||
            id.includes("/pages/admin/agent-payouts") || id.includes("/pages/admin/revenue") ||
            id.includes("/pages/admin/earnings") || id.includes("/pages/admin/gst")
          ) {
            return "admin-fin";
          }
          if (
            id.includes("/pages/admin/broker") || id.includes("/pages/admin/alpaca") ||
            id.includes("/pages/admin/multibroker") || id.includes("/pages/admin/bond") ||
            id.includes("/pages/admin/FixedIncome") || id.includes("/pages/admin/Unlisted") ||
            id.includes("/pages/admin/gift-city") || id.includes("/pages/admin/aif-seed")
          ) {
            return "admin-markets";
          }
          if (
            id.includes("/pages/admin/api") || id.includes("/pages/admin/bulk") ||
            id.includes("/pages/admin/system") || id.includes("/pages/admin/notification") ||
            id.includes("/pages/admin/sms") || id.includes("/pages/admin/activity") ||
            id.includes("/pages/admin/client")
          ) {
            return "admin-ops";
          }
          if (id.includes("/pages/admin")) {
            return "chunk-admin";
          }

          // Agent sub-chunks (splitting agent into focused domain bundles)
          if (
            id.includes("/pages/agent-crm-") || id.includes("/pages/agent-bulk-") ||
            id.includes("/pages/agent-lead-") || id.includes("/pages/agent-meetings") ||
            id.includes("/pages/agent-calendar") || id.includes("/pages/agent-tasks") ||
            id.includes("/pages/agent-tracker") || id.includes("/pages/agent-market-alerts") ||
            id.includes("/pages/agent-zoho-crm") || id.includes("/pages/agent-clients")
          ) {
            return "agent-crm";
          }
          if (
            id.includes("/pages/agent-knowledge-") || id.includes("/pages/agent-training") ||
            id.includes("/pages/agent-leaderboard") || id.includes("/pages/agent-performance") ||
            id.includes("/pages/agent-sample-report") || id.includes("/pages/agent-demo-") ||
            id.includes("/pages/agent-practice-test") || id.includes("/pages/agent-study-notes")
          ) {
            return "agent-knowledge";
          }
          if (
            id.includes("/pages/agent-investment-advisory") || id.includes("/pages/agent-picks") ||
            id.includes("/pages/agent-stock-ai") || id.includes("/pages/agent-quant-") ||
            id.includes("/pages/agent-research-") || id.includes("/pages/agent-screener") ||
            id.includes("/pages/agent-bond-") || id.includes("/pages/agent-derivatives") ||
            id.includes("/pages/agent-field-view")
          ) {
            return "agent-advisory";
          }
          if (
            id.includes("/pages/agent-model-portfolios") || id.includes("/pages/agent-portfolio-") ||
            id.includes("/pages/agent-financial-planning") || id.includes("/pages/agent-external-portfolios") ||
            id.includes("/pages/agent-investment-baskets") || id.includes("/pages/agent-sip-health")
          ) {
            return "agent-wealth";
          }
          if (
            id.includes("/pages/agent-proposals") || id.includes("/pages/agent-prospect-") ||
            id.includes("/pages/agent-deal-matcher") || id.includes("/pages/agent-recommendation-control")
          ) {
            return "agent-proposals";
          }
          if (
            id.includes("/pages/agent-commission-") || id.includes("/pages/agent-payout-") ||
            id.includes("/pages/agent-revenue-") || id.includes("/pages/agent-treasury")
          ) {
            return "agent-fin";
          }
          if (
            id.includes("/pages/agent-kyc-") || id.includes("/pages/agent-esign") ||
            id.includes("/pages/agent-client-onboarding") || id.includes("/pages/agent-client-acquisition")
          ) {
            return "agent-kyc";
          }
          if (
            id.includes("/pages/partner") ||
            id.includes("/pages/distribution-partner")
          ) {
            return "chunk-partner";
          }
          if (
            id.includes("/pages/agent") ||
            id.includes("/pages/field-agent")
          ) return "chunk-agent";

          // Tax sub-chunks (was one 686 KB chunk — now 3 smaller chunks)
          if (
            id.includes("/pages/tax-itr") || id.includes("/pages/itr-") ||
            id.includes("/pages/tax-regime") || id.includes("/pages/tax-smart-filing") ||
            id.includes("/pages/tax-compliance-form15")
          ) return "tax-itr";
          if (id.includes("/pages/ca-")) return "tax-ca";
          if (
            id.includes("/pages/tax") ||
            id.includes("/pages/itr") ||
            id.includes("/pages/tds")
          ) return "chunk-tax";

          // Investments sub-chunks (was one 692 KB chunk — now 3 smaller chunks)
          if (id.includes("/pages/mutual-funds")) return "investments-mf";
          if (
            id.includes("/pages/bonds") || id.includes("/pages/bond-") ||
            id.includes("/pages/fixed-income") || id.includes("/pages/mld")
          ) return "investments-bonds";
          if (
            id.includes("/pages/aif") ||
            id.includes("/pages/pms") ||
            id.includes("/pages/ipo") ||
            id.includes("/pages/pre-ipo") ||
            id.includes("/pages/unlisted") ||
            id.includes("/pages/reit") ||
            id.includes("/pages/alternative-investments")
          ) return "chunk-investments";

          if (id.includes("/pages/portfolio")) return "chunk-portfolio";

          if (id.includes("/pages/insurance")) return "chunk-insurance";
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
