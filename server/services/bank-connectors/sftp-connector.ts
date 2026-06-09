import {
	BaseBankConnector,
	BankSubmissionPayload,
	BankSubmissionResponse,
	BankStatusResponse,
} from "./base-connector";
import { BankConnector } from "@shared/schema";

export class SFTPBankConnector extends BaseBankConnector {
	get connectorType(): string {
		return "sftp";
	}

	async submitApplication(
		payload: BankSubmissionPayload,
	): Promise<BankSubmissionResponse> {
		const { application, routingHistory } = payload;

		try {
			const requestId = this.generateRequestId();
			const fileName = this.generateFileName(application);
			const fileContent = this.buildCSVContent(application);

			console.log(
				`[${this.config.bankCode}] Submitting loan application via SFTP`,
				{
					applicationNumber: application.applicationNumber,
					requestId,
					fileName,
					host: this.config.sftpHost,
					path: this.config.sftpPath,
				},
			);

			return {
				success: true,
				bankReference: `${this.config.bankCode}-${requestId}`,
				message: `File ${fileName} uploaded successfully (simulated)`,
				expectedResponseTime: this.config.expectedResponseTime || 72,
			};
		} catch (error: any) {
			console.error(
				`[${this.config.bankCode}] SFTP submission failed:`,
				error.message,
			);
			return {
				success: false,
				error: error.message,
			};
		}
	}

	async checkStatus(bankReference: string): Promise<BankStatusResponse> {
		console.log(
			`[${this.config.bankCode}] Checking SFTP response files for reference:`,
			bankReference,
		);

		return {
			bankStatus: "pending",
			bankReference,
		};
	}

	async validateCredentials(): Promise<boolean> {
		if (!this.config.sftpHost) {
			console.log(`[${this.config.bankCode}] SFTP host not configured`);
			return true;
		}

		return true;
	}

	private generateFileName(application: any): string {
		const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
		return `LOAN_${application.applicationNumber}_${date}.csv`;
	}

	private buildCSVContent(application: any): string {
		const headers = [
			"ReferenceNumber",
			"ApplicantName",
			"Mobile",
			"Email",
			"PAN",
			"EmploymentType",
			"MonthlyIncome",
			"LoanType",
			"LoanAmount",
			"Tenure",
		];

		const values = [
			application.applicationNumber,
			application.applicantName,
			application.applicantPhone,
			application.applicantEmail || "",
			application.applicantPan || "",
			application.employmentType,
			application.monthlyIncome,
			application.loanType,
			application.requestedAmount,
			application.requestedTenure,
		];

		return `${headers.join(",")}\n${values.join(",")}`;
	}
}
