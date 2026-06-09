import { draftStorage, QueuedAction } from "@/lib/draft-storage";
import { apiRequest } from "@/lib/queryClient";

export interface SyncResult {
	success: boolean;
	action: QueuedAction;
	error?: string;
}

const BLOCKED_ACTIONS = [
	"/api/orders",
	"/api/trade",
	"/api/execute",
	"/api/payment",
	"/api/submit",
	"/api/consent",
	"/api/kyc/submit",
	"/api/transactions",
];

function isBlockedAction(endpoint: string): boolean {
	return BLOCKED_ACTIONS.some((blocked) => endpoint.includes(blocked));
}

function generateIdempotencyKey(): string {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
}

export class ActionQueueService {
	private isProcessing = false;
	private processingPromise: Promise<void> | null = null;

	async queueAction(
		userId: string,
		role: string,
		actionType: string,
		endpoint: string,
		method: "POST" | "PUT" | "PATCH" | "DELETE",
		payload: Record<string, any>,
		networkState: "online" | "offline" | "slow",
		maxRetries: number = 3,
	): Promise<QueuedAction | null> {
		if (isBlockedAction(endpoint)) {
			console.warn(
				"[ActionQueue] Blocked action queuing for execution endpoint:",
				endpoint,
			);
			return null;
		}

		const action = await draftStorage.queueAction({
			idempotencyKey: generateIdempotencyKey(),
			userId,
			role,
			actionType,
			endpoint,
			method,
			payload,
			maxRetries,
			networkState,
		});

		console.log("[ActionQueue] Action queued:", action.id);
		return action;
	}

	async processQueue(userId: string): Promise<SyncResult[]> {
		if (this.isProcessing) {
			await this.processingPromise;
			return [];
		}

		this.isProcessing = true;
		const results: SyncResult[] = [];

		this.processingPromise = (async () => {
			try {
				const pendingActions = await draftStorage.getPendingActions(userId);
				console.log(
					`[ActionQueue] Processing ${pendingActions.length} pending actions`,
				);

				for (const action of pendingActions) {
					const result = await this.processAction(action);
					results.push(result);

					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			} finally {
				this.isProcessing = false;
				this.processingPromise = null;
			}
		})();

		await this.processingPromise;
		return results;
	}

	private async processAction(action: QueuedAction): Promise<SyncResult> {
		console.log(`[ActionQueue] Processing action: ${action.id}`);

		if (action.retryCount >= action.maxRetries) {
			await draftStorage.updateActionStatus(
				action.id,
				"failed",
				"Max retries exceeded",
			);
			return {
				success: false,
				action,
				error: "Max retries exceeded",
			};
		}

		await draftStorage.updateActionStatus(action.id, "processing");

		try {
			const headers: Record<string, string> = {
				"X-Idempotency-Key": action.idempotencyKey,
				"X-Network-State": "online",
				"X-Queued-At": action.timestamp.toString(),
				"Content-Type": "application/json",
			};

			await apiRequest(action.endpoint, {
				method: action.method,
				headers,
				body: JSON.stringify(action.payload),
			});

			await draftStorage.updateActionStatus(action.id, "completed");
			console.log(`[ActionQueue] Action completed: ${action.id}`);

			return {
				success: true,
				action,
			};
		} catch (error: any) {
			const errorMessage = error?.message || "Unknown error";

			if (this.isRetryableError(error)) {
				await draftStorage.updateActionStatus(
					action.id,
					"pending",
					errorMessage,
				);
				console.log(`[ActionQueue] Action will retry: ${action.id}`);
			} else {
				await draftStorage.updateActionStatus(
					action.id,
					"failed",
					errorMessage,
				);
				console.error(
					`[ActionQueue] Action failed permanently: ${action.id}`,
					error,
				);
			}

			return {
				success: false,
				action,
				error: errorMessage,
			};
		}
	}

	private isRetryableError(error: any): boolean {
		if (!error) return true;

		const status = error.status || error.statusCode;
		if (status) {
			if (status === 409) return false;
			if (status === 400) return false;
			if (status === 401) return false;
			if (status === 403) return false;
			if (status >= 500) return true;
			if (status === 429) return true;
		}

		if (error.name === "TypeError" && error.message?.includes("fetch")) {
			return true;
		}

		return true;
	}

	async getPendingCount(userId: string): Promise<number> {
		const actions = await draftStorage.getPendingActions(userId);
		return actions.length;
	}

	async clearCompletedActions(userId: string): Promise<void> {
		const actions = await draftStorage.getPendingActions(userId);
		const completed = actions.filter((a) => a.status === "completed");

		for (const action of completed) {
			await draftStorage.deleteAction(action.id);
		}
	}
}

export const actionQueueService = new ActionQueueService();

export function startSyncListener(userId: string): () => void {
	const handleOnline = () => {
		console.log("[ActionQueue] Connection restored, processing queue...");
		actionQueueService.processQueue(userId);
	};

	const handleSyncActions = () => {
		console.log("[ActionQueue] Sync event received, processing queue...");
		actionQueueService.processQueue(userId);
	};

	window.addEventListener("online", handleOnline);
	window.addEventListener("syncActions", handleSyncActions);

	return () => {
		window.removeEventListener("online", handleOnline);
		window.removeEventListener("syncActions", handleSyncActions);
	};
}
