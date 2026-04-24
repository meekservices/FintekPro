import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { logBootProgress } from "./boot-status";

export function serveStatic(app: Express) {
  // In production (Cloud Run), process.cwd() is /app
  // Vite builds to dist/public
  const distPath = path.resolve(process.cwd(), "dist", "public");
  const publicPath = path.resolve(process.cwd(), "public");

  logBootProgress(`Step 1.5: Initializing static file server (distPath: ${distPath})`);

  if (fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"))) {
    console.log(`✅ [Static] Serving frontend assets from production path: ${distPath}`);
    app.use(express.static(distPath, {
      maxAge: '1d',
      index: false,
      fallthrough: true // Ensure it falls through to other middlewares if not found
    }));
  } else if (fs.existsSync(publicPath)) {
    console.warn(`⚠️ [Static] Production build not found at ${distPath}. Falling back to ${publicPath}`);
    app.use(express.static(publicPath, {
      maxAge: '0',
      index: false,
      fallthrough: true
    }));
  } else {
    console.error(`❌ [Static] No static asset directory found! Checked ${distPath} and ${publicPath}`);
  }
}

/**
 * Final catch-all for SPA handling.
 * This should be registered as the VERY LAST route in the boot sequence.
 */
export function registerSPACatchAll(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  const publicPath = path.resolve(process.cwd(), "public");

  app.use("*", (req, res) => {
    // Skip API routes - they should have been handled or 404ed already
    if (req.path.startsWith('/api/')) {
       return res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
    }

    // Try primary production path
    let indexPath = path.join(distPath, "index.html");
    
    // Fallback path
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(publicPath, "index.html");
    }
      
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`❌ [Static] Error sending index.html:`, err);
          if (!res.headersSent) {
            res.status(500).send("Internal Server Error: Failed to serve frontend.");
          }
        }
      });
    } else {
      res.status(404).send(`Frontend application index.html not found. Deployment appears incomplete. (Checked: ${indexPath})`);
    }
  });
}

