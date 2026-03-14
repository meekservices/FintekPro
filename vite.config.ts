import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
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

          // ── App service chunks — only downloaded when the user visits that section ──

          // Admin sub-chunks (was one 2.3 MB chunk — now 4 smaller chunks)
          if (id.includes("/pages/admin-kyc") || id.includes("/pages/admin-aadhaar") || id.includes("/pages/admin-ckyc") || id.includes("/pages/admin-pan-config")) {
            return "admin-kyc";
          }
          if (id.includes("/pages/admin-loan") || id.includes("/pages/admin-dlm")) {
            return "admin-loans";
          }
          if (
            id.includes("/pages/admin-payout") || id.includes("/pages/admin-mf-") ||
            id.includes("/pages/admin-ai-") || id.includes("/pages/admin-api-usage") ||
            id.includes("/pages/admin-zoho") || id.includes("/pages/admin-data-") ||
            id.includes("/pages/admin-mapping") || id.includes("/pages/admin-master-dsa")
          ) {
            return "admin-fin";
          }
          if (id.includes("/pages/admin")) {
            return "chunk-admin";
          }

          // Agent sub-chunks (was one 2.6 MB chunk — now 5 smaller chunks)
          if (
            id.includes("/pages/agent-crm-") || id.includes("/pages/agent-bulk-") ||
            id.includes("/pages/agent-lead-") || id.includes("/pages/agent-meetings") ||
            id.includes("/pages/agent-calendar") || id.includes("/pages/agent-tasks") ||
            id.includes("/pages/agent-tracker") || id.includes("/pages/agent-market-alerts") ||
            id.includes("/pages/agent-zoho-crm")
          ) {
            return "agent-crm";
          }
          if (
            id.includes("/pages/agent-knowledge-") || id.includes("/pages/agent-training") ||
            id.includes("/pages/agent-leaderboard") || id.includes("/pages/agent-performance") ||
            id.includes("/pages/agent-sample-report") || id.includes("/pages/agent-demo-")
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
            id.includes("/pages/agent-kyc-") || id.includes("/pages/agent-esign") ||
            id.includes("/pages/agent-client-onboarding") || id.includes("/pages/agent-client-acquisition")
          ) {
            return "agent-kyc";
          }
          if (
            id.includes("/pages/agent") ||
            id.includes("/pages/partner") ||
            id.includes("/pages/distribution-partner") ||
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

          if (
            id.includes("/pages/loan") ||
            id.includes("/pages/loans") ||
            id.includes("/pages/icici-") ||
            id.includes("/pages/hdfc-") ||
            id.includes("/pages/bajaj-") ||
            id.includes("/pages/tata-capital")
          ) return "chunk-loans";

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
