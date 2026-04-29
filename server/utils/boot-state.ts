/**
 * BootState Manager
 * 
 * Tracks the asynchronous initialization phases of the application.
 * Useful for health checks and debugging "Why is the app taking so long to start?".
 */

type PhaseStatus = "pending" | "connecting" | "registering" | "setting_up" | "starting" | "ready" | "error";

interface Phase {
  id: number;
  name: string;
  status: PhaseStatus;
  message?: string;
  updatedAt: Date;
}

class BootStateManager {
  private phases: Map<number, Phase> = new Map([
    [0, { id: 0, name: "Core Setup", status: "ready", updatedAt: new Date() }],
    [1, { id: 1, name: "Database Connectivity", status: "pending", updatedAt: new Date() }],
    [2, { id: 2, name: "Route Registration", status: "pending", updatedAt: new Date() }],
    [3, { id: 3, name: "Middleware/Security", status: "pending", updatedAt: new Date() }],
    [4, { id: 4, name: "Frontend/Vite", status: "pending", updatedAt: new Date() }],
    [5, { id: 5, name: "Execution Readiness", status: "pending", updatedAt: new Date() }],
    [6, { id: 6, name: "System Overall", status: "pending", updatedAt: new Date() }],
  ]);

  setPhase(id: number, status: PhaseStatus, message?: string) {
    const phase = this.phases.get(id);
    if (phase) {
      phase.status = status;
      phase.message = message;
      phase.updatedAt = new Date();
      
      if (status === "error" && id !== 1) { // Phase 1 (DB) is non-critical for boot
        this.phases.get(6)!.status = "error";
        this.phases.get(6)!.message = `Failed at phase ${id}: ${message}`;
      }
    }
  }

  getSnapshot() {
    return Array.from(this.phases.values());
  }

  isReady() {
    return this.phases.get(6)?.status === "ready";
  }
}

export const bootState = new BootStateManager();
