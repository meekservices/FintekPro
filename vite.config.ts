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
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
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
        manualChunks(id) {
          // React core
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          // Recharts + d3
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-") || id.includes("node_modules/victory-")) {
            return "vendor-charts";
          }
          // Radix UI primitives
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          // TanStack (query, table, etc.)
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-tanstack";
          }
          // Forms + validation
          if (id.includes("node_modules/react-hook-form") || id.includes("node_modules/@hookform/") || id.includes("node_modules/zod")) {
            return "vendor-forms";
          }
          // PDF / canvas (heavy, infrequently changed)
          if (id.includes("node_modules/jspdf") || id.includes("node_modules/html2canvas") || id.includes("node_modules/pdfmake")) {
            return "vendor-pdf";
          }
          // Animation
          if (id.includes("node_modules/framer-motion") || id.includes("node_modules/motion-dom") || id.includes("node_modules/motion-utils")) {
            return "vendor-motion";
          }
          // Date utilities
          if (id.includes("node_modules/date-fns")) {
            return "vendor-dates";
          }
          // Lucide icons
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          // Drizzle ORM (server-only but imported via shared/schema for types)
          if (id.includes("node_modules/drizzle-orm") || id.includes("node_modules/drizzle-zod")) {
            return "vendor-drizzle";
          }
          // Floating UI + headless UI extras
          if (id.includes("node_modules/@floating-ui/") || id.includes("node_modules/cmdk") || id.includes("node_modules/vaul")) {
            return "vendor-ui-extras";
          }
          // Router + utility libs
          if (id.includes("node_modules/wouter") || id.includes("node_modules/clsx") ||
              id.includes("node_modules/class-variance-authority") || id.includes("node_modules/tailwind-merge")) {
            return "vendor-utils";
          }
          // HTTP clients
          if (id.includes("node_modules/axios") || id.includes("node_modules/ky")) {
            return "vendor-http";
          }
          // Everything else in node_modules
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
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
