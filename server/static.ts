import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Cloud Run Structure: 
  // Code is in /app
  // Build is in /app/dist
  // Assets are in /app/dist/public
  const possiblePaths = [
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "public"),
    path.resolve(import.meta.dirname, "public"),
    path.resolve(import.meta.dirname, "..", "dist", "public")
  ];

  let distPath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
      distPath = p;
      break;
    }
  }

  if (!distPath) {
    console.error(`❌ [Static] FATAL: frontend build directory not found in: ${possiblePaths.join(", ")}`);
    // Fallback to absolute last resort just so something is registered
    distPath = path.resolve(process.cwd(), "dist", "public");
  } else {
    console.log(`✅ [Static] Serving frontend assets from: ${distPath}`);
  }

  // 1. Serve static files with a high performance cache and explicit 404 for missing assets
  app.use(express.static(distPath, {
    maxAge: '1d',
    index: false, // Don't serve index.html for root - handled by catch-all below
    fallthrough: true // Allow falling through to catch-all for SPAs
  }));

  // 2. Explicitly 404 missing assets BEFORE the catch-all
  // This prevents the browser from trying to parse index.html as a .js file
  app.use(/.*\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2)$/, (req, res) => {
    res.status(404).send(`Asset ${req.originalUrl} not found`);
  });

  // 3. Catch-all for React/SPA routing
  app.use("*", (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Frontend application index.html not found. Please ensure the build step completed successfully.");
    }
  });
}
