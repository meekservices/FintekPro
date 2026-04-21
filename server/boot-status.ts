
export const bootState = {
  serverListening: false,
  authReady: false,
  routesReady: false,
  cronJobsReady: false,
  startTime: Date.now(),
  milestone: "starting",
  error: null as string | null,
  getBootTime: () => Date.now() - bootState.startTime,
  isFullyReady: () => bootState.serverListening && bootState.authReady && bootState.routesReady
};

export function logBootProgress(message: string) {
  const bootMs = bootState.getBootTime();
  console.log(`🚀 [Boot] ${bootMs / 1000}s: ${message}`);
  bootState.milestone = message;
}
