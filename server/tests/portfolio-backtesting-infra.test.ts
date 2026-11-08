/**
 * @file portfolio-backtesting-infra.test.ts
 * @description Comprehensive unit and integration test suite for FintekPro Universal Backtesting Engine
 * (FASP-AI v3.1 / FintekPro GCR v1.0).
 */

import { describe, it, expect } from "vitest";
import {
  portfolioBacktestService,
  BACKTEST_ENGINE_VERSION,
  DEFAULT_RISK_FREE_RATE,
  type BacktestConstituent,
} from "../services/portfolio-backtest-service";

describe("Universal Portfolio Backtesting Infrastructure (FASP-AI v3.1)", () => {
  describe("1. Date Range Resolution & Lookback Windows", () => {
    it("correctly resolves 1Y, 3Y, 5Y, and MAX horizons", () => {
      const today = new Date().toISOString().split("T")[0];
      const r1y = portfolioBacktestService.resolveDateRange("1Y");
      const r3y = portfolioBacktestService.resolveDateRange("3Y");
      const r5y = portfolioBacktestService.resolveDateRange("5Y");

      expect(r1y.end).toBe(today);
      expect(r3y.end).toBe(today);
      expect(r5y.end).toBe(today);

      const d1Start = new Date(r1y.start);
      const d1End = new Date(r1y.end);
      const diffYears1 = (d1End.getTime() - d1Start.getTime()) / (365.25 * 86400000);
      expect(Math.round(diffYears1)).toBe(1);

      const d3Start = new Date(r3y.start);
      const d3End = new Date(r3y.end);
      const diffYears3 = (d3End.getTime() - d3Start.getTime()) / (365.25 * 86400000);
      expect(Math.round(diffYears3)).toBe(3);
    });

    it("respects explicit start and end dates when provided", () => {
      const custom = portfolioBacktestService.resolveDateRange("custom", "2021-04-01", "2024-03-31");
      expect(custom.start).toBe("2021-04-01");
      expect(custom.end).toBe("2024-03-31");
    });
  });

  describe("2. Lump-Sum Multi-Asset Backtest Execution", () => {
    const constituents: BacktestConstituent[] = [
      {
        symbol: "NIFTY_LARGE_CAP",
        name: "Nifty Large Cap Bluechip Fund",
        type: "mutual_fund",
        assetClass: "equity",
        weight: 60,
      },
      {
        symbol: "CRISIL_CORP_BOND",
        name: "Corporate Bond Fund",
        type: "debt",
        assetClass: "debt",
        weight: 30,
      },
      {
        symbol: "GOLD_BEES",
        name: "Domestic Gold ETF",
        type: "etf",
        assetClass: "gold",
        weight: 10,
      },
    ];

    it("executes a 3Y lumpsum backtest with all risk metrics populated", async () => {
      const report = await portfolioBacktestService.executeBacktest(
        "Balanced Wealth Builder",
        constituents,
        {
          mode: "lumpsum",
          initialAmount: 200000,
          period: "3Y",
          rebalanceFrequency: "quarterly",
          benchmarkCode: "NIFTY50",
        }
      );

      expect(report).toBeDefined();
      expect(report.strategyName).toBe("Balanced Wealth Builder");
      expect(report.mode).toBe("lumpsum");
      expect(report.initialAmount).toBe(200000);
      expect(report.metrics.totalInvested).toBe(200000);
      expect(report.metrics.finalValue).toBeGreaterThan(0);

      // Quantitative metrics
      expect(typeof report.metrics.cagr).toBe("number");
      expect(typeof report.metrics.annualizedVolatility).toBe("number");
      expect(typeof report.metrics.sharpeRatio).toBe("number");
      expect(typeof report.metrics.sortinoRatio).toBe("number");
      expect(typeof report.metrics.maxDrawdown).toBe("number");
      expect(report.metrics.maxDrawdown).toBeLessThanOrEqual(0);
      expect(typeof report.metrics.calmarRatio).toBe("number");
      expect(typeof report.metrics.alpha).toBe("number");
      expect(typeof report.metrics.beta).toBe("number");
      expect(report.metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics.winRate).toBeLessThanOrEqual(100);

      // Time series curves
      expect(report.equityCurve.length).toBeGreaterThan(20);
      expect(report.drawdownCurve.length).toBeGreaterThan(20);
      expect(report.yearByYearReturns.length).toBeGreaterThan(0);
      expect(report.monthlyReturns.length).toBeGreaterThan(0);
      expect(report.constituents.length).toBe(3);

      // FASP-AI metadata & explainability
      expect(report.engineVersion).toBe(BACKTEST_ENGINE_VERSION);
      expect(report.disclaimers.length).toBeGreaterThan(0);
      expect(report.explainability.formulaApplied.cagr).toBeDefined();
      expect(report.explainability.formulaApplied.sharpe).toBeDefined();
    });
  });

  describe("3. Monthly SIP Simulation Engine", () => {
    const constituents: BacktestConstituent[] = [
      {
        symbol: "FLEXI_CAP_GROWTH",
        name: "Flexi Cap Fund",
        type: "mutual_fund",
        assetClass: "equity",
        weight: 70,
      },
      {
        symbol: "SHORT_TERM_DEBT",
        name: "Short Term Debt Fund",
        type: "debt",
        assetClass: "debt",
        weight: 30,
      },
    ];

    it("simulates monthly SIP with rupee cost averaging and incremental capital", async () => {
      const monthlySip = 15000;
      const report = await portfolioBacktestService.executeBacktest(
        "Goal SIP Builder",
        constituents,
        {
          mode: "sip",
          monthlySipAmount: monthlySip,
          period: "1Y",
          rebalanceFrequency: "none",
          benchmarkCode: "NIFTY50",
        }
      );

      expect(report.mode).toBe("sip");
      expect(report.monthlySipAmount).toBe(monthlySip);
      // After ~12 months of 15k, total invested should be around 1.8L (approx 12-13 installments)
      expect(report.metrics.totalInvested).toBeGreaterThanOrEqual(150000);
      expect(report.metrics.finalValue).toBeGreaterThan(0);
      expect(report.equityCurve[0].portfolioValue).toBe(monthlySip);
    });
  });

  describe("4. Financial Determinism (FintekPro GCR §3.2 Mandate)", () => {
    it("guarantees same input produces exactly the same output and metrics", async () => {
      const constituents: BacktestConstituent[] = [
        { symbol: "ALPHA_STOCK", name: "Alpha Leader", type: "stock", weight: 50 },
        { symbol: "DEFENSIVE_GILT", name: "G-Sec 10Y", type: "debt", assetClass: "debt", weight: 50 },
      ];

      const run1 = await portfolioBacktestService.executeBacktest("Deterministic Run", constituents, {
        startDate: "2023-01-01",
        endDate: "2024-01-01",
        initialAmount: 100000,
      });

      const run2 = await portfolioBacktestService.executeBacktest("Deterministic Run", constituents, {
        startDate: "2023-01-01",
        endDate: "2024-01-01",
        initialAmount: 100000,
      });

      expect(run1.metrics.cagr).toBe(run2.metrics.cagr);
      expect(run1.metrics.totalReturn).toBe(run2.metrics.totalReturn);
      expect(run1.metrics.finalValue).toBe(run2.metrics.finalValue);
      expect(run1.metrics.sharpeRatio).toBe(run2.metrics.sharpeRatio);
      expect(run1.metrics.maxDrawdown).toBe(run2.metrics.maxDrawdown);
      expect(run1.metrics.annualizedVolatility).toBe(run2.metrics.annualizedVolatility);
    });
  });
});
