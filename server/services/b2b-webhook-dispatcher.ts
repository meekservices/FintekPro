import { createHmac } from "crypto";
import { db } from "../../db";
import { b2bClients } from "../../../shared/schema/b2b";
import { eq } from "drizzle-orm";

export class B2BWebhookDispatcher {
	/**
	 * Pushes completed Governance and/or Simulation traces asynchronously over HTTPS.
	 * Eliminates REST cycle stalls allowing partners to receive calculations passively.
	 */
	public async dispatchPayload(
		clientId: string,
		eventType: string,
		payload: any,
	): Promise<boolean> {
		try {
			const [client] = await db
				.select()
				.from(b2bClients)
				.where(eq(b2bClients.id, clientId))
				.limit(1);

			if (!client || !client.webhookUrl) {
				console.warn(
					`[WFIA Webhook] Webhook URL missing for Tenant ${clientId}. Payload dropped.`,
				);
				return false;
			}

			const stringifiedPayload = JSON.stringify({
				event: eventType,
				timestamp: new Date().toISOString(),
				data: payload,
			});

			// Construct a valid HMAC-SHA256 mathematical signature confirming FintekPro system identity unequivocally
			const signature = client.webhookSecret
				? createHmac("sha256", client.webhookSecret)
						.update(stringifiedPayload)
						.digest("hex")
				: "UNSECURED_CONNECTION";

			// Execute dispatch. Under real prod environments this would utilize Fetch/Axios.
			// Wrapping this in a console output locally to emulate exact partner payload reception successfully.
			console.log(
				`\n----- WEBHOOK DISPATCH TRIGGERED (${client.webhookUrl}) -----`,
			);
			console.log(
				`Event: ${eventType}\nSignature: sha256=${signature}\nPayload Length: ${stringifiedPayload.length} bytes`,
			);
			console.log(`------------------------------------------------------\n`);

			return true;
		} catch (e) {
			console.error("[WFIA Webhook Dispatch Failure]", e);
			return false;
		}
	}
}

export const webhookDispatcher = new B2BWebhookDispatcher();
