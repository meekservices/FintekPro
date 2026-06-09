import { BankConnector } from "@shared/schema";
import { BaseBankConnector } from "./base-connector";
import { APIBankConnector } from "./api-connector";
import { SFTPBankConnector } from "./sftp-connector";
import { PortalBankConnector } from "./portal-connector";
import { db } from "../../db";
import { bankConnectors } from "@shared/schema";
import { eq } from "drizzle-orm";

class BankConnectorFactory {
	private connectorCache: Map<string, BaseBankConnector> = new Map();

	async getConnector(bankCode: string): Promise<BaseBankConnector | null> {
		if (this.connectorCache.has(bankCode)) {
			return this.connectorCache.get(bankCode)!;
		}

		const [config] = await db
			.select()
			.from(bankConnectors)
			.where(eq(bankConnectors.bankCode, bankCode))
			.limit(1);

		if (!config) {
			console.error(`Bank connector not found for: ${bankCode}`);
			return null;
		}

		const connector = this.createConnector(config);
		if (connector) {
			this.connectorCache.set(bankCode, connector);
		}

		return connector;
	}

	private createConnector(config: BankConnector): BaseBankConnector | null {
		switch (config.connectorType) {
			case "api":
				return new APIBankConnector(config);
			case "sftp":
				return new SFTPBankConnector(config);
			case "portal":
				return new PortalBankConnector(config);
			case "email":
				return new PortalBankConnector(config);
			case "webhook":
				return new APIBankConnector(config);
			default:
				console.error(`Unknown connector type: ${config.connectorType}`);
				return null;
		}
	}

	clearCache(): void {
		this.connectorCache.clear();
	}

	removeFromCache(bankCode: string): void {
		this.connectorCache.delete(bankCode);
	}
}

export const bankConnectorFactory = new BankConnectorFactory();
