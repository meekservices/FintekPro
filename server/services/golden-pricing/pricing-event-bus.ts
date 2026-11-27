/**
 * @file pricing-event-bus.ts
 * @description Lightweight reactive event bus for Golden Source Pricing Engine.
 *
 * Emits real-time event notifications when core benchmark prices (Nifty 50, Sensex,
 * MCX Gold, Silver, Brent Crude, G-Sec 10Y) are synchronized.
 * Consumed by:
 *   - inProcessMarketSnapshotStore (Market Brief Engine)
 *   - CentralMacroContextBus (CMCB)
 *   - Live WebSocket / SSE streams
 *
 * Compliance: FintekPro GCR v1.0
 */

import { EventEmitter } from "events";
import { logger } from "../../logger";

export interface BenchmarkUpdateEvent {
  benchmarks: string[]; // e.g. ["GOLD", "SILVER", "NIFTY_50"]
  source: string;
  timestamp: string;
}

class PricingEventBus extends EventEmitter {
  private static instance: PricingEventBus;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): PricingEventBus {
    if (!PricingEventBus.instance) {
      PricingEventBus.instance = new PricingEventBus();
    }
    return PricingEventBus.instance;
  }

  /**
   * Broadcasts that core benchmarks have been updated in golden_prices / MCX store.
   */
  public emitBenchmarkUpdate(event: BenchmarkUpdateEvent): void {
    logger.debug("[PricingEventBus] Benchmark price update broadcast", {
      benchmarks: event.benchmarks,
      source: event.source,
    });
    this.emit("PRICING_UPDATED:BENCHMARK", event);
  }

  /**
   * Subscribes to core benchmark price changes.
   */
  public onBenchmarkUpdate(handler: (event: BenchmarkUpdateEvent) => void): void {
    this.on("PRICING_UPDATED:BENCHMARK", handler);
  }
}

export const pricingEventBus = PricingEventBus.getInstance();
