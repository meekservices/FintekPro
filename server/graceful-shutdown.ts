import { Server } from "http";
import type { Socket } from "net";
import { closePool, isPoolClosed } from "./db";

let isShuttingDown = false;

export function setupGracefulShutdown(server: Server, beforeShutdown?: () => void): void {
  const openSockets = new Set<Socket>();

  server.on("connection", (socket: Socket) => {
    openSockets.add(socket);
    socket.once("close", () => openSockets.delete(socket));
  });

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[Graceful Shutdown] Received ${signal} — killing children and exiting immediately`);

    // 1. Run any pre-shutdown hook (e.g. drain in-flight requests)
    if (beforeShutdown) {
      try { beforeShutdown(); } catch (_) { /* best-effort */ }
    }

    // 2. Destroy all open HTTP sockets so port 5000 is released immediately
    for (const socket of openSockets) {
      try { socket.destroy(); } catch (_) { /* best-effort */ }
    }
    openSockets.clear();

    // 3. Close HTTP server (should return instantly since all sockets are destroyed)
    try { server.close(); } catch (_) { /* best-effort */ }

    // 4. Give in-flight background jobs a 2-second drain window before
    //    closing the pool. Railway's SIGTERM → SIGKILL gap is ~30s so this
    //    is safe even combined with the 8s hard-exit timer above.
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Close DB pool
    try { await closePool(); } catch (_) { /* best-effort */ }

    console.log("[Graceful Shutdown] Shutdown complete");
    process.exit(0);
  };

  // Safety net: if shutdown takes > 8s, hard-exit
  const hardExit = () => {
    console.error("[Graceful Shutdown] Hard exit after 8s timeout");
    process.exit(1);
  };

  process.on("SIGTERM", () => {
    setTimeout(hardExit, 8000).unref();
    handleShutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    setTimeout(hardExit, 8000).unref();
    handleShutdown("SIGINT");
  });
}
