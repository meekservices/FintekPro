import { Express } from "express";
import { registerMFMonthwiPart2Part1Routes } from "./mf-monthwise-2-1";
import { registerMFMonthwiPart2Part2Routes } from "./mf-monthwise-2-2";

export function registerMFMonthwiPart2Routes(app: Express): void {
	registerMFMonthwiPart2Part1Routes(app);
	registerMFMonthwiPart2Part2Routes(app);
}
