import { Server } from "http";
import { closePool } from "./db";

let isShuttingDown = false;

export function setupGracefulShutdown(server: Server): void {
  const handleShutdown = async (signal: string) => {
    // Prevent multiple shutdown attempts
    if (isShuttingDown) {
      console.log(`[Graceful Shutdown] Shutdown already in progress, ignoring ${signal} signal`);
      return;
    }

    isShuttingDown = true;
    console.log(`[Graceful Shutdown] Received ${signal} signal`);
    console.log("[Graceful Shutdown] Graceful shutdown initiated...");

    // Create a timeout that forces exit after 30 seconds
    const shutdownTimeout = setTimeout(() => {
      console.error("[Graceful Shutdown] Forced shutdown: 30-second timeout reached");
      process.exit(1);
    }, 30000);

    try {
      // Stop accepting new connections
      server.close(async () => {
        try {
          // Close database connections gracefully
          await closePool();

          // Clear the timeout since we completed successfully
          clearTimeout(shutdownTimeout);

          console.log("[Graceful Shutdown] Shutdown complete");
          process.exit(0);
        } catch (dbError) {
          console.error("[Graceful Shutdown] Error during database shutdown:", dbError);
          clearTimeout(shutdownTimeout);
          process.exit(1);
        }
      });

      // If server.close() callback is not called within timeout, force exit
      // This handles cases where connections are stuck
    } catch (error) {
      console.error("[Graceful Shutdown] Error during graceful shutdown:", error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  };

  // Handle SIGTERM (termination signal)
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));

  // Handle SIGINT (interrupt signal - Ctrl+C)
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}
