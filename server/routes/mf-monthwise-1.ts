import { Express } from "express";
import { registerMFMonthwiPart1Part1Routes } from "./mf-monthwise-1-1";
import { registerMFMonthwiPart1Part2Routes } from "./mf-monthwise-1-2";

export function registerMFMonthwiPart1Routes(app: Express): void {
	registerMFMonthwiPart1Part1Routes(app);
	registerMFMonthwiPart1Part2Routes(app);
}
