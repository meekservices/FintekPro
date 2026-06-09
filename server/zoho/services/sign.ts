import { ZohoApiClient } from "../api-client";

interface ZohoSignDocument {
	request_id?: string;
	request_name: string;
	request_status?:
		| "draft"
		| "inprogress"
		| "completed"
		| "declined"
		| "expired"
		| "recalled";
	owner_email?: string;
	created_time?: string;
	modified_time?: string;
	expiration_days?: number;
	is_sequential?: boolean;
	notes?: string;
	reminder_period?: number;
	actions?: ZohoSignAction[];
	document_ids?: string[];
}

interface ZohoSignAction {
	action_id?: string;
	recipient_email: string;
	recipient_name: string;
	action_type: "sign" | "view" | "approve" | "in-person-sign";
	signing_order?: number;
	action_status?: "waiting" | "signed" | "declined" | "expired";
	signed_time?: string;
	fields?: ZohoSignField[];
}

interface ZohoSignField {
	field_type:
		| "signature"
		| "initials"
		| "textfield"
		| "date"
		| "checkbox"
		| "dropdown"
		| "email"
		| "name"
		| "company";
	field_name: string;
	is_mandatory?: boolean;
	x_coord?: number;
	y_coord?: number;
	page_no?: number;
	width?: number;
	height?: number;
	default_value?: string;
}

interface ZohoSignTemplate {
	template_id: string;
	template_name: string;
	template_type?: string;
	is_active?: boolean;
	created_time?: string;
	modified_time?: string;
	owner_email?: string;
	actions?: ZohoSignAction[];
}

interface CreateSignRequestOptions {
	requestName: string;
	documents: Array<{ content: Buffer | string; fileName: string }>;
	recipients: Array<{
		email: string;
		name: string;
		actionType?: "sign" | "view" | "approve";
		signingOrder?: number;
	}>;
	expirationDays?: number;
	isSequential?: boolean;
	notes?: string;
	reminderPeriod?: number;
}

export class ZohoSignService {
	private client: ZohoApiClient;

	constructor(connectionId: string, dataCenter: string = "in") {
		this.client = new ZohoApiClient(connectionId, "Sign", dataCenter);
	}

	// ==================== Documents ====================

	async getDocuments(options?: {
		status?:
			| "draft"
			| "inprogress"
			| "completed"
			| "declined"
			| "expired"
			| "recalled";
		page?: number;
		limit?: number;
		sortBy?: "created_time" | "modified_time";
		sortOrder?: "asc" | "desc";
	}): Promise<ZohoSignDocument[]> {
		// Zoho Sign API v1 requires page_context as form data, but GET requests don't support form data
		// For simple listing, we can call without pagination parameters
		const response = await this.client.get("/api/v1/requests");
		return response.data?.requests || [];
	}

	async getDocumentDetails(
		requestId: string,
	): Promise<ZohoSignDocument | null> {
		const response = await this.client.get(`/api/v1/requests/${requestId}`);
		return response.data?.requests || null;
	}

	async createSignRequest(
		options: CreateSignRequestOptions,
	): Promise<ZohoSignDocument> {
		const formData = new FormData();

		const requestData = {
			requests: {
				request_name: options.requestName,
				expiration_days: options.expirationDays || 30,
				is_sequential: options.isSequential ?? true,
				notes: options.notes || "",
				reminder_period: options.reminderPeriod || 3,
				actions: options.recipients.map((r, index) => ({
					recipient_email: r.email,
					recipient_name: r.name,
					action_type: r.actionType || "sign",
					signing_order: r.signingOrder || index + 1,
					verify_recipient: true,
				})),
			},
		};

		formData.append("data", JSON.stringify(requestData));

		for (const doc of options.documents) {
			const blob =
				typeof doc.content === "string"
					? new Blob([Buffer.from(doc.content, "base64")])
					: new Blob([new Uint8Array(doc.content)]);
			formData.append("file", blob, doc.fileName);
		}

		const response = await this.client.post("/api/v1/requests", formData, {
			headers: { "Content-Type": "multipart/form-data" },
		});

		if (!response.data?.requests?.request_id) {
			throw new Error("Failed to create sign request");
		}

		return response.data.requests;
	}

	async submitForSignature(requestId: string): Promise<boolean> {
		const response = await this.client.post(
			`/api/v1/requests/${requestId}/submit`,
			{},
		);
		return response.data?.requests?.request_status === "inprogress";
	}

	async recallDocument(requestId: string): Promise<boolean> {
		const response = await this.client.post(
			`/api/v1/requests/${requestId}/recall`,
			{},
		);
		return response.data?.status === "success";
	}

	async deleteDocument(requestId: string): Promise<boolean> {
		const response = await this.client.delete(`/api/v1/requests/${requestId}`);
		return Number(response.status) === 200 || Number(response.status) === 204;
	}

	async downloadSignedDocument(requestId: string): Promise<Buffer> {
		const response = await this.client.get(
			`/api/v1/requests/${requestId}/pdf`,
			{
				responseType: "arraybuffer",
			},
		);
		return Buffer.from(response.data);
	}

	async remindRecipient(requestId: string, actionId: string): Promise<boolean> {
		const response = await this.client.post(
			`/api/v1/requests/${requestId}/actions/${actionId}/remind`,
			{},
		);
		return response.data?.status === "success";
	}

