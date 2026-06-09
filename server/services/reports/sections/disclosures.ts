export interface DisclosureData {
	version: string;
	effectiveDate: string;
	sections: {
		title: string;
		content: string;
	}[];
	riskWarnings: string[];
	regulatoryInfo: string;
	disclaimers: string[];
}

export function generateDisclosures(reportDate: Date): DisclosureData {
	const version = "2.1.0";
	const effectiveDate = new Date().toISOString().split("T")[0];

	return {
		version,
		effectiveDate,
		sections: [
			{
				title: "Investment Risks",
				content:
					"All investments are subject to market risks. The value of investments can go down as well as up, and investors may get back less than they invested. Past performance is not a reliable indicator of future results.",
			},
			{
				title: "Data Sources",
				content:
					"The data presented in this report is sourced from market data providers, regulatory filings, and internal calculations. While every effort has been made to ensure accuracy, we cannot guarantee the completeness or accuracy of all information.",
			},
			{
				title: "Calculation Methodology",
				content:
					"Returns are calculated using time-weighted methodology. Risk metrics are based on historical volatility and may not accurately predict future risk. All calculations are performed in INR unless otherwise specified.",
			},
			{
				title: "SEBI Compliance",
				content:
					"This report is prepared in accordance with SEBI (Investment Advisers) Regulations, 2013. The information provided is for informational purposes only and should not be construed as investment advice.",
			},
			{
				title: "Conflicts of Interest",
				content:
					"The advisor may have positions in some of the securities mentioned in this report. Any potential conflicts of interest are disclosed in accordance with regulatory requirements.",
			},
		],
		riskWarnings: [
			"Mutual fund investments are subject to market risks. Read all scheme-related documents carefully before investing.",
			"Equity investments involve higher risk and volatility compared to fixed income instruments.",
			"International investments carry additional risks including currency fluctuations and political uncertainty.",
			"Past performance does not guarantee future returns.",
			"Tax implications may vary based on individual circumstances. Consult a tax advisor for specific advice.",
		],
		regulatoryInfo: `This portfolio report is generated in compliance with SEBI regulations. Report generated on ${reportDate.toLocaleDateString("en-IN")}. For grievance redressal, contact SEBI through SCORES portal.`,
		disclaimers: [
			"This report is prepared for informational purposes only and is not an offer to buy or sell any securities.",
			"The projections and estimates contained herein are based on current market conditions and may change.",
			"Asset allocation recommendations are based on the investor's stated risk profile and investment objectives.",
			"The advisor is registered with SEBI as an Investment Adviser (Registration No. [INA000XXXXXX]).",
		],
	};
}

export function getDisclosureFooter(): string {
	return "This report is confidential and intended solely for the addressee. Unauthorized use, disclosure, or copying is prohibited. © FintekPro Financial Services. SEBI Registered Investment Adviser.";
}

export default generateDisclosures;
