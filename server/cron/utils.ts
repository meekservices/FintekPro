/**
 * Shared utilities for domain cron modules.
 *
 * staggeredStart delays startup work so multiple schedulers don't all hammer
 * the DB / external APIs simultaneously when the server boots.
 */

export type StaggerFn = (name: string, fn: () => void, delayMs: number) => void;

const activeTimers: NodeJS.Timeout[] = [];

export function staggeredStart(
	name: string,
	fn: () => void,
	delayMs: number,
): void {
	const timer = setTimeout(() => {
		console.log(`🚀 [StaggeredStart] Starting ${name}...`);
		fn();
	}, delayMs);
	activeTimers.push(timer);
}

export function clearAllStaggerTimers(): void {
	activeTimers.forEach((t) => clearTimeout(t));
	activeTimers.length = 0;
}