	// ==================== Templates ====================

	async getTemplates(): Promise<ZohoSignTemplate[]> {
		const response = await this.client.get("/api/v1/templates");
		return response.data?.templates || [];
	}

	async getTemplateDetails(
		templateId: string,
	): Promise<ZohoSignTemplate | null> {
		const response = await this.client.get(`/api/v1/templates/${templateId}`);
		return response.data?.templates || null;
	}

	async createFromTemplate(
		templateId: string,
		options: {
			requestName: string;
			recipients: Array<{ email: string; name: string; role?: string }>;
			prefillData?: Record<string, string>;
		},
	): Promise<ZohoSignDocument> {
		const payload = {
			templates: {
				request_name: options.requestName,
				actions: options.recipients.map((r) => ({
					recipient_email: r.email,
					recipient_name: r.name,
					role: r.role,
				})),
				prefill_data: options.prefillData || {},
			},
		};

		const response = await this.client.post(
			`/api/v1/templates/${templateId}/createdocument`,
			payload,
		);

		if (!response.data?.requests?.request_id) {
			throw new Error("Failed to create document from template");
		}

		return response.data.requests;
	}

	// ==================== FintekPro Integration ====================

	async createKYCSignRequest(options: {
		clientName: string;
		clientEmail: string;
		documentType:
			| "kyc_form"
			| "investment_agreement"
			| "nominee_form"
			| "fatca_declaration";
		documentContent: Buffer;
		agentEmail?: string;
		agentName?: string;
	}): Promise<{ requestId: string; signUrl: string }> {
		const documentNames: Record<string, string> = {
			kyc_form: "KYC Application Form",
			investment_agreement: "Investment Agreement",
			nominee_form: "Nominee Declaration Form",
			fatca_declaration: "FATCA/CRS Declaration",
		};

		const recipients: CreateSignRequestOptions["recipients"] = [
			{
				email: options.clientEmail,
				name: options.clientName,
				actionType: "sign",
				signingOrder: 1,
			},
		];

		if (options.agentEmail && options.agentName) {
			recipients.push({
				email: options.agentEmail,
				name: options.agentName,
				actionType: "view",
				signingOrder: 2,
			});
		}

		const signRequest = await this.createSignRequest({
			requestName: `${documentNames[options.documentType]} - ${options.clientName}`,
			documents: [
				{
					content: options.documentContent,
					fileName: `${options.documentType}_${Date.now()}.pdf`,
				},
			],
			recipients,
			expirationDays: 30,
			isSequential: true,
			notes: `Please review and sign the ${documentNames[options.documentType]}`,
			reminderPeriod: 3,
		});

		await this.submitForSignature(signRequest.request_id!);

		return {
			requestId: signRequest.request_id!,
			signUrl: `https://sign.zoho.in/signrequest/${signRequest.request_id}`,
		};
	}

	async createInvestmentAgreement(options: {
		clientName: string;
		clientEmail: string;
		investmentType: string;
		investmentAmount: number;
		documentContent: Buffer;
	}): Promise<{ requestId: string; status: string }> {
		const signRequest = await this.createSignRequest({
			requestName: `Investment Agreement - ${options.investmentType} - ${options.clientName}`,
			documents: [
				{
					content: options.documentContent,
					fileName: `investment_agreement_${Date.now()}.pdf`,
				},
			],
			recipients: [
				{
					email: options.clientEmail,
					name: options.clientName,
					actionType: "sign",
					signingOrder: 1,
				},
			],
			expirationDays: 15,
			isSequential: true,
			notes: `Investment Agreement for ${options.investmentType} worth ₹${options.investmentAmount.toLocaleString("en-IN")}`,
		});

		await this.submitForSignature(signRequest.request_id!);

		return {
			requestId: signRequest.request_id!,
			status: "sent_for_signature",
		};
	}

	async getSignatureStatus(requestId: string): Promise<{
		status: string;
		signedBy: Array<{ name: string; email: string; signedAt?: string }>;
		pendingFrom: Array<{ name: string; email: string }>;
	}> {
		const document = await this.getDocumentDetails(requestId);

		if (!document) {
			throw new Error("Document not found");
		}

		const signedBy: Array<{ name: string; email: string; signedAt?: string }> =
			[];
		const pendingFrom: Array<{ name: string; email: string }> = [];

		for (const action of document.actions || []) {
			if (action.action_status === "signed") {
				signedBy.push({
					name: action.recipient_name,
					email: action.recipient_email,
					signedAt: action.signed_time,
				});
			} else if (action.action_status === "waiting") {
				pendingFrom.push({
					name: action.recipient_name,
					email: action.recipient_email,
				});
			}
		}

		return {
			status: document.request_status || "unknown",
			signedBy,
			pendingFrom,
		};
	}

	async getCompletedKYCDocuments(
		clientEmail: string,
	): Promise<ZohoSignDocument[]> {
		const allDocs = await this.getDocuments({ status: "completed" });

		return allDocs.filter((doc) =>
			doc.actions?.some(
				(action) =>
					action.recipient_email.toLowerCase() === clientEmail.toLowerCase(),
			),
		);
	}
}

export const createZohoSignService = (
	connectionId: string,
	dataCenter: string = "in",
) => {
	return new ZohoSignService(connectionId, dataCenter);
};
