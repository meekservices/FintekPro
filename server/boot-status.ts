
export const bootState = {
  serverListening: false,
  authReady: false,
  routesReady: false,
  cronJobsReady: false,
  startTime: Date.now(),
  bootCompleteTime: null as number | null,
  milestone: "starting",
  error: null as string | null,
  getBootTime: () => {
    if (bootState.bootCompleteTime) return bootState.bootCompleteTime - bootState.startTime;
    return Date.now() - bootState.startTime;
  },
  isFullyReady: () => bootState.serverListening && bootState.authReady && bootState.routesReady
};

export function logBootProgress(message: string) {
  const bootMs = bootState.getBootTime();
  console.log(`🚀 [Boot] ${bootMs / 1000}s: ${message}`);
  bootState.milestone = message;
  
  if (message.toLowerCase().includes('complete') || message.toLowerCase().includes('ready')) {
    if (!bootState.bootCompleteTime && bootState.routesReady) {
      bootState.bootCompleteTime = Date.now();
    }
  }
}

