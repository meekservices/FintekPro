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
          if (id.includes("/pages/admin") || id.includes("/pages/admin-")) {
            return "chunk-admin";
          }
          if (
            id.includes("/pages/agent") ||
            id.includes("/pages/partner") ||
            id.includes("/pages/distribution-partner") ||
            id.includes("/pages/field-agent")
          ) return "chunk-agent";

          if (
            id.includes("/pages/tax") ||
            id.includes("/pages/itr") ||
            id.includes("/pages/ca-") ||
            id.includes("/pages/tds")
          ) return "chunk-tax";

          if (
            id.includes("/pages/mutual-funds") ||
            id.includes("/pages/bonds") ||
            id.includes("/pages/bond-") ||
            id.includes("/pages/aif") ||
            id.includes("/pages/pms") ||
            id.includes("/pages/ipo") ||
            id.includes("/pages/pre-ipo") ||
            id.includes("/pages/unlisted") ||
            id.includes("/pages/fixed-income") ||
            id.includes("/pages/reit") ||
            id.includes("/pages/mld") ||
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
