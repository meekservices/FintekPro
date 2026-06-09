import { db } from "../db";
import { kycWebhookEvents } from "@shared/schema";
import { eq, and, lte, desc, ne } from "drizzle-orm";

interface WebhookEventParams {
	provider: string;
	eventType: string;
	referenceId?: string;
	sessionId?: string;
	payload: any;
}

type WebhookHandler = (
	event: any,
) => Promise<{ success: boolean; error?: string }>;

class KycWebhookService {
	private handlers: Map<string, WebhookHandler> = new Map();
	private retryIntervals = [30, 120, 300, 900, 3600]; // seconds: 30s, 2m, 5m, 15m, 1h

	constructor() {
		console.log("✅ KYC Webhook & Async Retry Service initialized");
		console.log("   Providers: Sandbox, TruthScreen");
		console.log("   Max retries: 5, DLQ enabled");

		this.startRetryProcessor();
	}

	registerHandler(eventType: string, handler: WebhookHandler): void {
		this.handlers.set(eventType, handler);
	}

	async receiveEvent(params: WebhookEventParams): Promise<{
		success: boolean;
		eventId?: string;
		error?: string;
	}> {
		try {
			const [event] = await db
				.insert(kycWebhookEvents)
				.values({
					provider: params.provider,
					eventType: params.eventType,
					referenceId: params.referenceId || null,
					sessionId: params.sessionId || null,
					payload: params.payload,
					status: "PENDING",
					attempts: 0,
					maxAttempts: 5,
				})
				.returning();

			this.processEvent(event.id).catch((err) => {
				console.error(
					`[WebhookService] Error processing event ${event.id}:`,
					err,
				);
			});

			return { success: true, eventId: event.id };
		} catch (error) {
			console.error("[WebhookService] Error receiving event:", error);
			return { success: false, error: "Failed to receive webhook event" };
		}
	}

	private async processEvent(eventId: string): Promise<void> {
		try {
			const [event] = await db
				.select()
				.from(kycWebhookEvents)
				.where(eq(kycWebhookEvents.id, eventId))
				.limit(1);

			if (!event) return;

			const handler = this.handlers.get(event.eventType);
			if (!handler) {
				await db
					.update(kycWebhookEvents)
					.set({
						status: "FAILED",
						lastError: `No handler registered for event type: ${event.eventType}`,
						attempts: (event.attempts ?? 0) + 1,
					})
					.where(eq(kycWebhookEvents.id, eventId));
				return;
			}

			await db
				.update(kycWebhookEvents)
				.set({ status: "PROCESSING", attempts: (event.attempts ?? 0) + 1 })
				.where(eq(kycWebhookEvents.id, eventId));

			const result = await handler(event);

			if (result.success) {
				await db
					.update(kycWebhookEvents)
					.set({ status: "COMPLETED", processedAt: new Date() })
					.where(eq(kycWebhookEvents.id, eventId));
			} else {
				const attempts = (event.attempts ?? 0) + 1;
				const maxAttempts = event.maxAttempts ?? 5;

				if (attempts >= maxAttempts) {
					await db
						.update(kycWebhookEvents)
						.set({
							status: "DLQ",
							lastError: result.error || "Max retries exceeded",
							dlqAt: new Date(),
						})
						.where(eq(kycWebhookEvents.id, eventId));
				} else {
					const retryDelay =
						this.retryIntervals[
							Math.min(attempts - 1, this.retryIntervals.length - 1)
						];
					const nextRetry = new Date(Date.now() + retryDelay * 1000);

					await db
						.update(kycWebhookEvents)
						.set({
							status: "PENDING",
							lastError: result.error || "Processing failed",
							nextRetryAt: nextRetry,
						})
						.where(eq(kycWebhookEvents.id, eventId));
				}
			}
		} catch (error) {
			console.error(
				`[WebhookService] Error processing event ${eventId}:`,
				error,
			);
		}
	}

	private startRetryProcessor(): void {
		setInterval(async () => {
			try {
				const pendingEvents = await db
					.select()
					.from(kycWebhookEvents)
					.where(
						and(
							eq(kycWebhookEvents.status, "PENDING"),
							lte(kycWebhookEvents.nextRetryAt, new Date()),
						),
					)
					.limit(10);

				for (const event of pendingEvents) {
					this.processEvent(event.id).catch((err) => {
						console.error(`[WebhookService] Retry error for ${event.id}:`, err);
					});
				}
			} catch (error) {
				// Silent retry - don't spam logs
			}
		}, 60000); // Check every minute
	}

	async replayFromDLQ(eventId: string): Promise<{
		success: boolean;
		error?: string;
	}> {
		try {
			const [event] = await db
				.select()
				.from(kycWebhookEvents)
				.where(
					and(
						eq(kycWebhookEvents.id, eventId),
						eq(kycWebhookEvents.status, "DLQ"),
					),
				)
				.limit(1);

			if (!event) {
				return { success: false, error: "Event not found in DLQ" };
			}

			await db
				.update(kycWebhookEvents)
				.set({
					status: "PENDING",
					attempts: 0,
					dlqAt: null,
					nextRetryAt: null,
					lastError: null,
				})
				.where(eq(kycWebhookEvents.id, eventId));

			this.processEvent(eventId).catch((err) => {
				console.error(`[WebhookService] DLQ replay error for ${eventId}:`, err);
			});

			return { success: true };
		} catch (error) {
			console.error("[WebhookService] Error replaying from DLQ:", error);
			return { success: false, error: "Failed to replay from DLQ" };
		}
	}

	async getDLQEvents(): Promise<any[]> {
		try {
			return await db
				.select()
				.from(kycWebhookEvents)
				.where(eq(kycWebhookEvents.status, "DLQ"))
				.orderBy(desc(kycWebhookEvents.dlqAt));
		} catch {
			return [];
		}
	}

	async getEventsByProvider(provider: string): Promise<any[]> {
		try {
			return await db
				.select()
				.from(kycWebhookEvents)
				.where(eq(kycWebhookEvents.provider, provider))
				.orderBy(desc(kycWebhookEvents.createdAt))
				.limit(50);
		} catch {
			return [];
		}
	}

	async getStats(): Promise<{
		pending: number;
		processing: number;
		completed: number;
		failed: number;
		dlq: number;
	}> {
		try {
			const all = await db.select().from(kycWebhookEvents);
			return {
				pending: all.filter((e) => e.status === "PENDING").length,
				processing: all.filter((e) => e.status === "PROCESSING").length,
				completed: all.filter((e) => e.status === "COMPLETED").length,
				failed: all.filter((e) => e.status === "FAILED").length,
				dlq: all.filter((e) => e.status === "DLQ").length,
			};
		} catch {
			return { pending: 0, processing: 0, completed: 0, failed: 0, dlq: 0 };
		}
	}
}

export const kycWebhookService = new KycWebhookService();
