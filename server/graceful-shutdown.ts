import { Server } from "http";
import { closePool } from "./db";

let isShuttingDown = false;

export function setupGracefulShutdown(server: Server, beforeShutdown?: () => void): void {
  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log(`[Graceful Shutdown] Shutdown already in progress, ignoring ${signal} signal`);
      return;
    }

    isShuttingDown = true;
    console.log(`[Graceful Shutdown] Received ${signal} signal`);
    console.log("[Graceful Shutdown] Graceful shutdown initiated...");

    // Kill child processes (Python sidecar etc.) before closing the HTTP server
    if (beforeShutdown) {
      try { beforeShutdown(); } catch (_) { /* best-effort */ }
    }

    const shutdownTimeout = setTimeout(() => {
      console.error("[Graceful Shutdown] Forced shutdown: 30-second timeout reached");
      process.exit(1);
    }, 30000);

    try {
      server.close(async () => {
        try {
          await closePool();
          clearTimeout(shutdownTimeout);
          console.log("[Graceful Shutdown] Shutdown complete");
          process.exit(0);
        } catch (dbError) {
          console.error("[Graceful Shutdown] Error during database shutdown:", dbError);
          clearTimeout(shutdownTimeout);
          process.exit(1);
        }
      });
    } catch (error) {
      console.error("[Graceful Shutdown] Error during graceful shutdown:", error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}
