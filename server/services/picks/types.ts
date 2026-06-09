import {
	PickCategory,
	PickStatus,
	ScoreBreakdown,
	DailyPickData,
	PickOfTheDayService,
} from "../pick-of-the-day-service";

export interface StrategyContext {
	today: string;
	regime: string | null;
	recentIds: Set<string>;
	service: PickOfTheDayService;
}

export interface IPickStrategy {
	category: PickCategory;
	generate(
		context: StrategyContext,
	): Promise<DailyPickData | DailyPickData[] | null>;
	score(instrument: any, enriched?: any): number | Promise<number>;
	getLivePrice(instrumentId: string): Promise<number | null>;
	refresh?(pick: DailyPickData): Promise<number | null>;
}
