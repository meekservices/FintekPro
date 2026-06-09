import CryptoJS from "crypto-js";

const DB_NAME = "fintekpro-drafts";
const DB_VERSION = 1;
const DRAFTS_STORE = "drafts";
const ACTIONS_STORE = "actions";

export type DraftStatus = "pending" | "syncing" | "synced" | "failed";

export interface DraftMetadata {
	id: string;
	userId: string;
	role: "client" | "agent" | "admin" | "partner";
	module: string;
	formType: string;
	timestamp: number;
	lastModified: number;
	syncStatus: DraftStatus;
	version: number;
	checksum: string;
}

export interface Draft extends DraftMetadata {
	data: Record<string, any>;
	encrypted: boolean;
}

export interface QueuedAction {
	id: string;
	idempotencyKey: string;
	userId: string;
	role: string;
	actionType: string;
	endpoint: string;
	method: "POST" | "PUT" | "PATCH" | "DELETE";
	payload: Record<string, any>;
	timestamp: number;
	retryCount: number;
	maxRetries: number;
	status: "pending" | "processing" | "completed" | "failed";
	errorMessage?: string;
	networkState: "online" | "offline" | "slow";
}

const ENCRYPTION_KEY_PREFIX = "fintekpro_draft_key_";

function getEncryptionKey(userId: string): string {
	const storedKey = localStorage.getItem(`${ENCRYPTION_KEY_PREFIX}${userId}`);
	if (storedKey) return storedKey;

	const newKey = CryptoJS.lib.WordArray.random(32).toString();
	localStorage.setItem(`${ENCRYPTION_KEY_PREFIX}${userId}`, newKey);
	return newKey;
}

function encryptData(data: Record<string, any>, userId: string): string {
	const key = getEncryptionKey(userId);
	return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}

function decryptData(
	encryptedData: string,
	userId: string,
): Record<string, any> {
	const key = getEncryptionKey(userId);
	const bytes = CryptoJS.AES.decrypt(encryptedData, key);
	return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

function generateChecksum(data: Record<string, any>): string {
	return CryptoJS.MD5(JSON.stringify(data)).toString();
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
				const draftsStore = db.createObjectStore(DRAFTS_STORE, {
					keyPath: "id",
				});
				draftsStore.createIndex("userId", "userId", { unique: false });
				draftsStore.createIndex("module", "module", { unique: false });
				draftsStore.createIndex("syncStatus", "syncStatus", { unique: false });
				draftsStore.createIndex("userId_module", ["userId", "module"], {
					unique: false,
				});
			}

			if (!db.objectStoreNames.contains(ACTIONS_STORE)) {
				const actionsStore = db.createObjectStore(ACTIONS_STORE, {
					keyPath: "id",
				});
				actionsStore.createIndex("userId", "userId", { unique: false });
				actionsStore.createIndex("status", "status", { unique: false });
				actionsStore.createIndex("idempotencyKey", "idempotencyKey", {
					unique: true,
				});
			}
		};
	});
}

export class DraftStorage {
	private autoSaveInterval: number | null = null;
	private pendingChanges: Map<
		string,
		{ data: Record<string, any>; metadata: Partial<DraftMetadata> }
	> = new Map();

