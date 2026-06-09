import { db } from "../../db";
import { irisSessions } from "@shared/schema";
import { desc } from "drizzle-orm";
import { logger } from "../../logger";

interface IrisToken {
	token: string;
	expiresAt: number;
}

export class IrisAuthManager {
	private tokenData: IrisToken | null = null;
	private dbTokenLoaded = false;

	get isConfigured(): boolean {
		return !!(
			(process.env.IRIS_USERNAME || process.env.KFINTECH_USERNAME) &&
			(process.env.IRIS_PASSWORD || process.env.KFINTECH_PASSWORD)
		);
	}

	getCredentials() {
		return {
			username: process.env.IRIS_USERNAME || process.env.KFINTECH_USERNAME,
			password: process.env.IRIS_PASSWORD || process.env.KFINTECH_PASSWORD,
		};
	}

	async saveToken(token: string, expiresAt: number): Promise<void> {
		try {
			await db.delete(irisSessions);
			await db.insert(irisSessions).values({
				token,
				expiresAt: new Date(expiresAt),
				refreshedAt: new Date(),
			});
			this.tokenData = { token, expiresAt };
		} catch (err: any) {
			logger.warn("[IRIS] Token DB save failed (non-fatal)", {
				error: err?.message,
			});
		}
	}

	async loadToken(): Promise<IrisToken | null> {
		if (this.dbTokenLoaded && this.tokenData) return this.tokenData;
		this.dbTokenLoaded = true;
		try {
			const [row] = await db
				.select()
				.from(irisSessions)
				.orderBy(desc(irisSessions.refreshedAt))
				.limit(1);

			if (!row) return null;

			const expiresAt = row.expiresAt.getTime();
			if (Date.now() < expiresAt - 60_000) {
				this.tokenData = { token: row.token, expiresAt };
				logger.debug("[IRIS] Token restored from DB", {
					expiresAt: new Date(expiresAt).toISOString(),
				});
				return this.tokenData;
			}
			logger.info(
				"[IRIS] Persisted token expired — re-authentication required",
			);
		} catch (err: any) {
			logger.warn("[IRIS] Token DB load failed (non-fatal)", {
				error: err?.message,
			});
		}
		return null;
	}

	isTokenValid(): boolean {
		if (!this.tokenData) return false;
		return Date.now() < this.tokenData.expiresAt - 60000;
	}

	getToken(): string | null {
		if (this.isTokenValid() && this.tokenData) {
			return this.tokenData.token;
		}
		return null;
	}
}

export const irisAuthManager = new IrisAuthManager();
