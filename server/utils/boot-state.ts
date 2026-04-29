/**
 * Shared boot-state singleton used by server/index.ts to track the
 * server initialisation lifecycle and report progress to health-check
 * endpoints and audit logs.
 */

const bootStartTime = Date.now();

export const bootState = {
  /** Set to true once all routes are registered and the server is ready. */
  routesReady: false,

  /** Contains an error message if the boot sequence failed. */
  error: null as string | null,

  /** Returns elapsed milliseconds since the boot sequence started. */
  getBootTime(): number {
    return Date.now() - bootStartTime;
  },
};

/**
 * Log a boot-sequence progress message.
 * In production this emits a structured console log; in development it
 * also includes a timestamp so the startup timeline is easy to read.
 */
export function logBootProgress(message: string): void {
  const elapsed = bootState.getBootTime();
  if (process.env.NODE_ENV === 'production') {
    console.log(`🔄 [Boot +${elapsed}ms] ${message}`);
  } else {
    const ts = new Date().toISOString();
    console.log(`🔄 [Boot ${ts} +${elapsed}ms] ${message}`);
  }
}
