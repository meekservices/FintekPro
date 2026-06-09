// @ts-nocheck
import { db } from "../db";
import {
	prospectProposals,
	users,
	agents,
	prospectLeads,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface AgreementGeneratorOptions {
	proposalId: string;
	versionNumber?: number;
	includeDisclosures?: boolean;
	includeRiskWarnings?: boolean;
	watermark?: string;
}

export interface GeneratedAgreement {
	documentHtml: string;
	documentHash: string;
	generatedAt: Date;
	version: number;
	editableFields: EditableField[];
}

export interface EditableField {
	id: string;
	name: string;
	path: string;
	type: "text" | "number" | "date" | "currency" | "percentage";
	currentValue: string;
	isRequired: boolean;
	isEditable: boolean;
}

class InvestmentAgreementGenerator {
	private createDocumentHash(content: string): string {
		const crypto = require("crypto");
		return crypto.createHash("sha256").update(content).digest("hex");
	}

	private formatCurrency(amount: number, currency: string = "INR"): string {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		}).format(amount);
	}

	private formatDate(date: Date | string): string {
		const d = typeof date === "string" ? new Date(date) : date;
		return d.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "long",
			year: "numeric",
		});
	}

	async generateAgreement(
		options: AgreementGeneratorOptions,
	): Promise<GeneratedAgreement> {
		const [proposal] = await db
			.select()
			.from(prospectProposals)
			.where(eq(prospectProposals.id, options.proposalId))
			.limit(1);

		if (!proposal) {
			throw new Error("Proposal not found");
		}

		const [prospect] = await db
			.select()
			.from(prospectLeads)
			.where(eq(prospectLeads.id, proposal.prospectId))
			.limit(1);

		const [agent] = await db
			.select()
			.from(agents)
			.where(eq(agents.id, proposal.agentId))
			.limit(1);

		const recommendedProducts = (proposal.recommendedProducts || []) as any[];
		const totalInvestment = recommendedProducts.reduce(
			(sum: number, p: any) => sum + (p.proposedAmount || 0),
			0,
		);
		const version = options.versionNumber || 1;

		const editableFields: EditableField[] = [
			{
				id: "client_name",
				name: "Client Name",
				path: "client.name",
				type: "text",
				currentValue: prospect?.name || "",
				isRequired: true,
				isEditable: true,
			},
			{
				id: "client_pan",
				name: "Client PAN",
				path: "client.pan",
				type: "text",
				currentValue: prospect?.pan || "",
				isRequired: true,
				isEditable: false,
			},
			{
				id: "client_email",
				name: "Client Email",
				path: "client.email",
				type: "text",
				currentValue: prospect?.email || "",
				isRequired: true,
				isEditable: true,
			},
			{
				id: "client_mobile",
				name: "Client Mobile",
				path: "client.mobile",
				type: "text",
				currentValue: prospect?.mobile || "",
				isRequired: true,
				isEditable: true,
			},
			{
				id: "investment_amount",
				name: "Total Investment Amount",
				path: "investment.totalAmount",
				type: "currency",
				currentValue: totalInvestment.toString(),
				isRequired: true,
				isEditable: false,
			},
			{
				id: "agreement_date",
				name: "Agreement Date",
				path: "agreement.date",
				type: "date",
				currentValue: new Date().toISOString().split("T")[0],
				isRequired: true,
				isEditable: true,
			},
		];

		const documentHtml = this.generateHtmlDocument({
			proposal,
			prospect,
			agent,
			recommendedProducts,
			totalInvestment,
			version,
			watermark: options.watermark,
			includeDisclosures: options.includeDisclosures ?? true,
			includeRiskWarnings: options.includeRiskWarnings ?? true,
		});

		const documentHash = this.createDocumentHash(documentHtml);

		return {
			documentHtml,
			documentHash,
			generatedAt: new Date(),
			version,
			editableFields,
		};
	}

	private generateHtmlDocument(data: {
		proposal: any;
		prospect: any;
		agent: any;
		recommendedProducts: any[];
		totalInvestment: number;
		version: number;
		watermark?: string;
		includeDisclosures: boolean;
		includeRiskWarnings: boolean;
	}): string {
		const {
			proposal,
			prospect,
			agent,
			recommendedProducts,
			totalInvestment,
			version,
			watermark,
			includeDisclosures,
			includeRiskWarnings,
		} = data;
		const agreementNumber = `INV-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
		const agreementDate = this.formatDate(new Date());

		return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Investment Agreement - ${agreementNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      margin: 0;
      padding: 40px;
      ${watermark ? `background-image: url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="rgba(200,200,200,0.3)" font-size="48" transform="rotate(-45 200 200)">${watermark}</text></svg>`)}');` : ""}
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #2c3e50;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2c3e50;
      margin: 0;
      font-size: 24pt;
    }
    .header .subtitle {
      color: #666;
      font-size: 12pt;
      margin-top: 5px;
    }
    .agreement-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .agreement-info div {
      flex: 1;
    }
    .agreement-info label {
      font-weight: bold;
      color: #666;
      font-size: 10pt;
      display: block;
    }
    .agreement-info span {
      font-size: 11pt;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 14pt;
      font-weight: bold;
      color: #2c3e50;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
      margin-bottom: 15px;
    }
    .party-box {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    .party-box h4 {
      margin: 0 0 10px 0;
      color: #2c3e50;
    }
    .party-detail {
      display: flex;
      margin-bottom: 5px;
    }
    .party-detail label {
      width: 120px;
      font-weight: 500;
      color: #666;
    }
    .party-detail span {
      flex: 1;
    }
    .editable-field {
      background: #fffef0;
      border: 1px dashed #e6d400;
      padding: 2px 5px;
      border-radius: 2px;
    }
    .products-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .products-table th {
      background: #2c3e50;
      color: white;
      padding: 10px;
      text-align: left;
      font-size: 10pt;
    }
    .products-table td {
      border: 1px solid #ddd;
      padding: 10px;
      font-size: 10pt;
    }
    .products-table tr:nth-child(even) {
      background: #f8f9fa;
    }
    .products-table .amount {
      text-align: right;
      font-family: monospace;
    }
    .total-row {
      font-weight: bold;
      background: #e8f4f8 !important;
    }
    .risk-disclosure {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .risk-disclosure h4 {
      color: #856404;
      margin: 0 0 10px 0;
    }
    .risk-disclosure ul {
      margin: 0;
      padding-left: 20px;
    }
    .risk-disclosure li {
      margin-bottom: 5px;
      font-size: 10pt;
    }
    .sebi-disclosure {
      background: #d1ecf1;
      border: 1px solid #bee5eb;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .sebi-disclosure h4 {
      color: #0c5460;
      margin: 0 0 10px 0;
    }
    .terms {
      font-size: 10pt;
    }
    .terms ol {
      padding-left: 20px;
    }
    .terms li {
      margin-bottom: 10px;
    }
    .signature-section {
      margin-top: 50px;
      page-break-inside: avoid;
    }
    .signature-box {
      display: inline-block;
      width: 45%;
      vertical-align: top;
      margin-right: 5%;
    }
    .signature-box:last-child {
      margin-right: 0;
    }
    .signature-line {
      border-top: 1px solid #333;
      margin-top: 60px;
      padding-top: 5px;
      text-align: center;
    }
    .signature-label {
      font-size: 10pt;
      color: #666;
    }
    .witness-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #2c3e50;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
    .version-stamp {
      position: absolute;
      top: 20px;
      right: 20px;
      background: ${version > 1 ? "#dc3545" : "#28a745"};
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 10pt;
    }
    @media print {
      body {
        padding: 0;
      }
      .version-stamp {
        position: fixed;
      }
    }
  </style>
</head>
<body>
  <div class="version-stamp">Version ${version}${version > 1 ? " (Revised)" : " (Original)"}</div>
  
  <div class="header">
    <h1>INVESTMENT AGREEMENT</h1>
    <div class="subtitle">FintekPro Financial Services</div>
  </div>

  <div class="agreement-info">
    <div>
      <label>Agreement Number</label>
      <span>${agreementNumber}</span>
    </div>
    <div>
      <label>Date</label>
      <span class="editable-field" data-field="agreement_date">${agreementDate}</span>
    </div>
    <div>
      <label>Proposal Reference</label>
      <span>${proposal.proposalTitle || "Investment Proposal"}</span>
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">1. PARTIES TO THE AGREEMENT</h3>
    
    <div class="party-box">
      <h4>INVESTOR (First Party)</h4>
      <div class="party-detail">
        <label>Name:</label>
        <span class="editable-field" data-field="client_name">${prospect?.name || "Client Name"}</span>
      </div>
      <div class="party-detail">
        <label>PAN:</label>
        <span>${prospect?.pan || "XXXXX0000X"}</span>
      </div>
      <div class="party-detail">
        <label>Email:</label>
        <span class="editable-field" data-field="client_email">${prospect?.email || "client@email.com"}</span>
      </div>
      <div class="party-detail">
        <label>Mobile:</label>
        <span class="editable-field" data-field="client_mobile">${prospect?.mobile || "+91-XXXXXXXXXX"}</span>
      </div>
      <div class="party-detail">
        <label>Address:</label>
        <span class="editable-field" data-field="client_address">${prospect?.address || "Address"}</span>
      </div>
    </div>

    <div class="party-box">
      <h4>INVESTMENT ADVISOR (Second Party)</h4>
      <div class="party-detail">
        <label>Name:</label>
        <span>${agent?.name || "FintekPro Agent"}</span>
      </div>
      <div class="party-detail">
        <label>SEBI Reg. No.:</label>
        <span>${agent?.sebiRegistrationNumber || "INA000XXXXX"}</span>
      </div>
      <div class="party-detail">
        <label>Contact:</label>
        <span>${agent?.email || "agent@fintekpro.com"}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">2. INVESTMENT DETAILS</h3>
    <table class="products-table">
      <thead>
        <tr>
          <th>S.No.</th>
          <th>Product/Asset</th>
          <th>Type</th>
          <th>Risk Profile</th>
          <th>Proposed Amount</th>
        </tr>
      </thead>
      <tbody>
        ${recommendedProducts
					.map(
						(product: any, index: number) => `
        <tr>
          <td>${index + 1}</td>
          <td>${product.name || product.productName || "Investment Product"}</td>
          <td>${product.type || product.productType || "Equity"}</td>
          <td>${product.riskLevel || "Moderate"}</td>
          <td class="amount">${this.formatCurrency(product.proposedAmount || 0)}</td>
        </tr>
        `,
					)
					.join("")}
        <tr class="total-row">
          <td colspan="4" style="text-align: right; font-weight: bold;">TOTAL INVESTMENT:</td>
          <td class="amount">${this.formatCurrency(totalInvestment)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${
		includeRiskWarnings
			? `
  <div class="risk-disclosure">
    <h4>⚠️ RISK DISCLOSURE STATEMENT</h4>
    <ul>
      <li>Investments in securities/mutual funds are subject to market risks. Read all scheme-related documents carefully before investing.</li>
      <li>Past performance is not indicative of future returns. The value of investments may go up or down.</li>
      <li>There is no guarantee that the investment objectives will be achieved.</li>
      <li>Investors should consider their investment objectives, risk tolerance, and financial situation before investing.</li>
      <li>Tax benefits are subject to changes in tax laws. Consult your tax advisor for personalized advice.</li>
    </ul>
  </div>
  `
			: ""
	}

  ${
		includeDisclosures
			? `
  <div class="sebi-disclosure">
    <h4>📋 SEBI REGULATORY DISCLOSURE</h4>
    <p style="font-size: 10pt; margin: 0;">
      This investment recommendation is provided in compliance with SEBI (Investment Advisers) Regulations, 2013. 
      The advisor is registered with SEBI as an Investment Adviser. Investment decisions should be based on 
      investor's own judgment. The advisor does not guarantee any returns. All disputes shall be subject to 
      the jurisdiction of courts in Mumbai, India.
    </p>
  </div>
  `
			: ""
	}

  <div class="section terms">
    <h3 class="section-title">3. TERMS AND CONDITIONS</h3>
    <ol>
      <li><strong>Investment Period:</strong> The proposed investments are based on the investor's stated goals and risk profile. Actual holding period may vary based on market conditions.</li>
      <li><strong>Advisory Fees:</strong> Advisory fees, if applicable, are as per the agreed fee structure and will be charged separately.</li>
      <li><strong>Transaction Execution:</strong> All transactions will be executed through authorized intermediaries registered with relevant regulatory bodies.</li>
      <li><strong>KYC Compliance:</strong> The investor confirms completion of Know Your Customer (KYC) requirements as per regulatory guidelines.</li>
      <li><strong>Communication:</strong> All communications regarding investments will be sent to the registered email/mobile number.</li>
      <li><strong>Portfolio Review:</strong> Periodic portfolio reviews will be conducted to align investments with stated objectives.</li>
      <li><strong>Confidentiality:</strong> All information shared by the investor will be kept confidential as per applicable privacy laws.</li>
      <li><strong>Amendment:</strong> This agreement may be amended with mutual consent of both parties in writing.</li>
    </ol>
  </div>

  <div class="section">
    <h3 class="section-title">4. DECLARATIONS</h3>
    <p style="font-size: 10pt;">
      I/We, the undersigned investor(s), hereby confirm that:
    </p>
    <ol style="font-size: 10pt;">
      <li>I/We have read and understood the investment proposal and this agreement.</li>
      <li>I/We have been adequately informed about the risks associated with the proposed investments.</li>
      <li>The investment is being made from legitimate sources and is not in violation of any applicable laws.</li>
      <li>I/We authorize the advisor to execute the proposed transactions on my/our behalf.</li>
      <li>I/We understand that investments are subject to market risks and there is no guarantee of returns.</li>
    </ol>
  </div>

  <div class="signature-section">
    <h3 class="section-title">5. SIGNATURES</h3>
    
    <div class="signature-box">
      <p><strong>INVESTOR</strong></p>
      <div class="signature-line">
        <p class="signature-label">Signature / Digital Signature</p>
      </div>
      <p style="font-size: 10pt; margin-top: 5px;">
        Name: <span class="editable-field" data-field="investor_name">${prospect?.name || "________________"}</span><br>
        Date: ________________<br>
        Place: ________________
      </p>
    </div>

    <div class="signature-box">
      <p><strong>INVESTMENT ADVISOR</strong></p>
      <div class="signature-line">
        <p class="signature-label">Authorized Signatory</p>
      </div>
      <p style="font-size: 10pt; margin-top: 5px;">
        Name: ${agent?.name || "Authorized Agent"}<br>
        SEBI Reg. No.: ${agent?.sebiRegistrationNumber || "INA000XXXXX"}<br>
        Date: ________________
      </p>
    </div>

    <div class="witness-section">
      <p><strong>WITNESS (Optional)</strong></p>
      <div style="display: flex; gap: 50px;">
        <div style="flex: 1;">
          <p style="font-size: 10pt;">
            Name: ________________<br>
            Signature: ________________<br>
            Address: ________________
          </p>
        </div>
        <div style="flex: 1;">
          <p style="font-size: 10pt;">
            Name: ________________<br>
            Signature: ________________<br>
            Address: ________________
          </p>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>
      <strong>FintekPro Financial Services</strong><br>
      SEBI Registered Investment Adviser | CIN: UXXXXX2024PLCXXXXXX<br>
      Document generated on ${this.formatDate(new Date())} | Version ${version}<br>
      Document Hash: ${this.createDocumentHash(proposal.id + version)}
    </p>
  </div>
</body>
</html>
    `.trim();
	}

	async previewAgreement(proposalId: string): Promise<string> {
		const agreement = await this.generateAgreement({
			proposalId,
			watermark: "DRAFT",
			includeDisclosures: true,
			includeRiskWarnings: true,
		});
		return agreement.documentHtml;
	}

	async createFinalAgreement(proposalId: string): Promise<GeneratedAgreement> {
		return this.generateAgreement({
			proposalId,
			includeDisclosures: true,
			includeRiskWarnings: true,
		});
	}

	async createRevisedAgreement(
		proposalId: string,
		versionNumber: number,
		watermark?: string,
	): Promise<GeneratedAgreement> {
		return this.generateAgreement({
			proposalId,
			versionNumber,
			watermark: watermark || `REVISION ${versionNumber}`,
			includeDisclosures: true,
			includeRiskWarnings: true,
		});
	}
}

export const investmentAgreementGenerator = new InvestmentAgreementGenerator();
