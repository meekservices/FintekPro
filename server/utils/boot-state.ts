class BootState {
  private static instance: BootState;
  public routesReady: boolean = false;
  public serverListening: boolean = false;
  public error: string | null = null;
  private bootTime: Date;

  private constructor() {
    this.bootTime = new Date();
  }

  public static getInstance(): BootState {
    if (!BootState.instance) {
      BootState.instance = new BootState();
    }
    return BootState.instance;
  }

  public getBootTime(): string {
    return this.bootTime.toISOString();
  }
}

export const bootState = BootState.getInstance();

export function logBootProgress(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[BOOT][${timestamp}] ${message}`);
}