	async saveDraft(
		id: string,
		data: Record<string, any>,
		metadata: Omit<
			DraftMetadata,
			| "id"
			| "timestamp"
			| "lastModified"
			| "syncStatus"
			| "version"
			| "checksum"
		>,
	): Promise<Draft> {
		const db = await openDB();

		const existingDraft = await this.getDraft(id);
		const version = existingDraft ? existingDraft.version + 1 : 1;
		const checksum = generateChecksum(data);

		if (existingDraft && existingDraft.checksum === checksum) {
			return existingDraft;
		}

		const encryptedData = encryptData(data, metadata.userId);

		const draft: Draft = {
			id,
			...metadata,
			data: { encrypted: encryptedData },
			encrypted: true,
			timestamp: existingDraft?.timestamp || Date.now(),
			lastModified: Date.now(),
			syncStatus: "pending",
			version,
			checksum,
		};

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([DRAFTS_STORE], "readwrite");
			const store = transaction.objectStore(DRAFTS_STORE);
			const request = store.put(draft);

			request.onsuccess = () => resolve(draft);
			request.onerror = () => reject(request.error);
		});
	}

	async getDraft(id: string): Promise<Draft | null> {
		const db = await openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([DRAFTS_STORE], "readonly");
			const store = transaction.objectStore(DRAFTS_STORE);
			const request = store.get(id);

			request.onsuccess = () => {
				const draft = request.result;
				if (draft?.encrypted) {
					try {
						draft.data = decryptData(draft.data.encrypted, draft.userId);
						draft.encrypted = false;
					} catch (error) {
						console.error("Failed to decrypt draft:", error);
						resolve(null);
						return;
					}
				}
				resolve(draft || null);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async getDraftsByModule(userId: string, module: string): Promise<Draft[]> {
		const db = await openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([DRAFTS_STORE], "readonly");
			const store = transaction.objectStore(DRAFTS_STORE);
			const index = store.index("userId_module");
			const request = index.getAll([userId, module]);

			request.onsuccess = () => {
				const drafts = request.result.map((draft: Draft) => {
					if (draft.encrypted) {
						try {
							draft.data = decryptData(draft.data.encrypted, draft.userId);
							draft.encrypted = false;
						} catch (error) {
							console.error("Failed to decrypt draft:", error);
						}
					}
					return draft;
				});
				resolve(drafts);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async getPendingDrafts(userId: string): Promise<Draft[]> {
		const db = await openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([DRAFTS_STORE], "readonly");
			const store = transaction.objectStore(DRAFTS_STORE);
			const index = store.index("syncStatus");
			const request = index.getAll("pending");

			request.onsuccess = () => {
				const drafts = request.result
					.filter((d: Draft) => d.userId === userId)
					.map((draft: Draft) => {
						if (draft.encrypted) {
							try {
								draft.data = decryptData(draft.data.encrypted, draft.userId);
								draft.encrypted = false;
							} catch (error) {
								console.error("Failed to decrypt draft:", error);
							}
						}
						return draft;
					});
				resolve(drafts);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async updateDraftStatus(id: string, status: DraftStatus): Promise<void> {
		const db = await openDB();
		const draft = await this.getDraft(id);

		if (!draft) return;

		draft.syncStatus = status;
		draft.lastModified = Date.now();
		draft.encrypted = true;
		draft.data = { encrypted: encryptData(draft.data, draft.userId) };

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([DRAFTS_STORE], "readwrite");
			const store = transaction.objectStore(DRAFTS_STORE);
			const request = store.put(draft);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	async deleteDraft(id: string): Promise<void> {
		const db = await openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([DRAFTS_STORE], "readwrite");
			const store = transaction.objectStore(DRAFTS_STORE);
			const request = store.delete(id);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	async queueAction(
		action: Omit<QueuedAction, "id" | "timestamp" | "retryCount" | "status">,
	): Promise<QueuedAction> {
		const db = await openDB();

		const queuedAction: QueuedAction = {
			...action,
			id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: Date.now(),
			retryCount: 0,
			status: "pending",
		};

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([ACTIONS_STORE], "readwrite");
			const store = transaction.objectStore(ACTIONS_STORE);
			const request = store.put(queuedAction);

			request.onsuccess = () => resolve(queuedAction);
			request.onerror = () => reject(request.error);
		});
	}

	async getPendingActions(userId: string): Promise<QueuedAction[]> {
		const db = await openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([ACTIONS_STORE], "readonly");
			const store = transaction.objectStore(ACTIONS_STORE);
			const index = store.index("status");
			const request = index.getAll("pending");

			request.onsuccess = () => {
				const actions = request.result.filter(
					(a: QueuedAction) => a.userId === userId,
				);
				resolve(actions);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async updateActionStatus(
		id: string,
		status: QueuedAction["status"],
		errorMessage?: string,
	): Promise<void> {
		const db = await openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([ACTIONS_STORE], "readwrite");
			const store = transaction.objectStore(ACTIONS_STORE);
			const getRequest = store.get(id);

			getRequest.onsuccess = () => {
				const action = getRequest.result;
				if (action) {
					action.status = status;
					if (errorMessage) action.errorMessage = errorMessage;
					if (status === "processing") action.retryCount += 1;

					const putRequest = store.put(action);
					putRequest.onsuccess = () => resolve();
					putRequest.onerror = () => reject(putRequest.error);
				} else {
					resolve();
				}
			};
			getRequest.onerror = () => reject(getRequest.error);
		});
	}

	async deleteAction(id: string): Promise<void> {
		const db = await openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([ACTIONS_STORE], "readwrite");
			const store = transaction.objectStore(ACTIONS_STORE);
			const request = store.delete(id);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	startAutoSave(
		intervalMs: number,
		getDraftData: () => {
			id: string;
			data: Record<string, any>;
			metadata: Omit<
				DraftMetadata,
				| "id"
				| "timestamp"
				| "lastModified"
				| "syncStatus"
				| "version"
				| "checksum"
			>;
		} | null,
	): void {
		this.stopAutoSave();

		this.autoSaveInterval = window.setInterval(async () => {
			const draftInfo = getDraftData();
			if (draftInfo) {
				try {
					await this.saveDraft(
						draftInfo.id,
						draftInfo.data,
						draftInfo.metadata,
					);
					console.log("[DraftStorage] Auto-saved draft:", draftInfo.id);
				} catch (error) {
					console.error("[DraftStorage] Auto-save failed:", error);
				}
			}
		}, intervalMs);
	}

	stopAutoSave(): void {
		if (this.autoSaveInterval) {
			clearInterval(this.autoSaveInterval);
			this.autoSaveInterval = null;
		}
	}

	async clearAllDrafts(userId: string): Promise<void> {
		const db = await openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([DRAFTS_STORE], "readwrite");
			const store = transaction.objectStore(DRAFTS_STORE);
			const index = store.index("userId");
			const request = index.getAllKeys(userId);

			request.onsuccess = () => {
				const keys = request.result;
				let deleted = 0;

				if (keys.length === 0) {
					resolve();
					return;
				}

				keys.forEach((key) => {
					const deleteRequest = store.delete(key);
					deleteRequest.onsuccess = () => {
						deleted++;
						if (deleted === keys.length) resolve();
					};
					deleteRequest.onerror = () => reject(deleteRequest.error);
				});
			};
			request.onerror = () => reject(request.error);
		});
	}
}

export const draftStorage = new DraftStorage();
