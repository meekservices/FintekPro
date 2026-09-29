/* eslint-disable */
/**
 * NISM Examination Question Bank
 * Comprehensive question bank covering the official NISM curriculum:
 * - NISM Series V-A: Mutual Fund Distributors (Chapters 1 to 12) - 190 Questions
 * - NISM Series VIII: Equity Derivatives - 25 Questions
 * - NISM Series X-A: Investment Adviser Level 1 - 10 Questions
 * - NISM Series XV: Research Analyst - 10 Questions
 * - NISM Series XXI-A: PMS Distributors - 10 Questions
 * - NISM Series V-D: SIF Distributors - 10 Questions
 * Total Bank: 255 High-Yield Exam Questions
 *
 * Statutory References:
 * - SEBI (Mutual Funds) Regulations, 1996
 * - SEBI Master Circular for Mutual Funds (2024)
 * - AMFI Code of Ethics & Best Practice Guidelines
 * - Finance Act 2023 & Budget 2024 Capital Gains Tax Framework (12.5% LTCG, 20% STCG)
 */

export interface NismPracticeQuestion {
	id: string;
	courseId: string;
	question: string;
	options: string[];
	correctIndex: number;
	explanation: string;
	topic: string;
}

export const NISM_PRACTICE_BANK: NismPracticeQuestion[] = [
  {
    "id": "nism-va-q1",
    "courseId": "nism-va",
    "question": "Which entity acts as the primary legal custodian and holds the assets of a mutual fund scheme in trust for unit holders in India?",
    "options": [
      "Asset Management Company (AMC)",
      "Custodian registered with SEBI",
      "Board of Trustees / Trustee Company",
      "Association of Mutual Funds in India (AMFI)"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI (Mutual Funds) Regulations, the Custodian is responsible for the safekeeping of the fund's securities and assets, operating independently of the AMC.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q2",
    "courseId": "nism-va",
    "question": "What is the cut-off timing for receiving purchase applications in Liquid & Overnight Funds for applicable NAV of the same day?",
    "options": [
      "1:30 PM",
      "3:00 PM",
      "1:00 PM",
      "2:30 PM"
    ],
    "correctIndex": 0,
    "explanation": "As per SEBI guidelines, the cut-off timing for historical NAV applicability on subscriptions in Liquid and Overnight funds is 1:30 PM (provided funds are available in the bank before cut-off).",
    "topic": "Operational Guidelines & NAV"
  },
  {
    "id": "nism-va-q3",
    "courseId": "nism-va",
    "question": "Under the SEBI categorisation of mutual fund schemes, what is the minimum percentage of total assets that an Equity Linked Savings Scheme (ELSS) must invest in equity instruments?",
    "options": [
      "65%",
      "80%",
      "75%",
      "90%"
    ],
    "correctIndex": 1,
    "explanation": "ELSS schemes must invest at least 80% of total assets in equity and equity-related instruments, with a statutory 3-year lock-in period qualifying under Section 80C.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q4",
    "courseId": "nism-va",
    "question": "Which of the following risk profiling metrics evaluates how much portfolio return is achieved per unit of total risk (standard deviation)?",
    "options": [
      "Treynor Ratio",
      "Sharpe Ratio",
      "Jensen's Alpha",
      "Beta"
    ],
    "correctIndex": 1,
    "explanation": "The Sharpe Ratio measures excess return over the risk-free rate divided by total risk (Standard Deviation), whereas Treynor uses systematic risk (Beta).",
    "topic": "Portfolio Performance & Risk"
  },
  {
    "id": "nism-va-q5",
    "courseId": "nism-va",
    "question": "What is the maximum Total Expense Ratio (TER) permissible for an open-ended equity scheme for the first \u20b9500 crores of daily net assets under SEBI regulations?",
    "options": [
      "2.25%",
      "2.00%",
      "1.75%",
      "2.50%"
    ],
    "correctIndex": 0,
    "explanation": "SEBI limits the base TER for the first \u20b9500 crores of daily net assets of an open-ended equity-oriented scheme to 2.25% (plus additional allowances for B-30 cities and GST).",
    "topic": "Mutual Fund Expenses & Accounting"
  },
  {
    "id": "nism-va-q6",
    "courseId": "nism-va",
    "question": "Under Section 112A of the Income Tax Act, long-term capital gains (LTCG) on equity mutual funds exceeding \u20b91.25 Lakh per financial year are taxed at what rate (post Budget 2024)?",
    "options": [
      "10%",
      "12.5%",
      "15%",
      "20% with indexation"
    ],
    "correctIndex": 1,
    "explanation": "Effective Budget 2024, Long Term Capital Gains (LTCG) on listed equity and equity mutual funds held for more than 12 months are taxed at 12.5% on gains exceeding \u20b91.25 Lakhs per fiscal year.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q7",
    "courseId": "nism-va",
    "question": "When an investor redeems units of an open-ended mutual fund scheme subject to an exit load, where does the collected exit load amount go under SEBI regulations?",
    "options": [
      "Retained by the AMC as administrative revenue",
      "Credited directly back to the scheme to benefit remaining unit holders",
      "Paid to the distributing agent as trailing commission",
      "Transferred to SEBI Investor Protection and Education Fund"
    ],
    "correctIndex": 1,
    "explanation": "SEBI regulations mandate that 100% of any exit load collected must be credited back to the scheme account to mitigate dilution for existing unit holders.",
    "topic": "Mutual Fund Accounting & Expenses"
  },
  {
    "id": "nism-va-q8",
    "courseId": "nism-va",
    "question": "How many risk levels are defined in the standardized SEBI Risk-o-meter for mutual fund scheme labels?",
    "options": [
      "3 levels",
      "4 levels",
      "5 levels",
      "6 levels"
    ],
    "correctIndex": 3,
    "explanation": "The SEBI Risk-o-meter depicts 6 levels of risk: Low, Low to Moderate, Moderate, Moderately High, High, and Very High.",
    "topic": "Investor Protection & Suitability"
  },
  {
    "id": "nism-va-q9",
    "courseId": "nism-va",
    "question": "Which transaction facility allows an investor to systematically transfer a fixed sum periodically from one mutual fund scheme to another scheme within the same AMC?",
    "options": [
      "Systematic Investment Plan (SIP)",
      "Systematic Transfer Plan (STP)",
      "Systematic Withdrawal Plan (SWP)",
      "Dividend Transfer Plan (DTP)"
    ],
    "correctIndex": 1,
    "explanation": "An STP (Systematic Transfer Plan) transfers a fixed amount periodically from a source scheme (usually liquid or overnight) to a target scheme (typically equity).",
    "topic": "Investment Strategies & Products"
  },
  {
    "id": "nism-va-q10",
    "courseId": "nism-va",
    "question": "How frequently must an Asset Management Company (AMC) update its Key Information Memorandum (KIM) under SEBI guidelines?",
    "options": [
      "Every quarter",
      "At least once every year",
      "Every three years",
      "Only when scheme fundamentals change"
    ],
    "correctIndex": 1,
    "explanation": "AMCs must update the Key Information Memorandum (KIM) at least once every financial year and make it available across all investor service centers.",
    "topic": "Regulatory Disclosures"
  },
  {
    "id": "nism-va-q11",
    "courseId": "nism-va",
    "question": "Under the SEBI mutual fund distributor remuneration model, which commission structure is exclusively permitted?",
    "options": [
      "Full upfront commission model",
      "Full trail commission model only",
      "Combination of 50% upfront and 50% trail",
      "Discretionary fees negotiated directly with clients"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates an all-trail commission model for mutual fund distributors. Upfront commissions of any kind from AMCs are completely prohibited.",
    "topic": "Code of Conduct & Distributor Regulations"
  },
  {
    "id": "nism-va-q12",
    "courseId": "nism-va",
    "question": "What is the statutory minimum net worth requirement that an entity must maintain to operate as an Asset Management Company (AMC) in India?",
    "options": [
      "\u20b910 Crores",
      "\u20b925 Crores",
      "\u20b950 Crores",
      "\u20b9100 Crores"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI (Mutual Funds) Regulations, an AMC must maintain a continuous minimum net worth of at least \u20b950 Crores.",
    "topic": "Mutual Fund Governance"
  },
  {
    "id": "nism-va-q13",
    "courseId": "nism-va",
    "question": "What does Macaulay Duration measure in a debt mutual fund portfolio?",
    "options": [
      "Credit risk of corporate bonds in the fund",
      "Weighted average time until all cash flows (coupons and principal) are received",
      "The fund's total tracking error against government bonds",
      "The ratio of corporate bonds to treasury bills"
    ],
    "correctIndex": 1,
    "explanation": "Macaulay Duration measures the weighted average term to maturity of cash flows generated by a bond, reflecting sensitivity to interest rate fluctuations.",
    "topic": "Debt Fund Evaluation"
  },
  {
    "id": "nism-va-q14",
    "courseId": "nism-va",
    "question": "Under SEBI guidelines, which event explicitly triggers the creation of a 'Segregated Portfolio' (side-pocketing) in a debt mutual fund scheme?",
    "options": [
      "A 5% drop in scheme NAV within a single day",
      "A credit rating downgrade of a debt or money market instrument to below investment grade (BBB-)",
      "High redemption pressure exceeding 10% of scheme AUM",
      "Insolvency filing of the AMC sponsor"
    ],
    "correctIndex": 1,
    "explanation": "Side-pocketing (segregated portfolio creation) is triggered upon a credit event involving downgrade of debt instrument to below investment grade.",
    "topic": "Risk Management & Valuation"
  },
  {
    "id": "nism-va-q15",
    "courseId": "nism-va",
    "question": "Which of the following actions constitutes 'churning' by a mutual fund distributor under the AMFI Code of Ethics?",
    "options": [
      "Advising a client to rebalance portfolio annually based on target asset allocation",
      "Unnecessary switching of a client between similar schemes solely to generate trail turnover without financial rationale",
      "Recommending liquid funds for emergency cash requirements",
      "Helping an investor complete periodic eKYC re-verification"
    ],
    "correctIndex": 1,
    "explanation": "Churning refers to encouraging unnecessary transfers or redemptions between schemes with no demonstrable benefit to the client, which is strictly prohibited.",
    "topic": "Ethics & Professional Standards"
  },
  {
    "id": "nism-va-q16",
    "courseId": "nism-va",
    "question": "If an investment yields a nominal annual return of 9% while annual consumer inflation is 5%, what is the approximate real rate of return?",
    "options": [
      "14%",
      "4%",
      "1.8%",
      "4.5%"
    ],
    "correctIndex": 1,
    "explanation": "Real Rate of Return \u2248 Nominal Rate - Inflation Rate = 9% - 5% = 4%. Real return measures actual purchasing power growth.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q17",
    "courseId": "nism-va",
    "question": "Using the 'Rule of 72', how many years will it take for an investment to double at a compounded annual growth rate of 8%?",
    "options": [
      "6 years",
      "9 years",
      "12 years",
      "8 years"
    ],
    "correctIndex": 1,
    "explanation": "Rule of 72 states: Doubling Time = 72 / Interest Rate = 72 / 8 = 9 years.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q18",
    "courseId": "nism-va",
    "question": "Which asset class has historically delivered the highest protection against long-term inflation erosion in India?",
    "options": [
      "Fixed Deposits",
      "Equities",
      "Cash and Savings Account",
      "Short-term Treasury Bills"
    ],
    "correctIndex": 1,
    "explanation": "Over long investment horizons, equities have consistently outpaced consumer inflation, driving real wealth accumulation.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q19",
    "courseId": "nism-va",
    "question": "What is the primary distinction between active and passive mutual fund strategies?",
    "options": [
      "Active funds have zero portfolio management fees",
      "Active management aims to outperform a benchmark index, while passive management seeks to replicate benchmark returns",
      "Passive management requires daily rebalancing by the fund manager",
      "Active funds carry lower Total Expense Ratios than index funds"
    ],
    "correctIndex": 1,
    "explanation": "Active management involves research and security selection to beat a benchmark index (Alpha), while passive management replicates an index with minimal tracking error.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q20",
    "courseId": "nism-va",
    "question": "Why is the Net Asset Value (NAV) of a Direct Plan higher than the Regular Plan of the exact same scheme?",
    "options": [
      "Direct plans invest in separate high-yield securities",
      "Direct plans do not incur distributor commission expenses, lowering the scheme's Total Expense Ratio (TER)",
      "Direct plans are exempt from capital gains tax",
      "Direct plans receive seed capital subsidies from SEBI"
    ],
    "correctIndex": 1,
    "explanation": "Direct plans eliminate distributor commissions, resulting in a lower TER and consequently a higher NAV compounding over time.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q21",
    "courseId": "nism-va",
    "question": "What does the 'Equity Risk Premium' compensate an investor for?",
    "options": [
      "Brokerage charges on exchange trading",
      "The additional risk and volatility of equities relative to risk-free sovereign debt instruments",
      "Currency conversion losses on foreign investments",
      "Statutory stamp duties on purchase transactions"
    ],
    "correctIndex": 1,
    "explanation": "Equity risk premium is the excess return demanded by investors over risk-free government securities to compensate for market volatility and business uncertainty.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q22",
    "courseId": "nism-va",
    "question": "Which risk is completely eliminated when investing in sovereign Government Securities (G-Secs)?",
    "options": [
      "Interest Rate Risk",
      "Credit / Default Risk",
      "Reinvestment Risk",
      "Inflation Risk"
    ],
    "correctIndex": 1,
    "explanation": "Sovereign G-Secs carry the sovereign guarantee of the Government of India, making them free of credit default risk, though still subject to interest rate and inflation risks.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q23",
    "courseId": "nism-va",
    "question": "Empirical studies by Brinson, Hood, and Beebower demonstrated that over 90% of long-term portfolio return variation is explained by:",
    "options": [
      "Individual stock picking",
      "Market timing",
      "Asset allocation",
      "Choice of trading platform"
    ],
    "correctIndex": 2,
    "explanation": "Asset allocation \u2014 the proportion of wealth allocated among equity, debt, gold, and cash \u2014 is the primary driver of portfolio return variance over time.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q24",
    "courseId": "nism-va",
    "question": "What is an investor's 'Risk Capacity' fundamentally determined by?",
    "options": [
      "Their willingness to watch portfolio values fluctuate without panic",
      "Objective financial factors including age, net worth, income stability, time horizon, and debt obligations",
      "Their historical score on personality tests",
      "The trading volume of their demat account"
    ],
    "correctIndex": 1,
    "explanation": "Risk Capacity is an objective measure of an investor's financial capability to absorb losses without compromising their livelihood or life goals.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q25",
    "courseId": "nism-va",
    "question": "What key feature distinguishes Sovereign Gold Bonds (SGBs) from physical gold jewelry?",
    "options": [
      "SGBs pay 2.50% annual coupon interest on the initial investment amount and eliminate storage costs",
      "SGBs require paying 20% making charges on redemption",
      "SGBs are not backed by the Reserve Bank of India",
      "SGBs carry high wealth tax liability"
    ],
    "correctIndex": 0,
    "explanation": "SGBs pay 2.50% per annum interest, eliminate theft, storage, and purity risks, and are exempt from capital gains tax if held until sovereign maturity.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q26",
    "courseId": "nism-va",
    "question": "What happens to the price of an existing 10-year fixed-rate bond when the Reserve Bank of India raises market interest rates?",
    "options": [
      "Bond price rises",
      "Bond price falls",
      "Bond price remains static",
      "Coupon rate increases automatically"
    ],
    "correctIndex": 1,
    "explanation": "Bond prices and interest rates are inversely related. When market yields rise, existing fixed-coupon bonds drop in price to align their yield with current market rates.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q27",
    "courseId": "nism-va",
    "question": "What does 'Reinvestment Risk' refer to in a bond portfolio?",
    "options": [
      "The risk that the issuer enters bankruptcy",
      "The risk that interim coupon cash flows will have to be reinvested at lower interest rates",
      "The risk that the depository fails to credit units",
      "The risk that inflation will reduce bond coupons"
    ],
    "correctIndex": 1,
    "explanation": "Reinvestment risk arises when bond coupons received during a declining interest rate environment can only be reinvested at lower prevailing yields.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q28",
    "courseId": "nism-va",
    "question": "Which of the following is considered an 'Unsystematic Risk'?",
    "options": [
      "A sudden shift in national corporate tax rates",
      "A labor dispute leading to a factory shutdown at a specific pharmaceutical company",
      "A global financial liquidity crunch",
      "A nationwide spike in retail inflation"
    ],
    "correctIndex": 1,
    "explanation": "Unsystematic risks are idiosyncratic to a specific firm or industry and can be mitigated through adequate diversification.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q29",
    "courseId": "nism-va",
    "question": "How does diversification across uncorrelated assets enhance a portfolio?",
    "options": [
      "It guarantees that no asset in the portfolio will ever show a loss",
      "It reduces total portfolio volatility (standard deviation) without a proportional reduction in expected return",
      "It eliminates all capital gains taxes",
      "It converts equity shares into risk-free fixed deposits"
    ],
    "correctIndex": 1,
    "explanation": "Combining assets with low or negative correlation dampens portfolio volatility because price swings across assets partially offset each other.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q30",
    "courseId": "nism-va",
    "question": "In financial planning, what is the standard recommended size for an emergency reserve fund?",
    "options": [
      "1 month of discretionary spending",
      "3 to 6 months of mandatory living expenses",
      "5 years of gross income",
      "Equal to the entire home loan balance"
    ],
    "correctIndex": 1,
    "explanation": "An emergency reserve should cover 3 to 6 months of living expenses in liquid instruments to provide security against unexpected income disruptions.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q31",
    "courseId": "nism-va",
    "question": "Under the Indian Trust Act and SEBI regulations, in what legal form is a mutual fund set up in India?",
    "options": [
      "Public Limited Company",
      "Trust",
      "Limited Liability Partnership (LLP)",
      "Statutory Corporation"
    ],
    "correctIndex": 1,
    "explanation": "Mutual funds in India are constituted as Trusts under the Indian Trusts Act, 1882, with the scheme assets held by Trustees for the benefit of unitholders.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q32",
    "courseId": "nism-va",
    "question": "Which entity is responsible for floating and establishing the mutual fund trust in India?",
    "options": [
      "Asset Management Company (AMC)",
      "Sponsor",
      "Registrar and Transfer Agent (RTA)",
      "AMFI"
    ],
    "correctIndex": 1,
    "explanation": "The Sponsor is the promoter who initiates the creation of the mutual fund trust, establishes the AMC, and appoints trustees with SEBI approval.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q33",
    "courseId": "nism-va",
    "question": "What is the primary statutory responsibility of the Board of Trustees in a mutual fund?",
    "options": [
      "To manage the day-to-day trading of equity and debt securities",
      "To act as fiduciaries protecting unitholders' interests and ensuring AMC compliance with SEBI regulations",
      "To distribute mutual fund units to retail investors",
      "To audit public companies held in the portfolio"
    ],
    "correctIndex": 1,
    "explanation": "Trustees hold the fund assets in trust for unitholders and supervise the AMC to ensure strict compliance with SEBI (Mutual Funds) Regulations.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q34",
    "courseId": "nism-va",
    "question": "Under SEBI regulations, what percentage of the Board of Trustees or directors of a Trustee Company must be independent?",
    "options": [
      "At least 25%",
      "At least 50%",
      "At least 66%",
      "100%"
    ],
    "correctIndex": 1,
    "explanation": "At least 50% of the trustees or directors of the trustee company must be independent (not associated with the sponsor or its associates).",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q35",
    "courseId": "nism-va",
    "question": "What is the role of a Registrar and Transfer Agent (RTA) such as CAMS or KFintech?",
    "options": [
      "To decide portfolio security weights and trade execution",
      "To maintain unitholder records, process purchase/redemption transactions, and generate account statements",
      "To hold the physical equity share certificates of portfolio companies",
      "To conduct statutory SEBI inspections"
    ],
    "correctIndex": 1,
    "explanation": "The RTA maintains investor records, handles subscription and redemption processing, calculates unit balances, and issues Statements of Additional Information and Account Statements.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q36",
    "courseId": "nism-va",
    "question": "What defines an 'Open-ended' mutual fund scheme?",
    "options": [
      "A scheme that only trades on stock exchange floors during market hours",
      "A scheme available for continuous subscription and redemption at NAV-related prices without a fixed maturity date",
      "A scheme that cannot redeem units before 10 years",
      "A scheme with a fixed number of issued units"
    ],
    "correctIndex": 1,
    "explanation": "Open-ended funds offer continuous entry and exit at NAV-related prices and have an indefinite operational lifespan.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q37",
    "courseId": "nism-va",
    "question": "Where are units of a 'Close-ended' mutual fund scheme primarily traded during the tenure of the fund?",
    "options": [
      "Directly at AMC branch offices on a daily basis",
      "On a recognized stock exchange where the scheme is mandatorily listed",
      "Through RBI liquidity adjustment facility",
      "Through local municipal corporations"
    ],
    "correctIndex": 1,
    "explanation": "Close-ended funds have a fixed maturity period and must be listed on a recognized stock exchange to provide liquidity to unitholders prior to maturity.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q38",
    "courseId": "nism-va",
    "question": "What is an 'Interval Scheme' in mutual fund terminology?",
    "options": [
      "A scheme that only invests in 30-day commercial papers",
      "A hybrid scheme combining features of open-ended and close-ended funds that opens for purchase and redemption during specified recurring transaction intervals",
      "A fund that trades only between 12:00 PM and 1:00 PM",
      "A fund that pays dividends every 15 minutes"
    ],
    "correctIndex": 1,
    "explanation": "Interval funds remain closed for general transactions but open for subscriptions and redemptions during specified periodic intervals (e.g. monthly or semi-annually).",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q39",
    "courseId": "nism-va",
    "question": "What is the Association of Mutual Funds in India (AMFI)?",
    "options": [
      "A statutory arm of the Reserve Bank of India",
      "An industry association of SEBI-registered mutual funds dedicated to maintaining ethical standards, training distributors, and investor awareness",
      "The clearing corporation for mutual fund trades",
      "A commercial bank that settles SIP debits"
    ],
    "correctIndex": 1,
    "explanation": "AMFI is the non-profit apex industry body of Indian mutual funds that issues ARN licenses, enforces the distributor Code of Conduct, and promotes investor education.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q40",
    "courseId": "nism-va",
    "question": "Which of the following is a key advantage of investing through mutual funds rather than direct stock investing?",
    "options": [
      "Guaranteed 15% annual returns backed by the Government",
      "Professional portfolio management, built-in diversification, and high liquidity with small investment amounts",
      "Zero market risk during severe economic recessions",
      "Immunity from capital gains tax indefinitely"
    ],
    "correctIndex": 1,
    "explanation": "Mutual funds provide retail investors with access to professional fund managers, instant diversification across dozens of securities, economies of scale, and liquidity.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q41",
    "courseId": "nism-va",
    "question": "What is an inherent limitation of investing in mutual funds for an investor?",
    "options": [
      "Units cannot be sold for 20 years",
      "Lack of portfolio customization (investors cannot select or omit specific stocks held inside the scheme)",
      "Unitholders must personally attend annual shareholder meetings",
      "AMCs do not publish scheme Net Asset Values"
    ],
    "correctIndex": 1,
    "explanation": "Investors in a mutual fund hold pooled units and cannot customize the portfolio or instruct the fund manager to buy or avoid specific companies.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q42",
    "courseId": "nism-va",
    "question": "Who owns the underlying portfolio securities purchased by a mutual fund scheme?",
    "options": [
      "The Asset Management Company (AMC)",
      "The unitholders of the scheme in proportion to their unit holdings",
      "The Chief Investment Officer of the fund",
      "The stock exchange where units are listed"
    ],
    "correctIndex": 1,
    "explanation": "Unitholders are the beneficial owners of the scheme's assets in proportion to the number of units they hold, held in trust by the Trustees on their behalf.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q43",
    "courseId": "nism-va",
    "question": "What is the Net Asset Value (NAV) of a mutual fund scheme?",
    "options": [
      "The initial issue price of \u20b910 per unit fixed forever",
      "The market value of the scheme's investments plus current assets minus liabilities, divided by the total number of outstanding units",
      "The book value of the AMC's share capital",
      "The maximum price at which the distributor can sell units"
    ],
    "correctIndex": 1,
    "explanation": "NAV represents the per-unit intrinsic net worth of the scheme, calculated daily based on market closing valuations of portfolio holdings.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q44",
    "courseId": "nism-va",
    "question": "Can a mutual fund scheme promise or guarantee future investment returns to investors under SEBI rules?",
    "options": [
      "Yes, provided the fund manager signs an affidavit",
      "No, mutual funds cannot guarantee returns in any form, except in specifically structured assured return schemes approved with sponsor underwriting",
      "Yes, all equity schemes must guarantee at least 10% returns",
      "Yes, if the distributor provides written guarantee"
    ],
    "correctIndex": 1,
    "explanation": "SEBI strictly prohibits promising or guaranteeing returns in mutual fund schemes, as investment outcomes depend on market movements.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q45",
    "courseId": "nism-va",
    "question": "Which document legally establishes the Asset Management Company (AMC) as the investment manager of the mutual fund?",
    "options": [
      "Trust Deed",
      "Investment Management Agreement (IMA)",
      "Scheme Information Document",
      "Key Information Memorandum"
    ],
    "correctIndex": 1,
    "explanation": "The Investment Management Agreement (IMA) executed between the Trustees and the AMC appoints the AMC to manage the funds and float schemes.",
    "topic": "Concept & Role of a Mutual Fund"
  },
  {
    "id": "nism-va-q46",
    "courseId": "nism-va",
    "question": "What is the primary governing legislation regulating mutual funds and their asset management companies in India?",
    "options": [
      "Companies Act, 2013",
      "SEBI (Mutual Funds) Regulations, 1996",
      "Banking Regulation Act, 1949",
      "Insurance Act, 1938"
    ],
    "correctIndex": 1,
    "explanation": "The SEBI (Mutual Funds) Regulations, 1996 forms the core statutory framework governing the formation, operations, investments, and disclosures of mutual funds.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q47",
    "courseId": "nism-va",
    "question": "What is the minimum continuous net worth required for an entity to function as an Asset Management Company (AMC) in India?",
    "options": [
      "\u20b910 Crores",
      "\u20b925 Crores",
      "\u20b950 Crores",
      "\u20b9100 Crores"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI regulations, an AMC must maintain a continuous minimum net worth of at least \u20b950 Crores at all times.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q48",
    "courseId": "nism-va",
    "question": "What percentage of the Board of Directors of an Asset Management Company (AMC) must be independent directors?",
    "options": [
      "At least 25%",
      "At least 33%",
      "At least 50%",
      "At least 75%"
    ],
    "correctIndex": 2,
    "explanation": "SEBI mandates that at least 50% of the directors on the board of an AMC must be independent directors not associated with the sponsor.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q49",
    "courseId": "nism-va",
    "question": "Under SEBI investment restrictions, what is the maximum exposure an open-ended mutual fund scheme can take in equity shares of a single company?",
    "options": [
      "5% of NAV",
      "10% of NAV (extendable to 12% with prior trustee approval)",
      "25% of NAV",
      "50% of NAV"
    ],
    "correctIndex": 1,
    "explanation": "A mutual fund scheme cannot invest more than 10% of its NAV in equity shares or equity-related instruments of any single company (extendable to 12% with prior approval of Trustees).",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q50",
    "courseId": "nism-va",
    "question": "Can a mutual fund scheme invest in unlisted equity shares under current SEBI regulations?",
    "options": [
      "Yes, up to 30% of scheme NAV",
      "No, open-ended and close-ended mutual fund schemes are prohibited from investing in unlisted equity shares",
      "Yes, with permission from the local stock exchange",
      "Yes, if the company has a credit rating of AAA"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI portfolio prudential norms, mutual funds are prohibited from investing in unlisted equity and equity-related securities.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q51",
    "courseId": "nism-va",
    "question": "What is the maximum exposure limit for a debt mutual fund scheme to a single sector under SEBI regulations?",
    "options": [
      "10% of NAV",
      "20% of NAV (with additional 10% permissible for Housing Finance Companies)",
      "50% of NAV",
      "35% of NAV"
    ],
    "correctIndex": 1,
    "explanation": "SEBI caps debt scheme exposure to a single sector at 20% of net assets, with an additional 10% exposure allowed exclusively for HFCs.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q52",
    "courseId": "nism-va",
    "question": "Can a mutual fund scheme advance loans to its sponsor, AMC directors, or associate companies?",
    "options": [
      "Yes, at commercial interest rates",
      "No, mutual funds are strictly barred from giving loans or advances to any entity",
      "Yes, up to 15% of AUM",
      "Yes, with RBI clearance"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI regulations, mutual funds cannot advance loans to any party, including sponsors, trustees, or associate entities.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q53",
    "courseId": "nism-va",
    "question": "What is 'Front Running' in capital markets, which is strictly illegal under SEBI regulations?",
    "options": [
      "Submitting an order before the official market opening bell",
      "Trading in personal accounts ahead of a large impending client or mutual fund order to profit from the anticipated price impact",
      "Running a high-speed fiber optic connection to the exchange",
      "Advertising a mutual fund scheme on national television"
    ],
    "correctIndex": 1,
    "explanation": "Front running is the fraudulent practice of placing orders on personal accounts based on advance knowledge of large institutional orders expected to move security prices.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q54",
    "courseId": "nism-va",
    "question": "What is the role of 'Chinese Walls' in an Asset Management Company?",
    "options": [
      "Firewalls protecting AMC IT infrastructure from external cyber attacks",
      "Information barriers preventing sensitive, non-public research and trading information from leaking between investment teams and sales/broking arms",
      "Physical barriers between retail investors and fund managers",
      "Statutory restrictions on foreign equity investments"
    ],
    "correctIndex": 1,
    "explanation": "Chinese Walls are operational policies and controls designed to isolate non-public, material price-sensitive information to prevent insider trading and conflicts of interest.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q55",
    "courseId": "nism-va",
    "question": "Under the Prevention of Money Laundering Act (PMLA), 2002, how long must mutual funds maintain client transaction records?",
    "options": [
      "1 year",
      "3 years",
      "At least 5 years",
      "10 years"
    ],
    "correctIndex": 2,
    "explanation": "PMLA mandates that reporting entities, including mutual funds and intermediaries, must preserve client transaction records for at least 5 years.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q56",
    "courseId": "nism-va",
    "question": "What must an AMC do if a scheme's asset allocation breaches statutory limits due to market fluctuations?",
    "options": [
      "Immediately shut down the fund",
      "Rebalance the portfolio back within the mandated mandate limits within the statutory timeframe (e.g. 30 business days)",
      "Transfer excess assets to the sponsor's personal account",
      "Write off the portfolio loss"
    ],
    "correctIndex": 1,
    "explanation": "SEBI provides a standardized 30-business-day rectification window for passive portfolio rebalancing breaches caused by market movements.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q57",
    "courseId": "nism-va",
    "question": "What is the maximum investment limit for a mutual fund scheme in debt and money market securities of a single group under SEBI rules?",
    "options": [
      "10% of NAV",
      "20% of NAV (extendable to 25% with prior trustee approval)",
      "35% of NAV",
      "50% of NAV"
    ],
    "correctIndex": 1,
    "explanation": "SEBI limits single group exposure in debt instruments to 20% of net assets, extendable to 25% with prior approval of the Board of Trustees.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q58",
    "courseId": "nism-va",
    "question": "Who must approve the appointment and termination of an Asset Management Company (AMC)?",
    "options": [
      "AMFI and CRISIL",
      "Board of Trustees and SEBI",
      "Ministry of Corporate Affairs only",
      "Stock Exchange Listing Committee"
    ],
    "correctIndex": 1,
    "explanation": "The appointment of an AMC can only be initiated by the Trustees with prior approval of SEBI, and can be terminated by a majority of trustees or 75% of unitholders.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q59",
    "courseId": "nism-va",
    "question": "Which committee at the AMC oversees investment policies and approves valuation guidelines for unlisted or thinly traded securities?",
    "options": [
      "Marketing Committee",
      "Valuation Committee",
      "Sales & Distribution Committee",
      "HR Compensation Committee"
    ],
    "correctIndex": 1,
    "explanation": "The Valuation Committee oversees fair valuation policies, methodology compliance, and treatment of non-traded or illiquid securities in line with SEBI principles.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q60",
    "courseId": "nism-va",
    "question": "Under SEBI regulations, how frequently must Trustees inspect the operations of the AMC and review scheme transactions?",
    "options": [
      "Once every 3 years",
      "At least once every two months (or six times a year)",
      "Only during annual audit",
      "Only when complaints exceed 1,000"
    ],
    "correctIndex": 1,
    "explanation": "Trustees must meet at least once every two calendar months and review AMC operations, due diligence, compliance certificates, and portfolio performance.",
    "topic": "Legal and Regulatory Framework"
  },
  {
    "id": "nism-va-q61",
    "courseId": "nism-va",
    "question": "Which primary offer document contains detailed scheme-specific information such as investment strategy, asset allocation, fees, and fund manager background?",
    "options": [
      "Statement of Additional Information (SAI)",
      "Scheme Information Document (SID)",
      "Key Information Memorandum (KIM)",
      "Factsheet"
    ],
    "correctIndex": 1,
    "explanation": "The Scheme Information Document (SID) contains all fundamental operational, asset allocation, risk, and fee disclosures specific to that scheme.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q62",
    "courseId": "nism-va",
    "question": "Which document contains statutory disclosures concerning the constitution, history, and financial standing of the Sponsor, AMC, and Trustees?",
    "options": [
      "Scheme Information Document (SID)",
      "Statement of Additional Information (SAI)",
      "Key Information Memorandum (KIM)",
      "Account Statement"
    ],
    "correctIndex": 1,
    "explanation": "The Statement of Additional Information (SAI) contains statutory, legal, and operational information common to all schemes launched by the mutual fund.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q63",
    "courseId": "nism-va",
    "question": "Which abridged document must mandatorily accompany every mutual fund application form offered to prospective investors?",
    "options": [
      "Full Trust Deed",
      "Key Information Memorandum (KIM)",
      "Annual Report",
      "Quarterly Portfolio Sheet"
    ],
    "correctIndex": 1,
    "explanation": "The Key Information Memorandum (KIM) is the concise summary of key elements of the SID and SAI that must be attached to every application form.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q64",
    "courseId": "nism-va",
    "question": "What is an 'Addendum' in the context of mutual fund scheme documentation?",
    "options": [
      "A document that dissolves the scheme",
      "An official notice issued to amend, update, or add terms to an existing SID, SAI, or KIM",
      "An invoice sent to distributors for marketing materials",
      "A court order freezing client folios"
    ],
    "correctIndex": 1,
    "explanation": "An Addendum is a formal public notice and update that modifies or supplements existing information in the SID, SAI, or KIM without republishing the entire booklet.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q65",
    "courseId": "nism-va",
    "question": "If an AMC proposes to change a 'Fundamental Attribute' of a scheme (e.g. investment objective or type of scheme), what statutory option must be given to unitholders?",
    "options": [
      "A compulsory bonus issue of units",
      "Written notice with an exit option to redeem units at prevailing NAV with zero exit load within at least 30 days",
      "A coupon for free financial advisory sessions",
      "Automatic transfer into the sponsor's equity stock"
    ],
    "correctIndex": 1,
    "explanation": "Unitholders must be given written communication, public advertisements, and a 30-day exit window to redeem at prevailing NAV with no exit load.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q66",
    "courseId": "nism-va",
    "question": "By when must an AMC disclose its complete monthly portfolio statement on its website under SEBI guidelines?",
    "options": [
      "Within 5 days of month-end",
      "Within 10 days of month-end",
      "Within 30 days of quarter-end",
      "Only at the end of the financial year"
    ],
    "correctIndex": 1,
    "explanation": "AMCs must publish full portfolio holdings for all schemes on their official website within 10 calendar days of the close of each month.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q67",
    "courseId": "nism-va",
    "question": "For debt mutual fund schemes, what is the mandatory frequency of portfolio disclosure on the AMC website under SEBI guidelines?",
    "options": [
      "Annually",
      "Fortnightly (within 5 days of fortnight-end) and monthly",
      "Every 6 months",
      "Only upon unitholder request"
    ],
    "correctIndex": 1,
    "explanation": "Debt schemes are required to disclose their portfolio on a fortnightly basis within 5 days of each fortnight end, in addition to the monthly disclosure.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q68",
    "courseId": "nism-va",
    "question": "How often must the Key Information Memorandum (KIM) be updated by an Asset Management Company?",
    "options": [
      "Every month",
      "At least once every financial year",
      "Every 5 years",
      "Only when SEBI conducts an audit"
    ],
    "correctIndex": 1,
    "explanation": "KIM must be updated at least once every financial year and made available across all investor service centers and online portals.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q69",
    "courseId": "nism-va",
    "question": "Within what period must a mutual fund publish its half-yearly unaudited financial results on its website?",
    "options": [
      "Within 15 days",
      "Within 1 month from the close of each half-year",
      "Within 3 months",
      "Within 6 months"
    ],
    "correctIndex": 1,
    "explanation": "Mutual funds must publish their unaudited half-yearly financial results within one month from the close of each half-year in an English daily and vernacular newspaper.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q70",
    "courseId": "nism-va",
    "question": "What information is captured in a monthly Mutual Fund Scheme 'Factsheet'?",
    "options": [
      "The personal credit scores of all unitholders",
      "AUM, top 10 portfolio holdings, sector allocation, performance against benchmark, fund manager details, and risk ratios",
      "The salary records of AMC employees",
      "Tax returns of the sponsor"
    ],
    "correctIndex": 1,
    "explanation": "Factsheets provide monthly snapshots of AUM, sector allocations, top holdings, historical trailing returns, portfolio duration/yield, and risk statistics.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q71",
    "courseId": "nism-va",
    "question": "Where can an investor find the historical performance of all mutual fund schemes managed by the same fund manager?",
    "options": [
      "In local classified newspapers only",
      "In the Scheme Information Document (SID) and monthly factsheet as mandated by SEBI performance disclosure norms",
      "It is classified and not accessible to the public",
      "Only through paying a fee to stock exchanges"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates disclosure of performance of all schemes managed by the fund manager across 1, 3, and 5-year periods in the SID, KIM, and factsheets.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q72",
    "courseId": "nism-va",
    "question": "What is the purpose of the SEBI Risk-o-meter displayed on mutual fund scheme documents?",
    "options": [
      "To measure the physical temperature of data centers",
      "To visually communicate the level of risk associated with the principal invested in the scheme (Low to Very High)",
      "To calculate distributor brokerage payout",
      "To track daily trading volumes of the AMC stock"
    ],
    "correctIndex": 1,
    "explanation": "The Risk-o-meter visually conveys the scheme's evaluated risk level across 6 risk bands, updated on a monthly basis.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q73",
    "courseId": "nism-va",
    "question": "Within how many months from the close of the financial year must an AMC dispatch or email the scheme Annual Report to unitholders?",
    "options": [
      "1 month",
      "2 months",
      "Within 4 months",
      "6 months"
    ],
    "correctIndex": 2,
    "explanation": "SEBI regulations require the scheme Annual Report or abridged summary to be emailed to unitholders within 4 months from the close of each financial year.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q74",
    "courseId": "nism-va",
    "question": "What is meant by an 'Abridged Annual Report' in mutual fund disclosures?",
    "options": [
      "A one-page marketing brochure",
      "A concise statutory summary of the audited financial statements, portfolio highlights, and auditor notes formatted per SEBI guidelines",
      "A report containing only the CEO's interview",
      "A document that lists all cancelled investor folios"
    ],
    "correctIndex": 1,
    "explanation": "The abridged annual report contains key balance sheet items, revenue accounts, portfolio summaries, and auditor opinions sent to all unitholders.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q75",
    "courseId": "nism-va",
    "question": "Which entity must file draft offer documents (SID and SAI) with SEBI prior to launching a New Fund Offer (NFO)?",
    "options": [
      "AMFI",
      "The Asset Management Company (AMC) on behalf of the Trustees",
      "The Custodian",
      "The Registrar and Transfer Agent"
    ],
    "correctIndex": 1,
    "explanation": "The AMC files draft SIDs and SAIs with SEBI at least 21 working days before launching an NFO, allowing SEBI to issue regulatory observations.",
    "topic": "Scheme Related Documents"
  },
  {
    "id": "nism-va-q76",
    "courseId": "nism-va",
    "question": "What is the mandatory credential issued by AMFI that an individual must obtain to distribute mutual funds in India?",
    "options": [
      "SEBI Stock Broker License",
      "AMFI Registration Number (ARN)",
      "RBI Banking Correspondent ID",
      "IRDAI Corporate Agent Code"
    ],
    "correctIndex": 1,
    "explanation": "To distribute mutual funds in India, an intermediary must obtain an AMFI Registration Number (ARN) after passing the relevant NISM certification exam.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q77",
    "courseId": "nism-va",
    "question": "What does an Employee Unique Identification Number (EUIN) identify in a mutual fund transaction?",
    "options": [
      "The specific IT terminal where the transaction was entered",
      "The individual sales employee or relationship manager who advised or interacted with the investor",
      "The bank branch IFSC code",
      "The tax identification number of the AMC"
    ],
    "correctIndex": 1,
    "explanation": "EUIN identifies the actual sales person or relationship manager interacting with the client, ensuring accountability and preventing mis-selling.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q78",
    "courseId": "nism-va",
    "question": "When an investor signs an 'Execution-Only' declaration on an application form, what does it signify?",
    "options": [
      "The investor is trading on margin borrowing",
      "The investor executed the transaction without receiving investment advice or contrary to the distributor's advice",
      "The investor waives their rights to redeem units",
      "The transaction is completely tax-free"
    ],
    "correctIndex": 1,
    "explanation": "An execution-only declaration indicates the distributor acted solely as a transaction facilitator and did not provide advisory suitability recommendations.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q79",
    "courseId": "nism-va",
    "question": "Under SEBI's distributor remuneration regulations, how are distributors compensated by AMCs?",
    "options": [
      "Through 100% upfront commission paid on day of investment",
      "Through a full trail commission model based on unitholder asset retention",
      "Through fixed annual retainer fees paid from government funds",
      "Through performance profit-sharing bonuses"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates an all-trail commission model where compensation is paid periodically as a percentage of the investor's sustained assets in the scheme.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q80",
    "courseId": "nism-va",
    "question": "Under SEBI rules, can mutual fund distributors receive upfront commissions or upfronting of trail fees from AMCs?",
    "options": [
      "Yes, up to 5% of transaction value",
      "No, upfront commissions and upfronting of trail fees from AMCs are completely banned",
      "Yes, for investments above \u20b91 Crore",
      "Yes, with unitholder consent"
    ],
    "correctIndex": 1,
    "explanation": "SEBI banned upfront commissions in October 2018 to prevent churning and align distributor incentives with long-term investor holding periods.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q81",
    "courseId": "nism-va",
    "question": "What is the permissible transaction charge that an opted-in distributor can levy on a subscription of \u20b910,000 or more from a first-time mutual fund investor?",
    "options": [
      "\u20b950",
      "\u20b9100",
      "\u20b9150",
      "\u20b9500"
    ],
    "correctIndex": 2,
    "explanation": "SEBI allows opted-in distributors to deduct a transaction charge of \u20b9150 for a first-time mutual fund investor on investments of \u20b910,000 and above (and \u20b9100 for existing investors).",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q82",
    "courseId": "nism-va",
    "question": "For how many years is an NISM Series V-A certification valid from the date of passing the exam?",
    "options": [
      "1 year",
      "3 years",
      "5 years",
      "Lifetime validity"
    ],
    "correctIndex": 1,
    "explanation": "NISM certificates are valid for a period of 3 years and can be renewed by attending a Continuing Professional Education (CPE) program or re-clearing the exam.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q83",
    "courseId": "nism-va",
    "question": "Which of the following practices is explicitly prohibited under the AMFI Code of Conduct for distributors?",
    "options": [
      "Distributing factsheets to clients",
      "Rebating commission to clients or passing on cash kickbacks to induce investments",
      "Explaining the Risk-o-meter to investors",
      "Assisting investors with CKYC verification"
    ],
    "correctIndex": 1,
    "explanation": "Rebating commission, sharing fees, or offering gifts/kickbacks to entice investors is strictly prohibited under AMFI Code of Ethics and SEBI regulations.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q84",
    "courseId": "nism-va",
    "question": "What mandatory statutory disclaimer must be prominently included in all mutual fund promotional material and advertisements?",
    "options": [
      "\"Guaranteed profits are delivered by the fund manager.\"",
      "\"Mutual Fund investments are subject to market risks, read all scheme related documents carefully.\"",
      "\"Returns are protected under the Deposit Insurance Act.\"",
      "\"This scheme is guaranteed to outperform fixed deposits.\""
    ],
    "correctIndex": 1,
    "explanation": "SEBI advertising code mandates the standard visual and audio disclaimer: 'Mutual Fund investments are subject to market risks, read all scheme related documents carefully.'",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q85",
    "courseId": "nism-va",
    "question": "Can an individual act as both a SEBI-registered Investment Adviser (RIA) and earn distributor commissions from the same client?",
    "options": [
      "Yes, if the client signs an indemnity bond",
      "No, SEBI mandates a strict segregation of advisory and distribution activities to eliminate conflicts of interest",
      "Yes, up to \u20b910 Lakhs of commission",
      "Yes, if approved by AMFI"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI (Investment Advisers) Regulations, an intermediary cannot provide fee-based advice and earn distribution commissions from the same client/family.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q86",
    "courseId": "nism-va",
    "question": "What is an Institutional / National Distributor (ND) in mutual fund distribution?",
    "options": [
      "An individual IFA operating in a rural village",
      "A corporate entity with a multi-branch network, such as a commercial bank, NBFC, or national wealth firm distributing products across India",
      "The regulatory department of the Ministry of Finance",
      "A software vendor building trading terminals"
    ],
    "correctIndex": 1,
    "explanation": "National Distributors are corporate distribution entities (banks, NBFCs, retail brokerage chains) with wide branch networks distributing across multiple AMCs.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q87",
    "courseId": "nism-va",
    "question": "What happens if a mutual fund distributor fails to renew their NISM certification and ARN before expiry?",
    "options": [
      "Their ARN is made permanently invalid without appeal",
      "Their ARN is suspended, and trail commissions on existing client folios are withheld during the invalidity period",
      "They are fined \u20b91 Crore by the RBI",
      "Their clients' units are automatically redeemed"
    ],
    "correctIndex": 1,
    "explanation": "Upon ARN expiration, the distributor cannot solicit new investments, and trail commissions are withheld until certification renewal is completed.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q88",
    "courseId": "nism-va",
    "question": "Which electronic platforms enable mutual fund distributors to process transactions seamlessly for their clients on stock exchange infrastructure?",
    "options": [
      "BSE StAR MF and NSE NMF II",
      "SWIFT and Fedwire",
      "NEFT and RTGS only",
      "DigiLocker and UMANG"
    ],
    "correctIndex": 0,
    "explanation": "BSE StAR MF and NSE NMF II are the primary exchange-hosted order routing platforms used by distributors for seamless execution.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q89",
    "courseId": "nism-va",
    "question": "What is the primary objective of AMFI's 'Due Diligence' process for large mutual fund distributors?",
    "options": [
      "To set their commission percentages",
      "To assess organizational infrastructure, customer complaint mechanisms, sales practices, and regulatory compliance",
      "To audit their personal tax returns",
      "To mandate minimum sales quotas"
    ],
    "correctIndex": 1,
    "explanation": "AMCs conduct due diligence on institutional and large distributors to verify compliance with investor protection, fair selling, and KYC standards.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q90",
    "courseId": "nism-va",
    "question": "Under what condition does a distributor need to provide a transaction confirmation with EUIN?",
    "options": [
      "Only when buying gold funds",
      "For all advisory transactions where the distributor's employee interacted with and guided the investor",
      "Only for NRI transactions above $100,000",
      "Never, EUIN is entirely optional"
    ],
    "correctIndex": 1,
    "explanation": "EUIN is mandatory on all transaction forms where advice or customer interaction took place, establishing sales agent traceability.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q91",
    "courseId": "nism-va",
    "question": "What is the basic formula for calculating the Net Asset Value (NAV) per unit of a mutual fund scheme?",
    "options": [
      "(Total Assets + Liabilities) / Units Issued",
      "(Market Value of Investments + Receivables + Other Assets - Liabilities - Accrued Expenses) / Outstanding Units",
      "(Total Face Value of Shares) / Number of Unitholders",
      "(Annual Dividend) / Share Price"
    ],
    "correctIndex": 1,
    "explanation": "NAV = (Total Market Value of Portfolio Assets + Current Assets - Current Liabilities - Accrued Expenses) / Total Number of Units in Circulation.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q92",
    "courseId": "nism-va",
    "question": "How are equity shares listed on a recognized stock exchange valued for calculating a mutual fund scheme's daily NAV?",
    "options": [
      "At historical acquisition cost",
      "At the daily closing market price on the designated primary stock exchange (NSE/BSE)",
      "At the average price of the last 52 weeks",
      "At the book value per share"
    ],
    "correctIndex": 1,
    "explanation": "SEBI valuation rules require listed equity securities to be valued daily at the closing market price on the primary stock exchange (NSE or BSE).",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q93",
    "courseId": "nism-va",
    "question": "What is the maximum base Total Expense Ratio (TER) permissible for an open-ended equity scheme on the first \u20b9500 crores of daily net assets under SEBI slabs?",
    "options": [
      "1.50%",
      "2.00%",
      "2.25%",
      "2.75%"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI regulations, the maximum base TER for the first \u20b9500 crores of daily net assets of an open-ended equity-oriented scheme is 2.25%.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q94",
    "courseId": "nism-va",
    "question": "What is the cut-off time for receiving purchase applications in Liquid and Overnight funds for historical NAV applicability?",
    "options": [
      "12:00 Noon",
      "1:30 PM",
      "3:00 PM",
      "3:30 PM"
    ],
    "correctIndex": 1,
    "explanation": "The cut-off time for Liquid and Overnight fund purchase applications is 1:30 PM (subject to fund realization in the scheme's account before cut-off).",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q95",
    "courseId": "nism-va",
    "question": "For equity and debt mutual fund schemes (other than Liquid/Overnight), what is the standard cut-off timing for subscriptions and redemptions?",
    "options": [
      "1:00 PM",
      "2:00 PM",
      "3:00 PM",
      "5:00 PM"
    ],
    "correctIndex": 2,
    "explanation": "The standard cut-off timing for subscriptions and redemptions in equity, hybrid, and standard debt schemes is 3:00 PM.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q96",
    "courseId": "nism-va",
    "question": "Under SEBI's 'Realization of Funds' rule for mutual fund subscriptions, when is NAV allocated to an investor's application?",
    "options": [
      "On the day the application form is submitted, regardless of when money reaches the AMC",
      "Only on the business day when funds are actually credited and available in the scheme's bank account before cut-off time, irrespective of transaction size",
      "Always 3 days after check deposit",
      "On the last working day of the month"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates that applicable NAV is determined by the day on which investor funds are realized and credited into the scheme account before cut-off.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q97",
    "courseId": "nism-va",
    "question": "When an exit load is deducted upon premature redemption of mutual fund units, what does the AMC do with the deducted amount?",
    "options": [
      "Keeps it as corporate profit of the AMC",
      "Credits 100% of the exit load amount directly back to the scheme to benefit remaining unitholders",
      "Pays it as bonus commission to distributors",
      "Remits it to the Income Tax Department"
    ],
    "correctIndex": 1,
    "explanation": "SEBI regulations mandate that 100% of any exit load collected must be credited back into the scheme pool to compensate remaining unitholders.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q98",
    "courseId": "nism-va",
    "question": "What is the rate of statutory Stamp Duty levied on the purchase of mutual fund units in India since July 1, 2020?",
    "options": [
      "0.005%",
      "0.015%",
      "0.10%",
      "1.00%"
    ],
    "correctIndex": 0,
    "explanation": "Stamp Duty at the rate of 0.005% (50 paise per \u20b910,000) is deducted on all purchases and additions of mutual fund units (SIP, lumpsum, STP).",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q99",
    "courseId": "nism-va",
    "question": "What accounting method is followed by mutual funds for recognizing interest income on debt securities?",
    "options": [
      "Cash basis accounting upon actual coupon receipt",
      "Accrual basis accounting on a daily basis",
      "Deferred accounting at maturity",
      "LIFO accounting"
    ],
    "correctIndex": 1,
    "explanation": "Mutual funds follow accrual accounting, recognizing daily coupon interest earned on debt instruments into the NAV each day.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q100",
    "courseId": "nism-va",
    "question": "What is the maximum base Total Expense Ratio (TER) permissible for an open-ended debt scheme on the first \u20b9500 crores of AUM under SEBI regulations?",
    "options": [
      "1.50%",
      "2.00%",
      "2.25%",
      "2.50%"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI limits, the base TER for open-ended debt schemes on the first \u20b9500 crores of daily net assets is capped at 2.00%.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q101",
    "courseId": "nism-va",
    "question": "How does a high Total Expense Ratio (TER) affect an investor's compounded net return over a 15-year period?",
    "options": [
      "It increases net returns through higher fund manager bonuses",
      "It directly reduces the net return compounded annually, substantially lowering the final terminal wealth",
      "It has zero impact on compounded wealth",
      "It provides higher tax refunds"
    ],
    "correctIndex": 1,
    "explanation": "Because TER is deducted daily from scheme net assets before publishing NAV, a higher expense ratio compounds over time, reducing net investor wealth.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q102",
    "courseId": "nism-va",
    "question": "What happens to the NAV of a scheme on the 'Ex-Dividend' (Ex-IDCW) date?",
    "options": [
      "The NAV doubles",
      "The NAV drops by the gross dividend amount declared per unit",
      "The NAV is frozen for 30 days",
      "The NAV remains exactly unchanged"
    ],
    "correctIndex": 1,
    "explanation": "When a dividend/IDCW is distributed, funds are paid out from the scheme's distributable surplus, causing the NAV to fall by the exact per-unit payout amount.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q103",
    "courseId": "nism-va",
    "question": "What is 'Marking-to-Market' in mutual fund portfolio valuation?",
    "options": [
      "Writing the brand logo of the AMC on stock certificates",
      "Valuing all portfolio investments at current prevailing market prices rather than historical acquisition cost",
      "Selling the entire portfolio at the end of each day",
      "Publishing advertising billboards in financial districts"
    ],
    "correctIndex": 1,
    "explanation": "Marking-to-market is the daily revaluation of all scheme assets based on latest closing exchange prices and matrix valuations.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q104",
    "courseId": "nism-va",
    "question": "Under SEBI rules, within how many business days must an AMC dispatch or credit redemption proceeds to an investor?",
    "options": [
      "Within 3 working days (T+3) for standard equity schemes",
      "10 working days",
      "15 working days",
      "30 working days"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that redemption proceeds must be credited within 3 working days for standard equity schemes (and T+1 or T+2 for debt/liquid schemes).",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q105",
    "courseId": "nism-va",
    "question": "What penalty must an AMC pay to unitholders if redemption proceeds are delayed beyond the statutory SEBI timeline?",
    "options": [
      "A written apology letter",
      "Interest @ 15% per annum for the period of delay",
      "A waiver of future exit loads",
      "Free bonus units of another scheme"
    ],
    "correctIndex": 1,
    "explanation": "If redemption proceeds are delayed beyond statutory timelines, the AMC must pay interest at the rate of 15% per annum to the unitholder for the delayed period.",
    "topic": "Net Asset Value, TER & Pricing"
  },
  {
    "id": "nism-va-q106",
    "courseId": "nism-va",
    "question": "What is the statutory threshold for a mutual fund to qualify as an 'Equity Oriented Fund' under Section 112A of the Income Tax Act?",
    "options": [
      "At least 50% in equity",
      "At least 65% of total proceeds invested in equity shares of domestic listed companies",
      "At least 80% in gold and equities",
      "At least 90% in large cap shares"
    ],
    "correctIndex": 1,
    "explanation": "An equity-oriented mutual fund is defined as a scheme where at least 65% of total portfolio assets are invested in equity shares of domestic companies.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q107",
    "courseId": "nism-va",
    "question": "Effective post Budget 2024, what is the tax rate on Long-Term Capital Gains (LTCG) from equity mutual funds held for more than 12 months?",
    "options": [
      "10% on gains exceeding \u20b91 Lakh",
      "12.5% on gains exceeding \u20b91.25 Lakh per financial year",
      "15% on all gains",
      "20% with indexation"
    ],
    "correctIndex": 1,
    "explanation": "Budget 2024 revised the Section 112A LTCG tax rate to 12.5% with the annual tax-exempt threshold increased from \u20b91 Lakh to \u20b91.25 Lakhs.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q108",
    "courseId": "nism-va",
    "question": "Effective post Budget 2024, what is the Short-Term Capital Gains (STCG) tax rate on equity mutual funds held for 12 months or less under Section 111A?",
    "options": [
      "10%",
      "15%",
      "20%",
      "Applicable slab rates"
    ],
    "correctIndex": 2,
    "explanation": "Budget 2024 increased the Short-Term Capital Gains (STCG) tax rate under Section 111A for listed equities and equity mutual funds from 15% to 20%.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q109",
    "courseId": "nism-va",
    "question": "How are capital gains on 'Specified Mutual Funds' (debt mutual funds investing 35% or less in equity) taxed post Finance Act 2023?",
    "options": [
      "Taxed at 10% after 3 years",
      "Taxed at 20% with indexation benefit",
      "Treated as deemed short-term capital gains and taxed at the investor's applicable income tax slab rates regardless of holding period",
      "Completely tax-free"
    ],
    "correctIndex": 2,
    "explanation": "Finance Act 2023 introduced Section 50AA: debt funds with $\\le 35\\%$ domestic equity acquired after April 1, 2023 are taxed at income slab rates with no indexation.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q110",
    "courseId": "nism-va",
    "question": "How is dividend income (IDCW) received by an individual investor from mutual funds taxed under current Indian tax laws?",
    "options": [
      "Tax-free up to \u20b910 Lakhs",
      "Taxable in the hands of the investor at their applicable personal income tax slab rate",
      "Taxed at a flat rate of 10% without deductions",
      "Subject only to Dividend Distribution Tax paid by the AMC"
    ],
    "correctIndex": 1,
    "explanation": "DDT was abolished; dividend/IDCW receipts are now added to the investor's total income and taxed at their applicable slab rate.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q111",
    "courseId": "nism-va",
    "question": "What is the threshold above which an AMC must deduct 10% TDS under Section 194K on dividend (IDCW) payouts to resident unitholders in a financial year?",
    "options": [
      "\u20b91,000",
      "\u20b92,500",
      "\u20b95,000",
      "\u20b910,000"
    ],
    "correctIndex": 2,
    "explanation": "Under Section 194K, TDS @ 10% is deducted on mutual fund dividend payments exceeding \u20b95,000 in aggregate to a resident individual during a financial year.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q112",
    "courseId": "nism-va",
    "question": "Can Long-Term Capital Losses (LTCL) on equity mutual funds be set off against Short-Term Capital Gains (STCG)?",
    "options": [
      "Yes, capital losses can be set off against any capital gain",
      "No, Long-Term Capital Losses can only be set off against Long-Term Capital Gains",
      "Yes, but only up to \u20b950,000",
      "Yes, if approved by the Assessing Officer"
    ],
    "correctIndex": 1,
    "explanation": "Under Section 70 of the Income Tax Act, LTCL can only be set off against LTCG. In contrast, STCL can be set off against both STCG and LTCG.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q113",
    "courseId": "nism-va",
    "question": "For how many consecutive assessment years can unabsorbed capital losses from mutual funds be carried forward, provided the return of income is filed on time?",
    "options": [
      "3 years",
      "5 years",
      "Up to 8 Assessment Years",
      "Indefinitely"
    ],
    "correctIndex": 2,
    "explanation": "Both long-term and short-term capital losses can be carried forward for up to 8 assessment years immediately succeeding the year of loss.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q114",
    "courseId": "nism-va",
    "question": "Is Securities Transaction Tax (STT) applicable when an investor sells or redeems units of a pure debt mutual fund scheme?",
    "options": [
      "Yes, @ 0.001%",
      "No, STT is not applicable on transactions in debt mutual fund schemes",
      "Yes, @ 0.125%",
      "Yes, but only for transactions above \u20b910 Lakhs"
    ],
    "correctIndex": 1,
    "explanation": "STT applies only to equity shares and equity-oriented mutual fund redemptions/ETFs; it is not levied on debt schemes or liquid funds.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q115",
    "courseId": "nism-va",
    "question": "What is the tax rate applicable on Short-Term Capital Gains (STCG) on hybrid mutual funds with equity exposure between 35% and 65%?",
    "options": [
      "Flat 15%",
      "Flat 20%",
      "Applicable personal income tax slab rate of the investor",
      "12.5%"
    ],
    "correctIndex": 2,
    "explanation": "Hybrid funds with $>35\\%$ but $<65\\%$ equity held for $\\le 24$ months generate STCG taxed at the investor's applicable slab rate.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q116",
    "courseId": "nism-va",
    "question": "Under Section 80C of the Income Tax Act, what is the maximum tax deduction available for investing in Equity Linked Savings Schemes (ELSS)?",
    "options": [
      "\u20b950,000",
      "\u20b91,00,000",
      "\u20b91,50,000 per financial year",
      "\u20b92,50,000"
    ],
    "correctIndex": 2,
    "explanation": "Investments in ELSS qualify for deduction under Section 80C of the Income Tax Act up to a maximum overall ceiling of \u20b91.50 Lakhs per financial year.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q117",
    "courseId": "nism-va",
    "question": "What is the statutory lock-in period for units purchased in an Equity Linked Savings Scheme (ELSS)?",
    "options": [
      "1 year",
      "3 years from the date of allotment",
      "5 years",
      "Until retirement at age 60"
    ],
    "correctIndex": 1,
    "explanation": "ELSS units are subject to a mandatory statutory lock-in period of 3 years from the date of allotment. For SIPs, each instalment has its own 3-year lock-in.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q118",
    "courseId": "nism-va",
    "question": "What is 'Bonus Stripping' prevention rule under Section 94(8) of the Income Tax Act?",
    "options": [
      "A rule preventing employees from taking cash bonuses",
      "A rule that disallows capital losses generated by buying units before bonus issue and selling original units after bonus allotment within specified time windows",
      "A rule doubling bonus taxes",
      "A rule prohibiting bonus units in equity funds"
    ],
    "correctIndex": 1,
    "explanation": "Section 94(8) ignores artificial losses created when units bought within 3 months prior to record date are sold within 9 months after while retaining bonus units.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q119",
    "courseId": "nism-va",
    "question": "What is 'Dividend Stripping' under Section 94(7) of the Income Tax Act?",
    "options": [
      "Disallowing capital losses on sale of units bought within 3 months before record date and sold within 9 months after, to the extent of tax-free/exempt dividend received",
      "Banning dividend payments across all schemes",
      "Mandating 100% tax on dividends",
      "A method to accelerate dividend payouts"
    ],
    "correctIndex": 0,
    "explanation": "Section 94(7) prevents tax avoidance through buying units just before dividend record date and selling at an ex-dividend loss immediately after.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q120",
    "courseId": "nism-va",
    "question": "For a Non-Resident Indian (NRI) investor redeeming equity mutual fund units in India, how is capital gains tax collected?",
    "options": [
      "The NRI files self-assessment tax after returning to India",
      "TDS (Tax Deducted at Source) is mandatorily deducted at applicable rates by the AMC at the time of redemption payout",
      "No tax is deducted in India due to DTAA",
      "The NRI pays tax directly to the foreign bank"
    ],
    "correctIndex": 1,
    "explanation": "Unlike resident investors where no TDS is deducted on capital gains, the AMC must deduct TDS at applicable rates on redemption proceeds for NRIs.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q121",
    "courseId": "nism-va",
    "question": "Which centralized regulatory entity operates KYC Registration Agencies (KRAs) in India?",
    "options": [
      "IRDAI",
      "SEBI-registered KRAs (such as CVL, NDML, CAMS, Karvy, DotEx)",
      "Reserve Bank of India",
      "Income Tax Department"
    ],
    "correctIndex": 1,
    "explanation": "SEBI-registered KRAs maintain centralized unitholder KYC records, so an investor only needs to complete KYC once across all mutual funds.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q122",
    "courseId": "nism-va",
    "question": "What is the maximum number of nominees that can be registered for a single mutual fund folio in India?",
    "options": [
      "Only 1",
      "Up to 2",
      "Up to 3 nominees",
      "Up to 5 nominees"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI and AMFI guidelines, an investor can register up to 3 nominees per folio, specifying the percentage share for each summing to 100%.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q123",
    "courseId": "nism-va",
    "question": "Why are 'Third-Party Payments' generally rejected in mutual fund investments?",
    "options": [
      "To prevent loss of distributor commission",
      "To comply with Prevention of Money Laundering Act (PMLA) regulations and verify money originates from the investor's own verified bank account",
      "Because banks charge higher NEFT fees on third-party transactions",
      "Because third-party units cannot be redeemed"
    ],
    "correctIndex": 1,
    "explanation": "Third-party payment bans ensure funds originate from the unitholder's own bank account, preventing money laundering and anonymous fund flow.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q124",
    "courseId": "nism-va",
    "question": "Which of the following is an authorized exception where a third-party payment is permitted for a mutual fund investment?",
    "options": [
      "A friend paying for another friend's equity SIP",
      "A parent or grandparent paying up to \u20b950,000 per transaction as a gift for a minor child's folio",
      "A real estate developer investing on behalf of buyers",
      "An employer investing on personal behalf without payroll linkage"
    ],
    "correctIndex": 1,
    "explanation": "Exceptions include: parents/grandparents gifting to minor up to \u20b950,000, employer on behalf of employee via payroll, or custodian on behalf of institutional client.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q125",
    "courseId": "nism-va",
    "question": "What is the process of 'Transmission' of mutual fund units?",
    "options": [
      "Electronic transfer of units from an Indian investor to an overseas fund",
      "The legal transfer of units to the surviving joint unitholder, nominee, or legal heir upon the demise of the registered unitholder",
      "Converting mutual fund units into cash at an ATM",
      "Broadcasting scheme NAVs via radio"
    ],
    "correctIndex": 1,
    "explanation": "Transmission refers to transfer of ownership of units by operation of law upon the death or insolvency of the original unit holder.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q126",
    "courseId": "nism-va",
    "question": "In a joint mutual fund folio with holding mode 'Either or Survivor', what happens upon the demise of the first unitholder?",
    "options": [
      "The units are automatically surrendered to the state government",
      "The surviving second holder becomes the sole owner upon submitting the death certificate and KYC documentation",
      "The nominee overrides the surviving holder immediately",
      "The folio is liquidated and proceeds sent to courts"
    ],
    "correctIndex": 1,
    "explanation": "Under 'Either or Survivor', the surviving unitholder has immediate rights to operate the account and becomes the sole owner upon submission of death certificate.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q127",
    "courseId": "nism-va",
    "question": "When mutual fund units are held in dematerialized (Demat) mode, which nomination records take legal precedence?",
    "options": [
      "The nomination registered with the AMC folio",
      "The nomination registered with the Depository Participant (DP) for the demat account",
      "The distributor's personal CRM records",
      "The will registered with the employer"
    ],
    "correctIndex": 1,
    "explanation": "For demat units, the nomination registered with the Depository Participant (DP) under Depository Bye-Laws automatically governs the units.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q128",
    "courseId": "nism-va",
    "question": "Can an investor pledge their mutual fund units to a commercial bank or financial institution as collateral for a loan?",
    "options": [
      "No, mutual fund units cannot be pledged under any circumstances",
      "Yes, units can be pledged or lien-marked in favor of a lender by submitting a pledge request form to the AMC/RTA or Depository",
      "Yes, but only for ELSS schemes during lock-in",
      "Yes, but the units must be converted to physical share certificates first"
    ],
    "correctIndex": 1,
    "explanation": "Mutual fund units can be pledged or lien-marked in favor of banks/NBFCs as loan collateral. The units cannot be redeemed until the lender releases the lien.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q129",
    "courseId": "nism-va",
    "question": "What happens to a minor's mutual fund folio when the minor reaches 18 years of age (becomes a major)?",
    "options": [
      "The guardian continues to operate the account indefinitely",
      "All debit transactions are frozen until the newly turned major completes KYC, provides signature attestation, and updates their own bank account details",
      "The scheme automatically redeems all units to the guardian's bank",
      "The units are converted into government bonds"
    ],
    "correctIndex": 1,
    "explanation": "Upon turning 18, the minor becomes a major. All transactions are frozen until the major submits KYC documents, bank mandate, and specimen signature.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q130",
    "courseId": "nism-va",
    "question": "What is the annual investment ceiling per financial year per AMC for 'Micro SIPs' without submitting a PAN card?",
    "options": [
      "\u20b910,000",
      "\u20b925,000",
      "\u20b950,000 per financial year per AMC",
      "\u20b91,00,000"
    ],
    "correctIndex": 2,
    "explanation": "Micro SIPs (investments up to \u20b950,000 per financial year per mutual fund) are exempt from the mandatory PAN requirement, though photo KYC remains compulsory.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q131",
    "courseId": "nism-va",
    "question": "What is a 'Consolidated Account Statement' (CAS) received by mutual fund investors?",
    "options": [
      "A credit card statement showing mutual fund purchases",
      "A single monthly consolidated statement showing all financial transactions and balances across all mutual funds and demat accounts sharing the same PAN",
      "A statement sent only to institutional investors",
      "A document listing complaints filed against the AMC"
    ],
    "correctIndex": 1,
    "explanation": "CAS is a single monthly statement sent by Depositories/RTAs consolidating all transactions and holdings across all mutual fund folios and demat accounts linked to a PAN.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q132",
    "courseId": "nism-va",
    "question": "Under what condition will an investor receive a physical or electronic CAS for a calendar month?",
    "options": [
      "Only if they have filed an income tax return in that month",
      "If any financial transaction (purchase, redemption, SIP, STP, SWP, dividend) occurred in any of their folios during that month",
      "Only on their birthday",
      "Only if their portfolio value exceeds \u20b91 Crore"
    ],
    "correctIndex": 1,
    "explanation": "A monthly CAS is generated and sent by the 15th of the following month if any financial transaction took place across the investor's folios.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q133",
    "courseId": "nism-va",
    "question": "What is the 14-digit identifier issued by the Central KYC Registry (CKYCR) in India called?",
    "options": [
      "PAN Number",
      "Aadhaar Virtual ID",
      "KYC Identification Number (KIN)",
      "DIN Number"
    ],
    "correctIndex": 2,
    "explanation": "CKYCR issues a 14-digit KYC Identification Number (KIN) that allows an investor to establish identity across all SEBI, RBI, IRDAI, and PFRDA entities.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q134",
    "courseId": "nism-va",
    "question": "Which payment mechanism allows automatic periodic debit from an investor's bank account for SIP investments via NPCI infrastructure?",
    "options": [
      "National Automated Clearing House (NACH) e-Mandate",
      "RTGS telegraphic transfer",
      "Money Order",
      "Demand Draft"
    ],
    "correctIndex": 0,
    "explanation": "NACH (National Automated Clearing House) mandates enable automated periodic debits for recurring mutual fund SIP instalments.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q135",
    "courseId": "nism-va",
    "question": "What is the primary grievance redressal web portal provided by SEBI for unitholder complaints against mutual funds?",
    "options": [
      "SEBI SCORES (SEBI Complaints Redress System)",
      "IN-CREDIT Portal",
      "RBI Ombudsman Gateway",
      "National Consumer Forum"
    ],
    "correctIndex": 0,
    "explanation": "SCORES (SEBI Complaints Redress System) is SEBI's centralized online grievance redressal platform where investors can lodge and track complaints.",
    "topic": "Investor Services"
  },
  {
    "id": "nism-va-q136",
    "courseId": "nism-va",
    "question": "Which statistical measure reflects the total risk or volatility of returns around the mean for a mutual fund scheme?",
    "options": [
      "Beta",
      "Standard Deviation",
      "R-Squared",
      "Coupon Rate"
    ],
    "correctIndex": 1,
    "explanation": "Standard Deviation measures total risk \u2014 the dispersion of monthly or annual returns around the historical average return of the scheme.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q137",
    "courseId": "nism-va",
    "question": "What does a scheme Beta (\u03b2) of 1.25 indicate relative to its benchmark index?",
    "options": [
      "The scheme is 25% less volatile than the benchmark index",
      "The scheme tends to move by 1.25% for every 1% move in the benchmark index, reflecting higher systematic risk",
      "The scheme has delivered 1.25% excess dividend yield",
      "The fund manager has made 25% errors in portfolio replication"
    ],
    "correctIndex": 1,
    "explanation": "Beta measures systematic sensitivity to the market index. A Beta of 1.25 signifies that the fund is 25% more volatile than the benchmark index.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q138",
    "courseId": "nism-va",
    "question": "What does the Sharpe Ratio measure in portfolio evaluation?",
    "options": [
      "Total return minus inflation",
      "Excess return generated per unit of total risk (Standard Deviation): (Rp - Rf) / \u03c3p",
      "Dividend payout divided by market price",
      "Trading turnover per calendar quarter"
    ],
    "correctIndex": 1,
    "explanation": "Sharpe Ratio = (Portfolio Return - Risk-free Rate) / Standard Deviation. A higher Sharpe ratio indicates superior risk-adjusted performance.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q139",
    "courseId": "nism-va",
    "question": "How does the Treynor Ratio differ from the Sharpe Ratio?",
    "options": [
      "Treynor uses Total Expense Ratio instead of returns",
      "Treynor measures excess return per unit of systematic risk (Beta) rather than total risk (Standard Deviation)",
      "Treynor applies only to real estate funds",
      "Treynor is measured in dollars instead of percentages"
    ],
    "correctIndex": 1,
    "explanation": "Treynor Ratio = (Portfolio Return - Risk-free Rate) / Beta. It evaluates excess return per unit of market (systematic) risk.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q140",
    "courseId": "nism-va",
    "question": "What does Jensen's Alpha (\u03b1) quantify in active portfolio management?",
    "options": [
      "The total brokerage cost incurred on stock purchases",
      "The excess return generated by the fund manager above the expected return predicted by the Capital Asset Pricing Model (CAPM)",
      "The percentage of cash held in the scheme",
      "The time taken to liquidate top 10 stocks"
    ],
    "correctIndex": 1,
    "explanation": "Jensen's Alpha measures the value added by the fund manager's active stock selection and market timing after adjusting for systematic risk (Beta).",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q141",
    "courseId": "nism-va",
    "question": "What is 'Tracking Error' in the context of an Index Fund or ETF?",
    "options": [
      "The number of software glitches reported on the broker app",
      "The annualized standard deviation of the excess daily returns between the index fund and its underlying benchmark index",
      "The delay in crediting dividend cheques",
      "The percentage of illiquid securities held in the index"
    ],
    "correctIndex": 1,
    "explanation": "Tracking Error measures how closely a passive fund replicates its benchmark index. Lower tracking error signifies superior replication precision.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q142",
    "courseId": "nism-va",
    "question": "Why did SEBI mandate that all mutual fund performance benchmarks must use the 'Total Return Index' (TRI) instead of the 'Price Return Index' (PRI)?",
    "options": [
      "To artificially lower fund manager bonus targets",
      "Because TRI includes both capital gains and dividend payouts, providing a fair and realistic benchmark comparison for active mutual funds",
      "To eliminate foreign institutional investments",
      "Because PRI is no longer computed by stock exchanges"
    ],
    "correctIndex": 1,
    "explanation": "A Price Return Index ignores dividends paid by index constituent companies. TRI incorporates dividend reinvestment, providing an honest benchmark.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q143",
    "courseId": "nism-va",
    "question": "Why are 'Rolling Returns' considered more reliable than point-to-point trailing returns when evaluating mutual fund performance consistency?",
    "options": [
      "Rolling returns only evaluate profitable years",
      "Rolling returns evaluate multiple overlapping holding periods, eliminating starting date and ending date point-to-point biases",
      "Rolling returns ignore market crashes",
      "Rolling returns are calculated by government auditors"
    ],
    "correctIndex": 1,
    "explanation": "Rolling returns measure performance across every possible 3-year or 5-year window, eliminating entry/exit timing luck and highlighting consistency.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q144",
    "courseId": "nism-va",
    "question": "What does 'Modified Duration' measure in a fixed income portfolio?",
    "options": [
      "The legal expiry date of the fund deed",
      "The percentage change in a bond's price for a 100 basis point (1%) change in market yield",
      "The average coupon rate of bonds held",
      "The time taken to issue new units"
    ],
    "correctIndex": 1,
    "explanation": "Modified Duration measures a bond or debt portfolio's price sensitivity to interest rate changes (Price Change % \u2248 -Modified Duration \u00d7 Change in Yield).",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q145",
    "courseId": "nism-va",
    "question": "What does a high 'Portfolio Turnover Ratio' (e.g. 150%) typically indicate in an equity scheme?",
    "options": [
      "The fund manager buys and holds stocks for over 10 years",
      "The fund manager frequently buys and sells securities, which may result in higher brokerage costs and trading friction",
      "The scheme has zero cash holdings",
      "The scheme is completely invested in government bonds"
    ],
    "correctIndex": 1,
    "explanation": "Portfolio Turnover Ratio measures the frequency with which portfolio holdings are replaced. High turnover implies frequent trading and higher transaction costs.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q146",
    "courseId": "nism-va",
    "question": "If Scheme A has a Sharpe Ratio of 1.10 and Scheme B has a Sharpe Ratio of 0.65 with similar returns, which scheme delivered superior risk-adjusted return?",
    "options": [
      "Scheme B, because lower ratios are preferable",
      "Scheme A, because it generated significantly higher excess return per unit of volatility taken",
      "Both schemes delivered identical risk-adjusted returns",
      "Cannot be determined without knowing the AMC name"
    ],
    "correctIndex": 1,
    "explanation": "A higher Sharpe Ratio signifies superior return per unit of risk. Scheme A generated 1.10 units of excess return per unit of volatility vs 0.65 for Scheme B.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q147",
    "courseId": "nism-va",
    "question": "What does R-Squared (R\u00b2) represent when comparing a mutual fund to its benchmark index?",
    "options": [
      "The fund's return divided by inflation",
      "The percentage of a fund's movements that can be explained by movements in its benchmark index",
      "The number of stocks held in the fund",
      "The ratio of equity to debt"
    ],
    "correctIndex": 1,
    "explanation": "R-squared measures the correlation of the fund to its benchmark on a scale of 0 to 100%. An R\u00b2 of 95% means 95% of the fund's returns are explained by benchmark moves.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q148",
    "courseId": "nism-va",
    "question": "What is 'Yield to Maturity' (YTM) of a debt mutual fund portfolio?",
    "options": [
      "The guaranteed annual dividend yield of the fund",
      "The expected weighted average annualized rate of return of all bonds held in the portfolio if held until maturity, assuming zero default and coupon reinvestment",
      "The maximum exit load charged on redemption",
      "The coupon rate of the 10-year benchmark G-Sec"
    ],
    "correctIndex": 1,
    "explanation": "YTM is the internal rate of return (IRR) of all expected cash flows of the portfolio securities, assuming all bonds are held to maturity without default.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q149",
    "courseId": "nism-va",
    "question": "Which of the following describes 'Credit Spread' in bond markets?",
    "options": [
      "The broker commission on corporate bond purchases",
      "The yield difference between a corporate bond and a risk-free government security of identical maturity",
      "The difference between buy and sell prices on stock exchanges",
      "The maximum bank overdraft permitted to an AMC"
    ],
    "correctIndex": 1,
    "explanation": "Credit spread is the additional yield offered by a corporate bond over a sovereign G-Sec of the same maturity to compensate investors for credit risk.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q150",
    "courseId": "nism-va",
    "question": "What does 'Downward Yield Curve Inversion' typically signal in macroeconomic analysis?",
    "options": [
      "Rapid economic expansion and runaway inflation",
      "Anticipated economic slowdown or impending recession with market expectation of future central bank rate cuts",
      "A technical computer glitch at clearing corporations",
      "Immediate corporate tax cuts"
    ],
    "correctIndex": 1,
    "explanation": "An inverted yield curve (where short-term yields exceed long-term yields) historically reflects market expectations of economic contraction and interest rate cuts.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q151",
    "courseId": "nism-va",
    "question": "Under SEBI scheme categorisation norms, how is a 'Large Cap Fund' defined?",
    "options": [
      "Minimum 50% in top 500 companies",
      "Minimum 80% of total assets invested in equity shares of the top 100 companies by full market capitalization",
      "Minimum 65% in small cap companies",
      "Minimum 90% in government PSUs"
    ],
    "correctIndex": 1,
    "explanation": "Large Cap Funds must invest at least 80% of total assets in the 1st to 100th companies ranked by full market capitalization.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q152",
    "courseId": "nism-va",
    "question": "How are 'Mid Cap' companies classified under SEBI's standardized definition?",
    "options": [
      "Companies ranked from 50th to 150th by market capitalization",
      "Companies ranked from 101st to 250th by full market capitalization",
      "Companies with market capitalization below \u20b9500 Crores",
      "Companies operating in rural areas"
    ],
    "correctIndex": 1,
    "explanation": "SEBI categorizes companies ranked from 101st to 250th in terms of full market capitalization as Mid Cap companies.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q153",
    "courseId": "nism-va",
    "question": "What is the mandatory minimum asset allocation in equity for a 'Multi Cap Fund' across market capitalizations under SEBI circulars?",
    "options": [
      "Minimum 65% in large caps only",
      "Minimum 25% each in Large Cap, Mid Cap, and Small Cap companies (total at least 75% in equity)",
      "Minimum 50% in flexi cap stocks",
      "Minimum 10% in international equities"
    ],
    "correctIndex": 1,
    "explanation": "Multi Cap Funds must maintain a disciplined minimum allocation of 25% in Large Caps, 25% in Mid Caps, and 25% in Small Caps at all times.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q154",
    "courseId": "nism-va",
    "question": "How does a 'Flexi Cap Fund' differ from a 'Multi Cap Fund' under SEBI categorisation?",
    "options": [
      "Flexi cap funds must invest only in unlisted tech startups",
      "Flexi Cap Funds must invest at least 65% in equity, but have complete flexibility to allocate across large, mid, and small cap stocks without rigid market-cap minimums",
      "Flexi cap funds carry a mandatory 5-year lock-in period",
      "Flexi cap funds cannot invest in large cap stocks"
    ],
    "correctIndex": 1,
    "explanation": "Flexi Cap Funds require a minimum 65% total equity allocation, but the fund manager is free to dynamically shift between large, mid, and small caps.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q155",
    "courseId": "nism-va",
    "question": "What is the maximum number of stocks that a 'Focused Fund' can hold in its portfolio under SEBI rules?",
    "options": [
      "Maximum 15 stocks",
      "Maximum 30 stocks",
      "Maximum 50 stocks",
      "Maximum 100 stocks"
    ],
    "correctIndex": 1,
    "explanation": "Focused Funds invest in a concentrated portfolio of maximum 30 stocks, with at least 65% of total assets in equity instruments.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q156",
    "courseId": "nism-va",
    "question": "What is the maximum portfolio maturity of debt securities held in an 'Overnight Fund'?",
    "options": [
      "1 day",
      "7 days",
      "30 days",
      "91 days"
    ],
    "correctIndex": 0,
    "explanation": "Overnight funds invest exclusively in debt securities having maturity of 1 business day (such as TREPS / tri-party repo).",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q157",
    "courseId": "nism-va",
    "question": "What is the maximum permissible maturity of securities held by a 'Liquid Fund' under SEBI regulations?",
    "options": [
      "Up to 30 days",
      "Up to 60 days",
      "Up to 91 days",
      "Up to 180 days"
    ],
    "correctIndex": 2,
    "explanation": "Liquid Funds can invest only in debt and money market securities with residual maturity of up to 91 days.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q158",
    "courseId": "nism-va",
    "question": "What is the characteristic Macaulay duration range of a 'Short Duration Fund'?",
    "options": [
      "3 months to 6 months",
      "6 months to 12 months",
      "1 year to 3 years",
      "3 years to 4 years"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI categorization, a Short Duration Fund invests in debt and money market instruments such that the Macaulay duration is between 1 year and 3 years.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q159",
    "courseId": "nism-va",
    "question": "What is the characteristic Macaulay duration of a 'Medium Duration Fund' under SEBI scheme categorization?",
    "options": [
      "1 year to 3 years",
      "3 years to 4 years",
      "4 years to 7 years",
      "Greater than 7 years"
    ],
    "correctIndex": 1,
    "explanation": "Medium Duration Funds maintain a portfolio Macaulay duration of 3 to 4 years.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q160",
    "courseId": "nism-va",
    "question": "What is the defining asset allocation requirement of a 'Corporate Bond Fund'?",
    "options": [
      "Minimum 50% in government securities",
      "Minimum 80% of total assets invested in corporate bonds rated AA+ and above (highest rated paper)",
      "Minimum 65% in unrated startup debt",
      "Minimum 80% in banking shares"
    ],
    "correctIndex": 1,
    "explanation": "Corporate Bond Funds must invest at least 80% of total assets in corporate debt instruments bearing the highest credit ratings (AA+ and above).",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q161",
    "courseId": "nism-va",
    "question": "What asset allocation distinguishes an 'Aggressive Hybrid Fund'?",
    "options": [
      "100% in equity derivatives",
      "65% to 80% in equity and equity-related instruments, and 20% to 35% in debt instruments",
      "75% to 90% in debt, 10% to 25% in equity",
      "Equal 33% split between equity, gold, and real estate"
    ],
    "correctIndex": 1,
    "explanation": "Aggressive Hybrid Funds invest 65% to 80% in equities and 20% to 35% in debt, qualifying for equity tax status while offering bond cushion.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q162",
    "courseId": "nism-va",
    "question": "How does a 'Balanced Advantage Fund' (Dynamic Asset Allocation Fund) operate under SEBI norms?",
    "options": [
      "Maintains a rigid 50:50 allocation at all times",
      "Dynamically manages investment in equity and debt between 0% and 100% based on quantitative valuation metrics (P/E, P/B, trend indicators)",
      "Invests only in international commodities",
      "Guarantees capital protection through bank guarantees"
    ],
    "correctIndex": 1,
    "explanation": "Balanced Advantage Funds dynamically shift equity exposure between 0% and 100% based on in-house asset allocation models (e.g. buying when valuations are low).",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q163",
    "courseId": "nism-va",
    "question": "What is the defining requirement of a 'Multi Asset Allocation Fund'?",
    "options": [
      "Invests in at least 5 different stock exchanges",
      "Invests in at least 3 distinct asset classes with a minimum allocation of at least 10% in each asset class (e.g. Equity, Debt, and Gold)",
      "Invests across 10 different currencies",
      "Allocates 90% to private equity"
    ],
    "correctIndex": 1,
    "explanation": "Multi Asset Allocation Funds must allocate at least 10% of total assets to each of at least 3 asset classes (commonly Equity, Fixed Income, and Gold/Commodities).",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q164",
    "courseId": "nism-va",
    "question": "How does an 'Arbitrage Fund' generate returns while maintaining relatively low volatility?",
    "options": [
      "By taking high leverage positions on currency options",
      "By simultaneously buying equity shares in the cash market and selling equivalent futures contracts in the derivatives market, locking in the spread",
      "By lending money to distressed real estate promoters",
      "By short selling government securities"
    ],
    "correctIndex": 1,
    "explanation": "Arbitrage funds exploit price differentials between cash and futures markets (cash-futures arbitrage), locking in risk-free spreads while enjoying equity tax treatment.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q165",
    "courseId": "nism-va",
    "question": "Under SEBI categorization, what is a 'Gilt Fund' required to invest in?",
    "options": [
      "Minimum 50% in corporate debentures",
      "Minimum 80% of total assets in Government Securities across maturities",
      "100% in sovereign gold coins",
      "Minimum 65% in bank fixed deposits"
    ],
    "correctIndex": 1,
    "explanation": "Gilt funds invest at least 80% in sovereign Central and State Government securities, eliminating credit risk but exposing the fund to interest rate volatility.",
    "topic": "Scheme Selection & Categorisation"
  },
  {
    "id": "nism-va-q166",
    "courseId": "nism-va",
    "question": "What happens to investment gains under the 'Growth Option' of a mutual fund scheme?",
    "options": [
      "Gains are paid out as cash into the investor's bank account every month",
      "All realized gains and income remain invested in the scheme, compounding the Net Asset Value (NAV) over time",
      "Gains are used to buy physical gold on the investor's behalf",
      "Gains are transferred to the Prime Minister Relief Fund"
    ],
    "correctIndex": 1,
    "explanation": "Under the Growth option, no dividends are distributed; all profits and appreciation remain in the scheme, allowing the NAV to compound.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q167",
    "courseId": "nism-va",
    "question": "Under the 'IDCW Payout' option, where does the declared distribution come from?",
    "options": [
      "Additional government subsidies",
      "Out of the scheme's distributable surplus and accumulated reserves, which directly reduces the post-payout NAV by the payout amount",
      "The personal profits of the AMC CEO",
      "Bank interest on fixed capital"
    ],
    "correctIndex": 1,
    "explanation": "IDCW (Income Distribution cum Capital Withdrawal) payouts are distributed from the scheme's accumulated surplus, resulting in an exact downward adjustment in NAV.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q168",
    "courseId": "nism-va",
    "question": "How does 'Rupee Cost Averaging' in a Systematic Investment Plan (SIP) benefit retail investors?",
    "options": [
      "It guarantees that the investor will only buy units at the lowest price of the year",
      "It automatically buys more units when markets/NAVs are low and fewer units when markets/NAVs are high, averaging down the purchase cost per unit over market cycles",
      "It eliminates income tax completely",
      "It pays a fixed interest rate on monthly instalments"
    ],
    "correctIndex": 1,
    "explanation": "By investing a fixed rupee amount regularly, investors purchase more units at lower NAVs and fewer units at higher NAVs, mitigating market timing risk.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q169",
    "courseId": "nism-va",
    "question": "Why is a Systematic Withdrawal Plan (SWP) considered more tax-efficient than receiving dividends (IDCW) for cash flow generation?",
    "options": [
      "SWP proceeds are 100% tax-free under all conditions",
      "In an SWP, only the capital gain portion of each redeemed instalment is subject to tax, whereas IDCW payouts are 100% taxable at slab rates",
      "SWP redemptions do not require bank accounts",
      "SWP redemptions receive a 50% discount from the government"
    ],
    "correctIndex": 1,
    "explanation": "SWP withdrawals consist of both principal return and capital appreciation. Tax is levied only on the gain component, making it far more tax-efficient than IDCW.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q170",
    "courseId": "nism-va",
    "question": "What is a 'Systematic Transfer Plan' (STP) typically utilized for?",
    "options": [
      "Transferring money to offshore shell companies",
      "Parking a lumpsum in a low-risk liquid/overnight fund and systematically deploying fixed amounts periodically into an equity fund to average entry",
      "Converting open-ended funds into close-ended funds",
      "Transferring units to a new unitholder without KYC"
    ],
    "correctIndex": 1,
    "explanation": "An STP gradually shifts money from a low-volatility source fund (like liquid) to a target growth fund (like equity), managing market entry timing risk.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q171",
    "courseId": "nism-va",
    "question": "What is an 'IDCW Reinvestment' option?",
    "options": [
      "The dividend is paid into a fixed deposit account",
      "The declared dividend amount (net of any applicable TDS) is automatically reinvested back into the scheme to buy additional units at the ex-dividend NAV",
      "The dividend is converted into physical gold bars",
      "The dividend is used to purchase lottery tickets"
    ],
    "correctIndex": 1,
    "explanation": "In IDCW Reinvestment, the declared dividend is used to allot new units to the unitholder at the ex-dividend NAV on the record date.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q172",
    "courseId": "nism-va",
    "question": "What happens when an investor executes a 'Switch' between two schemes of the same AMC?",
    "options": [
      "It is treated as an internal transfer with no tax impact",
      "It is legally treated as a redemption from the source scheme and a fresh purchase in the target scheme, triggering capital gains tax on the redemption",
      "The transaction charge is multiplied by 10",
      "The units are frozen for 1 year"
    ],
    "correctIndex": 1,
    "explanation": "A switch is treated under the Income Tax Act as a redemption of units from the source scheme followed by a fresh subscription in the target scheme.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q173",
    "courseId": "nism-va",
    "question": "What is a 'Trigger' facility in mutual funds?",
    "options": [
      "An emergency alarm in case of market crashes",
      "A pre-set automated instruction to redeem, switch, or invest when a specific market event, NAV level, date, or index threshold is reached",
      "A penalty levied on delayed KYC",
      "An automatic loan approval mechanism"
    ],
    "correctIndex": 1,
    "explanation": "Triggers allow investors to pre-specify operational actions (like switching to debt if NAV hits a targeted profit level or market index hits a set level).",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q174",
    "courseId": "nism-va",
    "question": "Can an investor pause their ongoing SIP without terminating the entire mandate?",
    "options": [
      "No, SIPs can never be paused once started",
      "Yes, most AMCs provide an 'SIP Pause' facility that allows unitholders to suspend instalments for a specified period (e.g. 1 to 6 months)",
      "Yes, but only after paying a 10% penalty fee",
      "Yes, provided they liquidate their existing units"
    ],
    "correctIndex": 1,
    "explanation": "The SIP Pause facility allows unitholders experiencing temporary cash flow tightness to suspend deductions for 1-6 months without cancelling the SIP mandate.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q175",
    "courseId": "nism-va",
    "question": "What is 'Top-Up SIP' (Step-Up SIP)?",
    "options": [
      "A facility to borrow money to fund mutual fund units",
      "A feature enabling the investor to automatically increase their monthly SIP instalment amount by a fixed amount or percentage periodically (e.g. annually)",
      "A lottery scratchcard given with each instalment",
      "A facility that automatically buys crypto tokens"
    ],
    "correctIndex": 1,
    "explanation": "A Step-Up or Top-Up SIP allows investors to increase their periodic contribution in line with rising annual income, drastically boosting wealth creation.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q176",
    "courseId": "nism-va",
    "question": "What is the primary advantage of choosing a 'Growth Option' for an investor in the highest income tax slab?",
    "options": [
      "Zero tax on redemptions",
      "Tax deferral \u2014 capital gains are taxed only upon actual redemption rather than annual tax liabilities on dividend income",
      "Immunity from capital losses",
      "Double indexation benefits"
    ],
    "correctIndex": 1,
    "explanation": "Under the Growth option, gains compound without triggering interim tax liabilities until units are redeemed, providing massive tax deferral benefits.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q177",
    "courseId": "nism-va",
    "question": "What happens if an SIP instalment fails due to insufficient funds in the investor's bank account?",
    "options": [
      "The AMC immediately files a criminal case against the investor",
      "The mutual fund does not levy an exit load, but the investor's bank may charge an ECS/NACH bounce fee, and the SIP mandate may be cancelled after 3 consecutive failures",
      "The existing units are forfeited to the government",
      "The investor's PAN card is cancelled"
    ],
    "correctIndex": 1,
    "explanation": "Failed SIP instalments incur bank bounce charges. The mutual fund does not charge penalties, but standard mandates automatically terminate after 3 consecutive rejections.",
    "topic": "Selecting the Right Investment Options"
  },
  {
    "id": "nism-va-q178",
    "courseId": "nism-va",
    "question": "What is the first step in the comprehensive financial planning process?",
    "options": [
      "Recommending specific equity mutual fund schemes",
      "Establishing and defining the client-planner relationship, scope of engagement, and fiduciary responsibilities",
      "Executing trade orders on the stock exchange",
      "Submitting tax returns to the income tax department"
    ],
    "correctIndex": 1,
    "explanation": "The financial planning process begins with establishing and defining the relationship with the client, clarifying roles, responsibilities, and scope.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q179",
    "courseId": "nism-va",
    "question": "In which life cycle phase does an individual typically have the highest capacity for equity investments?",
    "options": [
      "Retirement Distribution Phase",
      "Early Career / Wealth Accumulation Phase (young, long investment horizon, low dependency liabilities)",
      "Late Retirement Phase (age 80+)",
      "Estate Distribution Phase"
    ],
    "correctIndex": 1,
    "explanation": "During the early accumulation phase, individuals have a long time horizon before retirement and can absorb short-term equity volatility for long-term growth.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q180",
    "courseId": "nism-va",
    "question": "What behavioral bias causes investors to feel the emotional pain of a financial loss twice as intensely as the pleasure of an equivalent gain?",
    "options": [
      "Mental Accounting",
      "Loss Aversion",
      "Anchoring Bias",
      "Confirmation Bias"
    ],
    "correctIndex": 1,
    "explanation": "Loss Aversion (Kahneman & Tversky's Prospect Theory) describes how people experience losses more acutely than equivalent gains, leading to irrational risk-avoidance.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q181",
    "courseId": "nism-va",
    "question": "What is 'Herd Mentality' (Herding) in behavioral finance?",
    "options": [
      "Investing strictly in agricultural cooperatives",
      "The tendency of investors to follow the actions and sentiment of the majority, buying at market tops and panic-selling at market bottoms",
      "Rebalancing a portfolio based on age rules",
      "Investing only in blue-chip index stocks"
    ],
    "correctIndex": 1,
    "explanation": "Herd behavior leads investors to mimic crowd behavior rather than conducting independent analysis, exacerbating asset price bubbles and market crashes.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q182",
    "courseId": "nism-va",
    "question": "What is 'Anchoring Bias' in investor decision making?",
    "options": [
      "Fixating on a specific piece of historical information (such as original purchase price) when making subsequent investment or exit decisions",
      "Investing exclusively in maritime shipping companies",
      "Relying on central bank repo rate announcements",
      "Holding 100% of cash in a single bank account"
    ],
    "correctIndex": 0,
    "explanation": "Anchoring occurs when an investor fixates on an arbitrary reference point (like purchase price) and refuses to sell a failing stock until it recovers to break-even.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q183",
    "courseId": "nism-va",
    "question": "What is 'Recency Bias' in investment psychology?",
    "options": [
      "Buying only companies founded within the last 12 months",
      "Giving disproportionate weight to recent market events and projecting them into the future (e.g. assuming a bull run or crash will continue forever)",
      "Checking stock prices every 30 seconds",
      "Reading only the latest financial newspapers"
    ],
    "correctIndex": 1,
    "explanation": "Recency bias leads investors to extrapolate recent short-term trends into the indefinite future, prompting them to invest aggressively after market peaks.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q184",
    "courseId": "nism-va",
    "question": "Under the AMFI Code of Ethics, what must a distributor do if a conflict of interest arises regarding a recommended scheme?",
    "options": [
      "Conceal the conflict of interest from the client",
      "Fully disclose the conflict of interest to the client in writing and ensure the client's interests are prioritized",
      "Charge double the distribution fee",
      "Cancel the client's folio immediately"
    ],
    "correctIndex": 1,
    "explanation": "The AMFI Code of Ethics mandates full disclosure of all potential and actual conflicts of interest to clients, prioritizing client financial welfare.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q185",
    "courseId": "nism-va",
    "question": "What is 'Mental Accounting' in behavioral economics?",
    "options": [
      "Using mental arithmetic to calculate compound interest",
      "The cognitive tendency to treat money differently based on its origin (e.g. lottery bonus vs hard-earned salary) or intended purpose",
      "Auditing bank balances in one's head",
      "Refusing to maintain physical bank statements"
    ],
    "correctIndex": 1,
    "explanation": "Mental accounting causes individuals to compartmentalize funds irrationally, such as recklessly gambling away windfall profits while preserving salary savings.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q186",
    "courseId": "nism-va",
    "question": "Why is 'Overconfidence Bias' particularly hazardous for retail investors?",
    "options": [
      "It causes investors to overestimate their predictive knowledge, underestimate market risks, trade excessively, and fail to diversify",
      "It leads to investing exclusively in government bonds",
      "It prevents investors from opening bank accounts",
      "It forces investors to pay higher stamp duties"
    ],
    "correctIndex": 0,
    "explanation": "Overconfident investors believe they possess superior market forecasting ability, leading to concentrated bets, excessive trading turnover, and severe losses.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q187",
    "courseId": "nism-va",
    "question": "What is the primary fiduciary duty of a financial intermediary under SEBI and AMFI guidelines?",
    "options": [
      "To maximize the intermediary's own commission income",
      "To act with integrity, transparency, and in the best interest of the client at all times",
      "To guarantee market outperformance",
      "To ensure the client never invests in equity"
    ],
    "correctIndex": 1,
    "explanation": "Fiduciary duty requires the intermediary to place the client's interests ahead of their own, maintaining confidentiality, transparency, and objective suitability.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q188",
    "courseId": "nism-va",
    "question": "What is meant by 'Suitability Assessment' in mutual fund advisory and distribution?",
    "options": [
      "Checking whether the investor is wearing formal clothing to the branch",
      "Ensuring that the recommended scheme aligns with the client's documented financial goals, risk profile, time horizon, and liquidity requirements",
      "Ensuring the scheme pays the highest trail commission",
      "Checking the client's passport expiry date"
    ],
    "correctIndex": 1,
    "explanation": "Suitability requires intermediaries to recommend only products appropriate for the client's risk profile, investment horizon, and financial objectives.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q189",
    "courseId": "nism-va",
    "question": "How often should an investor's comprehensive financial plan be reviewed and rebalanced?",
    "options": [
      "Every 20 years",
      "At least once every year, or whenever major life milestones (marriage, child birth, career change) occur",
      "Every day at market close",
      "Only when market crashes exceed 30%"
    ],
    "correctIndex": 1,
    "explanation": "Financial plans should be reviewed at least annually or when significant life events alter risk capacity, goals, or financial standing.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-va-q190",
    "courseId": "nism-va",
    "question": "Which of the following actions represents a serious violation of confidentiality by a mutual fund distributor?",
    "options": [
      "Submitting KYC documents to a SEBI-registered KRA",
      "Sharing client portfolio balances, PAN details, and net worth data with third-party real estate brokers without explicit consent",
      "Sending account statements to the client's registered email address",
      "Uploading transaction orders to BSE StAR MF"
    ],
    "correctIndex": 1,
    "explanation": "Distributors must maintain strict confidentiality regarding client financial data. Disclosing client information without consent violates the AMFI Code of Conduct.",
    "topic": "Financial Planning & Ethics"
  },
  {
    "id": "nism-viii-q1",
    "courseId": "nism-viii",
    "question": "A European Call Option gives the buyer which of the following rights?",
    "options": [
      "The right to buy the underlying asset on or before the expiration date",
      "The right to buy the underlying asset only on the expiration date",
      "The obligation to buy the underlying asset on the expiration date",
      "The right to sell the underlying asset only on the expiration date"
    ],
    "correctIndex": 1,
    "explanation": "European style options can only be exercised on the expiration date itself, unlike American style options which can be exercised at any time up to expiration.",
    "topic": "Options Fundamentals"
  },
  {
    "id": "nism-viii-q2",
    "courseId": "nism-viii",
    "question": "In the equity derivatives market, what does a high Open Interest (OI) accompanied by an increase in futures price typically indicate?",
    "options": [
      "Short Covering",
      "Long Liquidation",
      "Long Buildup (Bullish)",
      "Short Buildup (Bearish)"
    ],
    "correctIndex": 2,
    "explanation": "When price rises along with rising Open Interest, it signifies fresh capital entering the market to create new long positions, known as Long Buildup.",
    "topic": "Derivatives Market Dynamics"
  },
  {
    "id": "nism-viii-q3",
    "courseId": "nism-viii",
    "question": "Which Option Greek measures the sensitivity of an option's delta relative to a change in the price of the underlying asset?",
    "options": [
      "Theta",
      "Vega",
      "Gamma",
      "Rho"
    ],
    "correctIndex": 2,
    "explanation": "Gamma (\u0393) measures the rate of change of Delta with respect to changes in the underlying asset's price, effectively measuring the curvature of the option value.",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-q4",
    "courseId": "nism-viii",
    "question": "Which Option Greek measures the rate of decay of an option premium due to the passage of time?",
    "options": [
      "Delta",
      "Vega",
      "Theta",
      "Rho"
    ],
    "correctIndex": 2,
    "explanation": "Theta (\u0398) represents time decay \u2014 the loss in option value as time moves closer to expiration, typically negative for long option positions.",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-q5",
    "courseId": "nism-viii",
    "question": "Under what condition is an equity Put Option considered to be 'In-The-Money' (ITM)?",
    "options": [
      "Spot Price is greater than Strike Price",
      "Strike Price is greater than Spot Price",
      "Spot Price is equal to Strike Price",
      "Implied Volatility is above historical volatility"
    ],
    "correctIndex": 1,
    "explanation": "A Put Option is In-The-Money (ITM) when the Strike Price is higher than the current Spot Price, giving the put holder the right to sell above current market price.",
    "topic": "Options Fundamentals"
  },
  {
    "id": "nism-viii-q6",
    "courseId": "nism-viii",
    "question": "What happens to a 'Day Order' in an exchange trading system if it remains unexecuted at market close?",
    "options": [
      "It rolls over to the after-hours trading session",
      "It executes in the closing auction automatically",
      "It carries forward to the next trading day",
      "It is cancelled automatically by the trading engine at the end of the day"
    ],
    "correctIndex": 3,
    "explanation": "A Day order is valid exclusively for the trading day on which it is entered. If unexecuted, the trading system automatically purges it at market close.",
    "topic": "Trading Systems & Order Types"
  },
  {
    "id": "nism-viii-q7",
    "courseId": "nism-viii",
    "question": "As per Accounting Standards, the initial margin paid by an option seller is recorded under which head in the balance sheet?",
    "options": [
      "Current Liabilities",
      "Current Assets",
      "Long-Term Borrowings",
      "Contingent Liabilities"
    ],
    "correctIndex": 1,
    "explanation": "Initial margin paid to the clearing corporation is debited to an Option Margin Account and reported under Current Assets until position settlement.",
    "topic": "Accounting & Margining"
  },
  {
    "id": "nism-viii-q8",
    "courseId": "nism-viii",
    "question": "What does a Beta (\u03b2) greater than 1 signify for a stock in equity derivatives trading?",
    "options": [
      "The stock has negative correlation with the index",
      "The expected percentage change in stock price will be more than the percentage change in the index (higher systematic volatility)",
      "The stock has zero systematic risk",
      "The stock cannot be hedged using index futures"
    ],
    "correctIndex": 1,
    "explanation": "Beta measures sensitivity vis-\u00e0-vis index movement. A Beta > 1 indicates that the security tends to exhibit larger percentage swings than the market index.",
    "topic": "Hedging & Risk Management"
  },
  {
    "id": "nism-viii-q9",
    "courseId": "nism-viii",
    "question": "Which of the following contracts is NOT part of the Indian equity derivatives market?",
    "options": [
      "Index Futures",
      "Stock Options",
      "Interest Rate Futures",
      "Index Options"
    ],
    "correctIndex": 2,
    "explanation": "Interest rate futures trade under the interest rate derivatives segment on the exchange and are separate from equity derivatives.",
    "topic": "Derivatives Market Structure"
  },
  {
    "id": "nism-viii-q10",
    "courseId": "nism-viii",
    "question": "What is 'Arbitrage' in derivatives markets?",
    "options": [
      "Gambling on unpredictable earnings announcements",
      "Earning a risk-free profit by simultaneously buying and selling replicating assets in two or more different markets to exploit price differentials",
      "Holding open unhedged short options",
      "Borrowing money from commercial banks at subprime rates"
    ],
    "correctIndex": 1,
    "explanation": "Arbitrage exploits pricing discrepancies between markets (e.g. cash vs futures) by simultaneously entering opposing positions to lock in riskless profit.",
    "topic": "Arbitrage & Trading Strategies"
  },
  {
    "id": "nism-viii-q11",
    "courseId": "nism-viii",
    "question": "What is 'Mark-to-Market' (MTM) margin settlement in futures trading?",
    "options": [
      "Daily settlement of profits and losses arising from differences between the previous day's settlement price and the current closing price",
      "Paying brokerage fees to exchange directors",
      "Filing monthly income tax statements",
      "The physical delivery of share certificates every Friday"
    ],
    "correctIndex": 0,
    "explanation": "MTM is the daily cash settlement where clearing corporations credit gains and debit losses to trading accounts based on daily closing settlement prices.",
    "topic": "Clearing & Settlement"
  },
  {
    "id": "nism-viii-q12",
    "courseId": "nism-viii",
    "question": "What does 'Cost of Carry' represent in futures pricing?",
    "options": [
      "The storage and shipping cost of physical share certificates",
      "The net financing cost of holding the underlying asset until futures expiration, including interest paid minus dividends received",
      "The broker's monthly trading terminal rent",
      "The security transaction tax paid on entry"
    ],
    "correctIndex": 1,
    "explanation": "Cost of Carry model establishes that Futures Price = Spot Price + Financing Cost - Dividends/Income earned until maturity.",
    "topic": "Futures Pricing"
  },
  {
    "id": "nism-viii-q13",
    "courseId": "nism-viii",
    "question": "What is 'Contango' in futures markets?",
    "options": [
      "When futures price trades at a discount below spot price",
      "When futures price trades at a premium above spot price, reflecting positive cost of carry",
      "When options volatility hits zero",
      "When market trading is halted by circuit breakers"
    ],
    "correctIndex": 1,
    "explanation": "Contango occurs when futures trade at a premium over spot prices, reflecting normal cost of financing, storage, and interest.",
    "topic": "Futures Pricing"
  },
  {
    "id": "nism-viii-q14",
    "courseId": "nism-viii",
    "question": "What is 'Backwardation' in futures markets?",
    "options": [
      "When futures price trades below spot price, often due to high dividend expectations or immediate physical scarcity",
      "When prices double overnight",
      "When open interest falls to zero",
      "When clearing margins are refunded"
    ],
    "correctIndex": 0,
    "explanation": "Backwardation occurs when futures price trades at a discount to the spot price, commonly seen when large near-term dividends are expected.",
    "topic": "Futures Pricing"
  },
  {
    "id": "nism-viii-q15",
    "courseId": "nism-viii",
    "question": "Which Option Greek measures the sensitivity of an option's premium to changes in the implied volatility (IV) of the underlying asset?",
    "options": [
      "Delta",
      "Gamma",
      "Vega",
      "Rho"
    ],
    "correctIndex": 2,
    "explanation": "Vega measures the change in option price for a 1% change in implied volatility. Long option holders benefit from rising Vega/volatility.",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-q16",
    "courseId": "nism-viii",
    "question": "What is the maximum loss potential for the buyer (holder) of a Call Option?",
    "options": [
      "Unlimited",
      "Equal to the Strike Price",
      "Limited strictly to the initial premium paid to purchase the option",
      "Equal to the Spot Price"
    ],
    "correctIndex": 2,
    "explanation": "An option buyer pays a premium for the right (not obligation) to buy. The maximum loss is capped at the premium paid, while upside is theoretically unlimited.",
    "topic": "Options Fundamentals"
  },
  {
    "id": "nism-viii-q17",
    "courseId": "nism-viii",
    "question": "What is the risk profile of an uncovered (naked) Call Option seller (writer)?",
    "options": [
      "Limited risk and unlimited profit",
      "Limited profit (maximum equal to premium received) and theoretically unlimited loss potential if stock price surges",
      "Zero risk under all market conditions",
      "Risk capped at the strike price"
    ],
    "correctIndex": 1,
    "explanation": "Naked call sellers take on unlimited upside risk if the stock price skyrockets, while their maximum gain is strictly capped at the option premium collected.",
    "topic": "Options Fundamentals"
  },
  {
    "id": "nism-viii-q18",
    "courseId": "nism-viii",
    "question": "What is a 'Protective Put' hedging strategy?",
    "options": [
      "Selling put options without owning the underlying stock",
      "Holding a long stock position and simultaneously purchasing a Put Option on that stock to establish a price floor against downside decline",
      "Buying call options and selling futures",
      "Investing in fixed maturity debt plans"
    ],
    "correctIndex": 1,
    "explanation": "A Protective Put acts as insurance: the investor owns the underlying stock and buys a put option to protect against steep market declines below the strike price.",
    "topic": "Hedging & Risk Management"
  },
  {
    "id": "nism-viii-q19",
    "courseId": "nism-viii",
    "question": "What is a 'Covered Call' strategy?",
    "options": [
      "Buying put options and shorting stock",
      "Holding long shares of a stock and selling (writing) a Call Option on the same stock to generate extra income from the option premium",
      "Buying both call and put options at the same strike",
      "Selling futures contracts on foreign indices"
    ],
    "correctIndex": 1,
    "explanation": "In a Covered Call, an investor writes call options against shares they already own, generating cash flow from premiums in exchange for capping upside gains.",
    "topic": "Hedging & Risk Management"
  },
  {
    "id": "nism-viii-q20",
    "courseId": "nism-viii",
    "question": "What is a 'Long Straddle' options strategy?",
    "options": [
      "Simultaneously buying a Call Option and a Put Option with the same strike price and same expiration date, expecting high volatility in either direction",
      "Buying options and selling bonds",
      "Selling out-of-the-money puts only",
      "Holding cash in savings accounts"
    ],
    "correctIndex": 0,
    "explanation": "A Long Straddle profits when the underlying asset experiences large directional price swings (up or down) exceeding the total combined premium paid.",
    "topic": "Option Strategies"
  },
  {
    "id": "nism-viii-q21",
    "courseId": "nism-viii",
    "question": "What does 'SPAN Margin' (Standard Portfolio Analysis of Risk) calculate in derivatives trading?",
    "options": [
      "Broker corporate income tax",
      "The maximum worst-case portfolio loss calculated across 16 simulated market risk scenarios over a 1-day time horizon",
      "Annual management fees charged by clearing banks",
      "The historical dividend yield of Nifty 50"
    ],
    "correctIndex": 1,
    "explanation": "SPAN calculates portfolio-level initial margin by simulating potential portfolio value changes across 16 different price and volatility scenarios.",
    "topic": "Accounting & Margining"
  },
  {
    "id": "nism-viii-q22",
    "courseId": "nism-viii",
    "question": "What is 'Exposure Margin' levied in Indian derivatives markets?",
    "options": [
      "A margin collected in addition to SPAN margin to cushion against extreme intra-day price swings beyond the standard deviation coverage",
      "A fee paid to financial newspapers for advertising",
      "The margin required to open a demat account",
      "A deposit refunded after 10 years"
    ],
    "correctIndex": 0,
    "explanation": "Exposure margin is an additional margin charged by clearing corporations on gross open positions to protect against tail-risk and black-swan moves.",
    "topic": "Accounting & Margining"
  },
  {
    "id": "nism-viii-q23",
    "courseId": "nism-viii",
    "question": "Under SEBI regulations, how are stock derivative contracts settled upon expiration in India?",
    "options": [
      "Only through cash difference settlement",
      "Through mandatory physical delivery of underlying shares for all in-the-money stock futures and stock options contracts",
      "Through promissory notes issued by brokers",
      "Through conversion to government bonds"
    ],
    "correctIndex": 1,
    "explanation": "SEBI introduced mandatory physical delivery settlement for all stock derivatives contracts. Open in-the-money positions require delivering or receiving physical shares.",
    "topic": "Clearing & Settlement"
  },
  {
    "id": "nism-viii-q24",
    "courseId": "nism-viii",
    "question": "What does a 'Put-Call Ratio' (PCR) by volume or open interest above 1.0 typically indicate in market sentiment analysis?",
    "options": [
      "Extreme bearish breakdown",
      "Higher put open interest relative to calls, often interpreted by contrarians as an oversold or bullish support zone",
      "The market will be closed for a week",
      "All brokers are insolvent"
    ],
    "correctIndex": 1,
    "explanation": "PCR measures the ratio of put options traded/open to call options. A high PCR indicates heavy put writing by institutional players, forming strong support.",
    "topic": "Derivatives Market Dynamics"
  },
  {
    "id": "nism-viii-q25",
    "courseId": "nism-viii",
    "question": "What is 'Implied Volatility' (IV) in options pricing?",
    "options": [
      "The historical standard deviation of daily returns over the last 100 days",
      "The market's forecast of the underlying stock's future volatility implied by the current market price of the option using pricing models (e.g. Black-Scholes)",
      "The interest rate set by the Reserve Bank of India",
      "The brokerage rate charged by discount brokers"
    ],
    "correctIndex": 1,
    "explanation": "Implied Volatility is the forward-looking volatility metric backed out of actual traded option market prices using the Black-Scholes formula.",
    "topic": "Option Pricing & Greeks"
  }
,

// ==========================================
	// NISM Series X-A: Investment Adviser Level 1 (10 Questions)
	// ==========================================
	{
		id: "nism-xa-q1",
		courseId: "nism-xa",
		question: "Under the SEBI (Investment Advisers) Regulations, 2013, which of the following is mandatory for an individual RIA?",
		options: [
			"Segregation of advisory and distribution activities at client level",
			"Maintaining an ARN code under the same PAN for mutual fund distribution",
			"Charging both advisory fees and distribution commission from the same client",
			"Mandatory guarantee of capital protection in financial plans"
		],
		correctIndex: 0,
		explanation: "SEBI regulations enforce strict client-level segregation between investment advisory and distribution/execution services to prevent conflicts of interest.",
		topic: "SEBI RIA Regulations"
	},
	{
		id: "nism-xa-q2",
		courseId: "nism-xa",
		question: "Which of the following approaches is the foundational formula of Modern Portfolio Theory (MPT) developed by Harry Markowitz?",
		options: [
			"Maximizing expected return for a given level of risk or minimizing risk for a given level of expected return",
			"Purchasing only risk-free government securities and cash equivalents",
			"Focusing solely on individual stock price-to-earnings ratios",
			"Eliminating systematic market risk through stock diversification"
		],
		correctIndex: 0,
		explanation: "Markowitz Modern Portfolio Theory states that an investor can construct an efficient frontier portfolio that maximizes expected return for a given level of risk.",
		topic: "Portfolio Construction & Asset Allocation"
	},
	{
		id: "nism-xa-q3",
		courseId: "nism-xa",
		question: "What is the maximum annual fee that an individual SEBI-registered Investment Adviser (RIA) can charge under the Assets Under Advice (AUA) mechanism?",
		options: ["1.5% of AUA", "2.5% of AUA", "3.0% of AUA", "5.0% of AUA"],
		correctIndex: 1,
		explanation: "Under SEBI RIA guidelines, maximum fees charged under the AUA model cannot exceed 2.5% per annum of the client's Assets under Advice.",
		topic: "Advisory Fee Norms"
	},
	{
		id: "nism-xa-q4",
		courseId: "nism-xa",
		question: "In investor profiling, what is the crucial distinction between 'Risk Capacity' and 'Risk Tolerance'?",
		options: [
			"Capacity is psychological willingness; Tolerance is financial ability",
			"Capacity is objective financial ability to absorb losses; Tolerance is subjective emotional attitude toward risk",
			"Capacity is determined by credit score; Tolerance is determined by income tax slab",
			"Both terms denote identical regulatory metrics"
		],
		correctIndex: 1,
		explanation: "Risk capacity is the objective ability to absorb losses (net worth, time horizon), while risk tolerance is psychological willingness to handle market volatility.",
		topic: "Client Profiling & Suitability"
	},
	{
		id: "nism-xa-q5",
		courseId: "nism-xa",
		question: "In financial planning, what is the standard prudent sizing recommended for an individual's emergency contingency fund?",
		options: [
			"1 month of gross discretionary spending",
			"3 to 6 months of mandatory household and debt-servicing expenses",
			"1 year of total investments",
			"5 years of life insurance premiums"
		],
		correctIndex: 1,
		explanation: "An emergency fund should cover 3 to 6 months of committed living expenses, held in safe and liquid avenues like bank deposits or overnight/liquid funds.",
		topic: "Personal Financial Planning"
	},
	{
		id: "nism-xa-q6",
		courseId: "nism-xa",
		question: "When should an investment advisor trigger portfolio rebalancing for a client?",
		options: [
			"Whenever any individual stock declines by 2%",
			"When portfolio asset allocations drift significantly beyond predefined percentage tolerance bands from target allocation",
			"Every Monday morning regardless of market movements",
			"Only when the client changes their employer"
		],
		correctIndex: 1,
		explanation: "Rebalancing is disciplined: it is enacted when asset classes drift beyond target allocation bands (e.g. +/- 5%) due to market performance.",
		topic: "Asset Allocation & Rebalancing"
	},
	{
		id: "nism-xa-q7",
		courseId: "nism-xa",
		question: "What is the tax treatment of Sovereign Gold Bonds (SGB) held until their 8-year maturity by an individual investor in India?",
		options: [
			"Taxable at 20% with indexation benefit",
			"Entire capital gain upon redemption at maturity is 100% exempt from income tax",
			"Taxable at marginal income tax slab rates",
			"Taxable at flat 12.5% under Section 112A"
		],
		correctIndex: 1,
		explanation: "Under Section 47(viic) of the Income Tax Act, capital gains arising on redemption of Sovereign Gold Bonds by an individual at maturity are completely tax-exempt.",
		topic: "Taxation & Wealth Planning"
	},
	{
		id: "nism-xa-q8",
		courseId: "nism-xa",
		question: "Under the legal fiduciary duty owed by an RIA to their client, what is the core requirement?",
		options: [
			"Ensuring guaranteed annual capital appreciation",
			"Subordinating personal and institutional interests to the client's best interests at all times",
			"Recommending the products that yield the highest brokerage",
			"Refusing to execute transactions requested by the client"
		],
		correctIndex: 1,
		explanation: "Fiduciary duty requires an RIA to act strictly in the best interest of the client, maintaining independence and disclosing all potential conflicts of interest.",
		topic: "Code of Ethics"
	},
	{
		id: "nism-xa-q9",
		courseId: "nism-xa",
		question: "How does the Treynor Ratio differ from the Sharpe Ratio when evaluating investment portfolios?",
		options: [
			"Treynor uses Beta (systematic risk); Sharpe uses Standard Deviation (total risk)",
			"Treynor uses Standard Deviation; Sharpe uses Jensen's Alpha",
			"Treynor ignores risk-free return; Sharpe includes it",
			"Treynor applies only to real estate assets"
		],
		correctIndex: 0,
		explanation: "Treynor divides excess return by Beta (systematic risk), while Sharpe divides excess return by Standard Deviation (total risk).",
		topic: "Performance Measurement"
	},
	{
		id: "nism-xa-q10",
		courseId: "nism-xa",
		question: "For how long must a SEBI-registered Investment Adviser maintain client risk profiling records, financial plans, and correspondence under regulations?",
		options: ["1 year", "3 years", "At least 5 years", "10 years"],
		correctIndex: 2,
		explanation: "SEBI (Investment Advisers) Regulations mandate that all client agreements, advice records, risk profiling, and KYC documents must be preserved for at least 5 years.",
		topic: "Compliance & Record Keeping"
	},

	// ==========================================
	// NISM Series XV: Research Analyst (10 Questions)
	// ==========================================
	{
		id: "nism-xv-q1",
		courseId: "nism-xv",
		question: "Under SEBI (Research Analysts) Regulations, 2014, what is the mandatory quiet period for a research analyst before and after public appearances?",
		options: [
			"No trading in subject company securities 30 days prior to and 5 days after publishing a research report",
			"No trading in any equities for 1 year",
			"Trading allowed provided notice is given to the exchange within 24 hours",
			"No quiet period if disclosures are made verbally"
		],
		correctIndex: 0,
		explanation: "SEBI (Research Analysts) Regulations mandate that RAs and their associates shall not deal or trade in securities of the subject company within 30 days before and 5 days after publication of a research report.",
		topic: "Regulatory Code of Conduct"
	},
	{
		id: "nism-xv-q2",
		courseId: "nism-xv",
		question: "Under SEBI RA Regulations, what is the shareholding threshold in a subject company that requires mandatory disclosure in a research report?",
		options: [
			"Holding 0.1% or more of securities",
			"Holding 1% or more of securities of the subject company at the end of the month preceding publication",
			"Holding 5% or more under takeover regulations",
			"Any fractional holding regardless of amount"
		],
		correctIndex: 1,
		explanation: "An RA must disclose if the analyst, research entity, or associates hold financial interest of 1% or more of securities of the subject company.",
		topic: "Conflict of Interest Disclosures"
	},
	{
		id: "nism-xv-q3",
		courseId: "nism-xv",
		question: "What is the standard formula to compute the Enterprise Value (EV) of a listed corporate entity?",
		options: [
			"Market Capitalization + Total Debt - Cash and Cash Equivalents",
			"Market Capitalization - Total Debt + Cash and Cash Equivalents",
			"Book Value of Equity + Gross Revenue",
			"EBITDA multiplied by Total Shares"
		],
		correctIndex: 0,
		explanation: "Enterprise Value represents total company value: Equity Value (Market Cap) + Total Debt - Cash & Cash Equivalents.",
		topic: "Equity Valuation Methodologies"
	},
	{
		id: "nism-xv-q4",
		courseId: "nism-xv",
		question: "Why is the EV/EBITDA valuation multiple often preferred over the P/E multiple when comparing capital-intensive companies?",
		options: [
			"EV/EBITDA is unaffected by stock market crashes",
			"It is capital-structure neutral and removes distortions caused by differences in debt gearing and depreciation methods",
			"It is always a lower number than P/E",
			"It is only applicable to companies with zero tax liabilities"
		],
		correctIndex: 1,
		explanation: "EV/EBITDA is independent of leverage differences and depreciation/amortization policies, making it ideal for cross-firm comparisons.",
		topic: "Relative Valuation"
	},
	{
		id: "nism-xv-q5",
		courseId: "nism-xv",
		question: "What is the purpose of establishing a 'Chinese Wall' inside an investment banking and research firm?",
		options: [
			"Restricting internet access of junior research associates",
			"Preventing the flow of unpublished price-sensitive information (UPSI) between research and investment banking teams",
			"Ensuring that all reports are published in international time zones",
			"Preventing analysts from changing their price targets"
		],
		correctIndex: 1,
		explanation: "A Chinese Wall is an information barrier isolating investment banking and advisory operations from the research department to avoid conflicts of interest.",
		topic: "Governance & Information Barriers"
	},
	{
		id: "nism-xv-q6",
		courseId: "nism-xv",
		question: "If a research analyst inadvertently comes into possession of Unpublished Price Sensitive Information (UPSI), what is their legal obligation?",
		options: [
			"Immediately publish a research report incorporating the UPSI to assist retail investors",
			"Refrain from trading in the security, do not communicate the information, and notify the Compliance Officer",
			"Share the UPSI with preferred HNI advisory clients",
			"Purchase put options as a hedge"
		],
		correctIndex: 1,
		explanation: "Under SEBI (Prohibition of Insider Trading) Regulations, possessing UPSI requires absolute non-disclosure and strict abstinence from trading.",
		topic: "Insider Trading Prevention"
	},
	{
		id: "nism-xv-q7",
		courseId: "nism-xv",
		question: "What does a Price-to-Earnings to Growth (PEG) ratio of less than 1.0 generally indicate to a fundamental equity analyst?",
		options: [
			"The stock is severely overvalued and should be sold",
			"The company is growing slower than the inflation rate",
			"The stock may be undervalued relative to its expected earnings growth rate",
			"The company has negative net profit margin"
		],
		correctIndex: 2,
		explanation: "Peter Lynch's PEG ratio compares P/E to EPS growth rate: PEG < 1 indicates that earnings growth outpaces the valuation multiple, suggesting value.",
		topic: "Fundamental Analysis"
	},
	{
		id: "nism-xv-q8",
		courseId: "nism-xv",
		question: "Under SEBI RA Regulations, can a research analyst share a draft research report with the subject company prior to publication?",
		options: [
			"Yes, but only factual sections of the report to verify accuracy; target price and ratings must NOT be shared",
			"Yes, the subject company must sign off on the target price",
			"No, draft reports can never be shared under any circumstances",
			"Yes, provided the subject company pays for the research coverage"
		],
		correctIndex: 0,
		explanation: "Draft reports may only be shared with the subject company to verify factual accuracy; recommendations, ratings, and valuation summaries cannot be shared.",
		topic: "Research Process Integrity"
	},
	{
		id: "nism-xv-q9",
		courseId: "nism-xv",
		question: "In a Discounted Cash Flow (DCF) model, how is the Terminal Value (TV) calculated using the Gordon Growth Model?",
		options: [
			"TV = Final Year EBITDA × Industry Multiple",
			"TV = FCF × (1 + g) / (WACC - g)",
			"TV = Total Assets - Total Liabilities",
			"TV = Market Cap / Risk Free Rate"
		],
		correctIndex: 1,
		explanation: "Gordon Growth formula: TV = (Expected Cash Flow in Year n+1) / (WACC - Perpetual Growth Rate).",
		topic: "DCF Modeling"
	},
	{
		id: "nism-xv-q10",
		courseId: "nism-xv",
		question: "How long must a Research Analyst maintain records of research reports, public appearances, and research recommendations?",
		options: ["1 year", "3 years", "Minimum 5 years", "Permanent archival"],
		correctIndex: 2,
		explanation: "SEBI RA Regulations mandate that all research reports, rationale documents, recommendations, and public appearance transcripts be kept for at least 5 years.",
		topic: "Regulatory Compliance"
	},

	// ==========================================
	// NISM Series XXI-A: PMS Distributors (10 Questions)
	// ==========================================
	{
		id: "nism-xxia-q1",
		courseId: "nism-xxia",
		question: "What is the statutory minimum investment amount required from a client to open a Portfolio Management Services (PMS) account under SEBI regulations?",
		options: ["₹10 Lakhs", "₹25 Lakhs", "₹50 Lakhs", "₹1 Crore"],
		correctIndex: 2,
		explanation: "SEBI (Portfolio Managers) Regulations 2020 raised the minimum investment ticket size per client for PMS to ₹50 Lakhs.",
		topic: "PMS Regulatory Framework"
	},
	{
		id: "nism-xxia-q2",
		courseId: "nism-xxia",
		question: "What distinguishes a Discretionary PMS from a Non-Discretionary PMS?",
		options: [
			"In Discretionary PMS, the portfolio manager executes trades independently without seeking prior approval for each trade from the client",
			"In Discretionary PMS, the client must approve every individual buy and sell order before execution",
			"Non-Discretionary PMS does not require a SEBI registration",
			"Discretionary PMS can only invest in government securities"
		],
		correctIndex: 0,
		explanation: "Under Discretionary PMS, the portfolio manager holds full investment discretion. Under Non-Discretionary PMS, the manager advises but requires client consent for each trade.",
		topic: "Operating Models"
	},
	{
		id: "nism-xxia-q3",
		courseId: "nism-xxia",
		question: "Which return calculation methodology is mandatory for Portfolio Managers when reporting client portfolio performance under SEBI norms?",
		options: ["Simple Annual Return", "Internal Rate of Return (IRR)", "Time-Weighted Rate of Return (TWRR)", "Book Value Return"],
		correctIndex: 2,
		explanation: "SEBI mandates the Time-Weighted Rate of Return (TWRR) methodology to neutralize the distortionary impact of external cash inflows and outflows on performance.",
		topic: "Performance Calculation"
	},
	{
		id: "nism-xxia-q4",
		courseId: "nism-xxia",
		question: "What is the 'High Water Mark' principle in the context of PMS performance fee calculation?",
		options: [
			"Performance fee is charged only when portfolio returns exceed the fixed deposit rate",
			"Performance fee is charged only on the increase in portfolio value exceeding the highest historic NAV achieved in any previous performance fee calculation period",
			"The maximum percentage fee that can be levied on a client's capital",
			"A minimum reserve requirement kept with the Clearing Corporation"
		],
		correctIndex: 1,
		explanation: "The High Water Mark ensures that clients do not pay performance fees for recovering past losses; fees apply only above the highest previous peak.",
		topic: "Fee Structures"
	},
	{
		id: "nism-xxia-q5",
		courseId: "nism-xxia",
		question: "Under SEBI regulations, must a Portfolio Manager provide an option for clients to onboard directly without paying distributor commission?",
		options: [
			"Yes, direct onboarding without distributor fees is mandatory across all registered Portfolio Managers",
			"No, all clients must compulsorily come through registered distributors",
			"Only institutional clients with over ₹10 Crores can onboard directly",
			"Direct onboarding is optional at the discretion of the Portfolio Manager"
		],
		correctIndex: 0,
		explanation: "SEBI mandates that portfolio managers must provide a direct onboarding channel with zero distributor commission fees for prospective clients.",
		topic: "Investor Protection"
	},
	{
		id: "nism-xxia-q6",
		courseId: "nism-xxia",
		question: "What is the statutory minimum net worth requirement for an entity seeking registration as a Portfolio Manager with SEBI?",
		options: ["₹1 Crore", "₹2 Crores", "₹5 Crores", "₹10 Crores"],
		correctIndex: 2,
		explanation: "Under the SEBI (Portfolio Managers) Regulations, 2020, registered Portfolio Managers must maintain a continuous minimum net worth of ₹5 Crores.",
		topic: "Entity Governance"
	},
	{
		id: "nism-xxia-q7",
		courseId: "nism-xxia",
		question: "How frequently must client portfolio accounts in a PMS be audited by an independent Chartered Accountant?",
		options: ["Every quarter", "At least once every year", "Every three years", "Only when requested by SEBI"],
		correctIndex: 1,
		explanation: "SEBI rules require an annual independent audit of every client's portfolio account and internal controls by a practicing Chartered Accountant.",
		topic: "Audit & Verification"
	},
	{
		id: "nism-xxia-q8",
		courseId: "nism-xxia",
		question: "How are client securities custodied in a Portfolio Management Services arrangement?",
		options: [
			"Pooled in the portfolio manager's personal demat account",
			"Held in a segregated demat account opened in the name of the client with a SEBI-registered Custodian",
			"Deposited with the stock exchange guarantee fund",
			"Held as physical certificates in the portfolio manager's locker"
		],
		correctIndex: 1,
		explanation: "Client securities in PMS are segregated and held directly in demat accounts opened in the individual client's own name with an independent custodian.",
		topic: "Custody & Safekeeping"
	},
	{
		id: "nism-xxia-q9",
		courseId: "nism-xxia",
		question: "What is the regulatory limit on investment in unlisted securities by a Discretionary Portfolio Manager?",
		options: [
			"Unlisted investments are completely banned in discretionary PMS",
			"Up to a maximum of 25% of the client's portfolio AUM may be invested in unlisted securities",
			"Up to 50% without disclosure",
			"100% permitted if approved by the custodian"
		],
		correctIndex: 1,
		explanation: "SEBI permits discretionary portfolio managers to invest up to a maximum cap of 25% of the portfolio's total AUM in unlisted securities.",
		topic: "Portfolio Guidelines"
	},
	{
		id: "nism-xxia-q10",
		courseId: "nism-xxia",
		question: "When must the PMS Disclosure Document be provided to a prospective investor?",
		options: [
			"Within 30 days after executing the portfolio agreement",
			"At least two days prior to entering into the PMS agreement with the client",
			"Only when the client explicitly requests it in writing",
			"At the end of the first financial year"
		],
		correctIndex: 1,
		explanation: "SEBI regulations mandate that the Disclosure Document must be handed over to the client at least two days before signing the investment agreement.",
		topic: "Disclosures & Transparency"
	},

	// ==========================================
	// NISM Series V-D: SIF Distributors (10 Questions)
	// ==========================================
	{
		id: "nism-vd-q1",
		courseId: "nism-vd",
		question: "Under the SEBI regulatory framework, what distinguishes a Specialized Investment Fund (SIF) from a standard mutual fund scheme?",
		options: [
			"SIF schemes invest exclusively in sovereign gold bonds",
			"SIF caters to accredited and sophisticated investors with specialized asset classes, structured debt, or hybrid strategies and higher minimum commitment",
			"SIF does not require any regulatory disclosure or trustee oversight",
			"SIF schemes are exempt from income tax"
		],
		correctIndex: 1,
		explanation: "SIFs provide access to specialized alternative and hybrid investment opportunities with higher suitability criteria and bespoke risk profiles.",
		topic: "SIF Regulatory Framework"
	},
	{
		id: "nism-vd-q2",
		courseId: "nism-vd",
		question: "Why do Specialized Investment Funds maintain higher minimum ticket thresholds than retail mutual funds?",
		options: [
			"To maximize distributor trailing commissions",
			"To ensure investment suitability, financial sophistication, and risk-absorption capacity of participants",
			"To avoid paying stamp duty on contract notes",
			"Because SEBI does not permit retail investors to invest in mutual funds"
		],
		correctIndex: 1,
		explanation: "Higher investment commitments ensure that only sophisticated investors with adequate loss-absorption capacity participate in specialized fund strategies.",
		topic: "Investor Categorisation & Suitability"
	},
	{
		id: "nism-vd-q3",
		courseId: "nism-vd",
		question: "How frequently must illiquid or unlisted assets in a specialized fund portfolio be valued by an independent valuation agency?",
		options: [
			"Daily in real-time during market hours",
			"At least periodically (e.g. monthly or quarterly) by an independent SEBI-recognized valuation agency",
			"Once every five years",
			"Only upon fund liquidation"
		],
		correctIndex: 1,
		explanation: "Unlisted or illiquid instruments require periodic independent valuation by an accredited valuation agency to ensure fair NAV calculation.",
		topic: "Valuation Principles"
	},
	{
		id: "nism-vd-q4",
		courseId: "nism-vd",
		question: "What is the primary responsibility of the Scheme Investment Committee in specialized funds?",
		options: [
			"Deciding marketing slogans for fund roadshows",
			"Overseeing investment adherence, risk mandates, and approving investments in structured or illiquid securities",
			"Filing personal tax returns of unit holders",
			"Setting the exchange clearing fees"
		],
		correctIndex: 1,
		explanation: "The Investment Committee ensures that all transactions adhere strictly to the scheme's mandate, risk parameters, and regulatory exposure limits.",
		topic: "Scheme Governance"
	},
	{
		id: "nism-vd-q5",
		courseId: "nism-vd",
		question: "What is a key difference in liquidity management between a specialized fund and an open-ended liquid mutual fund?",
		options: [
			"Liquid funds offer daily redemptions at T+1, whereas specialized funds may incorporate defined liquidity windows or lock-in terms",
			"Specialized funds never allow redemptions under any circumstances",
			"Liquid funds require a 1-year notice for redemption",
			"Specialized funds settle redemptions in physical bullion"
		],
		correctIndex: 0,
		explanation: "Specialized funds manage liquidity through specified redemption intervals or lock-ins matching the duration of their underlying assets.",
		topic: "Liquidity Risk Management"
	},
	{
		id: "nism-vd-q6",
		courseId: "nism-vd",
		question: "Who qualifies as an 'Accredited Investor' under the SEBI regulatory framework?",
		options: [
			"Any individual with an active PAN card",
			"An individual with annual income ≥ ₹2 Crores OR net worth ≥ ₹7.5 Crores (with at least ₹3.75 Cr in financial assets)",
			"Any corporate entity regardless of balance sheet size",
			"An investor who has passed the NISM exam"
		],
		correctIndex: 1,
		explanation: "SEBI defines Accredited Investors by net worth or income thresholds (e.g. ₹2 Cr annual income or ₹7.5 Cr net worth for individuals).",
		topic: "Accredited Investor Norms"
	},
	{
		id: "nism-vd-q7",
		courseId: "nism-vd",
		question: "Are 'Side Letter' agreements offering preferential terms or fee discounts to select investors permitted in regulated specialized funds?",
		options: [
			"Yes, side letters can be secretly signed with large investors without disclosure",
			"No, SEBI prohibits side letters that provide differential rights or preferential liquidity that prejudices other unit holders",
			"Yes, permitted if the investment exceeds ₹10 Lakhs",
			"Permitted only for foreign institutional investors"
		],
		correctIndex: 1,
		explanation: "SEBI mandates fair and equitable treatment for all investors in a scheme; preferential side letters that undermine pari-passu rights are prohibited.",
		topic: "Fair Treatment of Investors"
	},
	{
		id: "nism-vd-q8",
		courseId: "nism-vd",
		question: "How must related-party transactions and conflict of interest scenarios be handled in specialized fund operations?",
		options: [
			"Hidden from the trustees to prevent delays",
			"Fully disclosed to trustees and unit holders, with independent valuations and adherence to arm's length standards",
			"Executed at a 50% discount to market rates",
			"Referred to the local police department"
		],
		correctIndex: 1,
		explanation: "Affiliate and related-party deals require prior committee/trustee review, arm's-length pricing, and transparent disclosure in scheme reports.",
		topic: "Code of Conduct"
	},
	{
		id: "nism-vd-q9",
		courseId: "nism-vd",
		question: "How should performance benchmarks be constructed for specialized or hybrid investment funds?",
		options: [
			"Using a fixed 15% arbitrary hurdle rate",
			"Using a transparent, publicly available index that accurately reflects the asset mix and investment strategy of the fund",
			"Benchmark choice is entirely prohibited for specialized funds",
			"Using the US S&P 500 index regardless of domestic portfolio assets"
		],
		correctIndex: 1,
		explanation: "Regulations mandate benchmarks that reflect the strategy, duration, and asset composition of the underlying specialized fund portfolio.",
		topic: "Performance Evaluation"
	},
	{
		id: "nism-vd-q10",
		courseId: "nism-vd",
		question: "What is the dual licensing benefit of holding the NISM Series V-D certification for financial intermediaries?",
		options: [
			"Authorizes the distribution of both standard mutual fund schemes and specialized investment funds (SIF) under a unified license",
			"Allows the advisor to trade international currency futures without an exchange broker",
			"Exempts the distributor from filing GST returns",
			"Guarantees automatic appointment as an AMC fund manager"
		],
		correctIndex: 0,
		explanation: "NISM Series V-D provides accreditation covering both traditional mutual funds and specialized investment funds under SEBI distribution guidelines.",
		topic: "SIF Regulatory Framework"
	}
];
