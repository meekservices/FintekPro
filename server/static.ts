import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  let distPath = path.resolve(import.meta.dirname, "public");

  // Robust check: in some production environments, the path may be different
  if (!fs.existsSync(distPath)) {
    const fallbackPath = path.resolve(process.cwd(), "dist", "public");
    if (fs.existsSync(fallbackPath)) {
      distPath = fallbackPath;
    }
  }

  if (!fs.existsSync(distPath)) {
    // In production, the build should always be here
    console.warn(`[Static] Warning: Build directory not found at ${distPath}. This usually means the build step failed.`);
    return;
  }

  app.use(express.static(distPath));

  // Catch-all for React/SPA routing
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
