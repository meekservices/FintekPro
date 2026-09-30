/* eslint-disable max-len */
import type { NismPracticeQuestion } from "./nism-lms-service";

/**
 * High-yield NISM Accredited Practice Question Bank
 * Covers all official NISM modules: Series V-A, V-D, VIII, XIII, X-A, X-B, XV, XXI-A, and CPE Refresher.
 * Verified with SEBI Master Circular 2024 and Union Budget 2024 taxation updates.
 */
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
    "question": "What is the maximum Total Expense Ratio (TER) permissible for an open-ended equity scheme for the first ₹500 crores of daily net assets under SEBI regulations?",
    "options": [
      "2.25%",
      "2.00%",
      "1.75%",
      "2.50%"
    ],
    "correctIndex": 0,
    "explanation": "SEBI limits the base TER for the first ₹500 crores of daily net assets of an open-ended equity-oriented scheme to 2.25% (plus additional allowances for B-30 cities and GST).",
    "topic": "Mutual Fund Expenses & Accounting"
  },
  {
    "id": "nism-va-q6",
    "courseId": "nism-va",
    "question": "Under Section 112A of the Income Tax Act, long-term capital gains (LTCG) on equity mutual funds exceeding ₹1.25 Lakh per financial year are taxed at what rate (post Budget 2024)?",
    "options": [
      "10%",
      "12.5%",
      "15%",
      "20% with indexation"
    ],
    "correctIndex": 1,
    "explanation": "Effective Budget 2024, Long Term Capital Gains (LTCG) on listed equity and equity mutual funds held for more than 12 months are taxed at 12.5% on gains exceeding ₹1.25 Lakhs per fiscal year.",
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
      "₹10 Crores",
      "₹25 Crores",
      "₹50 Crores",
      "₹100 Crores"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI (Mutual Funds) Regulations, an AMC must maintain a continuous minimum net worth of at least ₹50 Crores.",
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
    "explanation": "Real Rate of Return ≈ Nominal Rate - Inflation Rate = 9% - 5% = 4%. Real return measures actual purchasing power growth.",
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
    "explanation": "Asset allocation — the proportion of wealth allocated among equity, debt, gold, and cash — is the primary driver of portfolio return variance over time.",
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
      "The initial issue price of ₹10 per unit fixed forever",
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
      "₹10 Crores",
      "₹25 Crores",
      "₹50 Crores",
      "₹100 Crores"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI regulations, an AMC must maintain a continuous minimum net worth of at least ₹50 Crores at all times.",
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
      "Yes, for investments above ₹1 Crore",
      "Yes, with unitholder consent"
    ],
    "correctIndex": 1,
    "explanation": "SEBI banned upfront commissions in October 2018 to prevent churning and align distributor incentives with long-term investor holding periods.",
    "topic": "Fund Distribution & Channel Practices"
  },
  {
    "id": "nism-va-q81",
    "courseId": "nism-va",
    "question": "What is the permissible transaction charge that an opted-in distributor can levy on a subscription of ₹10,000 or more from a first-time mutual fund investor?",
    "options": [
      "₹50",
      "₹100",
      "₹150",
      "₹500"
    ],
    "correctIndex": 2,
    "explanation": "SEBI allows opted-in distributors to deduct a transaction charge of ₹150 for a first-time mutual fund investor on investments of ₹10,000 and above (and ₹100 for existing investors).",
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
      "Yes, up to ₹10 Lakhs of commission",
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
      "They are fined ₹1 Crore by the RBI",
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
    "question": "What is the maximum base Total Expense Ratio (TER) permissible for an open-ended equity scheme on the first ₹500 crores of daily net assets under SEBI slabs?",
    "options": [
      "1.50%",
      "2.00%",
      "2.25%",
      "2.75%"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI regulations, the maximum base TER for the first ₹500 crores of daily net assets of an open-ended equity-oriented scheme is 2.25%.",
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
    "explanation": "Stamp Duty at the rate of 0.005% (50 paise per ₹10,000) is deducted on all purchases and additions of mutual fund units (SIP, lumpsum, STP).",
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
    "question": "What is the maximum base Total Expense Ratio (TER) permissible for an open-ended debt scheme on the first ₹500 crores of AUM under SEBI regulations?",
    "options": [
      "1.50%",
      "2.00%",
      "2.25%",
      "2.50%"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI limits, the base TER for open-ended debt schemes on the first ₹500 crores of daily net assets is capped at 2.00%.",
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
      "10% on gains exceeding ₹1 Lakh",
      "12.5% on gains exceeding ₹1.25 Lakh per financial year",
      "15% on all gains",
      "20% with indexation"
    ],
    "correctIndex": 1,
    "explanation": "Budget 2024 revised the Section 112A LTCG tax rate to 12.5% with the annual tax-exempt threshold increased from ₹1 Lakh to ₹1.25 Lakhs.",
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
      "Tax-free up to ₹10 Lakhs",
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
      "₹1,000",
      "₹2,500",
      "₹5,000",
      "₹10,000"
    ],
    "correctIndex": 2,
    "explanation": "Under Section 194K, TDS @ 10% is deducted on mutual fund dividend payments exceeding ₹5,000 in aggregate to a resident individual during a financial year.",
    "topic": "Taxation of Mutual Funds"
  },
  {
    "id": "nism-va-q112",
    "courseId": "nism-va",
    "question": "Can Long-Term Capital Losses (LTCL) on equity mutual funds be set off against Short-Term Capital Gains (STCG)?",
    "options": [
      "Yes, capital losses can be set off against any capital gain",
      "No, Long-Term Capital Losses can only be set off against Long-Term Capital Gains",
      "Yes, but only up to ₹50,000",
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
      "Yes, but only for transactions above ₹10 Lakhs"
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
      "₹50,000",
      "₹1,00,000",
      "₹1,50,000 per financial year",
      "₹2,50,000"
    ],
    "correctIndex": 2,
    "explanation": "Investments in ELSS qualify for deduction under Section 80C of the Income Tax Act up to a maximum overall ceiling of ₹1.50 Lakhs per financial year.",
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
      "A parent or grandparent paying up to ₹50,000 per transaction as a gift for a minor child's folio",
      "A real estate developer investing on behalf of buyers",
      "An employer investing on personal behalf without payroll linkage"
    ],
    "correctIndex": 1,
    "explanation": "Exceptions include: parents/grandparents gifting to minor up to ₹50,000, employer on behalf of employee via payroll, or custodian on behalf of institutional client.",
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
      "₹10,000",
      "₹25,000",
      "₹50,000 per financial year per AMC",
      "₹1,00,000"
    ],
    "correctIndex": 2,
    "explanation": "Micro SIPs (investments up to ₹50,000 per financial year per mutual fund) are exempt from the mandatory PAN requirement, though photo KYC remains compulsory.",
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
      "Only if their portfolio value exceeds ₹1 Crore"
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
    "explanation": "Standard Deviation measures total risk — the dispersion of monthly or annual returns around the historical average return of the scheme.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q137",
    "courseId": "nism-va",
    "question": "What does a scheme Beta (β) of 1.25 indicate relative to its benchmark index?",
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
      "Excess return generated per unit of total risk (Standard Deviation): (Rp - Rf) / σp",
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
    "question": "What does Jensen's Alpha (α) quantify in active portfolio management?",
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
    "explanation": "Modified Duration measures a bond or debt portfolio's price sensitivity to interest rate changes (Price Change % ≈ -Modified Duration × Change in Yield).",
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
    "question": "What does R-Squared (R²) represent when comparing a mutual fund to its benchmark index?",
    "options": [
      "The fund's return divided by inflation",
      "The percentage of a fund's movements that can be explained by movements in its benchmark index",
      "The number of stocks held in the fund",
      "The ratio of equity to debt"
    ],
    "correctIndex": 1,
    "explanation": "R-squared measures the correlation of the fund to its benchmark on a scale of 0 to 100%. An R² of 95% means 95% of the fund's returns are explained by benchmark moves.",
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
      "Companies with market capitalization below ₹500 Crores",
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
      "Tax deferral — capital gains are taxed only upon actual redemption rather than annual tax liabilities on dividend income",
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
    "explanation": "Gamma (Γ) measures the rate of change of Delta with respect to changes in the underlying asset's price, effectively measuring the curvature of the option value.",
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
    "explanation": "Theta (Θ) represents time decay — the loss in option value as time moves closer to expiration, typically negative for long option positions.",
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
    "question": "What does a Beta (β) greater than 1 signify for a stock in equity derivatives trading?",
    "options": [
      "The stock has negative correlation with the index",
      "The expected percentage change in stock price will be more than the percentage change in the index (higher systematic volatility)",
      "The stock has zero systematic risk",
      "The stock cannot be hedged using index futures"
    ],
    "correctIndex": 1,
    "explanation": "Beta measures sensitivity vis-à-vis index movement. A Beta > 1 indicates that the security tends to exhibit larger percentage swings than the market index.",
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
  },
  {
    "id": "nism-xa-q1",
    "courseId": "nism-xa",
    "question": "Under the SEBI (Investment Advisers) Regulations, 2013, which of the following is mandatory for an individual RIA?",
    "options": [
      "Segregation of advisory and distribution activities at client level",
      "Maintaining an ARN code under the same PAN for mutual fund distribution",
      "Charging both advisory fees and distribution commission from the same client",
      "Mandatory guarantee of capital protection in financial plans"
    ],
    "correctIndex": 0,
    "explanation": "SEBI regulations enforce strict client-level segregation between investment advisory and distribution/execution services to prevent conflicts of interest.",
    "topic": "SEBI RIA Regulations"
  },
  {
    "id": "nism-xa-q2",
    "courseId": "nism-xa",
    "question": "Which of the following approaches is the foundational formula of Modern Portfolio Theory (MPT) developed by Harry Markowitz?",
    "options": [
      "Maximizing expected return for a given level of risk or minimizing risk for a given level of expected return",
      "Purchasing only risk-free government securities and cash equivalents",
      "Focusing solely on individual stock price-to-earnings ratios",
      "Eliminating systematic market risk through stock diversification"
    ],
    "correctIndex": 0,
    "explanation": "Markowitz Modern Portfolio Theory states that an investor can construct an efficient frontier portfolio that maximizes expected return for a given level of risk.",
    "topic": "Portfolio Construction & Asset Allocation"
  },
  {
    "id": "nism-xa-q3",
    "courseId": "nism-xa",
    "question": "What is the maximum annual fee that an individual SEBI-registered Investment Adviser (RIA) can charge under the Assets Under Advice (AUA) mechanism?",
    "options": [
      "1.5% of AUA",
      "2.5% of AUA",
      "3.0% of AUA",
      "5.0% of AUA"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI RIA guidelines, maximum fees charged under the AUA model cannot exceed 2.5% per annum of the client's Assets under Advice.",
    "topic": "Advisory Fee Norms"
  },
  {
    "id": "nism-xa-q4",
    "courseId": "nism-xa",
    "question": "In investor profiling, what is the crucial distinction between 'Risk Capacity' and 'Risk Tolerance'?",
    "options": [
      "Capacity is psychological willingness; Tolerance is financial ability",
      "Capacity is objective financial ability to absorb losses; Tolerance is subjective emotional attitude toward risk",
      "Capacity is determined by credit score; Tolerance is determined by income tax slab",
      "Both terms denote identical regulatory metrics"
    ],
    "correctIndex": 1,
    "explanation": "Risk capacity is the objective ability to absorb losses (net worth, time horizon), while risk tolerance is psychological willingness to handle market volatility.",
    "topic": "Client Profiling & Suitability"
  },
  {
    "id": "nism-xa-q5",
    "courseId": "nism-xa",
    "question": "In financial planning, what is the standard prudent sizing recommended for an individual's emergency contingency fund?",
    "options": [
      "1 month of gross discretionary spending",
      "3 to 6 months of mandatory household and debt-servicing expenses",
      "1 year of total investments",
      "5 years of life insurance premiums"
    ],
    "correctIndex": 1,
    "explanation": "An emergency fund should cover 3 to 6 months of committed living expenses, held in safe and liquid avenues like bank deposits or overnight/liquid funds.",
    "topic": "Personal Financial Planning"
  },
  {
    "id": "nism-xa-q6",
    "courseId": "nism-xa",
    "question": "When should an investment advisor trigger portfolio rebalancing for a client?",
    "options": [
      "Whenever any individual stock declines by 2%",
      "When portfolio asset allocations drift significantly beyond predefined percentage tolerance bands from target allocation",
      "Every Monday morning regardless of market movements",
      "Only when the client changes their employer"
    ],
    "correctIndex": 1,
    "explanation": "Rebalancing is disciplined: it is enacted when asset classes drift beyond target allocation bands (e.g. +/- 5%) due to market performance.",
    "topic": "Asset Allocation & Rebalancing"
  },
  {
    "id": "nism-xa-q7",
    "courseId": "nism-xa",
    "question": "What is the tax treatment of Sovereign Gold Bonds (SGB) held until their 8-year maturity by an individual investor in India?",
    "options": [
      "Taxable at 20% with indexation benefit",
      "Entire capital gain upon redemption at maturity is 100% exempt from income tax",
      "Taxable at marginal income tax slab rates",
      "Taxable at flat 12.5% under Section 112A"
    ],
    "correctIndex": 1,
    "explanation": "Under Section 47(viic) of the Income Tax Act, capital gains arising on redemption of Sovereign Gold Bonds by an individual at maturity are completely tax-exempt.",
    "topic": "Taxation & Wealth Planning"
  },
  {
    "id": "nism-xa-q8",
    "courseId": "nism-xa",
    "question": "Under the legal fiduciary duty owed by an RIA to their client, what is the core requirement?",
    "options": [
      "Ensuring guaranteed annual capital appreciation",
      "Subordinating personal and institutional interests to the client's best interests at all times",
      "Recommending the products that yield the highest brokerage",
      "Refusing to execute transactions requested by the client"
    ],
    "correctIndex": 1,
    "explanation": "Fiduciary duty requires an RIA to act strictly in the best interest of the client, maintaining independence and disclosing all potential conflicts of interest.",
    "topic": "Code of Ethics"
  },
  {
    "id": "nism-xa-q9",
    "courseId": "nism-xa",
    "question": "How does the Treynor Ratio differ from the Sharpe Ratio when evaluating investment portfolios?",
    "options": [
      "Treynor uses Beta (systematic risk); Sharpe uses Standard Deviation (total risk)",
      "Treynor uses Standard Deviation; Sharpe uses Jensen's Alpha",
      "Treynor ignores risk-free return; Sharpe includes it",
      "Treynor applies only to real estate assets"
    ],
    "correctIndex": 0,
    "explanation": "Treynor divides excess return by Beta (systematic risk), while Sharpe divides excess return by Standard Deviation (total risk).",
    "topic": "Performance Measurement"
  },
  {
    "id": "nism-xa-q10",
    "courseId": "nism-xa",
    "question": "For how long must a SEBI-registered Investment Adviser maintain client risk profiling records, financial plans, and correspondence under regulations?",
    "options": [
      "1 year",
      "3 years",
      "At least 5 years",
      "10 years"
    ],
    "correctIndex": 2,
    "explanation": "SEBI (Investment Advisers) Regulations mandate that all client agreements, advice records, risk profiling, and KYC documents must be preserved for at least 5 years.",
    "topic": "Compliance & Record Keeping"
  },
  {
    "id": "nism-xv-q1",
    "courseId": "nism-xv",
    "question": "Under SEBI (Research Analysts) Regulations, 2014, what is the mandatory quiet period for a research analyst before and after public appearances?",
    "options": [
      "No trading in subject company securities 30 days prior to and 5 days after publishing a research report",
      "No trading in any equities for 1 year",
      "Trading allowed provided notice is given to the exchange within 24 hours",
      "No quiet period if disclosures are made verbally"
    ],
    "correctIndex": 0,
    "explanation": "SEBI (Research Analysts) Regulations mandate that RAs and their associates shall not deal or trade in securities of the subject company within 30 days before and 5 days after publication of a research report.",
    "topic": "Regulatory Code of Conduct"
  },
  {
    "id": "nism-xv-q2",
    "courseId": "nism-xv",
    "question": "Under SEBI RA Regulations, what is the shareholding threshold in a subject company that requires mandatory disclosure in a research report?",
    "options": [
      "Holding 0.1% or more of securities",
      "Holding 1% or more of securities of the subject company at the end of the month preceding publication",
      "Holding 5% or more under takeover regulations",
      "Any fractional holding regardless of amount"
    ],
    "correctIndex": 1,
    "explanation": "An RA must disclose if the analyst, research entity, or associates hold financial interest of 1% or more of securities of the subject company.",
    "topic": "Conflict of Interest Disclosures"
  },
  {
    "id": "nism-xv-q3",
    "courseId": "nism-xv",
    "question": "What is the standard formula to compute the Enterprise Value (EV) of a listed corporate entity?",
    "options": [
      "Market Capitalization + Total Debt - Cash and Cash Equivalents",
      "Market Capitalization - Total Debt + Cash and Cash Equivalents",
      "Book Value of Equity + Gross Revenue",
      "EBITDA multiplied by Total Shares"
    ],
    "correctIndex": 0,
    "explanation": "Enterprise Value represents total company value: Equity Value (Market Cap) + Total Debt - Cash & Cash Equivalents.",
    "topic": "Equity Valuation Methodologies"
  },
  {
    "id": "nism-xv-q4",
    "courseId": "nism-xv",
    "question": "Why is the EV/EBITDA valuation multiple often preferred over the P/E multiple when comparing capital-intensive companies?",
    "options": [
      "EV/EBITDA is unaffected by stock market crashes",
      "It is capital-structure neutral and removes distortions caused by differences in debt gearing and depreciation methods",
      "It is always a lower number than P/E",
      "It is only applicable to companies with zero tax liabilities"
    ],
    "correctIndex": 1,
    "explanation": "EV/EBITDA is independent of leverage differences and depreciation/amortization policies, making it ideal for cross-firm comparisons.",
    "topic": "Relative Valuation"
  },
  {
    "id": "nism-xv-q5",
    "courseId": "nism-xv",
    "question": "What is the purpose of establishing a 'Chinese Wall' inside an investment banking and research firm?",
    "options": [
      "Restricting internet access of junior research associates",
      "Preventing the flow of unpublished price-sensitive information (UPSI) between research and investment banking teams",
      "Ensuring that all reports are published in international time zones",
      "Preventing analysts from changing their price targets"
    ],
    "correctIndex": 1,
    "explanation": "A Chinese Wall is an information barrier isolating investment banking and advisory operations from the research department to avoid conflicts of interest.",
    "topic": "Governance & Information Barriers"
  },
  {
    "id": "nism-xv-q6",
    "courseId": "nism-xv",
    "question": "If a research analyst inadvertently comes into possession of Unpublished Price Sensitive Information (UPSI), what is their legal obligation?",
    "options": [
      "Immediately publish a research report incorporating the UPSI to assist retail investors",
      "Refrain from trading in the security, do not communicate the information, and notify the Compliance Officer",
      "Share the UPSI with preferred HNI advisory clients",
      "Purchase put options as a hedge"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI (Prohibition of Insider Trading) Regulations, possessing UPSI requires absolute non-disclosure and strict abstinence from trading.",
    "topic": "Insider Trading Prevention"
  },
  {
    "id": "nism-xv-q7",
    "courseId": "nism-xv",
    "question": "What does a Price-to-Earnings to Growth (PEG) ratio of less than 1.0 generally indicate to a fundamental equity analyst?",
    "options": [
      "The stock is severely overvalued and should be sold",
      "The company is growing slower than the inflation rate",
      "The stock may be undervalued relative to its expected earnings growth rate",
      "The company has negative net profit margin"
    ],
    "correctIndex": 2,
    "explanation": "Peter Lynch's PEG ratio compares P/E to EPS growth rate: PEG < 1 indicates that earnings growth outpaces the valuation multiple, suggesting value.",
    "topic": "Fundamental Analysis"
  },
  {
    "id": "nism-xv-q8",
    "courseId": "nism-xv",
    "question": "Under SEBI RA Regulations, can a research analyst share a draft research report with the subject company prior to publication?",
    "options": [
      "Yes, but only factual sections of the report to verify accuracy; target price and ratings must NOT be shared",
      "Yes, the subject company must sign off on the target price",
      "No, draft reports can never be shared under any circumstances",
      "Yes, provided the subject company pays for the research coverage"
    ],
    "correctIndex": 0,
    "explanation": "Draft reports may only be shared with the subject company to verify factual accuracy; recommendations, ratings, and valuation summaries cannot be shared.",
    "topic": "Research Process Integrity"
  },
  {
    "id": "nism-xv-q9",
    "courseId": "nism-xv",
    "question": "In a Discounted Cash Flow (DCF) model, how is the Terminal Value (TV) calculated using the Gordon Growth Model?",
    "options": [
      "TV = Final Year EBITDA × Industry Multiple",
      "TV = FCF × (1 + g) / (WACC - g)",
      "TV = Total Assets - Total Liabilities",
      "TV = Market Cap / Risk Free Rate"
    ],
    "correctIndex": 1,
    "explanation": "Gordon Growth formula: TV = (Expected Cash Flow in Year n+1) / (WACC - Perpetual Growth Rate).",
    "topic": "DCF Modeling"
  },
  {
    "id": "nism-xv-q10",
    "courseId": "nism-xv",
    "question": "How long must a Research Analyst maintain records of research reports, public appearances, and research recommendations?",
    "options": [
      "1 year",
      "3 years",
      "Minimum 5 years",
      "Permanent archival"
    ],
    "correctIndex": 2,
    "explanation": "SEBI RA Regulations mandate that all research reports, rationale documents, recommendations, and public appearance transcripts be kept for at least 5 years.",
    "topic": "Regulatory Compliance"
  },
  {
    "id": "nism-xxia-q1",
    "courseId": "nism-xxia",
    "question": "What is the statutory minimum investment amount required from a client to open a Portfolio Management Services (PMS) account under SEBI regulations?",
    "options": [
      "₹10 Lakhs",
      "₹25 Lakhs",
      "₹50 Lakhs",
      "₹1 Crore"
    ],
    "correctIndex": 2,
    "explanation": "SEBI (Portfolio Managers) Regulations 2020 raised the minimum investment ticket size per client for PMS to ₹50 Lakhs.",
    "topic": "PMS Regulatory Framework"
  },
  {
    "id": "nism-xxia-q2",
    "courseId": "nism-xxia",
    "question": "What distinguishes a Discretionary PMS from a Non-Discretionary PMS?",
    "options": [
      "In Discretionary PMS, the portfolio manager executes trades independently without seeking prior approval for each trade from the client",
      "In Discretionary PMS, the client must approve every individual buy and sell order before execution",
      "Non-Discretionary PMS does not require a SEBI registration",
      "Discretionary PMS can only invest in government securities"
    ],
    "correctIndex": 0,
    "explanation": "Under Discretionary PMS, the portfolio manager holds full investment discretion. Under Non-Discretionary PMS, the manager advises but requires client consent for each trade.",
    "topic": "Operating Models"
  },
  {
    "id": "nism-xxia-q3",
    "courseId": "nism-xxia",
    "question": "Which return calculation methodology is mandatory for Portfolio Managers when reporting client portfolio performance under SEBI norms?",
    "options": [
      "Simple Annual Return",
      "Internal Rate of Return (IRR)",
      "Time-Weighted Rate of Return (TWRR)",
      "Book Value Return"
    ],
    "correctIndex": 2,
    "explanation": "SEBI mandates the Time-Weighted Rate of Return (TWRR) methodology to neutralize the distortionary impact of external cash inflows and outflows on performance.",
    "topic": "Performance Calculation"
  },
  {
    "id": "nism-xxia-q4",
    "courseId": "nism-xxia",
    "question": "What is the 'High Water Mark' principle in the context of PMS performance fee calculation?",
    "options": [
      "Performance fee is charged only when portfolio returns exceed the fixed deposit rate",
      "Performance fee is charged only on the increase in portfolio value exceeding the highest historic NAV achieved in any previous performance fee calculation period",
      "The maximum percentage fee that can be levied on a client's capital",
      "A minimum reserve requirement kept with the Clearing Corporation"
    ],
    "correctIndex": 1,
    "explanation": "The High Water Mark ensures that clients do not pay performance fees for recovering past losses; fees apply only above the highest previous peak.",
    "topic": "Fee Structures"
  },
  {
    "id": "nism-xxia-q5",
    "courseId": "nism-xxia",
    "question": "Under SEBI regulations, must a Portfolio Manager provide an option for clients to onboard directly without paying distributor commission?",
    "options": [
      "Yes, direct onboarding without distributor fees is mandatory across all registered Portfolio Managers",
      "No, all clients must compulsorily come through registered distributors",
      "Only institutional clients with over ₹10 Crores can onboard directly",
      "Direct onboarding is optional at the discretion of the Portfolio Manager"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that portfolio managers must provide a direct onboarding channel with zero distributor commission fees for prospective clients.",
    "topic": "Investor Protection"
  },
  {
    "id": "nism-xxia-q6",
    "courseId": "nism-xxia",
    "question": "What is the statutory minimum net worth requirement for an entity seeking registration as a Portfolio Manager with SEBI?",
    "options": [
      "₹1 Crore",
      "₹2 Crores",
      "₹5 Crores",
      "₹10 Crores"
    ],
    "correctIndex": 2,
    "explanation": "Under the SEBI (Portfolio Managers) Regulations, 2020, registered Portfolio Managers must maintain a continuous minimum net worth of ₹5 Crores.",
    "topic": "Entity Governance"
  },
  {
    "id": "nism-xxia-q7",
    "courseId": "nism-xxia",
    "question": "How frequently must client portfolio accounts in a PMS be audited by an independent Chartered Accountant?",
    "options": [
      "Every quarter",
      "At least once every year",
      "Every three years",
      "Only when requested by SEBI"
    ],
    "correctIndex": 1,
    "explanation": "SEBI rules require an annual independent audit of every client's portfolio account and internal controls by a practicing Chartered Accountant.",
    "topic": "Audit & Verification"
  },
  {
    "id": "nism-xxia-q8",
    "courseId": "nism-xxia",
    "question": "How are client securities custodied in a Portfolio Management Services arrangement?",
    "options": [
      "Pooled in the portfolio manager's personal demat account",
      "Held in a segregated demat account opened in the name of the client with a SEBI-registered Custodian",
      "Deposited with the stock exchange guarantee fund",
      "Held as physical certificates in the portfolio manager's locker"
    ],
    "correctIndex": 1,
    "explanation": "Client securities in PMS are segregated and held directly in demat accounts opened in the individual client's own name with an independent custodian.",
    "topic": "Custody & Safekeeping"
  },
  {
    "id": "nism-xxia-q9",
    "courseId": "nism-xxia",
    "question": "What is the regulatory limit on investment in unlisted securities by a Discretionary Portfolio Manager?",
    "options": [
      "Unlisted investments are completely banned in discretionary PMS",
      "Up to a maximum of 25% of the client's portfolio AUM may be invested in unlisted securities",
      "Up to 50% without disclosure",
      "100% permitted if approved by the custodian"
    ],
    "correctIndex": 1,
    "explanation": "SEBI permits discretionary portfolio managers to invest up to a maximum cap of 25% of the portfolio's total AUM in unlisted securities.",
    "topic": "Portfolio Guidelines"
  },
  {
    "id": "nism-xxia-q10",
    "courseId": "nism-xxia",
    "question": "When must the PMS Disclosure Document be provided to a prospective investor?",
    "options": [
      "Within 30 days after executing the portfolio agreement",
      "At least two days prior to entering into the PMS agreement with the client",
      "Only when the client explicitly requests it in writing",
      "At the end of the first financial year"
    ],
    "correctIndex": 1,
    "explanation": "SEBI regulations mandate that the Disclosure Document must be handed over to the client at least two days before signing the investment agreement.",
    "topic": "Disclosures & Transparency"
  },
  {
    "id": "nism-vd-q1",
    "courseId": "nism-vd",
    "question": "Under the SEBI regulatory framework, what distinguishes a Specialized Investment Fund (SIF) from a standard mutual fund scheme?",
    "options": [
      "SIF schemes invest exclusively in sovereign gold bonds",
      "SIF caters to accredited and sophisticated investors with specialized asset classes, structured debt, or hybrid strategies and higher minimum commitment",
      "SIF does not require any regulatory disclosure or trustee oversight",
      "SIF schemes are exempt from income tax"
    ],
    "correctIndex": 1,
    "explanation": "SIFs provide access to specialized alternative and hybrid investment opportunities with higher suitability criteria and bespoke risk profiles.",
    "topic": "SIF Regulatory Framework"
  },
  {
    "id": "nism-vd-q2",
    "courseId": "nism-vd",
    "question": "Why do Specialized Investment Funds maintain higher minimum ticket thresholds than retail mutual funds?",
    "options": [
      "To maximize distributor trailing commissions",
      "To ensure investment suitability, financial sophistication, and risk-absorption capacity of participants",
      "To avoid paying stamp duty on contract notes",
      "Because SEBI does not permit retail investors to invest in mutual funds"
    ],
    "correctIndex": 1,
    "explanation": "Higher investment commitments ensure that only sophisticated investors with adequate loss-absorption capacity participate in specialized fund strategies.",
    "topic": "Investor Categorisation & Suitability"
  },
  {
    "id": "nism-vd-q3",
    "courseId": "nism-vd",
    "question": "How frequently must illiquid or unlisted assets in a specialized fund portfolio be valued by an independent valuation agency?",
    "options": [
      "Daily in real-time during market hours",
      "At least periodically (e.g. monthly or quarterly) by an independent SEBI-recognized valuation agency",
      "Once every five years",
      "Only upon fund liquidation"
    ],
    "correctIndex": 1,
    "explanation": "Unlisted or illiquid instruments require periodic independent valuation by an accredited valuation agency to ensure fair NAV calculation.",
    "topic": "Valuation Principles"
  },
  {
    "id": "nism-vd-q4",
    "courseId": "nism-vd",
    "question": "What is the primary responsibility of the Scheme Investment Committee in specialized funds?",
    "options": [
      "Deciding marketing slogans for fund roadshows",
      "Overseeing investment adherence, risk mandates, and approving investments in structured or illiquid securities",
      "Filing personal tax returns of unit holders",
      "Setting the exchange clearing fees"
    ],
    "correctIndex": 1,
    "explanation": "The Investment Committee ensures that all transactions adhere strictly to the scheme's mandate, risk parameters, and regulatory exposure limits.",
    "topic": "Scheme Governance"
  },
  {
    "id": "nism-vd-q5",
    "courseId": "nism-vd",
    "question": "What is a key difference in liquidity management between a specialized fund and an open-ended liquid mutual fund?",
    "options": [
      "Liquid funds offer daily redemptions at T+1, whereas specialized funds may incorporate defined liquidity windows or lock-in terms",
      "Specialized funds never allow redemptions under any circumstances",
      "Liquid funds require a 1-year notice for redemption",
      "Specialized funds settle redemptions in physical bullion"
    ],
    "correctIndex": 0,
    "explanation": "Specialized funds manage liquidity through specified redemption intervals or lock-ins matching the duration of their underlying assets.",
    "topic": "Liquidity Risk Management"
  },
  {
    "id": "nism-vd-q6",
    "courseId": "nism-vd",
    "question": "Who qualifies as an 'Accredited Investor' under the SEBI regulatory framework?",
    "options": [
      "Any individual with an active PAN card",
      "An individual with annual income ≥ ₹2 Crores OR net worth ≥ ₹7.5 Crores (with at least ₹3.75 Cr in financial assets)",
      "Any corporate entity regardless of balance sheet size",
      "An investor who has passed the NISM exam"
    ],
    "correctIndex": 1,
    "explanation": "SEBI defines Accredited Investors by net worth or income thresholds (e.g. ₹2 Cr annual income or ₹7.5 Cr net worth for individuals).",
    "topic": "Accredited Investor Norms"
  },
  {
    "id": "nism-vd-q7",
    "courseId": "nism-vd",
    "question": "Are 'Side Letter' agreements offering preferential terms or fee discounts to select investors permitted in regulated specialized funds?",
    "options": [
      "Yes, side letters can be secretly signed with large investors without disclosure",
      "No, SEBI prohibits side letters that provide differential rights or preferential liquidity that prejudices other unit holders",
      "Yes, permitted if the investment exceeds ₹10 Lakhs",
      "Permitted only for foreign institutional investors"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates fair and equitable treatment for all investors in a scheme; preferential side letters that undermine pari-passu rights are prohibited.",
    "topic": "Fair Treatment of Investors"
  },
  {
    "id": "nism-vd-q8",
    "courseId": "nism-vd",
    "question": "How must related-party transactions and conflict of interest scenarios be handled in specialized fund operations?",
    "options": [
      "Hidden from the trustees to prevent delays",
      "Fully disclosed to trustees and unit holders, with independent valuations and adherence to arm's length standards",
      "Executed at a 50% discount to market rates",
      "Referred to the local police department"
    ],
    "correctIndex": 1,
    "explanation": "Affiliate and related-party deals require prior committee/trustee review, arm's-length pricing, and transparent disclosure in scheme reports.",
    "topic": "Code of Conduct"
  },
  {
    "id": "nism-vd-q9",
    "courseId": "nism-vd",
    "question": "How should performance benchmarks be constructed for specialized or hybrid investment funds?",
    "options": [
      "Using a fixed 15% arbitrary hurdle rate",
      "Using a transparent, publicly available index that accurately reflects the asset mix and investment strategy of the fund",
      "Benchmark choice is entirely prohibited for specialized funds",
      "Using the US S&P 500 index regardless of domestic portfolio assets"
    ],
    "correctIndex": 1,
    "explanation": "Regulations mandate benchmarks that reflect the strategy, duration, and asset composition of the underlying specialized fund portfolio.",
    "topic": "Performance Evaluation"
  },
  {
    "id": "nism-vd-q10",
    "courseId": "nism-vd",
    "question": "What is the dual licensing benefit of holding the NISM Series V-D certification for financial intermediaries?",
    "options": [
      "Authorizes the distribution of both standard mutual fund schemes and specialized investment funds (SIF) under a unified license",
      "Allows the advisor to trade international currency futures without an exchange broker",
      "Exempts the distributor from filing GST returns",
      "Guarantees automatic appointment as an AMC fund manager"
    ],
    "correctIndex": 0,
    "explanation": "NISM Series V-D provides accreditation covering both traditional mutual funds and specialized investment funds under SEBI distribution guidelines.",
    "topic": "SIF Regulatory Framework"
  },
  {
    "id": "nism-va-q191",
    "courseId": "nism-va",
    "question": "Which of the following investment assets has historically exhibited the strongest negative correlation with domestic equities during geopolitical crises in India?",
    "options": [
      "Real Estate",
      "Sovereign Gold",
      "High-Yield Corporate Bonds",
      "Commercial Paper"
    ],
    "correctIndex": 1,
    "explanation": "Gold has historically served as a safe haven and portfolio hedge with strong negative or low correlation to domestic equities during systemic and geopolitical turmoil.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q192",
    "courseId": "nism-va",
    "question": "An investor seeking regular fixed payouts with sovereign guarantee should prioritize which financial instrument?",
    "options": [
      "Subordinated Tier-II Bank Bonds",
      "Government Securities (G-Secs) through RBI Retail Direct",
      "Non-Convertible Debentures of NBFCs",
      "Arbitrage Mutual Funds"
    ],
    "correctIndex": 1,
    "explanation": "Government of India Dated Securities (G-Secs) provide zero credit risk backed by sovereign guarantee with fixed semi-annual coupon distributions.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q193",
    "courseId": "nism-va",
    "question": "If inflation in the economy is running at 6% per annum and an investor earns 7% nominal return on an FD before a 30% tax slab, what is their post-tax real rate of return?",
    "options": [
      "+1.00%",
      "-1.10%",
      "-0.90%",
      "+0.70%"
    ],
    "correctIndex": 1,
    "explanation": "Post-tax nominal return = 7% * (1 - 0.30) = 4.90%. Real rate of return approx = 4.90% - 6.00% = -1.10%. The investor's purchasing power declines in real terms.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q194",
    "courseId": "nism-va",
    "question": "The primary economic benefit of compounding returns is maximized when an investor:",
    "options": [
      "Chases momentum stocks with frequent intraday churning",
      "Commences investing early with long holding periods and reinvests cash flows",
      "Withdraws capital gains annually to avoid taxation",
      "Times market peaks with leveraged derivative positions"
    ],
    "correctIndex": 1,
    "explanation": "Compounding exhibits exponential growth when investments are initiated early, allowed uninterrupted tenure, and distributions are reinvested rather than withdrawn.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q195",
    "courseId": "nism-va",
    "question": "Which statutory authority regulates National Pension System (NPS) products and point of presence entities in India?",
    "options": [
      "SEBI",
      "IRDAI",
      "PFRDA",
      "Reserve Bank of India"
    ],
    "correctIndex": 2,
    "explanation": "The Pension Fund Regulatory and Development Authority (PFRDA) is the statutory regulator governing the National Pension System in India.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q196",
    "courseId": "nism-va",
    "question": "How does reinvestment risk impact an investor holding a 10-year 8.5% fixed-rate bond when interest rates decline to 6% in year 3?",
    "options": [
      "The periodic coupon payouts will be reinvested at the lower prevailing 6% yield",
      "The principal will be redeemed early by the sovereign",
      "The bond price will drop sharply in the secondary market",
      "The coupon rate on the bond automatically drops to 6%"
    ],
    "correctIndex": 0,
    "explanation": "Reinvestment risk refers to the risk that intermediate cash flows (coupons) received cannot be reinvested at the original high yield (8.5%) and must be deployed at the lower prevailing market rate (6%).",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q197",
    "courseId": "nism-va",
    "question": "Which of the following asset classes offers the greatest liquidity for immediate settlement in India?",
    "options": [
      "Physical Commercial Real Estate",
      "Overnight & Liquid Mutual Funds",
      "Private Equity Unlisted Shares",
      "Senior Citizen Savings Scheme (SCSS)"
    ],
    "correctIndex": 1,
    "explanation": "Overnight and liquid mutual funds offer T+1 settlement with instant redemption facilities (up to ₹50,000 or 90% of folio value) within seconds.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q198",
    "courseId": "nism-va",
    "question": "The nominal risk-free rate of return in India is generally benchmarked against the yield on:",
    "options": [
      "91-day Government of India Treasury Bills (T-Bills)",
      "30-year Corporate Infrastructure Bonds",
      "State Development Loans (SDLs)",
      "Nifty 50 Dividend Yield"
    ],
    "correctIndex": 0,
    "explanation": "91-day Government of India Treasury Bills represent sovereign-backed short-term debt with zero default risk, serving as the benchmark risk-free rate.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q199",
    "courseId": "nism-va",
    "question": "Purchasing power risk is most hazardous to investors with prolonged exposure to:",
    "options": [
      "Diversified Equity Mutual Funds",
      "Fixed-rate cash deposits with returns below prevailing CPI inflation",
      "Inflation-Indexed Bonds",
      "Precious metal ETFs"
    ],
    "correctIndex": 1,
    "explanation": "Fixed-rate nominal instruments whose post-tax returns trail consumer price inflation steadily erode the purchasing power of the principal over time.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q200",
    "courseId": "nism-va",
    "question": "Under modern portfolio theory, the primary purpose of asset allocation across non-correlated asset classes is to:",
    "options": [
      "Guarantee positive returns every trading month",
      "Reduce total portfolio volatility for a targeted expected rate of return",
      "Eliminate all forms of market and systemic risk",
      "Avoid paying securities transaction tax"
    ],
    "correctIndex": 1,
    "explanation": "Asset allocation optimizes the risk-return frontier by combining imperfectly correlated assets, minimizing overall portfolio variance for a target return level.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q201",
    "courseId": "nism-va",
    "question": "Which of the following small savings schemes is backed by sovereign guarantee and exempt from tax under Section 80C with EEE status?",
    "options": [
      "Public Provident Fund (PPF)",
      "Corporate Fixed Deposit",
      "Mutual Fund Monthly Income Plan",
      "Commercial Paper"
    ],
    "correctIndex": 0,
    "explanation": "PPF enjoys sovereign backing with Exempt-Exempt-Exempt (EEE) status: contribution deductible under 80C, interest exempt, and maturity proceeds tax-free.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q202",
    "courseId": "nism-va",
    "question": "In financial planning, an Emergency Reserve Fund should ideally be equivalent to:",
    "options": [
      "1 to 2 days of discretionary dining expenses",
      "6 to 12 months of mandatory family living expenses and debt obligations",
      "10 years of retirement income",
      "The entire net worth of the individual"
    ],
    "correctIndex": 1,
    "explanation": "An emergency reserve should hold 6 to 12 months of non-negotiable living expenses, EMIs, and insurance premiums in high-liquidity instruments.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q203",
    "courseId": "nism-va",
    "question": "Which of the following instruments is considered money market debt with maturity of up to one year issued by corporations to meet short-term liabilities?",
    "options": [
      "Commercial Paper (CP)",
      "Perpetual AT-1 Bonds",
      "Municipal Bonds",
      "Deep Discount Zero-Coupon Debentures"
    ],
    "correctIndex": 0,
    "explanation": "Commercial Paper (CP) is an unsecured money market instrument issued by creditworthy corporates in promissory note form for maturities between 7 days and 1 year.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q204",
    "courseId": "nism-va",
    "question": "The spread between the 10-year Indian Government Bond yield and the Repo Rate primarily reflects:",
    "options": [
      "AMC Management Fee limits",
      "Term premium, inflation expectations, and long-term liquidity conditions",
      "Securities Transaction Tax collected by exchanges",
      "Stamp duty charges payable to state treasuries"
    ],
    "correctIndex": 1,
    "explanation": "The slope and term spread between the 10-year G-sec yield and overnight repo rate reflect the market's inflation expectations, credit cycle outlook, and term premium.",
    "topic": "Investment Landscape"
  },
  {
    "id": "nism-va-q205",
    "courseId": "nism-va",
    "question": "The operational structure of a mutual fund ensures that unit holders are entitled to:",
    "options": [
      "A guaranteed fixed dividend irrespective of portfolio earnings",
      "Pro-rata ownership and sharing of scheme profits and losses",
      "Voting rights in the AMC board meetings",
      "Exemption from all capital gains tax"
    ],
    "correctIndex": 1,
    "explanation": "Mutual funds operate on a pass-through pooling principle: every unit holder participates pro-rata in the assets, income, gains, and losses of the underlying portfolio.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q206",
    "courseId": "nism-va",
    "question": "Which of the following is a structural limitation of open-ended mutual funds compared to direct equity ownership?",
    "options": [
      "Portfolio diversification across sectors",
      "Mandatory regulation by SEBI",
      "Inability of an individual unit holder to customize portfolio security exclusions",
      "Availability of systematic investment plans (SIP)"
    ],
    "correctIndex": 2,
    "explanation": "In pooled mutual funds, individual investors hold units of a collective mandate and cannot dictate specific stock exclusions or individualized portfolio tilting.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q207",
    "courseId": "nism-va",
    "question": "What is the primary difference between a closed-ended fund and an open-ended fund in India?",
    "options": [
      "Closed-ended funds do not calculate daily NAV",
      "Closed-ended funds issue units only during NFO and trade on a stock exchange until maturity",
      "Closed-ended funds are exempt from SEBI investment limits",
      "Open-ended funds cannot invest in equities"
    ],
    "correctIndex": 1,
    "explanation": "Closed-ended funds issue units exclusively during the NFO, after which units cannot be directly redeemed with the AMC until maturity, but must be traded on stock exchanges.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q208",
    "courseId": "nism-va",
    "question": "The unit capital of an open-ended mutual fund scheme:",
    "options": [
      "Remains rigidly constant throughout the scheme's existence",
      "Changes continuously due to daily purchases and redemptions by unit holders",
      "Can only be altered with Central Government approval",
      "Decreases automatically when the Nifty index falls"
    ],
    "correctIndex": 1,
    "explanation": "Open-ended mutual funds have variable unit capital that expands when new units are issued upon subscription and contracts when units are redeemed.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q209",
    "courseId": "nism-va",
    "question": "Which of the following represents an interval fund under SEBI guidelines?",
    "options": [
      "A fund that invests solely in intraday algorithmic strategies",
      "A fund that allows entry and exit during specified transaction windows (intervals) throughout the year",
      "A fund that pays dividends every 15 minutes",
      "A fund with no maturity and no exit load"
    ],
    "correctIndex": 1,
    "explanation": "Interval funds combine features of open-ended and closed-ended funds, opening for subscriptions and redemptions only during pre-defined interval periods.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q210",
    "courseId": "nism-va",
    "question": "Real Estate Mutual Funds and Infrastructure Debt Schemes under SEBI regulations are primarily structured as:",
    "options": [
      "Open-ended daily liquid funds",
      "Closed-ended schemes listed on recognized stock exchanges",
      "Unregulated private partnerships",
      "Foreign portfolio feeder funds"
    ],
    "correctIndex": 1,
    "explanation": "Due to the illiquid nature of underlying infrastructure and real estate assets, SEBI mandates that such funds be structured as closed-ended schemes listed on stock exchanges.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q211",
    "courseId": "nism-va",
    "question": "The primary objective of a 'Growth Option' in a mutual fund scheme is to:",
    "options": [
      "Distribute all realized dividends to unit holders every Friday",
      "Retain and reinvest all portfolio earnings and capital gains to compound NAV",
      "Guarantee a minimum 15% annual return",
      "Avoid deducting the Total Expense Ratio"
    ],
    "correctIndex": 1,
    "explanation": "In a Growth option, all profits, interest, and dividends are retained in the scheme and reflected as appreciation in the NAV, maximizing compounding benefits.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q212",
    "courseId": "nism-va",
    "question": "In an IDCW (Income Distribution cum Capital Withdrawal) option, when a distribution is made to unit holders, the NAV of the scheme:",
    "options": [
      "Rises by the exact payout percentage",
      "Falls by the exact per-unit distribution amount plus applicable taxes",
      "Remains unaffected because cash was borrowed from the AMC",
      "Is frozen for 30 business days"
    ],
    "correctIndex": 1,
    "explanation": "Any IDCW payout is paid out of the distributable surplus of the scheme. Therefore, on the record date, the NAV drops to the extent of the gross dividend/distribution per unit.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q213",
    "courseId": "nism-va",
    "question": "Can an Asset Management Company guarantee a specific rate of return on an open-ended equity scheme under SEBI regulations?",
    "options": [
      "Yes, if the AMC has a net worth exceeding ₹1,000 Crore",
      "No, SEBI strictly prohibits guaranteed returns unless backed by a formal credit guarantee disclosed in SID",
      "Yes, up to 12% per annum",
      "Yes, if the fund manager is a CFA charterholder"
    ],
    "correctIndex": 1,
    "explanation": "SEBI strictly prohibits promising or guaranteeing returns in mutual funds unless the guarantee is explicitly insured or backed by the sponsor/guarantor with full SID disclosures.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q214",
    "courseId": "nism-va",
    "question": "What is the primary role of the Association of Mutual Funds in India (AMFI)?",
    "options": [
      "Acting as the judicial court for investor litigations",
      "Promoting industry standards, ethical distribution practices, and issuing ARN/EUIN licenses",
      "Directly fixing the daily NAV of all mutual funds in India",
      "Managing sovereign foreign exchange reserves"
    ],
    "correctIndex": 1,
    "explanation": "AMFI is the premier industry association in India that sets professional standards, promotes ethical distribution, handles investor education, and issues AMFI Registration Numbers (ARN).",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q215",
    "courseId": "nism-va",
    "question": "How do Exchange Traded Funds (ETFs) differ from standard open-ended index funds?",
    "options": [
      "ETFs trade real-time on stock exchanges at market-determined prices, requiring a Demat account",
      "ETFs have significantly higher expense ratios than active funds",
      "ETFs do not track any underlying benchmark index",
      "ETFs guarantee capital protection"
    ],
    "correctIndex": 0,
    "explanation": "ETFs trade intra-day on stock exchange terminals like equity shares, allowing real-time trading at prevailing market bid-ask quotes, requiring a demat and trading account.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q216",
    "courseId": "nism-va",
    "question": "Which of the following is a statutory requirement for an entity applying to become a mutual fund Sponsor under SEBI regulations?",
    "options": [
      "Must have at least 5 years of track record in financial services with positive net worth in all 5 years",
      "Must be a state-owned public enterprise",
      "Must be registered as a non-banking finance company with RBI",
      "Must manage at least ₹50,000 Crore of AUM"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that a sponsor must have a minimum 5-year track record in financial services, with positive net worth across all 5 years and profitability in at least 3 of the last 5 years.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q217",
    "courseId": "nism-va",
    "question": "In the tripartite structure of an Indian mutual fund, the Trustees owe fiduciary duty primarily to:",
    "options": [
      "The shareholders of the Asset Management Company",
      "The unit holders of the mutual fund schemes",
      "The stock exchanges where funds are listed",
      "The Ministry of Corporate Affairs"
    ],
    "correctIndex": 1,
    "explanation": "Trustees hold the fund assets in trust on behalf of unit holders and owe strict fiduciary obligations solely to protect the financial interests of scheme investors.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q218",
    "courseId": "nism-va",
    "question": "What proportion of the Board of Trustees must be independent directors under SEBI (Mutual Funds) Regulations?",
    "options": [
      "At least 25%",
      "At least 33%",
      "At least 50%",
      "At least 66.67% (two-thirds)"
    ],
    "correctIndex": 3,
    "explanation": "SEBI mandates that at least two-thirds (66.67%) of the members of the Board of Trustees must be independent persons not associated with the sponsor or its associates.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q219",
    "courseId": "nism-va",
    "question": "Under the Indian Trusts Act, 1882, who is the author of the trust in a mutual fund setup?",
    "options": [
      "The Custodian",
      "The Sponsor",
      "The Registrar and Transfer Agent",
      "The Unit Holder"
    ],
    "correctIndex": 1,
    "explanation": "The Sponsor acts as the settlor or author of the trust by executing the Trust Deed and creating the mutual fund trust for the benefit of unit holders.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q220",
    "courseId": "nism-va",
    "question": "What is the statutory minimum net worth required for an Asset Management Company (AMC) to operate under SEBI regulations?",
    "options": [
      "₹10 Crore",
      "₹25 Crore",
      "₹50 Crore",
      "₹100 Crore"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI (Mutual Funds) Regulations, an AMC is required to maintain a continuous minimum net worth of at least ₹50 Crore.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q221",
    "courseId": "nism-va",
    "question": "Can an Asset Management Company (AMC) undertake portfolio management services (PMS) or advisory activities?",
    "options": [
      "No, AMCs are strictly barred from any non-mutual fund activity",
      "Yes, provided there is no conflict of interest and proper departmental Chinese walls exist as approved by SEBI",
      "Yes, without any SEBI intimation",
      "Only if it merges with a scheduled commercial bank"
    ],
    "correctIndex": 1,
    "explanation": "Under Regulation 24 of SEBI MF Regulations, an AMC may undertake PMS or advisory services provided it ensures complete operational segregation and no conflict of interest with mutual fund schemes.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q222",
    "courseId": "nism-va",
    "question": "Who appoints the Registrar and Transfer Agent (RTA) for a mutual fund in India?",
    "options": [
      "The Association of Mutual Funds in India (AMFI)",
      "The Asset Management Company (AMC) with approval of Trustees",
      "The Ministry of Finance",
      "The Unit Holders via AGM"
    ],
    "correctIndex": 1,
    "explanation": "The AMC, with the formal consent and supervision of the Board of Trustees, enters into an agreement to appoint a SEBI-registered RTA.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q223",
    "courseId": "nism-va",
    "question": "Which entity is legally responsible for holding physical and dematerialized securities of mutual fund portfolios in safe custody?",
    "options": [
      "The Registrar and Transfer Agent (RTA)",
      "The Custodian registered with SEBI",
      "The Chief Executive Officer of the AMC",
      "The Depository Participant chosen by the sponsor"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI regulations, the Custodian holds the portfolio securities and tracks corporate actions, operating completely independent of the AMC.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q224",
    "courseId": "nism-va",
    "question": "Can the Sponsor of a mutual fund and its Custodian be the same corporate entity without restriction?",
    "options": [
      "Yes, it is common practice in all global jurisdictions",
      "No, SEBI mandates that the Custodian must not be an associate of the Sponsor or AMC unless at least 50% independent directors oversee both and criteria under Regulation 24 are met",
      "Yes, if both entities have the same CEO",
      "Only if the fund invests solely in money market securities"
    ],
    "correctIndex": 1,
    "explanation": "SEBI maintains strict arm's length regulations between the Sponsor/AMC and the Custodian to prevent co-mingling of assets and conflicts of interest.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q225",
    "courseId": "nism-va",
    "question": "Who audits the financial accounts of a mutual fund scheme in India?",
    "options": [
      "The internal auditor of the Sponsor",
      "An independent Chartered Accountant firm appointed by the Trustees",
      "The Comptroller and Auditor General of India (CAG)",
      "The compliance officer of the RTA"
    ],
    "correctIndex": 1,
    "explanation": "The accounts of each mutual fund scheme must be audited by an independent statutory auditor appointed by the Trustees, who cannot be the same as the AMC auditor.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q226",
    "courseId": "nism-va",
    "question": "What is the primary role of a KYC Registration Agency (KRA) in the Indian mutual fund ecosystem?",
    "options": [
      "Printing unit certificates for physical folios",
      "Centralizing and maintaining investor KYC records so that an investor does not repeat KYC across multiple intermediaries",
      "Executing intraday stock orders for AMC dealers",
      "Auditing the expense ratios of mutual fund schemes"
    ],
    "correctIndex": 1,
    "explanation": "KRAs centralize investor KYC documents under SEBI KYC regulations, allowing an investor who is KYC-compliant with one SEBI intermediary to transact across all SEBI entities.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q227",
    "courseId": "nism-va",
    "question": "How often must the Trustees of a mutual fund review transactions between the AMC and its associates?",
    "options": [
      "Once every 5 years",
      "At least quarterly in their meetings",
      "Only when an associate declares bankruptcy",
      "Annually after filing income tax returns"
    ],
    "correctIndex": 1,
    "explanation": "Trustees are mandated to conduct a quarterly review of all transactions between the AMC, its associates, and related-party brokerages to enforce investor protection.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q228",
    "courseId": "nism-va",
    "question": "Which of the following documents legally establishes the mutual fund and defines the rights and obligations of Trustees and unit holders?",
    "options": [
      "Scheme Information Document (SID)",
      "Trust Deed executed by the Sponsor and Trustees",
      "Key Information Memorandum (KIM)",
      "Broker Distribution Agreement"
    ],
    "correctIndex": 1,
    "explanation": "The Trust Deed is the primary foundational legal document executed between the Sponsor and the Board of Trustees registered under the Registration Act, 1908.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q229",
    "courseId": "nism-va",
    "question": "What is the statutory role of the Investment Committee in an Asset Management Company?",
    "options": [
      "Approving broker commissions for distributor roadshows",
      "Setting overall investment policy, asset allocation frameworks, and monitoring scheme risk parameters",
      "Selecting marketing brand ambassadors",
      "Conducting tax audits of high-net-worth investors"
    ],
    "correctIndex": 1,
    "explanation": "The Investment Committee of the AMC formulates investment philosophy, monitors portfolio risk metrics, and ensures compliance with SEBI exposure limits.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q230",
    "courseId": "nism-va",
    "question": "What proportion of the Board of Directors of an Asset Management Company (AMC) must be independent directors?",
    "options": [
      "At least 25%",
      "At least 50%",
      "At least 66.67%",
      "100%"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI (Mutual Funds) Regulations, at least 50% of the directors on the Board of the AMC must be independent directors not associated with the Sponsor.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q231",
    "courseId": "nism-va",
    "question": "Can an individual serve simultaneously as a Trustee of one mutual fund and a Director of an AMC of another mutual fund?",
    "options": [
      "Yes, if approved by AMFI",
      "No, SEBI strictly prohibits common trusteeship or directorship across competing mutual fund entities to prevent conflicts of interest",
      "Yes, if the two funds have different market caps",
      "Yes, if an annual disclosure is published in newspapers"
    ],
    "correctIndex": 1,
    "explanation": "SEBI MF Regulations bar cross-directorships and common trusteeships between competing mutual fund AMCs and Trustee boards.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q232",
    "courseId": "nism-va",
    "question": "In case of gross negligence or breach of trust causing financial loss to unit holders, who can be held legally liable?",
    "options": [
      "Only the junior dealer who entered the buy order",
      "The AMC and the Trustees in their fiduciary capacity",
      "Only the software provider hosting the cloud servers",
      "Unit holders who approved the NFO"
    ],
    "correctIndex": 1,
    "explanation": "Trustees and the AMC carry statutory and fiduciary accountability under SEBI regulations and the Trust Deed for breach of trust or gross negligence.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q233",
    "courseId": "nism-va",
    "question": "Under SEBI regulations, what is the maximum permissible investment by a mutual fund scheme in debt instruments issued by a single issuer?",
    "options": [
      "10% of NAV (extendable to 12% with prior approval of Trustees and AMC Board)",
      "25% of NAV without conditions",
      "5% of NAV under all circumstances",
      "30% of NAV if rated AAA"
    ],
    "correctIndex": 0,
    "explanation": "SEBI single issuer debt exposure limit is 10% of scheme NAV, extendable to 12% with prior approval of the Board of Trustees and Board of Directors of the AMC.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q234",
    "courseId": "nism-va",
    "question": "What is the maximum investment limit for an equity mutual fund scheme in the equity shares of a single company?",
    "options": [
      "5% of NAV",
      "10% of NAV",
      "20% of NAV",
      "15% of NAV"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI regulations, an open-ended equity scheme cannot invest more than 10% of its NAV in the equity shares or equity-related instruments of any single company.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q235",
    "courseId": "nism-va",
    "question": "Can a mutual fund scheme invest in unrated debt and money market instruments issued by a corporate entity?",
    "options": [
      "Yes, up to 50% of scheme assets",
      "No, SEBI mandates that mutual funds can only invest in listed or to-be-listed rated debt instruments (subject to specific G-Sec/T-bill exemptions)",
      "Yes, if the issuer pays a 15% coupon",
      "Yes, if the fund manager provides personal indemnity"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI revised norms, mutual funds are prohibited from investing in unlisted or unrated debt and money market instruments, except for sovereign papers and repo transactions.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q236",
    "courseId": "nism-va",
    "question": "Which of the following actions constitutes a violation of the SEBI (Prohibition of Insider Trading) Regulations for mutual fund employees?",
    "options": [
      "Submitting an internal personal trading pre-clearance request to compliance",
      "Dealing in shares of a company while possessing Unpublished Price Sensitive Information (UPSI) acquired during fund manager research visits",
      "Investing in the growth option of a broad market index fund",
      "Writing research reports based entirely on public annual reports"
    ],
    "correctIndex": 1,
    "explanation": "Trading or tipping based on Unpublished Price Sensitive Information (UPSI) is a severe criminal and regulatory offense under SEBI Insider Trading Regulations.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q237",
    "courseId": "nism-va",
    "question": "Under SEBI circular on 'Skin in the Game', key employees of an AMC (fund managers, CXOs) are mandated to:",
    "options": [
      "Invest a specified percentage of their net salary in the mutual fund schemes they manage with a 3-year lock-in",
      "Provide personal collateral for scheme redemptions",
      "Work without compensation during bear markets",
      "Hold 100% of their net worth in government cash balances"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that key employees of AMCs must invest a minimum percentage (ranging from 10% to 20%) of their cost to company (CTC) in units of the schemes they manage, locked for 3 years.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q238",
    "courseId": "nism-va",
    "question": "Under SEBI guidelines, what is the maximum aggregate group exposure limit in debt schemes for a single corporate group?",
    "options": [
      "5% of NAV",
      "20% of NAV (extendable to 25% with Trustee approval)",
      "50% of NAV",
      "35% of NAV"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates that debt schemes cannot exceed 20% of NAV in debt securities of a single corporate group, extendable to 25% with prior Trustee approval.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q239",
    "courseId": "nism-va",
    "question": "What is the primary requirement under the Prevention of Money Laundering Act (PMLA) for mutual fund intermediaries?",
    "options": [
      "Ensuring every client doubles their capital within 3 years",
      "Verifying the identity of the beneficial owner, conducting Customer Due Diligence (CDD), and reporting Suspicious Transaction Reports (STR) to FIU-IND",
      "Collecting cash deposits exceeding ₹10 Lakh without PAN",
      "Exempting high-net-worth investors from KYC verification"
    ],
    "correctIndex": 1,
    "explanation": "PMLA mandates strict client identification, beneficial ownership verification, records preservation, and reporting of suspicious transactions (STR) to the Financial Intelligence Unit - India.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q240",
    "courseId": "nism-va",
    "question": "Can a mutual fund distributor registered under AMFI guarantee portfolio outperformance over the benchmark index?",
    "options": [
      "Yes, if the distributor has passed the NISM Series V-A examination with >80%",
      "No, AMFI Code of Conduct strictly bars distributors from making exaggerated claims or guaranteeing performance",
      "Yes, if the investor signs an indemnity waiver",
      "Yes, for liquid and overnight funds only"
    ],
    "correctIndex": 1,
    "explanation": "The AMFI Code of Conduct explicitly prohibits distributors from guaranteeing returns, making false claims, or projecting speculative performance numbers.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q241",
    "courseId": "nism-va",
    "question": "What is the statutory cooling-off period required before an employee of an AMC can execute a personal trade in a stock that was bought or sold by the AMC scheme?",
    "options": [
      "Zero hours",
      "At least 15 calendar days from the date of the scheme's transaction",
      "6 months",
      "3 years"
    ],
    "correctIndex": 1,
    "explanation": "SEBI employee personal trading guidelines mandate a cooling-off period (typically 15 days) before or after scheme trades to prevent front-running and conflict of interest.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q242",
    "courseId": "nism-va",
    "question": "In mutual fund advertising, SEBI mandates that performance numbers must always be accompanied by:",
    "options": [
      "A mandatory risk disclaimer: 'Mutual Fund investments are subject to market risks, read all scheme related documents carefully'",
      "The personal mobile number of the fund manager",
      "A guarantee certificate from a nationalized bank",
      "A pledge of sovereign gold bonds"
    ],
    "correctIndex": 0,
    "explanation": "All promotional material and advertisements across print, audio, and visual media must prominently display the standard statutory risk disclaimer.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q243",
    "courseId": "nism-va",
    "question": "Under SEBI regulations, how long must an AMC preserve investor records, application forms, and transaction logs?",
    "options": [
      "1 year",
      "3 years",
      "At least 8 years",
      "Only until the next audit"
    ],
    "correctIndex": 2,
    "explanation": "Under PMLA and SEBI regulations, all transaction logs, account opening forms, and investor communication records must be preserved for at least 8 years.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q244",
    "courseId": "nism-va",
    "question": "Which authority handles unresolved investor grievances against mutual fund intermediaries through the online SCORES 2.0 portal?",
    "options": [
      "SEBI",
      "RBI",
      "IRDAI",
      "Competition Commission of India"
    ],
    "correctIndex": 0,
    "explanation": "SEBI operates the SEBI Complaints Redress System (SCORES), providing centralized tracking and time-bound resolution for investor complaints against market intermediaries.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q245",
    "courseId": "nism-va",
    "question": "Under SEBI regulations, what is the maximum percentage of scheme NAV that can be invested in unlisted equity shares?",
    "options": [
      "10% of NAV",
      "0% (Zero - unlisted equity investments are completely prohibited for open-ended MF schemes)",
      "25% of NAV",
      "5% of NAV"
    ],
    "correctIndex": 1,
    "explanation": "SEBI regulations prohibit open-ended mutual fund schemes from investing in unlisted equity shares and equity-related instruments to protect scheme liquidity.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q246",
    "courseId": "nism-va",
    "question": "What is 'Front-Running' under SEBI (Prohibition of Fraudulent and Unfair Trade Practices) Regulations?",
    "options": [
      "Running to the exchange building to submit physical share certificates",
      "Trading in securities ahead of a substantial block order of a mutual fund scheme to profit from the anticipated price movement",
      "Investing in an NFO on day one",
      "Redeeming units exactly at 2:59 PM"
    ],
    "correctIndex": 1,
    "explanation": "Front-running is a fraudulent market malpractice where an entity trades securities on personal account possessing advance knowledge of impending large client/fund orders.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q247",
    "courseId": "nism-va",
    "question": "Can an open-ended mutual fund borrow money to fund daily investment purchases in the stock market?",
    "options": [
      "Yes, up to 100% of its net assets",
      "No, mutual funds can borrow ONLY to meet temporary liquidity requirements for unit redemptions, up to 20% of net assets for max 6 months",
      "Yes, if interest rates are below 5%",
      "Yes, with approval of the local stock broker"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI Regulation 44, funds can borrow exclusively for temporary redemption or dividend liquidity needs, capped at 20% of net assets for a maximum period of 6 months.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q248",
    "courseId": "nism-va",
    "question": "Under SEBI norms, the valuation of non-traded or thinly traded debt securities must be performed based on:",
    "options": [
      "The fund manager's optimistic personal assessment",
      "Matrix pricing guidelines and valuation models provided by independent valuation agencies approved by AMFI (e.g. CRISIL / ICRA)",
      "The historical purchase cost without write-downs",
      "The Face Value of ₹1,000"
    ],
    "correctIndex": 1,
    "explanation": "Non-traded debt securities must be valued strictly using mark-to-market matrix methodology released daily by AMFI-appointed independent valuation agencies.",
    "topic": "Mutual Fund Structure & Regulation"
  },
  {
    "id": "nism-va-q249",
    "courseId": "nism-va",
    "question": "The two primary components of a Mutual Fund Offer Document are:",
    "options": [
      "The Scheme Information Document (SID) and Statement of Additional Information (SAI)",
      "The Balance Sheet and Profit & Loss Account of the Sponsor",
      "The PAN Card and Aadhaar Card of the Fund Manager",
      "The Broker Agreement and Distributor Passbook"
    ],
    "correctIndex": 0,
    "explanation": "The Offer Document comprises the SID (scheme-specific details) and the SAI (statutory, governance, and sponsor-level information).",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q250",
    "courseId": "nism-va",
    "question": "Which document contains detailed statutory information regarding the Sponsor, AMC, Trustees, Custodian, and legal proceedings?",
    "options": [
      "Scheme Information Document (SID)",
      "Statement of Additional Information (SAI)",
      "Key Information Memorandum (KIM)",
      "Factsheet"
    ],
    "correctIndex": 1,
    "explanation": "The Statement of Additional Information (SAI) contains all statutory and institutional details regarding the constitution, management, sponsor history, and governance of the mutual fund.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q251",
    "courseId": "nism-va",
    "question": "How frequently must an Asset Management Company update the Scheme Information Document (SID) under SEBI guidelines?",
    "options": [
      "Every week",
      "At least once every financial year (annually)",
      "Only once every 10 years",
      "Never after the initial NFO"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates that the SID must be updated at least once every financial year, within six months of the end of the financial year.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q252",
    "courseId": "nism-va",
    "question": "Every application form for purchasing mutual fund units must be accompanied by which concise disclosure document?",
    "options": [
      "Full Statement of Additional Information",
      "Key Information Memorandum (KIM)",
      "Annual Report of the Sponsor",
      "Custodian Agreement"
    ],
    "correctIndex": 1,
    "explanation": "Under Section 57 of the SEBI regulations, every application form must be accompanied by the Key Information Memorandum (KIM), summarizing essential scheme terms.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q253",
    "courseId": "nism-va",
    "question": "Where an AMC makes a material fundamental attribute change to an existing mutual fund scheme, what statutory right must be given to existing unit holders?",
    "options": [
      "Right to purchase AMC equity shares at par",
      "An exit window of at least 30 days to redeem their units at the prevailing NAV without paying any exit load",
      "Right to veto the CEO's bonus",
      "Immediate 100% cash dividend"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates that unit holders must be given written communication and a 30-day exit window to redeem without exit load if fundamental attributes of a scheme are altered.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q254",
    "courseId": "nism-va",
    "question": "What constitutes a 'Fundamental Attribute Change' of a mutual fund scheme under SEBI Regulation 18(15A)?",
    "options": [
      "Change in the office address of the local branch distributor",
      "Change in the type of scheme (e.g. open-ended to closed-ended), investment objective, or terms of asset allocation",
      "Change in the AMC stationary supplier",
      "Retirement of an administrative clerk in the RTA office"
    ],
    "correctIndex": 1,
    "explanation": "Fundamental attributes include the type of scheme, investment objectives, asset allocation patterns, and terms of redemption or liquidity.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q255",
    "courseId": "nism-va",
    "question": "How often must a mutual fund disclose the complete portfolio of its schemes on its official website under SEBI regulations?",
    "options": [
      "Once every 5 years",
      "On a monthly basis (within 10 days of month-end) and fortnightly for debt schemes",
      "Only to unit holders who visit the head office in person",
      "Quarterly in printed gazettes only"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates monthly portfolio disclosures within 10 days of month-end on AMC and AMFI websites, with fortnightly portfolio disclosures for debt schemes.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q256",
    "courseId": "nism-va",
    "question": "The Risk-o-meter displayed on mutual fund scheme documents and factsheets depicts risk across how many standardized levels?",
    "options": [
      "3 levels: Low, Medium, High",
      "6 levels: Low, Low to Moderate, Moderate, Moderately High, High, and Very High",
      "10 numeric grades from 1 to 10",
      "2 levels: Safe and Risky"
    ],
    "correctIndex": 1,
    "explanation": "SEBI's standardized Risk-o-meter has 6 levels: Low, Low to Moderate, Moderate, Moderately High, High, and Very High, evaluated on a monthly basis.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q257",
    "courseId": "nism-va",
    "question": "When an AMC modifies the fees, fundamental features, or risk profile of a scheme between annual SID updates, it issues a:",
    "options": [
      "Court injunction",
      "Notice-cum-Addendum published in national newspapers and uploaded to the website",
      "New NFO prospectus under a different fund name",
      "Letter to the Governor of the Reserve Bank of India"
    ],
    "correctIndex": 1,
    "explanation": "Interim changes in scheme terms are communicated via a formal 'Notice-cum-Addendum' published in leading English and vernacular newspapers and online.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q258",
    "courseId": "nism-va",
    "question": "What is the maximum duration for which a New Fund Offer (NFO) of an open-ended mutual fund scheme can remain open for subscription?",
    "options": [
      "3 business days",
      "15 calendar days",
      "90 calendar days",
      "1 year"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI MF Regulations, an NFO of an open-ended scheme (other than ELSS) can remain open for subscription for a maximum period of 15 calendar days.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q259",
    "courseId": "nism-va",
    "question": "Within how many business days must an open-ended mutual fund re-open for continuous ongoing purchases and redemptions after NFO closure?",
    "options": [
      "Within 5 business days of unit allotment",
      "Within 30 calendar days",
      "After 6 months",
      "Immediately on the day of NFO launch"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that units must be allotted and the scheme must re-open for continuous sales and repurchases within 5 business days from NFO closure date.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q260",
    "courseId": "nism-va",
    "question": "If an AMC fails to collect the minimum subscription target during an NFO, within how many days must it refund the subscription money to applicants?",
    "options": [
      "Within 5 business days from the closure of the NFO",
      "Within 60 calendar days",
      "Within 1 year with RBI permission",
      "Refunds are never permitted under company law"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations, if the minimum subscription amount is not raised, the AMC must refund the entire subscription amount within 5 business days of NFO closure.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q261",
    "courseId": "nism-va",
    "question": "The Key Information Memorandum (KIM) must be updated by the AMC at least:",
    "options": [
      "Once every month",
      "At least once a year (annually)",
      "Only when the benchmark index drops by 10%",
      "Every decade"
    ],
    "correctIndex": 1,
    "explanation": "SEBI requires the KIM to be updated at least once a year and made available to every prospective investor prior to unit subscription.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q262",
    "courseId": "nism-va",
    "question": "Where can an investor inspect material documents like the Trust Deed, Custodian Agreement, and AMC Memorandum of Association?",
    "options": [
      "At the registered head office of the AMC during regular business hours",
      "Only at SEBI Bhavan in Mumbai with court subpoena",
      "On unverified social media handles",
      "These documents are strictly confidential trade secrets"
    ],
    "correctIndex": 0,
    "explanation": "The SAI explicitly lists material contracts and documents that are open for inspection by unit holders at the AMC's registered office during office hours.",
    "topic": "Legal & Regulatory Framework"
  },
  {
    "id": "nism-va-q263",
    "courseId": "nism-va",
    "question": "Under SEBI and AMFI guidelines, who is mandated to obtain an Employee Unique Identification Number (EUIN)?",
    "options": [
      "Only the CEO and Board of Directors of the Asset Management Company",
      "Every sales employee or person interacting directly with investors for marketing, selling, or advising on mutual fund schemes",
      "Only staff responsible for data center server cooling",
      "Independent chartered accountants auditing the scheme"
    ],
    "correctIndex": 1,
    "explanation": "AMFI mandates that all sales personnel, relationship managers, and bank employees who interact with or advise investors must obtain and quote their EUIN on application forms.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q264",
    "courseId": "nism-va",
    "question": "What is the primary objective of quoting the EUIN on mutual fund transaction slips?",
    "options": [
      "To track and identify individual sales personnel in case of mis-selling or regulatory grievances, even if the corporate ARN remains the same",
      "To determine the PAN number of the investor",
      "To calculate daily stamp duty payable to state governments",
      "To exempt the transaction from capital gains tax"
    ],
    "correctIndex": 0,
    "explanation": "The EUIN system fixes personal accountability and enables tracking of individual salespersons involved in advising or facilitating transactions, combating mis-selling.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q265",
    "courseId": "nism-va",
    "question": "Under SEBI regulations, how can an AMC compensate mutual fund distributors for mobilizing investments?",
    "options": [
      "Through upfront cash commissions paid directly from scheme assets on day one",
      "Strictly through a trail commission model based on prevailing assets under management, with upfront commissions completely banned",
      "By offering overseas vacation packages and luxury cars to top distributors",
      "By issuing free bonus units from the scheme portfolio"
    ],
    "correctIndex": 1,
    "explanation": "SEBI abolished upfront commissions in 2018; all distributor remuneration must be paid exclusively on a trailing commission basis based on active AUM.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q266",
    "courseId": "nism-va",
    "question": "A distributor who has opted to charge transaction charges under SEBI guidelines can collect how much on an investment of ₹10,000 or more from a first-time mutual fund investor?",
    "options": [
      "₹500",
      "₹150",
      "₹100",
      "Nil (Zero)"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI circular, distributors who opt in can collect ₹150 for a first-time investor in mutual funds and ₹100 for an existing investor on investments of ₹10,000 and above.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q267",
    "courseId": "nism-va",
    "question": "Can a mutual fund distributor pass back or rebate a portion of their trail commission to the investor as an incentive to invest?",
    "options": [
      "Yes, it is encouraged as competitive pricing",
      "No, the AMFI Code of Conduct strictly prohibits rebating or passing back commissions in any form to clients",
      "Yes, if the investment is above ₹1 Crore",
      "Yes, if approved by the bank branch manager"
    ],
    "correctIndex": 1,
    "explanation": "Rebating of commissions directly or indirectly to investors is a grave violation of the AMFI Code of Conduct and can lead to suspension of the ARN license.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q268",
    "courseId": "nism-va",
    "question": "How does a 'Direct Plan' of a mutual fund scheme differ from a 'Regular Plan' of the exact same scheme?",
    "options": [
      "Direct Plans have lower Total Expense Ratios (TER) because no distributor commission is charged, resulting in a higher NAV and returns over time",
      "Direct Plans invest in completely different portfolio stocks",
      "Regular Plans are exempt from capital gains tax",
      "Direct Plans do not allow SIP investments"
    ],
    "correctIndex": 0,
    "explanation": "Direct Plans exclude distributor distribution expenses and commissions, resulting in lower expenses, higher compounding, and a higher NAV relative to Regular Plans.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q269",
    "courseId": "nism-va",
    "question": "Under SEBI regulations, an entity registered as an Investment Adviser (RIA):",
    "options": [
      "Can receive both distribution commissions from AMCs and advisory fees from the same client",
      "Is legally prohibited from receiving any distribution commission from AMCs and can charge only advisory fees directly to clients",
      "Can accept soft-dollar commissions in cash",
      "Must be a public listed bank"
    ],
    "correctIndex": 1,
    "explanation": "SEBI (Investment Advisers) Regulations enforce a strict segregation: an RIA cannot accept any commission or remuneration from AMCs and works on a fee-only advisory model.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q270",
    "courseId": "nism-va",
    "question": "What happens to the trail commission when an investor voluntarily switches their ARN code to another distributor without the consent of the existing distributor?",
    "options": [
      "The new distributor receives double trail commission",
      "The new distributor does not receive any trail commission for the transferred assets, and trail commission ceases to be paid on those assets",
      "The AMC pays a lump-sum penalty to the old distributor",
      "The investor is charged an exit load of 5%"
    ],
    "correctIndex": 1,
    "explanation": "Under AMFI transfer of AUM guidelines, on voluntary transfer of folio without a No Objection Certificate (NOC), the new distributor does not receive trail commission on the migrated assets.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q271",
    "courseId": "nism-va",
    "question": "What is the validity period of an AMFI Registration Number (ARN) issued to an individual distributor upon passing NISM Series V-A?",
    "options": [
      "1 year",
      "3 years",
      "5 years",
      "Permanent lifetime validity without renewal"
    ],
    "correctIndex": 1,
    "explanation": "An ARN card issued to an individual distributor is valid for 3 years from the date of issue and must be renewed by completing CPE or passing the NISM examination prior to expiry.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q272",
    "courseId": "nism-va",
    "question": "Under the 'Execution Only' transaction declaration on an application form, an investor signifies that:",
    "options": [
      "The distributor provided extensive customized financial planning advice",
      "The transaction is executed without any advisory recommendation from the distributor, even if the scheme is not suitable to the investor",
      "The investor promises to never redeem units for 10 years",
      "The AMC will guarantee capital protection"
    ],
    "correctIndex": 1,
    "explanation": "An 'Execution Only' (non-advisory) declaration protects distributors where an investor insists on investing contrary to the distributor's assessment of suitability.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q273",
    "courseId": "nism-va",
    "question": "In the event of the demise of an individual ARN holder, can their trail commission continue to be paid to their legal heir or nominee?",
    "options": [
      "No, all accumulated and future commissions lapse to the Prime Minister Relief Fund",
      "Yes, provided the nominee or legal heir obtains an ARN and complies with AMFI transfer norms within the stipulated time frame",
      "Yes, without obtaining any certification or license",
      "Only if the nominee was already a director of the AMC"
    ],
    "correctIndex": 1,
    "explanation": "AMFI guidelines permit transmission of AUM and continuation of trail commission to the registered nominee/legal heir provided they obtain valid NISM certification and ARN.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q274",
    "courseId": "nism-va",
    "question": "Under AMFI Code of Conduct, a distributor who makes derogatory or malicious statements about a competing AMC or scheme is liable to:",
    "options": [
      "Be awarded a certificate of marketing excellence",
      "Disciplinary action by AMFI, including warning letters, suspension, or permanent cancellation of ARN",
      "Promotion to the board of Trustees",
      "Exemption from paying GST on commission"
    ],
    "correctIndex": 1,
    "explanation": "The AMFI Code of Conduct prohibits unethical competitive practices, derogatory comments, or spreading rumors about competing fund houses.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q275",
    "courseId": "nism-va",
    "question": "What is the minimum age required for an individual to appear for NISM Series V-A and obtain an ARN from AMFI?",
    "options": [
      "16 years",
      "18 years (major under Indian law)",
      "21 years",
      "25 years"
    ],
    "correctIndex": 1,
    "explanation": "An individual must have attained 18 years of age (legal majority) to enter into contracts and receive an ARN license from AMFI.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q276",
    "courseId": "nism-va",
    "question": "Which of the following channels of mutual fund distribution is regulated by the Reserve Bank of India in addition to SEBI?",
    "options": [
      "Individual Independent Financial Advisers (IFAs)",
      "Commercial Banks operating as Corporate Mutual Fund Distributors",
      "Fintech web aggregators",
      "Stock brokers"
    ],
    "correctIndex": 1,
    "explanation": "Scheduled commercial banks acting as corporate distributors are governed primarily by RBI for their banking licenses and adhere to SEBI/AMFI distribution regulations.",
    "topic": "Distribution & Channel Management"
  },
  {
    "id": "nism-va-q277",
    "courseId": "nism-va",
    "question": "A mutual fund scheme has total market value of portfolio investments of ₹1,000 Crore, accrued income of ₹20 Crore, and current liabilities and accrued expenses of ₹30 Crore. If there are 50 Crore units outstanding, what is the Net Asset Value (NAV) per unit?",
    "options": [
      "₹19.80",
      "₹20.00",
      "₹20.40",
      "₹19.40"
    ],
    "correctIndex": 0,
    "explanation": "Net Assets = Investments (1000) + Accrued Income (20) - Current Liabilities (30) = ₹990 Crore. NAV per unit = 990 / 50 = ₹19.80.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q278",
    "courseId": "nism-va",
    "question": "Under SEBI cut-off rules for Liquid and Overnight funds, an investor submits an application with an electronic fund transfer at 1:15 PM on Tuesday, and funds are realized in the scheme account at 1:25 PM on Tuesday. Which NAV will be allotted?",
    "options": [
      "NAV of Wednesday (next business day)",
      "Historical NAV of Monday (previous day)",
      "NAV of Tuesday (same day)",
      "Average NAV of the month"
    ],
    "correctIndex": 1,
    "explanation": "In Liquid and Overnight funds, where application is received up to 1:30 PM and funds are realized before 1:30 PM, the applicable NAV is the previous calendar day (historical NAV).",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q279",
    "courseId": "nism-va",
    "question": "Under current SEBI regulations, for all mutual fund schemes other than Liquid and Overnight funds, the realization of funds principle applies to:",
    "options": [
      "Purchases above ₹2 Lakh only",
      "Purchases above ₹50 Lakh only",
      "All purchase transactions irrespective of the investment amount",
      "Systematic Investment Plans (SIP) only"
    ],
    "correctIndex": 2,
    "explanation": "SEBI mandates that for all purchase transactions across all non-liquid schemes, the NAV of the day on which funds are available for utilization before cut-off (3:00 PM) applies, regardless of transaction value.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q280",
    "courseId": "nism-va",
    "question": "What is the maximum Total Expense Ratio (TER) permissible under SEBI Regulation 52 for an open-ended equity-oriented scheme on the first ₹500 Crore of daily net assets?",
    "options": [
      "2.50%",
      "2.25%",
      "2.00%",
      "1.75%"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI Regulation 52, the maximum base TER for open-ended equity schemes on the first ₹500 Crore of daily net assets is 2.25%.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q281",
    "courseId": "nism-va",
    "question": "When an investor redeems units of an equity fund subject to a 1% exit load, where does the collected exit load go under SEBI regulations?",
    "options": [
      "100% is kept by the AMC as corporate profit",
      "It is credited back entirely to the scheme portfolio immediately (net of GST) to benefit remaining unit holders",
      "It is paid as a special bonus to the distributor",
      "It is deposited in the investor protection fund of the stock exchange"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates that 100% of the exit load charged on redemption must be credited back to the scheme immediately, ensuring remaining unit holders are compensated for the liquidity impact.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q282",
    "courseId": "nism-va",
    "question": "How does the Total Expense Ratio (TER) impact the daily Net Asset Value (NAV) of a mutual fund scheme?",
    "options": [
      "It is deducted once a year during Diwali",
      "It is accrued on a daily basis and deducted before declaring the daily published NAV",
      "It is billed separately as an invoice sent to the investor's home",
      "It is waived during market corrections"
    ],
    "correctIndex": 1,
    "explanation": "Expenses are accrued daily as 1/365th of the annual rate and deducted from the gross asset value before computing and publishing the daily NAV.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q283",
    "courseId": "nism-va",
    "question": "If a mutual fund scheme has an NAV of ₹100 and levies an exit load of 1% on redemptions within 1 year, what is the net redemption price per unit received by an investor who redeems within 6 months?",
    "options": [
      "₹101.00",
      "₹99.00",
      "₹98.00",
      "₹100.00"
    ],
    "correctIndex": 1,
    "explanation": "Redemption Price = NAV * (1 - Exit Load) = 100 * (1 - 0.01) = ₹99.00 per unit.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q284",
    "courseId": "nism-va",
    "question": "Under SEBI guidelines, what is 'Swing Pricing' in mutual funds?",
    "options": [
      "A mechanism that adjusts the scheme NAV upward or downward during periods of extreme market liquidity stress to protect existing investors from dilution caused by large redemptions",
      "A method of dancing at AMC corporate conferences",
      "A tool to increase fund manager bonuses during bull markets",
      "A strategy of buying only midcap swinging momentum stocks"
    ],
    "correctIndex": 0,
    "explanation": "Swing pricing adjusts the net asset value of a scheme during market dislocation to prevent dilution of value for long-term unit holders caused by transaction costs of massive redemptions.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q285",
    "courseId": "nism-va",
    "question": "Under SEBI valuation guidelines, how are listed equity shares valued for daily NAV computation?",
    "options": [
      "At the historical 52-week high price",
      "At the closing price on the primary stock exchange (NSE/BSE) where the security is traded",
      "At the book value from the latest annual balance sheet",
      "At the fund manager's expected target price"
    ],
    "correctIndex": 1,
    "explanation": "Traded equity shares are valued daily at the closing market price on the principal stock exchange where they are primarily listed and traded.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q286",
    "courseId": "nism-va",
    "question": "What is the purpose of 'Side-Pocketing' (Segregated Portfolio) introduced by SEBI for mutual funds?",
    "options": [
      "Hiding losses from the statutory auditor",
      "Segregating distressed or defaulted illiquid credit debt assets from the main liquid portfolio so that genuine investors can continue transacting in the main fund without getting trapped",
      "Creating an offshore tax haven account for the AMC",
      "Paying higher management fees to foreign consultants"
    ],
    "correctIndex": 1,
    "explanation": "Side-pocketing segregates defaulted or downgraded debt instruments into a separate portfolio, ensuring that arriving or exiting investors are treated equitably without panic runs.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q287",
    "courseId": "nism-va",
    "question": "Under SEBI regulations, how is Goods and Services Tax (GST) on Investment Management Fees treated?",
    "options": [
      "It is paid by the Central Government",
      "It is charged to the scheme within the permissible Total Expense Ratio (TER) limits",
      "It can be added as an extra 5% surcharge above all statutory caps",
      "Mutual funds are completely exempt from GST"
    ],
    "correctIndex": 1,
    "explanation": "GST on investment management and advisory fees must be accommodated within the maximum Total Expense Ratio limit prescribed under Regulation 52.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q288",
    "courseId": "nism-va",
    "question": "What is the cut-off time for submitting redemption applications in equity and debt mutual funds for same-day NAV applicability?",
    "options": [
      "1:00 PM",
      "1:30 PM",
      "3:00 PM",
      "5:00 PM"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI revised operational guidelines, the cut-off time for receiving redemption requests for same-day closing NAV applicability is 3:00 PM.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q289",
    "courseId": "nism-va",
    "question": "An AMC can charge additional expenses up to 30 basis points (0.30%) over the base TER if new inflows from B30 (Beyond Top 30 cities) cities are at least:",
    "options": [
      "10% of gross new inflows or 5% of average AUM, whichever is higher",
      "30% of gross new inflows in the scheme or 15% of average AUM, whichever is higher",
      "50% of the scheme corpus",
      "100% from rural post offices"
    ],
    "correctIndex": 1,
    "explanation": "SEBI permits an additional expense of up to 30 bps if inflows from beyond top 30 cities reach at least 30% of gross new inflows or 15% of average AUM (year-to-date), whichever is higher.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q290",
    "courseId": "nism-va",
    "question": "If a mutual fund declares a dividend (IDCW payout) of ₹2 per unit when the cum-dividend NAV is ₹28, what will be the theoretical ex-dividend NAV on the record date (ignoring tax deduction)?",
    "options": [
      "₹30.00",
      "₹28.00",
      "₹26.00",
      "₹25.00"
    ],
    "correctIndex": 2,
    "explanation": "Theoretical Ex-dividend NAV = Cum-dividend NAV - Dividend Payout = 28 - 2 = ₹26.00.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q291",
    "courseId": "nism-va",
    "question": "Under SEBI regulations, how many decimal places must the NAV of an open-ended Liquid or Money Market fund be rounded and published to?",
    "options": [
      "Up to 2 decimal places",
      "At least 4 decimal places",
      "Rounded to the nearest integer rupee",
      "Up to 6 decimal places"
    ],
    "correctIndex": 1,
    "explanation": "Liquid, overnight, and money market funds are required to calculate and publish their NAV up to at least 4 decimal places, whereas equity and other debt funds use 2 decimal places.",
    "topic": "Accounting, Valuation & NAV"
  },
  {
    "id": "nism-va-q292",
    "courseId": "nism-va",
    "question": "Under the Union Budget 2024 tax amendments, what is the holding period required for units of an Equity-Oriented Mutual Fund to qualify as Long-Term Capital Assets?",
    "options": [
      "More than 6 months",
      "More than 12 months",
      "More than 24 months",
      "More than 36 months"
    ],
    "correctIndex": 1,
    "explanation": "Under Section 2(42A) of the Income Tax Act, units of equity-oriented mutual funds held for more than 12 months qualify as long-term capital assets.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q293",
    "courseId": "nism-va",
    "question": "Under Section 112A of the Income Tax Act (as amended by Budget 2024), what is the tax rate applicable on Long-Term Capital Gains (LTCG) from equity mutual funds?",
    "options": [
      "10% on gains exceeding ₹1 Lakh",
      "12.5% on gains exceeding ₹1.25 Lakh per financial year (without indexation)",
      "15% flat on all gains",
      "Taxed at marginal income slab rate"
    ],
    "correctIndex": 1,
    "explanation": "Budget 2024 revised the Section 112A LTCG tax rate to 12.5% while increasing the annual tax-exempt threshold from ₹1 Lakh to ₹1.25 Lakh.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q294",
    "courseId": "nism-va",
    "question": "Under Section 111A of the Income Tax Act (as amended by Budget 2024), what is the tax rate on Short-Term Capital Gains (STCG) on equity mutual fund units held for 12 months or less?",
    "options": [
      "10%",
      "15%",
      "20%",
      "Marginal tax slab rate"
    ],
    "correctIndex": 2,
    "explanation": "Union Budget 2024 increased the Short-Term Capital Gains tax rate on equity-oriented securities and funds from 15% to 20% under Section 111A.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q295",
    "courseId": "nism-va",
    "question": "Under the Finance Act 2023 amendment (Section 50AA), how are capital gains on 'Specified Mutual Funds' (debt funds with not more than 35% domestic equity) acquired on or after April 1, 2023 taxed?",
    "options": [
      "Always treated as Short-Term Capital Gains and taxed at the investor's applicable marginal income tax slab rate, regardless of the holding period",
      "Taxed at 10% after 3 years with full indexation benefit",
      "Completely tax-free under Section 10(23D)",
      "Taxed at a flat rate of 5%"
    ],
    "correctIndex": 0,
    "explanation": "Section 50AA mandates that capital gains from debt funds with <=35% domestic equity acquired on or after April 1, 2023 are deemed short-term capital gains taxed at the investor's applicable slab rates.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q296",
    "courseId": "nism-va",
    "question": "Under Budget 2024, what is the holding period and tax treatment for 'Other Mutual Funds' (such as Gold ETFs, Fund of Funds, and Hybrid funds with equity between 35% and 65%)?",
    "options": [
      "Holding period of >12 months; taxed at 10% with indexation",
      "Holding period of >24 months for LTCG; taxed at 12.5% without indexation",
      "Holding period of >36 months; taxed at 30%",
      "Always tax-exempt"
    ],
    "correctIndex": 1,
    "explanation": "Budget 2024 harmonized unlisted/non-equity asset rules: assets held >24 months qualify as long-term, taxed at 12.5% with the abolition of indexation benefits.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q297",
    "courseId": "nism-va",
    "question": "Under the classical system of dividend taxation in India, how are Income Distribution cum Capital Withdrawal (IDCW) payouts from mutual funds taxed in the hands of unit holders?",
    "options": [
      "Tax-free in the hands of investors because the AMC pays Dividend Distribution Tax (DDT)",
      "Added to the total taxable income of the investor and taxed at their applicable slab rates",
      "Taxed at a flat rate of 10% under Section 115BB",
      "Taxed at 30% irrespective of total income"
    ],
    "correctIndex": 1,
    "explanation": "Dividends/IDCW payouts are added to the investor's taxable income and taxed at their marginal income tax slab rates.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q298",
    "courseId": "nism-va",
    "question": "Under Section 194K of the Income Tax Act, what is the threshold limit beyond which an AMC must deduct Tax Deducted at Source (TDS) on IDCW payouts to a resident individual in a financial year?",
    "options": [
      "₹1,000",
      "₹5,000",
      "₹10,000",
      "₹50,000"
    ],
    "correctIndex": 1,
    "explanation": "Under Section 194K, an AMC must deduct TDS at 10% if the aggregate IDCW (dividend) payout to a resident individual exceeds ₹5,000 in a financial year.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q299",
    "courseId": "nism-va",
    "question": "If an investor does not provide a valid PAN to the AMC, what is the rate of TDS deducted on IDCW payouts exceeding the statutory threshold?",
    "options": [
      "10%",
      "15%",
      "20% (under Section 206AA)",
      "30%"
    ],
    "correctIndex": 2,
    "explanation": "Under Section 206AA of the Income Tax Act, failure to furnish a valid PAN results in TDS deduction at the higher penal rate of 20%.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q300",
    "courseId": "nism-va",
    "question": "Under the Income Tax Act, can a Long-Term Capital Loss (LTCL) incurred on the redemption of equity mutual funds be set off against Short-Term Capital Gains (STCG)?",
    "options": [
      "Yes, capital losses can be set off against any income head",
      "No, Long-Term Capital Loss can ONLY be set off against Long-Term Capital Gains",
      "Yes, but only against bank FD interest",
      "Yes, if the loss is below ₹50,000"
    ],
    "correctIndex": 1,
    "explanation": "Under Indian tax law, Long-Term Capital Loss can only be set off against Long-Term Capital Gains. In contrast, Short-Term Capital Loss can be set off against both STCG and LTCG.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q301",
    "courseId": "nism-va",
    "question": "For how many consecutive assessment years can unabsorbed Long-Term or Short-Term Capital Losses be carried forward, provided the return of income is filed on time under Section 139(1)?",
    "options": [
      "3 assessment years",
      "5 assessment years",
      "Up to 8 consecutive assessment years",
      "Indefinitely"
    ],
    "correctIndex": 2,
    "explanation": "Unadjusted capital losses can be carried forward for up to 8 assessment years following the year in which the loss was incurred, provided the tax return was filed within the due date.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q302",
    "courseId": "nism-va",
    "question": "An investor redeems equity mutual fund units and realizes a Long-Term Capital Gain of ₹3,00,000 in FY 2024-25. Under the Budget 2024 tax framework, what is the tax liability under Section 112A (excluding cess)?",
    "options": [
      "₹37,500",
      "₹21,875 (12.5% on ₹1,75,000)",
      "₹20,000",
      "₹30,000"
    ],
    "correctIndex": 1,
    "explanation": "LTCG above the ₹1,25,000 exemption = ₹3,00,000 - ₹1,25,000 = ₹1,75,000. Tax at 12.5% = 12.5% * 1,75,000 = ₹21,875.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q303",
    "courseId": "nism-va",
    "question": "Is Securities Transaction Tax (STT) applicable on the redemption of units in a Pure Debt Mutual Fund or Liquid Fund in India?",
    "options": [
      "Yes, at 0.1% on the redemption value",
      "No, STT is applicable ONLY on equity-oriented funds and is NOT levied on debt or liquid funds",
      "Yes, if the investor is a corporate",
      "Yes, if the holding period is less than 3 years"
    ],
    "correctIndex": 1,
    "explanation": "STT is levied exclusively on transactions in equity shares, equity-oriented mutual funds, and equity derivatives. Debt mutual funds and money market schemes are exempt from STT.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q304",
    "courseId": "nism-va",
    "question": "What is the tax treatment of switching units from a Regular Plan to a Direct Plan within the exact same mutual fund scheme?",
    "options": [
      "It is treated as an internal bookkeeping transfer with zero tax implications",
      "It is legally treated as a redemption from the regular plan followed by a fresh purchase into the direct plan, triggering capital gains tax",
      "It is exempt under Section 54EC",
      "It attracts a penalty of 10% paid to the Central Government"
    ],
    "correctIndex": 1,
    "explanation": "Any inter-scheme or inter-plan switch (Regular to Direct or Growth to IDCW) constitutes a transfer/redemption under Section 2(47) and triggers applicable capital gains tax.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q305",
    "courseId": "nism-va",
    "question": "What is the tax treatment of mutual fund units transferred as a bona fide gift to a relative or upon transmission under a will?",
    "options": [
      "Treated as an immediate taxable sale at fair market value",
      "Exempt from capital gains tax at the time of transfer; the recipient inherits the original cost and holding period of the previous owner",
      "Subject to 30% gift tax deducted at source by the AMC",
      "Subject to mandatory forfeiture of all accumulated dividends"
    ],
    "correctIndex": 1,
    "explanation": "Under Section 47 of the Income Tax Act, transfer of capital assets under a gift or will is not regarded as a taxable transfer. When the recipient later sells, the cost and holding period of the original owner apply.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q306",
    "courseId": "nism-va",
    "question": "Under Section 80C of the Income Tax Act, what is the maximum tax deduction available for investment in an Equity Linked Savings Scheme (ELSS) in a financial year (under the old tax regime)?",
    "options": [
      "₹50,000",
      "₹1,00,000",
      "₹1,50,000",
      "₹2,50,000"
    ],
    "correctIndex": 2,
    "explanation": "Under Section 80C of the Income Tax Act, investments in eligible instruments including ELSS qualify for a deduction up to ₹1,50,000 per financial year.",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q307",
    "courseId": "nism-va",
    "question": "What is the mandatory statutory lock-in period for units allotted under an Equity Linked Savings Scheme (ELSS)?",
    "options": [
      "1 year",
      "3 years from the date of allotment of units",
      "5 years",
      "Until the investor reaches age 60"
    ],
    "correctIndex": 1,
    "explanation": "ELSS schemes carry a statutory lock-in period of 3 years from the date of each respective unit allotment (each monthly SIP installment is locked for 3 years from its own allotment date).",
    "topic": "Taxation & Legal Principles"
  },
  {
    "id": "nism-va-q308",
    "courseId": "nism-va",
    "question": "What is the 14-digit identifier issued to an investor upon successful completion and registration of Central KYC (CKYC)?",
    "options": [
      "Aadhaar Number",
      "KYC Identification Number (KIN)",
      "Permanent Account Number (PAN)",
      "Bank Account IFSC Code"
    ],
    "correctIndex": 1,
    "explanation": "The Central Registry of Securitisation Asset Reconstruction and Security Interest of India (CERSAI) generates a unique 14-digit KYC Identification Number (KIN) for every CKYC-registered investor.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q309",
    "courseId": "nism-va",
    "question": "Under SEBI and AMFI guidelines, what is the annual investment ceiling for 'Micro SIPs' to be exempt from the requirement of furnishing a PAN card?",
    "options": [
      "₹20,000 per financial year",
      "₹50,000 per financial year per investor across all schemes of an AMC",
      "₹1,00,000 per financial year",
      "₹10,000 per financial year"
    ],
    "correctIndex": 1,
    "explanation": "Micro SIPs and small lump sum investments up to ₹50,000 per financial year per investor are exempt from PAN requirement (valid photo ID proof required).",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q310",
    "courseId": "nism-va",
    "question": "In a mutual fund folio opened on behalf of a minor, what is the regulatory requirement regarding the bank account used for investment and redemption payouts?",
    "options": [
      "The bank account can belong to any third-party family friend",
      "The payment must come from the bank account of the minor, or from a joint account of the minor with the registered guardian",
      "Payment must be made exclusively through cash deposit at post office",
      "Bank account is not verified for minors"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates that subscription payments for investments in the name of a minor must originate from the minor's bank account or joint account with the registered guardian.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q311",
    "courseId": "nism-va",
    "question": "What statutory procedure must be followed when a minor unit holder attains the age of majority (18 years)?",
    "options": [
      "The guardian continues operating the account until the child gets married",
      "All further transactions in the folio are frozen until the new major submits their own PAN, KYC documentation, bank account proof, and specimen signature",
      "The folio is automatically liquidated and cash mailed via demand draft",
      "The units are transferred to the Prime Minister's National Relief Fund"
    ],
    "correctIndex": 1,
    "explanation": "Upon attaining majority, the guardian's authority terminates immediately. The folio is locked until the young adult completes fresh KYC, updates signature, and submits their individual bank mandate.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q312",
    "courseId": "nism-va",
    "question": "Under SEBI guidelines, what is the maximum number of nominees that can be registered in a single mutual fund folio?",
    "options": [
      "1 nominee only",
      "Up to 3 nominees, with explicit percentage allocation totaling 100%",
      "Up to 5 nominees with equal split",
      "Unlimited nominees"
    ],
    "correctIndex": 1,
    "explanation": "SEBI permits an individual unit holder to designate up to 3 nominees in a folio, specifying the percentage allocation for each nominee, which must aggregate to exactly 100%.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q313",
    "courseId": "nism-va",
    "question": "Can a non-individual entity such as a private limited company, partnership firm, or trust appoint a nominee in a mutual fund folio?",
    "options": [
      "Yes, corporate entities can appoint up to 3 directors as nominees",
      "No, nomination facility is available exclusively to individual investors (including sole proprietors)",
      "Yes, if approved by the Registrar of Companies",
      "Yes, if the entity has an ARN license"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI regulations, nomination is an individual statutory right and is not available to institutional, corporate, partnership, or trust investors.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q314",
    "courseId": "nism-va",
    "question": "What is the primary role of the Foreign Account Tax Compliance Act (FATCA) and Common Reporting Standard (CRS) declarations collected during onboarding?",
    "options": [
      "To calculate domestic GST liability on management fees",
      "To identify tax residency of the investor outside India and report cross-border financial account information to Indian tax authorities for automatic exchange with foreign jurisdictions",
      "To permit investors to trade US equities without a broker",
      "To exempt the investor from all domestic Indian taxes"
    ],
    "correctIndex": 1,
    "explanation": "FATCA and CRS frameworks require financial institutions in India to determine the tax residency of account holders and report accounts of foreign tax residents to Indian tax authorities.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q315",
    "courseId": "nism-va",
    "question": "If an investor wishes to opt out of nominating anyone for their mutual fund folio, what is required under SEBI regulations?",
    "options": [
      "The application is rejected outright",
      "The investor must submit a signed formal declaration of opting out of nomination",
      "The investor must pay a ₹500 opt-out surcharge",
      "The AMC automatically assigns a state bank as nominee"
    ],
    "correctIndex": 1,
    "explanation": "SEBI requires all individual folios to either register a nomination or submit a signed formal declaration explicitly opting out of nomination.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q316",
    "courseId": "nism-va",
    "question": "In a joint holding folio operating under the 'Anyone or Survivor' mandate, who can sign and authorize redemption requests?",
    "options": [
      "All joint holders must sign together on every transaction",
      "Any one of the living joint holders can independently sign and execute transactions and redemptions",
      "Only the nominee can authorize redemptions",
      "Only the distributor who holds the ARN code"
    ],
    "correctIndex": 1,
    "explanation": "Under an 'Anyone or Survivor' holding mandate, any single surviving joint holder has full legal authority to transact, redeem, or switch units in the folio.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q317",
    "courseId": "nism-va",
    "question": "What document must be submitted for the transmission of mutual fund units upon the demise of a sole unit holder who had registered a valid nomination?",
    "options": [
      "Probate of will issued by the High Court",
      "Attested copy of the Death Certificate, transmission request form from the nominee, and KYC documents with bank mandate of the nominee",
      "Succession Certificate from a civil judge",
      "No documents are required, units are automatically transferred"
    ],
    "correctIndex": 1,
    "explanation": "Where a valid nomination is registered, transmission requires the death certificate, identity and bank verification of the nominee, and standard transmission form, avoiding court probate delays.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q318",
    "courseId": "nism-va",
    "question": "What is the maximum cash transaction permitted per investor per mutual fund scheme per financial year under SEBI guidelines?",
    "options": [
      "₹10,000",
      "₹50,000 (provided redemptions are routed strictly through bank accounts)",
      "₹2,00,000",
      "Zero (cash is completely banned)"
    ],
    "correctIndex": 1,
    "explanation": "To facilitate financial inclusion in rural areas, SEBI permits cash investments up to ₹50,000 per investor per financial year across all schemes of an AMC, but all redemptions must be via banking channels.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q319",
    "courseId": "nism-va",
    "question": "Can a Power of Attorney (PoA) holder open a mutual fund folio and appoint themselves as the registered nominee on the folio?",
    "options": [
      "Yes, the PoA has unlimited legal rights",
      "No, a PoA holder cannot nominate themselves nor create a nomination on behalf of the principal unless explicitly authorized by law",
      "Yes, if the PoA is notarized",
      "Yes, if the principal is over 80 years of age"
    ],
    "correctIndex": 1,
    "explanation": "Under Indian law and SEBI regulations, nomination is an intimate personal right of the investor; a PoA agent cannot execute a nomination favoring themselves.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q320",
    "courseId": "nism-va",
    "question": "What is an In-Person Verification (IPV) in the context of mutual fund KYC onboarding?",
    "options": [
      "A face-to-face physical or video-based verification of the investor by an authorized official of the intermediary to match physical presence with identity documents",
      "An eye examination at a certified clinic",
      "A personal home visit by the CEO of the AMC",
      "A telephone call from an automated call center"
    ],
    "correctIndex": 0,
    "explanation": "IPV is a mandatory regulatory step where a SEBI-registered intermediary verifies that the individual presenting the KYC documents is the genuine living person appearing in the identity proofs.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q321",
    "courseId": "nism-va",
    "question": "Under SEBI norms, within how many business days must an AMC dispatch redemption proceeds to an investor's bank account under normal market conditions?",
    "options": [
      "Within 3 business days of the transaction date (T+2/T+3)",
      "Within 30 calendar days",
      "After 6 months",
      "Within 24 hours of market opening"
    ],
    "correctIndex": 0,
    "explanation": "SEBI regulations mandate that mutual funds must dispatch redemption proceeds within 3 business days of receipt of valid redemption request, failing which penal interest at 15% p.a. is payable.",
    "topic": "Investor Services & Onboarding"
  },
  {
    "id": "nism-va-q322",
    "courseId": "nism-va",
    "question": "Which statistical metric measures the total volatility or dispersion of a mutual fund scheme's historical returns around its arithmetic mean?",
    "options": [
      "Beta",
      "Standard Deviation",
      "Sharpe Ratio",
      "Treynor Ratio"
    ],
    "correctIndex": 1,
    "explanation": "Standard Deviation is the primary statistical measure of total risk, quantifying how widely returns fluctuate relative to the fund's historical average return.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q323",
    "courseId": "nism-va",
    "question": "A mutual fund scheme has a Beta of 1.25 relative to the Nifty 50 Index. If the Nifty 50 increases by 10% in a given period, what is the expected movement of the scheme's portfolio (all else being equal)?",
    "options": [
      "Expected to fall by 2.5%",
      "Expected to rise by approximately 12.5%",
      "Expected to rise by exactly 10.0%",
      "Expected to remain flat"
    ],
    "correctIndex": 1,
    "explanation": "Beta measures systematic sensitivity to benchmark movements. Expected return change = Beta * Benchmark Change = 1.25 * 10% = +12.5%.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q324",
    "courseId": "nism-va",
    "question": "The Sharpe Ratio evaluates portfolio performance by measuring:",
    "options": [
      "Excess return generated per unit of systematic risk (Beta)",
      "Excess return generated over the risk-free rate per unit of total risk (Standard Deviation)",
      "The total turnover of portfolio stocks in a year",
      "The ratio of equity to debt holdings"
    ],
    "correctIndex": 1,
    "explanation": "Sharpe Ratio = (Portfolio Return - Risk Free Rate) / Standard Deviation. It evaluates how much excess return is earned per unit of total volatility.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q325",
    "courseId": "nism-va",
    "question": "How does the Treynor Ratio differ from the Sharpe Ratio?",
    "options": [
      "Treynor Ratio uses Beta (systematic risk) in the denominator, whereas Sharpe Ratio uses Standard Deviation (total risk)",
      "Treynor Ratio is used only for debt funds, while Sharpe Ratio is used for equity",
      "Treynor Ratio ignores the risk-free rate of return",
      "Sharpe Ratio cannot be negative"
    ],
    "correctIndex": 0,
    "explanation": "Treynor Ratio measures excess return per unit of systematic market risk (Beta), whereas Sharpe Ratio measures excess return per unit of total risk (Standard Deviation).",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q326",
    "courseId": "nism-va",
    "question": "A mutual fund manager achieves an annualized return of 18% with a Beta of 1.1. If the benchmark market return was 15% and the risk-free rate is 6%, what is the fund's Jensen's Alpha?",
    "options": [
      "+2.1%",
      "+2.0%",
      "+3.0%",
      "+1.5%"
    ],
    "correctIndex": 0,
    "explanation": "Expected Return (CAPM) = Rf + Beta*(Rm - Rf) = 6% + 1.1*(15% - 6%) = 6% + 9.9% = 15.9%. Jensen's Alpha = Actual Return - Expected Return = 18.0% - 15.9% = +2.1%.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q327",
    "courseId": "nism-va",
    "question": "What does 'Tracking Error' signify in the evaluation of an Index Fund or Exchange Traded Fund (ETF)?",
    "options": [
      "The number of times the fund manager clicked the wrong button",
      "The standard deviation of the difference in returns between the index fund and its target benchmark index",
      "The commission paid to stock brokers",
      "The percentage of bad debt in the fund portfolio"
    ],
    "correctIndex": 1,
    "explanation": "Tracking error measures the annualized standard deviation of return differences between the index fund/ETF and its target index, reflecting how closely the fund replicates the benchmark.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q328",
    "courseId": "nism-va",
    "question": "Which bond duration metric measures the approximate percentage change in a bond or debt fund's price for a 100 basis point (1%) change in market yields?",
    "options": [
      "Macaulay Duration",
      "Modified Duration",
      "Yield to Maturity (YTM)",
      "Current Yield"
    ],
    "correctIndex": 1,
    "explanation": "Modified Duration measures the price sensitivity of a bond to interest rate changes: % Price Change ≈ - Modified Duration * Yield Change.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q329",
    "courseId": "nism-va",
    "question": "A debt mutual fund portfolio has a Modified Duration of 5 years. If the Reserve Bank of India unexpectedly hikes interest rates by 50 basis points (0.50%), what is the expected impact on the portfolio's NAV?",
    "options": [
      "Expected to increase by 5.0%",
      "Expected to decline by approximately 2.5%",
      "Expected to decline by exactly 5.0%",
      "Expected to remain completely unaffected"
    ],
    "correctIndex": 1,
    "explanation": "Change in Price ≈ - Modified Duration * Change in Yield = - 5 * (+0.50%) = -2.50%. Bond prices fall when interest rates rise.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q330",
    "courseId": "nism-va",
    "question": "How does Macaulay Duration relate to the cash flows of a fixed-income bond?",
    "options": [
      "It is the coupon rate multiplied by 100",
      "It is the weighted average maturity of the bond's cash flows (coupons and principal), where weights are the present value of each cash flow",
      "It is the total number of bond certificates issued",
      "It is the credit rating assigned by CRISIL"
    ],
    "correctIndex": 1,
    "explanation": "Macaulay duration represents the weighted average time an investor must hold the bond until the present value of cash flows equals the amount paid for the bond.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q331",
    "courseId": "nism-va",
    "question": "In credit risk analysis, a 'Credit Rating Downgrade' of a corporate debt security held in a mutual fund portfolio causes:",
    "options": [
      "An immediate surge in the price of the bond",
      "A widening of the bond's credit spread, leading to a drop in its market valuation and a decline in scheme NAV",
      "An increase in the scheme's equity allocation",
      "No change in the bond's market price"
    ],
    "correctIndex": 1,
    "explanation": "A credit rating downgrade increases the perceived probability of default, widening yields and causing bond prices and scheme NAV to drop.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q332",
    "courseId": "nism-va",
    "question": "Which type of risk can be effectively reduced or eliminated through portfolio diversification across multiple companies and industries?",
    "options": [
      "Systematic (Market) Risk",
      "Unsystematic (Idiosyncratic / Company-Specific) Risk",
      "Country Risk",
      "Currency Exchange Rate Risk"
    ],
    "correctIndex": 1,
    "explanation": "Unsystematic or company-specific risk can be virtually eliminated through diversification across non-correlated stocks. Systematic risk cannot be diversified away.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q333",
    "courseId": "nism-va",
    "question": "The R-squared (R²) statistic in portfolio regression analysis indicates:",
    "options": [
      "The fund manager's retirement age",
      "The percentage of a fund's portfolio return movements that can be explained by movements in its benchmark index",
      "The exact percentage dividend payout",
      "The expense ratio of the fund"
    ],
    "correctIndex": 1,
    "explanation": "R-squared measures the goodness of fit: an R² between 85% and 100% indicates that the fund's performance is closely aligned with its benchmark index.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q334",
    "courseId": "nism-va",
    "question": "What is the Compound Annual Growth Rate (CAGR) formula used to calculate multi-year annualized returns?",
    "options": [
      "CAGR = (End Value / Beginning Value) * (1 / n)",
      "CAGR = [(End Value / Beginning Value) ^ (1 / n)] - 1",
      "CAGR = (End Value - Beginning Value) / n",
      "CAGR = (End Value + Beginning Value) / 2"
    ],
    "correctIndex": 1,
    "explanation": "CAGR calculates the geometric annualized rate of return: [(End Value / Beginning Value) ^ (1 / n)] - 1.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q335",
    "courseId": "nism-va",
    "question": "Why is Extended Internal Rate of Return (XIRR) the mandated industry standard for calculating returns on Systematic Investment Plans (SIP)?",
    "options": [
      "Because it ignores all cash outflows",
      "Because it accurately accounts for irregular, recurring, and multiple dated cash flow installments over time",
      "Because it produces the highest return percentage for marketing purposes",
      "Because it is calculated by stock brokers"
    ],
    "correctIndex": 1,
    "explanation": "XIRR accounts for multiple cash inflows and outflows occurring at different dates, computing the true annualized internal rate of return for SIP investments.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q336",
    "courseId": "nism-va",
    "question": "Which of the following mutual fund categories carries the lowest degree of interest rate and credit risk?",
    "options": [
      "Credit Risk Debt Fund",
      "Overnight Fund investing in 1-day Tri-Party Repos (TREPS) backed by G-Secs",
      "Long Duration G-Sec Fund with 10-year maturity",
      "Medium Duration Corporate Bond Fund"
    ],
    "correctIndex": 1,
    "explanation": "Overnight funds invest in debt securities with 1-day maturity backed by collateralized sovereign repo, effectively eliminating both interest rate and credit default risk.",
    "topic": "Risk, Return & Performance"
  },
  {
    "id": "nism-va-q337",
    "courseId": "nism-va",
    "question": "Under SEBI's Scheme Categorisation Circular (October 2017), how is a 'Large Cap Company' officially defined in India?",
    "options": [
      "Any company with a stock price exceeding ₹1,000",
      "Companies ranked 1st to 100th in terms of full market capitalization on recognized stock exchanges",
      "Companies with revenue above ₹10,000 Crore",
      "Companies located only in Mumbai and Delhi"
    ],
    "correctIndex": 1,
    "explanation": "SEBI defines Large Cap companies as those ranked 1st to 100th in terms of full market capitalization across the Indian equity markets.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q338",
    "courseId": "nism-va",
    "question": "Under SEBI categorisation norms, a 'Mid Cap Fund' must invest a minimum of what percentage of its total assets in equity shares of Mid Cap companies (ranked 101st to 250th)?",
    "options": [
      "At least 50% of total assets",
      "At least 65% of total assets",
      "At least 80% of total assets",
      "100% of total assets"
    ],
    "correctIndex": 1,
    "explanation": "SEBI categorisation rules mandate that a Mid Cap fund must invest at least 65% of its total assets in equity shares of companies ranked 101st to 250th by market cap.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q339",
    "courseId": "nism-va",
    "question": "How does a 'Multi Cap Fund' differ from a 'Flexi Cap Fund' under SEBI regulatory guidelines?",
    "options": [
      "Multi Cap funds have a mandatory minimum allocation of 25% each in Large Cap, Mid Cap, and Small Cap stocks (total min 75% in equity), whereas Flexi Cap funds have complete flexibility with min 65% in equity across any market caps",
      "Flexi Cap funds cannot invest in equities",
      "Multi Cap funds invest solely in government debt",
      "There is no difference between them under SEBI rules"
    ],
    "correctIndex": 0,
    "explanation": "Multi Cap funds must strictly maintain 25% Large, 25% Mid, and 25% Small Cap equity. Flexi Cap funds require 65% overall in equity with full fund manager discretion across market caps.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q340",
    "courseId": "nism-va",
    "question": "What is the portfolio mandate of an 'Arbitrage Fund' under SEBI scheme categorisation norms?",
    "options": [
      "Investing 100% in speculative unhedged derivative futures",
      "Investing a minimum of 65% in equity and equity derivatives by exploiting price differentials between the cash and futures market, maintaining a hedged low-risk profile",
      "Investing in international currency forex swaps",
      "Lending to high-risk real estate developers"
    ],
    "correctIndex": 1,
    "explanation": "Arbitrage funds invest min 65% in equities simultaneously balanced by offsetting short derivative futures positions, capturing risk-free cash-futures spreads while qualifying for equity taxation.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q341",
    "courseId": "nism-va",
    "question": "Under SEBI categorisation guidelines, an 'Aggressive Hybrid Fund' must invest what percentage of its total assets in equity and equity-related instruments?",
    "options": [
      "Between 10% and 25% in equity",
      "Between 65% and 80% in equity, with the balance 20% to 35% in debt instruments",
      "Exactly 50% in equity and 50% in gold",
      "100% in unlisted equities"
    ],
    "correctIndex": 1,
    "explanation": "Aggressive Hybrid Funds invest between 65% and 80% of total assets in equities and 20% to 35% in debt instruments, qualifying as equity-oriented for income tax purposes.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q342",
    "courseId": "nism-va",
    "question": "What is the defining investment strategy of a 'Balanced Advantage Fund' (Dynamic Asset Allocation Fund)?",
    "options": [
      "Maintaining a permanent static 50:50 allocation between equity and bonds",
      "Dynamically shifting asset allocation between equity (0% to 100%) and debt (0% to 100%) based on objective market valuation indicators like P/E, P/B, and trend metrics",
      "Investing 100% in physical commodities",
      "Trading only penny stocks"
    ],
    "correctIndex": 1,
    "explanation": "Dynamic Asset Allocation / Balanced Advantage Funds use proprietary quantitative valuation models to actively adjust equity and debt exposure between 0% and 100%.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q343",
    "courseId": "nism-va",
    "question": "Under SEBI debt categorisation rules, a 'Liquid Fund' is permitted to invest only in debt and money market securities with a residual maturity of up to:",
    "options": [
      "30 days",
      "91 days",
      "180 days",
      "1 year"
    ],
    "correctIndex": 1,
    "explanation": "Liquid funds are mandated to invest exclusively in debt and money market instruments having residual maturities of up to 91 days only.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q344",
    "courseId": "nism-va",
    "question": "Under SEBI rules, a 'Corporate Bond Fund' must invest a minimum of what percentage of its total assets in corporate bonds rated AA+ and above?",
    "options": [
      "At least 50% of total assets",
      "At least 65% of total assets",
      "At least 80% of total assets in highest-rated corporate bonds",
      "100% of total assets"
    ],
    "correctIndex": 2,
    "explanation": "SEBI mandates that a Corporate Bond Fund must maintain at least 80% of total assets in corporate debt securities with the highest credit ratings (AA+ and above).",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q345",
    "courseId": "nism-va",
    "question": "A 'Credit Risk Fund' under SEBI categorisation norms is mandated to invest at least what percentage of its assets in corporate bonds rated AA and below?",
    "options": [
      "At least 25% of total assets",
      "At least 65% of total assets in lower-rated corporate bonds",
      "Up to 10% of total assets",
      "100% in default papers"
    ],
    "correctIndex": 1,
    "explanation": "Credit Risk Funds must invest at least 65% of total assets in corporate bonds rated AA and below (excluding AA+), earning higher yields by accepting higher credit spread risks.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q346",
    "courseId": "nism-va",
    "question": "How many asset classes must a 'Multi Asset Allocation Fund' invest in simultaneously, with what minimum allocation per asset class under SEBI norms?",
    "options": [
      "At least 2 asset classes with min 5% in each",
      "At least 3 asset classes (e.g. Equity, Debt, and Gold/Commodities) with a minimum allocation of at least 10% in each asset class",
      "At least 5 asset classes with equal weightage",
      "Only equity and bank deposits"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates that a Multi Asset Allocation Fund must invest in at least 3 distinct asset classes with a minimum allocation of at least 10% in each asset class.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q347",
    "courseId": "nism-va",
    "question": "What is the investment objective of a 'Gilt Fund' under SEBI scheme categorisation rules?",
    "options": [
      "Investing in gold mining company shares",
      "Investing at least 80% of total assets in Government Securities (G-Secs and State Development Loans) across maturities",
      "Investing in microfinance NBFC commercial paper",
      "Investing in US Treasury bills exclusively"
    ],
    "correctIndex": 1,
    "explanation": "Gilt Funds invest at least 80% of total assets in sovereign Government Securities, carrying zero credit default risk but subject to interest rate volatility.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q348",
    "courseId": "nism-va",
    "question": "Under SEBI rules, a 'Solution Oriented Scheme' designed for Children's Gift or Retirement must have a minimum lock-in period of:",
    "options": [
      "1 year",
      "At least 5 years or till the child attains majority / retirement age (whichever is earlier)",
      "10 years compulsory",
      "Zero lock-in"
    ],
    "correctIndex": 1,
    "explanation": "Solution-oriented schemes (Retirement Fund and Children's Fund) carry a mandatory lock-in period of at least 5 years or until the child reaches age 18 / retirement age.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q349",
    "courseId": "nism-va",
    "question": "An 'Index Fund' or 'Exchange Traded Fund (ETF)' replicating the Nifty Next 50 index must invest at least what percentage of its total assets in securities of the target index?",
    "options": [
      "At least 65% of total assets",
      "At least 80% of total assets",
      "At least 95% of total assets in securities of the underlying benchmark index",
      "100% in sovereign G-Secs"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI regulations, index funds and ETFs must hold at least 95% of total assets in the constituent securities of the target benchmark index being replicated.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q350",
    "courseId": "nism-va",
    "question": "What is a 'Fund of Funds' (FoF) under SEBI mutual fund regulations?",
    "options": [
      "A fund that prints fake money",
      "A mutual fund scheme that invests a minimum of 95% of its total assets in units of other underlying mutual fund schemes rather than directly in stocks or bonds",
      "A scheme managed by foreign central banks",
      "A fund that lends money to the stock exchange"
    ],
    "correctIndex": 1,
    "explanation": "A Fund of Funds (FoF) is a scheme whose primary portfolio consists of units of other mutual fund schemes (domestic or overseas), investing at least 95% in underlying funds.",
    "topic": "Scheme Categorisation"
  },
  {
    "id": "nism-va-q351",
    "courseId": "nism-va",
    "question": "How does a Systematic Withdrawal Plan (SWP) in an equity mutual fund compare with receiving IDCW (dividend) payouts for an investor in the 30% tax bracket?",
    "options": [
      "IDCW is more tax-efficient because dividends are tax-free",
      "SWP is significantly more tax-efficient because each withdrawal consists primarily of return of capital (principal) with only the embedded capital gain subject to taxation at 12.5% LTCG, whereas 100% of IDCW payout is taxed at 30%",
      "Both are taxed identically on the gross withdrawal value",
      "SWP is illegal for retirement investors"
    ],
    "correctIndex": 1,
    "explanation": "In an SWP, tax is levied only on the net capital gain portion of the redeemed units (at 12.5% LTCG or 20% STCG), whereas 100% of an IDCW payout is taxed at the investor's high marginal slab rate.",
    "topic": "Financial Planning & Advisory"
  },
  {
    "id": "nism-va-q352",
    "courseId": "nism-va",
    "question": "What is 'Rupee Cost Averaging' achieved through Systematic Investment Plans (SIP)?",
    "options": [
      "Buying fixed number of units every month regardless of price",
      "Investing a fixed rupee amount regularly, automatically acquiring more units when the NAV is low and fewer units when the NAV is high, lowering average purchase cost over time",
      "Selling units when the market goes up by 5%",
      "Converting Indian Rupees into foreign currencies"
    ],
    "correctIndex": 1,
    "explanation": "Rupee cost averaging removes market timing: by allocating a fixed rupee amount periodically, investors naturally buy more units during market dips and fewer units during rallies.",
    "topic": "Financial Planning & Advisory"
  },
  {
    "id": "nism-va-q353",
    "courseId": "nism-va",
    "question": "A client with a 15-year investment horizon for a child's higher education should primarily be advised to allocate to:",
    "options": [
      "Overnight Funds with daily redemptions",
      "Diversified Equity Mutual Funds (e.g. Flexi Cap / Large & Mid Cap) with systematic monthly investments",
      "Bank Savings Account earning 2.5%",
      "Call Money market debt"
    ],
    "correctIndex": 1,
    "explanation": "For long-term goals (>10-15 years), equity mutual funds provide the highest probability of generating inflation-beating real compounding returns.",
    "topic": "Financial Planning & Advisory"
  },
  {
    "id": "nism-va-q354",
    "courseId": "nism-va",
    "question": "What behavioral finance bias occurs when an investor refuses to sell a poorly performing mutual fund scheme because they are fixated on the original price at which they bought it?",
    "options": [
      "Recency Bias",
      "Anchoring Bias",
      "Herding Mentality",
      "Overconfidence Bias"
    ],
    "correctIndex": 1,
    "explanation": "Anchoring bias is the cognitive tendency to disproportionately fixate on an arbitrary reference point (such as the initial purchase price) rather than assessing future prospects.",
    "topic": "Financial Planning & Advisory"
  },
  {
    "id": "nism-va-q355",
    "courseId": "nism-va",
    "question": "When an investor assumes that the outstanding performance of a small-cap fund over the past 6 months will continue uninterrupted for the next 10 years, they are exhibiting:",
    "options": [
      "Loss Aversion",
      "Recency Bias",
      "Mental Accounting",
      "Confirmation Bias"
    ],
    "correctIndex": 1,
    "explanation": "Recency bias leads investors to extrapolate recent short-term market momentum or outperformance into the distant future, ignoring cyclicality and mean reversion.",
    "topic": "Financial Planning & Advisory"
  },
  {
    "id": "nism-va-q356",
    "courseId": "nism-va",
    "question": "In financial planning, what is the primary purpose of a Systematic Transfer Plan (STP)?",
    "options": [
      "Transferring funds between bank accounts to earn reward points",
      "Parking a lump-sum amount in a liquid or ultra-short-term fund and systematically transferring a fixed sum periodically into an equity fund to manage market entry risk",
      "Withdrawing cash from an ATM machine",
      "Switching between competing asset management companies without paying taxes"
    ],
    "correctIndex": 1,
    "explanation": "An STP mitigates timing risk for lump-sum investors by parking capital in a stable debt/liquid fund and staggering entries into equity funds over 6 to 12 months.",
    "topic": "Financial Planning & Advisory"
  },
  {
    "id": "nism-va-q357",
    "courseId": "nism-va",
    "question": "Which of the following client profiles has the highest risk tolerance and suitability for high-beta equity schemes?",
    "options": [
      "A 75-year-old retired widow relying solely on interest income for daily medical expenses",
      "A 28-year-old corporate executive with zero debt, high disposable income, and an investment horizon of 25 years",
      "A student with an education loan due next month",
      "A non-profit charitable trust seeking capital preservation"
    ],
    "correctIndex": 1,
    "explanation": "A young professional with stable income, negligible liabilities, and a multi-decade horizon has maximum financial capacity and emotional ability to absorb equity volatility.",
    "topic": "Financial Planning & Advisory"
  },
  {
    "id": "nism-va-q358",
    "courseId": "nism-va",
    "question": "According to the AMFI Code of Ethics, what must a mutual fund distributor do when a recommended product carries an inherent conflict of interest with the distributor's remuneration?",
    "options": [
      "Conceal the commission numbers from the client",
      "Fully disclose the commission structure, potential conflicts of interest, and rationale for suitability to the investor prior to transaction execution",
      "Directly credit 50% of the commission to the client's bank account in cash",
      "Refuse to answer any client questions"
    ],
    "correctIndex": 1,
    "explanation": "The AMFI Code of Ethics mandates complete transparency: distributors must disclose all commissions and resolve or disclose any potential conflicts of interest prior to transacting.",
    "topic": "Financial Planning & Advisory"
  },
  {
    "id": "nism-va-q359",
    "courseId": "nism-va",
    "question": "What is 'Mental Accounting' in behavioral economics?",
    "options": [
      "Doing complex mathematical calculations in your head",
      "Treating money differently based on its origin or intended use (e.g. treating tax refund money as 'free gamble money' while protecting regular salary savings)",
      "Auditing bank accounts with a mobile app",
      "Writing financial plans in a diary"
    ],
    "correctIndex": 1,
    "explanation": "Mental accounting is the cognitive tendency to assign subjective values to money based on arbitrary criteria like source or purpose, violating the economic principle of fungibility.",
    "topic": "Financial Planning & Advisory"
  },
  {
    "id": "nism-va-q360",
    "courseId": "nism-va",
    "question": "When designing a retirement asset allocation strategy for a 60-year-old investor entering post-retirement life, the financial advisor should ideally recommend:",
    "options": [
      "100% in micro-cap equities and leveraged futures",
      "A balanced asset allocation with high-grade debt and conservative hybrid funds providing predictable monthly cash flows via SWP, combined with modest equity exposure to counter inflation",
      "100% in physical gold jewellery",
      "Zero investment, keeping all cash in home lockers"
    ],
    "correctIndex": 1,
    "explanation": "Post-retirement planning requires a calibrated portfolio combining capital preservation and steady cash flow (debt/hybrid SWP) with 20-30% equity to protect purchasing power against longevity inflation.",
    "topic": "Financial Planning & Advisory"
  },
  {
    "id": "nism-vd-gen-q11",
    "courseId": "nism-vd",
    "question": "What is the primary role of a Specialized Investment Fund (SIF) distributor under SEBI guidelines?",
    "options": [
      "Distributing both standard mutual funds and specialized investment vehicles (including AIF Category I/II/III and private credit funds) to eligible investors",
      "Selling life insurance policies exclusively",
      "Conducting stock market audits for listed corporations",
      "Providing tax return filing software"
    ],
    "correctIndex": 0,
    "explanation": "A SIF distributor is accredited to market complex and specialized investment vehicles alongside mutual funds to eligible and accredited investors.",
    "topic": "SIF Distributor Framework"
  },
  {
    "id": "nism-vd-gen-q12",
    "courseId": "nism-vd",
    "question": "Under SEBI AIF Regulations, 2012, which of the following is categorized as a Category I AIF?",
    "options": [
      "Venture Capital Fund (VCF)",
      "Hedge Fund",
      "Private Equity Fund investing in listed equities",
      "Real Estate debt fund"
    ],
    "correctIndex": 0,
    "explanation": "Category I AIFs include Venture Capital Funds, Angel Funds, Social Venture Funds, and Infrastructure Funds.",
    "topic": "AIF Structure & Categories"
  },
  {
    "id": "nism-vd-gen-q13",
    "courseId": "nism-vd",
    "question": "What is the minimum corpus requirement for an Angel Fund under SEBI AIF Regulations?",
    "options": [
      "₹5 Crores",
      "₹10 Crores",
      "₹20 Crores",
      "₹50 Crores"
    ],
    "correctIndex": 0,
    "explanation": "SEBI AIF regulations specify that an Angel Fund must have a minimum corpus of ₹5 Crores.",
    "topic": "Angel Fund Norms"
  },
  {
    "id": "nism-vd-gen-q14",
    "courseId": "nism-vd",
    "question": "What is the minimum ticket size for an angel investor committing capital to an Angel Fund?",
    "options": [
      "₹10 Lakhs",
      "₹25 Lakhs",
      "₹1 Crore",
      "₹5 Crores"
    ],
    "correctIndex": 1,
    "explanation": "The minimum investment commitment for an angel investor in an Angel Fund is ₹25 Lakhs (compared to ₹1 Crore for regular AIFs).",
    "topic": "Angel Fund Norms"
  },
  {
    "id": "nism-vd-gen-q15",
    "courseId": "nism-vd",
    "question": "In private equity funds, 'J-Curve Effect' refers to:",
    "options": [
      "Initial negative cash flows and valuations due to upfront fees and capital deployment, followed by steep positive returns as portfolio companies mature",
      "A steady linear increase in returns every year",
      "A perpetual loss over the life of the fund",
      "The interest rate trajectory of sovereign debt"
    ],
    "correctIndex": 0,
    "explanation": "The J-Curve reflects early negative cash flow and J-shaped return curve in private equity as management fees and unharvested early investments turn into profitable exits later.",
    "topic": "Private Equity Dynamics"
  },
  {
    "id": "nism-vd-gen-q16",
    "courseId": "nism-vd",
    "question": "What is 'Carried Interest' earned by an AIF fund manager?",
    "options": [
      "A percentage of the fund's net capital gains (typically 20%) paid to the General Partner/Manager after returning capital and the hurdle rate to investors",
      "A fixed monthly salary paid by SEBI",
      "The brokerage commission paid to clearing brokers",
      "Interest paid on margin loans"
    ],
    "correctIndex": 0,
    "explanation": "Carried interest is the performance fee incentive paid to the fund manager only after investors have received their initial capital plus the minimum hurdle rate.",
    "topic": "Carried Interest & Fund Economics"
  },
  {
    "id": "nism-vd-gen-q17",
    "courseId": "nism-vd",
    "question": "What is a 'Catch-Up Clause' in an AIF private placement memorandum (PPM)?",
    "options": [
      "A clause permitting the manager to receive a larger share of profits until their total profit share equals the agreed carried interest percentage once the hurdle rate is cleared",
      "A late payment penalty imposed on unit holders",
      "A regulatory fine for delayed filing",
      "A clause allowing delayed NAV declarations"
    ],
    "correctIndex": 0,
    "explanation": "A catch-up clause allows the GP/manager to receive 50% to 100% of distributions after the hurdle rate until the agreed carried interest split (e.g. 80:20) is restored.",
    "topic": "Carried Interest & Fund Economics"
  },
  {
    "id": "nism-vd-gen-q18",
    "courseId": "nism-vd",
    "question": "Under SEBI rules, what is the maximum number of investors permitted in any scheme of an AIF (other than an Angel Fund)?",
    "options": [
      "50 investors",
      "200 investors",
      "1,000 investors",
      "Unlimited investors"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI AIF Regulations, no scheme of an AIF shall have more than 1,000 investors (Angel Funds can have up to 200 angel investors).",
    "topic": "AIF Investor Ceilings"
  },
  {
    "id": "nism-vd-gen-q19",
    "courseId": "nism-vd",
    "question": "What is the statutory tenure requirement for Category I and Category II AIFs?",
    "options": [
      "They must be close-ended with a minimum tenure of 3 years",
      "They must be open-ended with daily liquidity",
      "They must have a 20-year lock-in",
      "Tenure is decided on a daily basis"
    ],
    "correctIndex": 0,
    "explanation": "Category I and II AIFs are required by law to be close-ended schemes with a minimum statutory tenure of 3 years at the time of launch.",
    "topic": "AIF Scheme Tenures"
  },
  {
    "id": "nism-vd-gen-q20",
    "courseId": "nism-vd",
    "question": "Can Category I and Category II AIFs borrow funds for investment leverage?",
    "options": [
      "No, they cannot borrow funds directly or indirectly for leverage; they can only borrow for meeting temporary operational liquidity needs for up to 30 days",
      "Yes, up to 5 times their net worth",
      "Yes, without any restrictions",
      "Only with RBI Governor approval"
    ],
    "correctIndex": 0,
    "explanation": "SEBI regulations prohibit Cat I & II AIFs from leveraging; borrowing is permitted solely for operational requirements (up to 30 days and max 10% of investable funds).",
    "topic": "Borrowing & Leverage Restrictions"
  },
  {
    "id": "nism-viii-gen-q26",
    "courseId": "nism-viii",
    "question": "What is 'Basis' in the context of futures trading?",
    "options": [
      "Futures Price minus Spot Price (or Spot minus Futures)",
      "The strike price of an option",
      "The brokerage commission charged on trades",
      "The face value of the underlying equity share"
    ],
    "correctIndex": 0,
    "explanation": "Basis is defined as Spot Price minus Futures Price. In a normal contango market, basis is negative; during backwardation, basis is positive.",
    "topic": "Futures Pricing & Basis"
  },
  {
    "id": "nism-viii-gen-q27",
    "courseId": "nism-viii",
    "question": "What happens to the basis of a futures contract as the expiration date approaches?",
    "options": [
      "It fluctuates randomly without bounds",
      "It converges towards zero (Futures Price converges to Spot Price at expiration)",
      "It widens to infinity",
      "It turns strictly negative for all stocks"
    ],
    "correctIndex": 1,
    "explanation": "Basis convergence occurs because at expiration, the futures contract is settled against the spot price, eliminating carrying costs and forcing basis to zero.",
    "topic": "Convergence of Basis"
  },
  {
    "id": "nism-viii-gen-q28",
    "courseId": "nism-viii",
    "question": "What is 'Cash and Carry Arbitrage' in equity derivatives?",
    "options": [
      "Buying the underlying stock in the spot market and selling the overvalued futures contract while borrowing funds to finance the spot purchase until expiration",
      "Withdrawing cash from an ATM to buy options",
      "Selling stock in the spot market and buying physical gold",
      "Trading only during post-market sessions"
    ],
    "correctIndex": 0,
    "explanation": "Cash and carry arbitrage exploits a futures price trading above theoretical cost of carry by buying spot, shorting futures, and locking in risk-free carrying profits.",
    "topic": "Arbitrage Mechanisms"
  },
  {
    "id": "nism-viii-gen-q29",
    "courseId": "nism-viii",
    "question": "What is 'Reverse Cash and Carry Arbitrage'?",
    "options": [
      "Short selling the overvalued spot equity (or borrowing shares via SLB) and buying undervalued futures contracts, investing the sale proceeds at the risk-free rate",
      "Buying calls and puts simultaneously",
      "Borrowing from an NBFC to buy call options",
      "Exchanging futures for physical delivery"
    ],
    "correctIndex": 0,
    "explanation": "Reverse cash and carry arbitrage is triggered when futures trade below theoretical fair value (discount/backwardation), shorting spot and buying futures.",
    "topic": "Arbitrage Mechanisms"
  },
  {
    "id": "nism-viii-gen-q30",
    "courseId": "nism-viii",
    "question": "According to Put-Call Parity for European options, which relationship holds true (where S = Spot, C = Call, P = Put, PV(X) = Present Value of Strike)?",
    "options": [
      "C + PV(X) = P + S",
      "C + P = S + X",
      "C - P = S * X",
      "C / P = S / X"
    ],
    "correctIndex": 0,
    "explanation": "Put-Call Parity states that Fiduciary Call (Long Call + Zero Coupon Bond with face value X) equals Protective Put (Long Put + Underlying Stock): C + PV(X) = P + S.",
    "topic": "Put-Call Parity"
  },
  {
    "id": "nism-viii-gen-q31",
    "courseId": "nism-viii",
    "question": "What does the option Greek 'Delta' represent for a Call option?",
    "options": [
      "The rate of change of option price with respect to a change in the underlying asset's price, bounded between 0 and +1.0 for calls",
      "The volatility of the market",
      "The exchange margin percentage",
      "The interest rate sensitivity"
    ],
    "correctIndex": 0,
    "explanation": "Call Delta measures option price sensitivity to the underlying stock move; it ranges from 0 (deep out of the money) to +1.0 (deep in the money).",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-gen-q32",
    "courseId": "nism-viii",
    "question": "What does 'Delta' equal for an At-The-Money (ATM) call option?",
    "options": [
      "Approximately 0.50 (50%)",
      "Exactly 1.0",
      "Zero",
      "Minus 1.0"
    ],
    "correctIndex": 0,
    "explanation": "An ATM call option has a Delta close to 0.50, meaning the option price moves roughly ₹0.50 for every ₹1.00 move in the underlying stock price.",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-gen-q33",
    "courseId": "nism-viii",
    "question": "What does the option Greek 'Vega' measure?",
    "options": [
      "The sensitivity of the option price to a 1% change in implied volatility of the underlying asset",
      "The effect of elapsed time on the option",
      "The dividend yield of the index",
      "The loan-to-value ratio of the margin"
    ],
    "correctIndex": 0,
    "explanation": "Vega measures the change in option price for a 1% change in implied volatility. Both long calls and long puts have positive Vega.",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-gen-q34",
    "courseId": "nism-viii",
    "question": "What is a 'Protective Put' strategy?",
    "options": [
      "Holding long equity shares and simultaneously buying a Put option on the same stock to cap downside risk",
      "Selling a put option without owning cash",
      "Buying two call options at the same strike",
      "Pledging shares for personal loans"
    ],
    "correctIndex": 0,
    "explanation": "A Protective Put strategy combines long stock with a long put option, establishing a synthetic floor against catastrophic market declines while retaining upside.",
    "topic": "Hedging Strategies"
  },
  {
    "id": "nism-viii-gen-q35",
    "courseId": "nism-viii",
    "question": "What is a 'Covered Call' strategy?",
    "options": [
      "Holding underlying long stock and selling an Out-Of-The-Money Call option against it to generate recurring cash premium income",
      "Buying calls and puts at different expirations",
      "Selling put options without cash margin",
      "Trading futures during earnings week"
    ],
    "correctIndex": 0,
    "explanation": "A Covered Call generates income by selling upside call options against an existing portfolio of shares, trading future upside beyond strike for immediate premium.",
    "topic": "Derivative Strategies"
  },
  {
    "id": "nism-xiii-gen-q1",
    "courseId": "nism-xiii",
    "question": "What is the primary objective of NISM Series XIII Common Derivatives examination?",
    "options": [
      "To establish a comprehensive, single-window qualification across Equity, Currency, Commodity, and Interest Rate derivative segments",
      "To certify chartered accountants in corporate auditing",
      "To license real estate property brokers",
      "To inspect commercial banks on NPA provisioning"
    ],
    "correctIndex": 0,
    "explanation": "Series XIII unified derivative licensing across equity, FX, commodities, and interest rates under SEBI's integrated market framework.",
    "topic": "Common Derivatives Scope"
  },
  {
    "id": "nism-xiii-gen-q2",
    "courseId": "nism-xiii",
    "question": "In Currency Derivatives, which regulatory authority jointly regulates exchange-traded currency markets alongside SEBI?",
    "options": [
      "Reserve Bank of India (RBI)",
      "Insurance Regulatory and Development Authority (IRDAI)",
      "Pension Fund Regulatory and Development Authority (PFRDA)",
      "Insolvency and Bankruptcy Board of India (IBBI)"
    ],
    "correctIndex": 0,
    "explanation": "Exchange-traded currency futures and options are regulated under the joint jurisdiction of SEBI (exchange oversight) and RBI (foreign exchange policy under FEMA).",
    "topic": "Regulatory Framework"
  },
  {
    "id": "nism-xiii-gen-q3",
    "courseId": "nism-xiii",
    "question": "What is the tick size (minimum price movement) for USD-INR currency futures on Indian exchanges?",
    "options": [
      "0.0025 INR (0.25 paise)",
      "1.00 INR",
      "0.05 INR",
      "0.50 INR"
    ],
    "correctIndex": 0,
    "explanation": "The minimum price movement (tick size) for currency futures contracts such as USD-INR is 0.0025 INR (a quarter of a paisa).",
    "topic": "Currency Contract Specifications"
  },
  {
    "id": "nism-xiii-gen-q4",
    "courseId": "nism-xiii",
    "question": "What is 'Conversion Factor' (CF) in 10-Year Government of India Bond Futures?",
    "options": [
      "A mathematical coefficient used to equalize deliverable coupon-bearing bonds of differing maturities and coupons to the standardized 7% notional contract",
      "The currency exchange rate between USD and INR",
      "The broker's clearing commission rate",
      "The income tax deduction factor"
    ],
    "correctIndex": 0,
    "explanation": "Conversion Factors normalize the price of various eligible deliverable GoI securities relative to the hypothetical 7% coupon notional bond at contract expiration.",
    "topic": "Interest Rate Futures"
  },
  {
    "id": "nism-xiii-gen-q5",
    "courseId": "nism-xiii",
    "question": "What does 'Cheapest-to-Deliver' (CTD) bond mean in Interest Rate Futures delivery?",
    "options": [
      "The deliverable bond that minimizes the short position seller's net cost of purchasing and delivering the security against the futures contract",
      "A bond with zero credit rating",
      "The bond with the highest coupon regardless of market price",
      "A bond issued by a distressed municipal corporation"
    ],
    "correctIndex": 0,
    "explanation": "The CTD bond maximizes the delivery payoff or minimizes delivery cost for the short seller among all eligible basket bonds.",
    "topic": "Interest Rate Futures"
  },
  {
    "id": "nism-xiii-gen-q6",
    "courseId": "nism-xiii",
    "question": "In Commodity Futures, what is the role of an 'Electronic Negotiable Warehouse Receipt' (e-NWR)?",
    "options": [
      "A legally recognized digital title representing ownership of physical commodities stored in a WDRA-regulated repository, facilitating delivery and bank financing",
      "A paper bill sent by postal mail",
      "An insurance receipt for shipping containers",
      "A tax clearance certificate"
    ],
    "correctIndex": 0,
    "explanation": "e-NWRs issued via repositories (like CCRL/NERL) represent standardized, digital proof of physical commodity ownership for exchange settlement and bank pledges.",
    "topic": "Commodity Warehousing & e-NWR"
  },
  {
    "id": "nism-xiii-gen-q7",
    "courseId": "nism-xiii",
    "question": "Which of the following commodities is typically cash-settled rather than physically settled on Indian commodity exchanges?",
    "options": [
      "Crude Oil and Natural Gas futures",
      "Soybean futures",
      "Chana futures",
      "Cotton futures"
    ],
    "correctIndex": 0,
    "explanation": "Energy commodities like Crude Oil and Natural Gas contracts on MCX are compulsory cash-settled based on international benchmark settlement prices.",
    "topic": "Commodity Settlement Norms"
  },
  {
    "id": "nism-xiii-gen-q8",
    "courseId": "nism-xiii",
    "question": "What is 'Convenience Yield' in commodity storage and pricing theory?",
    "options": [
      "The non-monetary benefit or operational advantage of physically holding the tangible commodity inventory rather than holding derivative contracts during shortages",
      "A fee charged by banks for convenience UPI transfers",
      "The annual dividend paid by agricultural companies",
      "A subsidy provided by the government to farmers"
    ],
    "correctIndex": 0,
    "explanation": "Convenience yield is the implicit benefit of having physical stock on hand to prevent production interruptions during unexpected supply pinches.",
    "topic": "Commodity Pricing Theory"
  },
  {
    "id": "nism-xiii-gen-q9",
    "courseId": "nism-xiii",
    "question": "What is a 'Calendar Spread' in commodity and equity derivatives?",
    "options": [
      "Simultaneously buying and selling futures contracts on the same underlying asset with different expiration months",
      "Trading exclusively on the first day of each calendar month",
      "Buying options on two completely unrelated stocks",
      "A spread between spot gold and spot silver"
    ],
    "correctIndex": 0,
    "explanation": "A calendar spread exploits price differences across time horizons by holding opposing long and short positions in different contract expiration months.",
    "topic": "Derivative Spread Strategies"
  },
  {
    "id": "nism-xiii-gen-q10",
    "courseId": "nism-xiii",
    "question": "Under SEBI Commodity Derivatives norms, what is the purpose of the 'Client Level Position Limit'?",
    "options": [
      "To prevent market manipulation, hoarding, and excessive speculative concentration by any single participant in physical commodities",
      "To maximize trading fees collected by the exchange",
      "To guarantee 100% profits for hedgers",
      "To restrict trading only to institutional banks"
    ],
    "correctIndex": 0,
    "explanation": "SEBI imposes strict individual and member position limits to prevent market abuse, cornering of deliverable supplies, and artificial price distortions.",
    "topic": "Position Limits & Surveillance"
  },
  {
    "id": "nism-xa-gen-q11",
    "courseId": "nism-xa",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013, can an individual RIA also be a director or partner in a mutual fund distribution firm?",
    "options": [
      "No, an individual RIA cannot provide distribution services or hold directorship/partnership in a distributing entity under client segregation rules",
      "Yes, provided they pay an additional fee to SEBI",
      "Yes, if the client signs an informal email waiver",
      "Yes, with permission from the local police station"
    ],
    "correctIndex": 0,
    "explanation": "SEBI regulations prohibit individual investment advisers from holding distribution licenses or partnering with distributors, maintaining absolute segregation.",
    "topic": "SEBI RIA Regulations"
  },
  {
    "id": "nism-xa-gen-q12",
    "courseId": "nism-xa",
    "question": "What is the minimum net worth requirement for a corporate / body corporate entity seeking registration as a SEBI Registered Investment Adviser?",
    "options": [
      "₹50 Lakhs",
      "₹1 Crore",
      "₹5 Crores",
      "₹10 Lakhs"
    ],
    "correctIndex": 0,
    "explanation": "Under amended SEBI RIA Regulations, non-individual (corporate) investment advisers must maintain a minimum net worth of ₹50 Lakhs (individuals require ₹5 Lakhs).",
    "topic": "RIA Registration Criteria"
  },
  {
    "id": "nism-xa-gen-q13",
    "courseId": "nism-xa",
    "question": "What is the mandatory cooling-off period if an existing RIA wishes to surrender their advisory license and register as a mutual fund distributor?",
    "options": [
      "No cooling-off period is required",
      "A cooling-off period of 6 months is required",
      "3 years",
      "10 years"
    ],
    "correctIndex": 1,
    "explanation": "SEBI guidelines require a mandatory cooling-off period of at least 6 months when switching between RIA registration and intermediary distribution roles.",
    "topic": "Transition & Cooling-Off Norms"
  },
  {
    "id": "nism-xa-gen-q14",
    "courseId": "nism-xa",
    "question": "In client risk profiling, an investor who has stable high income, owns their home, has no loans, and plans to retire in 25 years has:",
    "options": [
      "High Risk Capacity and potential for high equity allocation",
      "Low Risk Capacity",
      "Zero ability to absorb market fluctuations",
      "Mandatory requirement to hold 100% cash"
    ],
    "correctIndex": 0,
    "explanation": "Young age, long horizon, absence of liabilities, and steady surplus give this investor high objective risk capacity to withstand market cycles.",
    "topic": "Client Profiling & Suitability"
  },
  {
    "id": "nism-xa-gen-q15",
    "courseId": "nism-xa",
    "question": "Under SEBI regulations, how long must an Investment Adviser maintain records of client risk profiling, advisory agreements, and suitability assessments?",
    "options": [
      "At least 5 years",
      "1 year",
      "Only until the client pays the fee",
      "10 years"
    ],
    "correctIndex": 0,
    "explanation": "Regulation 19 of SEBI RIA Regulations mandates that advisers must maintain all client records, investment advice provided, and agreements for at least 5 years.",
    "topic": "Record Keeping & Retention"
  },
  {
    "id": "nism-xa-gen-q16",
    "courseId": "nism-xa",
    "question": "What is the Capital Asset Pricing Model (CAPM) formula for expected return of an asset?",
    "options": [
      "Expected Return = Rf + Beta * (Rm - Rf)",
      "Expected Return = Spot Price / P/E Ratio",
      "Expected Return = Dividend Yield + Inflation",
      "Expected Return = Debt / Equity * Beta"
    ],
    "correctIndex": 0,
    "explanation": "CAPM defines Expected Return as the Risk-Free Rate (Rf) plus the product of Beta and the Market Risk Premium (Rm - Rf).",
    "topic": "Modern Portfolio Theory"
  },
  {
    "id": "nism-xa-gen-q17",
    "courseId": "nism-xa",
    "question": "What does 'Sharpe Ratio' measure in portfolio performance analysis?",
    "options": [
      "Excess return earned per unit of total risk (Standard Deviation): (Portfolio Return - Risk Free Rate) / Standard Deviation",
      "Total dividend received per share",
      "The percentage of trading days with positive returns",
      "The turnover ratio of portfolio stocks"
    ],
    "correctIndex": 0,
    "explanation": "The Sharpe Ratio evaluates risk-adjusted return by dividing the portfolio's excess return over the risk-free benchmark by its standard deviation.",
    "topic": "Portfolio Risk Metrics"
  },
  {
    "id": "nism-xa-gen-q18",
    "courseId": "nism-xa",
    "question": "In personal tax planning, what is the maximum deduction allowed for health insurance premium for senior citizen parents under Section 80D?",
    "options": [
      "₹50,000",
      "₹25,000",
      "₹1,00,000",
      "₹15,000"
    ],
    "correctIndex": 0,
    "explanation": "Under Section 80D of the Income Tax Act, deduction up to ₹50,000 per financial year is available for health insurance premiums paid for senior citizen parents.",
    "topic": "Tax Planning & Deductions"
  },
  {
    "id": "nism-xa-gen-q19",
    "courseId": "nism-xa",
    "question": "What is the maximum investment limit per financial year in Public Provident Fund (PPF)?",
    "options": [
      "₹1,50,000",
      "₹2,50,000",
      "₹5,00,000",
      "Unlimited"
    ],
    "correctIndex": 0,
    "explanation": "The statutory maximum contribution permitted in a Public Provident Fund (PPF) account is ₹1.5 Lakhs per financial year under government rules.",
    "topic": "Small Savings Schemes"
  },
  {
    "id": "nism-xa-gen-q20",
    "courseId": "nism-xa",
    "question": "What is 'Systematic Withdrawal Plan' (SWP) tax treatment post Budget 2024?",
    "options": [
      "Each SWP installment is treated as a partial redemption of capital and capital gains, with the capital gains portion taxed as STCG or LTCG based on holding period",
      "SWP is subject to flat 30% TDS regardless of amount",
      "SWP is completely tax-free under Section 10(10D)",
      "SWP is taxed as salary income"
    ],
    "correctIndex": 0,
    "explanation": "SWP redemptions are taxed on a First-In-First-Out (FIFO) capital gains basis: each withdrawal consists of principal return (tax-free) and capital gain (taxed per holding period).",
    "topic": "Taxation of Redemptions"
  },
  {
    "id": "nism-xb-gen-q1",
    "courseId": "nism-xb",
    "question": "In estate planning, what is a 'Probate' of a Will?",
    "options": [
      "A court-issued legal certificate under the seal of a competent civil court certifying the genuineness and validity of the Will and executor's authority",
      "A tax notice issued by the Income Tax Department",
      "An insurance claim document",
      "A receipt for property stamp duty"
    ],
    "correctIndex": 0,
    "explanation": "Probate is the official court decree validating a Will and confirming the executor's legal power to administer the deceased testator's estate.",
    "topic": "Estate Planning & Wills"
  },
  {
    "id": "nism-xb-gen-q2",
    "courseId": "nism-xb",
    "question": "What is the legal implication of creating an 'Irrevocable Discretionary Private Trust' in India?",
    "options": [
      "The settlor permanently gives up ownership, the trustee has discretion on timing and amount of distribution to beneficiaries, and trust assets are shielded from beneficiaries' future creditors",
      "The settlor can cancel the trust at any time and take back the assets",
      "The trust is exempt from all corporate and individual tax forever",
      "The trust must be listed on the National Stock Exchange"
    ],
    "correctIndex": 0,
    "explanation": "In an irrevocable discretionary trust, assets are separated from the settlor and beneficiaries lack fixed rights to distributions, offering maximum creditor protection.",
    "topic": "Estate Planning & Private Trusts"
  },
  {
    "id": "nism-xb-gen-q3",
    "courseId": "nism-xb",
    "question": "Under behavioral finance, what is 'Anchoring Bias'?",
    "options": [
      "Fixating on a specific piece of historical information (such as purchase price or 52-week high) when making subsequent investment decisions, even when new fundamentals change",
      "Holding ships in a harbor",
      "Diversifying equally across all sectors",
      "Setting stop-loss orders on all trades"
    ],
    "correctIndex": 0,
    "explanation": "Anchoring bias causes an investor to over-rely on initial reference figures (e.g. initial buy price) instead of objective current valuations.",
    "topic": "Behavioral Biases"
  },
  {
    "id": "nism-xb-gen-q4",
    "courseId": "nism-xb",
    "question": "What does the 'Sortino Ratio' measure, and how does it differ from the Sharpe Ratio?",
    "options": [
      "It measures excess return divided solely by Downside Deviation, penalizing only negative volatility rather than total volatility",
      "It measures turnover ratio divided by dividend yield",
      "It uses Beta instead of Standard Deviation",
      "It is identical in every way to the Sharpe Ratio"
    ],
    "correctIndex": 0,
    "explanation": "While Sharpe penalizes all volatility (both upside and downside), Sortino divides excess return only by downside semi-deviation, focusing on harmful downside risk.",
    "topic": "Portfolio Performance Evaluation"
  },
  {
    "id": "nism-xb-gen-q5",
    "courseId": "nism-xb",
    "question": "What is 'Tracking Error' in index fund and passive portfolio management?",
    "options": [
      "The annualized standard deviation of the difference in returns between the portfolio and its underlying benchmark index",
      "A computer software glitch in trade execution",
      "The total expense ratio charged by the AMC",
      "The delay in physical delivery of shares"
    ],
    "correctIndex": 0,
    "explanation": "Tracking error measures the volatility of active return: standard deviation of (Portfolio Return - Benchmark Return), indicating how closely the fund replicates its index.",
    "topic": "Portfolio Performance Evaluation"
  },
  {
    "id": "nism-xb-gen-q6",
    "courseId": "nism-xb",
    "question": "In retirement planning, what percentage of the accumulated pension corpus can be withdrawn tax-free as a lump-sum upon reaching age 60 under NPS Tier 1?",
    "options": [
      "Up to 60% of the corpus can be commuted tax-free; the remaining minimum 40% must be used to purchase an annuity",
      "100% tax-free lump sum",
      "Zero, 100% must be annuitized",
      "Up to 25% only"
    ],
    "correctIndex": 0,
    "explanation": "Under PFRDA regulations, an NPS Tier 1 subscriber can withdraw up to 60% of the accumulated corpus tax-free upon maturity, with at least 40% annuitized.",
    "topic": "Retirement Planning & NPS"
  },
  {
    "id": "nism-xb-gen-q7",
    "courseId": "nism-xb",
    "question": "What is the primary difference between a 'Defined Benefit' (DB) pension plan and a 'Defined Contribution' (DC) pension plan?",
    "options": [
      "DB guarantees a predetermined retirement payout based on salary and tenure, with investment risk borne by the employer; DC specifies fixed contributions, with retirement payout and investment risk borne by the employee",
      "DB is for corporate executives only; DC is for farmers",
      "DB has no tax benefits; DC has full exemption",
      "DB permits daily withdrawals; DC locks funds forever"
    ],
    "correctIndex": 0,
    "explanation": "In DB plans (like old pension scheme), the employer guarantees the retirement pension; in DC plans (like NPS/EPF), the employee bears the investment risk.",
    "topic": "Retirement Planning & Solutions"
  },
  {
    "id": "nism-xb-gen-q8",
    "courseId": "nism-xb",
    "question": "Under Section 54EC of the Income Tax Act, an investor can claim capital gains tax exemption on long-term capital gains from real estate by investing in specified bonds (REC, PFC, NHAI) up to a maximum limit of:",
    "options": [
      "₹50 Lakhs per financial year within 6 months of transfer",
      "₹1 Crore",
      "₹25 Lakhs",
      "Unlimited investment"
    ],
    "correctIndex": 0,
    "explanation": "Section 54EC allows exemption up to ₹50 Lakhs per financial year by investing in specified infrastructure capital gains bonds within 6 months of property transfer.",
    "topic": "Tax Exemption Framework"
  },
  {
    "id": "nism-xb-gen-q9",
    "courseId": "nism-xb",
    "question": "What is 'Overconfidence Bias' in investment decision making?",
    "options": [
      "The tendency of investors to overestimate their financial knowledge, predictive accuracy, and ability to control market outcomes, leading to excessive trading and inadequate diversification",
      "Being confident that bank deposits will be safe",
      "Checking stock prices once a week",
      "Investing solely in index funds"
    ],
    "correctIndex": 0,
    "explanation": "Overconfidence causes investors to misjudge risk, underestimate market uncertainty, and trade too frequently, resulting in substandard net returns.",
    "topic": "Behavioral Biases"
  },
  {
    "id": "nism-xb-gen-q10",
    "courseId": "nism-xb",
    "question": "What is 'Asset-Liability Matching' (ALM) in institutional and high-net-worth portfolio advisory?",
    "options": [
      "Structuring the cash flows, maturities, and liquidity profiles of investment assets to coincide precisely with the timing and magnitudes of future client liabilities and commitments",
      "Borrowing from credit cards to invest in equities",
      "Balancing ledger accounts at the end of the day",
      "Pledging assets to secure real estate mortgages"
    ],
    "correctIndex": 0,
    "explanation": "ALM ensures that an investor or institution holds adequate liquid and maturing assets matching their time-specific future debt obligations and spending commitments.",
    "topic": "Wealth Management & ALM"
  },
  {
    "id": "nism-xv-gen-q11",
    "courseId": "nism-xv",
    "question": "What is the statutory requirement under SEBI (Research Analysts) Regulations, 2014 regarding personal shareholding disclosure in a research report?",
    "options": [
      "The research analyst and research entity must disclose if they hold 1% or more financial interest in the subject company as on the date of publication",
      "They are strictly barred from publishing any disclosures",
      "They only need to disclose if they hold 51% majority control",
      "Disclosures are optional at the analyst's discretion"
    ],
    "correctIndex": 0,
    "explanation": "SEBI RA Regulations mandate explicit disclosure of whether the analyst, entity, or associates hold 1% or more beneficial ownership in the target company.",
    "topic": "SEBI Research Analyst Regulations"
  },
  {
    "id": "nism-xv-gen-q12",
    "courseId": "nism-xv",
    "question": "Under SEBI RA Regulations, can a research analyst trade against their own published recommendation within 30 days of report publication?",
    "options": [
      "No, research analysts are strictly prohibited from trading against their own recommendation or in a manner contrary to their research views within 30 days",
      "Yes, provided they do it on an overseas stock exchange",
      "Yes, if they need personal emergency cash",
      "Yes, without any restrictions"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that research analysts cannot execute personal trades contrary to their published recommendations for a period of 30 days from publication.",
    "topic": "Code of Conduct & Personal Trading"
  },
  {
    "id": "nism-xv-gen-q13",
    "courseId": "nism-xv",
    "question": "In equity valuation, what is Enterprise Value (EV)?",
    "options": [
      "Market Capitalization + Total Debt + Minority Interest + Preferred Stock - Cash and Cash Equivalents",
      "Total Revenue minus Total Expenses",
      "Current share price multiplied by total employees",
      "Net Worth divided by Book Value"
    ],
    "correctIndex": 0,
    "explanation": "Enterprise Value reflects the total economic takeover value of a firm, calculated as Market Cap plus Debt minus Cash & Liquid Investments.",
    "topic": "Valuation Metrics"
  },
  {
    "id": "nism-xv-gen-q14",
    "courseId": "nism-xv",
    "question": "Why is the EV/EBITDA multiple preferred over the Price-to-Earnings (P/E) ratio when comparing capital-intensive companies with differing capital structures and tax rates?",
    "options": [
      "Because EBITDA is independent of capital structure (debt vs equity financing), depreciation policies, and income tax variations, providing a clean operational comparison",
      "Because EV/EBITDA is always a smaller number than P/E",
      "Because EBITDA includes extraordinary non-operating income",
      "Because P/E ratios are illegal under SEBI guidelines"
    ],
    "correctIndex": 0,
    "explanation": "EV/EBITDA eliminates distortions caused by differences in debt leverage, depreciation accounting, and jurisdictional tax rates across competing firms.",
    "topic": "Valuation Metrics"
  },
  {
    "id": "nism-xv-gen-q15",
    "courseId": "nism-xv",
    "question": "In Michael Porter's Five Forces model for industry analysis, which force evaluates the bargaining leverage that consumers have over product pricing?",
    "options": [
      "Bargaining Power of Buyers",
      "Threat of New Entrants",
      "Bargaining Power of Suppliers",
      "Threat of Substitute Products"
    ],
    "correctIndex": 0,
    "explanation": "Bargaining Power of Buyers measures the ability of customers to drive down prices, demand higher quality, or switch to competitors.",
    "topic": "Industry Analysis"
  },
  {
    "id": "nism-xv-gen-q16",
    "courseId": "nism-xv",
    "question": "What does the 'Current Ratio' measure in financial statement analysis?",
    "options": [
      "Short-term liquidity: Current Assets divided by Current Liabilities",
      "Long-term solvency: Total Debt divided by Equity",
      "Profitability: Net Profit divided by Net Sales",
      "Operating efficiency: Inventory divided by COGS"
    ],
    "correctIndex": 0,
    "explanation": "The Current Ratio evaluates short-term liquidity by comparing current assets (convertible to cash within 1 year) against obligations due within 1 year.",
    "topic": "Financial Statement Analysis"
  },
  {
    "id": "nism-xv-gen-q17",
    "courseId": "nism-xv",
    "question": "What does Return on Capital Employed (ROCE) measure?",
    "options": [
      "Operating Profit (EBIT) divided by Total Capital Employed (Total Assets minus Current Liabilities), reflecting efficiency of capital deployment",
      "Net profit divided by dividend payments",
      "Market price divided by book value",
      "Cash generated from financing activities"
    ],
    "correctIndex": 0,
    "explanation": "ROCE measures how effectively a company generates operating profits from all the capital invested into the business by both debt holders and equity shareholders.",
    "topic": "Financial Statement Analysis"
  },
  {
    "id": "nism-xv-gen-q18",
    "courseId": "nism-xv",
    "question": "In macroeconomic analysis, what is 'Core Inflation'?",
    "options": [
      "Headline inflation excluding volatile components such as food and energy prices to reveal underlying medium-term price trends",
      "The inflation rate measured exclusively inside bank branches",
      "The annual percentage rise in real estate rents",
      "The inflation rate of technology software"
    ],
    "correctIndex": 0,
    "explanation": "Core inflation strips out volatile food and fuel prices, providing monetary authorities like the RBI with a stable measure of structural demand-driven price pressures.",
    "topic": "Macroeconomic Analysis"
  },
  {
    "id": "nism-xv-gen-q19",
    "courseId": "nism-xv",
    "question": "What does an inverted yield curve (where short-term bond yields are higher than long-term bond yields) traditionally signal to research analysts?",
    "options": [
      "An impending economic slowdown or recession as markets anticipate future central bank rate cuts",
      "A booming economic expansion with high inflation",
      "A surge in foreign institutional equity investments",
      "A sudden strengthening of the domestic currency"
    ],
    "correctIndex": 0,
    "explanation": "Yield curve inversion is a classic leading indicator of recession; investors lock into long-term bonds expecting economic deceleration and lower future rates.",
    "topic": "Economic & Bond Market Analysis"
  },
  {
    "id": "nism-xv-gen-q20",
    "courseId": "nism-xv",
    "question": "What is 'DuPont Analysis' in financial equity research?",
    "options": [
      "Decomposing Return on Equity (ROE) into three distinct components: Net Profit Margin (profitability) * Asset Turnover (operating efficiency) * Financial Leverage (equity multiplier)",
      "A chemical manufacturing process",
      "A technical charting pattern on candlestick charts",
      "A method of calculating brokerage commissions"
    ],
    "correctIndex": 0,
    "explanation": "DuPont analysis breaks down ROE to identify whether a company's return is driven by high profit margins, efficient asset utilization, or aggressive debt leverage.",
    "topic": "Financial Statement Analysis"
  },
  {
    "id": "nism-xxia-gen-q11",
    "courseId": "nism-xxia",
    "question": "Under SEBI (Portfolio Managers) Regulations, 2020, what is the minimum net worth requirement for a registered Portfolio Manager?",
    "options": [
      "₹5 Crores",
      "₹2 Crores",
      "₹1 Crore",
      "₹10 Crores"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that an entity registered as a Portfolio Manager must maintain a minimum net worth of ₹5 Crores at all times.",
    "topic": "SEBI PMS Regulations"
  },
  {
    "id": "nism-xxia-gen-q12",
    "courseId": "nism-xxia",
    "question": "What is the 'Disclosure Document' (Form C) provided by a Portfolio Manager to prospective clients prior to agreement signing?",
    "options": [
      "A comprehensive regulatory document detailing PMS history, investment strategies, performance track record, fee schedules, and pending litigation",
      "A marketing brochure with guaranteed profit claims",
      "A bank account opening letter",
      "An insurance policy document"
    ],
    "correctIndex": 0,
    "explanation": "Under Regulation 22, the Disclosure Document gives investors transparent, verified information on the manager's strategies, risks, fees, and past performance.",
    "topic": "Disclosure Document & Form C"
  },
  {
    "id": "nism-xxia-gen-q13",
    "courseId": "nism-xxia",
    "question": "How frequently must a Portfolio Manager provide detailed activity, transaction, and portfolio valuation statements to PMS clients?",
    "options": [
      "At least once every three months (quarterly), or monthly if requested",
      "Once every 5 years",
      "Only when the client explicitly issues a legal notice",
      "Annually at the Annual General Meeting"
    ],
    "correctIndex": 0,
    "explanation": "SEBI regulations mandate that portfolio managers provide reports to clients at least on a quarterly basis, detailing portfolio assets, transactions, and fees charged.",
    "topic": "Client Reporting & Statements"
  },
  {
    "id": "nism-xxia-gen-q14",
    "courseId": "nism-xxia",
    "question": "In PMS operations, what is the role of an independent 'Custodian'?",
    "options": [
      "To safe-keep client securities, maintain independent demat and bank accounts, and settle trades under the instructions of the portfolio manager",
      "To market PMS schemes across rural areas",
      "To audit the client's personal income tax returns",
      "To lend money to the portfolio manager"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates appointment of an independent, regulated custodian for safekeeping of client funds and securities to prevent misappropriation.",
    "topic": "Custody & Settlement"
  },
  {
    "id": "nism-xxia-gen-q15",
    "courseId": "nism-xxia",
    "question": "Under SEBI regulations, can a Portfolio Manager invest client funds in unlisted securities?",
    "options": [
      "Yes, but only in discretionary and non-discretionary PMS up to a maximum aggregate limit of 25% of the client's portfolio in unlisted securities",
      "No, zero percent unlisted investment is allowed",
      "Yes, 100% of the portfolio can be in unlisted shares",
      "Only if the client is a foreign citizen"
    ],
    "correctIndex": 0,
    "explanation": "SEBI permits investment in unlisted securities up to a maximum cap of 25% of the client's AUM under prudent risk diversification norms.",
    "topic": "PMS Investment Restrictions"
  },
  {
    "id": "nism-xxia-gen-q16",
    "courseId": "nism-xxia",
    "question": "What is the primary reason why Time-Weighted Rate of Return (TWRR) is mandated over Internal Rate of Return (IRR) for reporting PMS manager performance?",
    "options": [
      "TWRR eliminates the distorting effects of client cash deposits and withdrawals, measuring solely the manager's investment skill",
      "TWRR always produces a higher percentage return than IRR",
      "IRR is mathematically impossible to calculate on computers",
      "TWRR is required by the Income Tax Department for GST calculation"
    ],
    "correctIndex": 0,
    "explanation": "Since the timing and size of capital injections and withdrawals are controlled by the client, TWRR isolates the manager's true investment compounding ability.",
    "topic": "Performance Reporting & Metrics"
  },
  {
    "id": "nism-xxia-gen-q17",
    "courseId": "nism-xxia",
    "question": "Can a Portfolio Manager promise or guarantee fixed returns to a PMS client under SEBI regulations?",
    "options": [
      "No, SEBI strictly prohibits portfolio managers from promising, assuring, or indicating any guaranteed returns to clients",
      "Yes, if backed by an insurance policy",
      "Yes, up to 15% annual return",
      "Yes, if the client invests more than ₹10 Crores"
    ],
    "correctIndex": 0,
    "explanation": "Regulation 24(2) explicitly prohibits portfolio managers from guaranteeing or indicating guaranteed returns on any PMS product.",
    "topic": "Code of Conduct & Prohibitions"
  },
  {
    "id": "nism-xxia-gen-q18",
    "courseId": "nism-xxia",
    "question": "Under the SEBI PMS fee framework, how are distributor commissions paid for sourcing PMS clients?",
    "options": [
      "Only through a trail commission model out of the management fee; upfront commissions are strictly prohibited",
      "Full 5% upfront commission on day one",
      "Cash payment directly from client to distributor",
      "No commission is permitted under any circumstances"
    ],
    "correctIndex": 0,
    "explanation": "SEBI banned all upfront commissions in PMS distribution: distributors can only receive ongoing trail-based compensation deducted from management fees.",
    "topic": "Distributor Commission Norms"
  },
  {
    "id": "nism-xxia-gen-q19",
    "courseId": "nism-xxia",
    "question": "What is a 'Model Portfolio' in PMS operations?",
    "options": [
      "A standardized investment basket created by the research team representing an approved strategy, which is replicated across individual client accounts based on their mandates",
      "A portfolio created by fashion models",
      "A demonstration account with monopoly money",
      "An index ETF managed by a mutual fund"
    ],
    "correctIndex": 0,
    "explanation": "Model portfolios represent the institutional target allocations of a strategy; trades are proportionately executed across client accounts following that model.",
    "topic": "Portfolio Execution"
  },
  {
    "id": "nism-xxia-gen-q20",
    "courseId": "nism-xxia",
    "question": "What is the statutory requirement for auditing of client PMS accounts by an independent Chartered Accountant?",
    "options": [
      "An annual audit of each client's portfolio accounts must be conducted by an independent CA, and the report submitted to the client and SEBI",
      "Audit is only required if the client incurs a loss",
      "Audits are conducted once every 10 years",
      "Audits are conducted exclusively by RBI officials"
    ],
    "correctIndex": 0,
    "explanation": "SEBI regulations mandate an annual audit of individual client portfolio accounts by an independent practicing Chartered Accountant.",
    "topic": "Audit & Regulatory Compliance"
  },
  {
    "id": "nism-cpe-mf-gen-q1",
    "courseId": "nism-cpe-mf",
    "question": "What is the validity period of an initial NISM Series V-A Mutual Fund Distributors Certification, and how is it extended via CPE?",
    "options": [
      "Valid for 3 years from the date of examination; completing an approved 1-day CPE program prior to expiry extends certification for another 3 years",
      "Valid for lifetime with no renewal required",
      "Valid for 6 months only",
      "Valid for 10 years"
    ],
    "correctIndex": 0,
    "explanation": "NISM Series V-A certification is valid for 3 years. Candidates must complete a NISM CPE training session within 12 months prior to certificate expiration.",
    "topic": "CPE Revalidation Norms"
  },
  {
    "id": "nism-cpe-mf-gen-q2",
    "courseId": "nism-cpe-mf",
    "question": "Under the updated SEBI guidelines, what is Central KYC (CKYC) registry administered by CERSAI?",
    "options": [
      "A centralized repository storing verified digital KYC records of financial consumers, allowing one-time KYC verification across all SEBI, RBI, IRDAI, and PFRDA entities",
      "A national credit rating bureau",
      "A taxation database for GST returns",
      "A blacklist registry of loan defaulters"
    ],
    "correctIndex": 0,
    "explanation": "CKYC eliminates redundant document collection by storing verified records under a 14-digit CKYC number usable across all financial intermediaries.",
    "topic": "KYC & AML Compliance"
  },
  {
    "id": "nism-cpe-mf-gen-q3",
    "courseId": "nism-cpe-mf",
    "question": "Under SEBI regulations, what is the consequence of failing to link PAN with Aadhaar for mutual fund investments?",
    "options": [
      "The PAN becomes inoperative, leading to blocking of mutual fund transactions, higher TDS deductions, and rejection of fresh purchase and SIP orders",
      "The investor is arrested by local police",
      "The mutual fund units are confiscated by the AMC",
      "No consequence, transactions continue normally"
    ],
    "correctIndex": 0,
    "explanation": "An inoperative PAN due to non-linkage with Aadhaar prevents compliance with KYC laws, halting fresh investments, SIP installments, and redemptions.",
    "topic": "Statutory Compliance & PAN"
  },
  {
    "id": "nism-cpe-mf-gen-q4",
    "courseId": "nism-cpe-mf",
    "question": "What is the role of the Association of Mutual Funds in India (AMFI) in distributor regulation?",
    "options": [
      "Issuing AMFI Registration Numbers (ARN), maintaining the distributor code of conduct, and enforcing disciplinary actions for unethical selling practices",
      "Regulating monetary policy and repo rates",
      "Managing commercial real estate properties",
      "Printing sovereign currency notes"
    ],
    "correctIndex": 0,
    "explanation": "AMFI is the apex industry body that issues ARN cards, enforces the AMFI Code of Ethics, and coordinates with SEBI for orderly distribution growth.",
    "topic": "Industry Structure & AMFI"
  },
  {
    "id": "nism-cpe-mf-gen-q5",
    "courseId": "nism-cpe-mf",
    "question": "What is the maximum timeline prescribed by SEBI for processing mutual fund redemptions in standard open-ended schemes?",
    "options": [
      "Within 2 working days (T+2) for equity schemes and T+1 for liquid schemes",
      "Within 30 calendar days",
      "Within 12 hours of placing the order",
      "Redemptions can be delayed indefinitely without notice"
    ],
    "correctIndex": 0,
    "explanation": "SEBI amended mutual fund redemption transfer timelines to T+2 working days for general schemes and T+1 for liquid/overnight schemes to protect investor liquidity.",
    "topic": "Operational Turnaround Times"
  },
  {
    "id": "nism-vd-q11",
    "courseId": "nism-vd",
    "question": "Under the SEBI (Alternative Investment Funds) Regulations, 2012, which category of AIF is primarily formed to invest in start-ups, early-stage ventures, social ventures, and SMEs?",
    "options": [
      "Category I AIF",
      "Category II AIF",
      "Category III AIF",
      "Mutual Fund Liquid Scheme"
    ],
    "correctIndex": 0,
    "explanation": "Category I AIFs invest in start-ups, early stage ventures, social ventures, SMEs, and infrastructure that the government or regulators consider socially or economically desirable.",
    "topic": "AIF Structure & Categories"
  },
  {
    "id": "nism-vd-q12",
    "courseId": "nism-vd",
    "question": "What is the minimum investment amount required from an investor (other than employees/directors of the AIF/manager) in a Category I or Category II AIF?",
    "options": [
      "₹10 Lakhs",
      "₹25 Lakhs",
      "₹1 Crore",
      "₹5 Crores"
    ],
    "correctIndex": 2,
    "explanation": "SEBI (AIF) Regulations mandate a minimum investment commitment of ₹1 Crore per investor for Category I and II AIFs (₹25 Lakhs for employees/directors).",
    "topic": "AIF Regulatory Thresholds"
  },
  {
    "id": "nism-vd-q13",
    "courseId": "nism-vd",
    "question": "Under SEBI regulations, an 'Accredited Investor' (AI) is eligible for lower minimum ticket size in AIFs if an individual investor possesses:",
    "options": [
      "Annual income of at least ₹2 Crores, or net worth of at least ₹7.5 Crores with at least ₹3.75 Crores in financial assets",
      "Annual income of ₹10 Lakhs",
      "A PAN card and an Aadhaar card only",
      "At least 5 years of mutual fund trading experience"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI AI norms, an individual qualifies as an Accredited Investor if they have an annual gross income >= ₹2 Crores OR net worth >= ₹7.5 Crores with at least 50% in financial assets.",
    "topic": "Accredited Investor Framework"
  },
  {
    "id": "nism-vd-q14",
    "courseId": "nism-vd",
    "question": "Which category of AIF employs complex or diverse trading strategies including leverage, short selling, and investment in listed derivatives?",
    "options": [
      "Category I AIF",
      "Category II AIF",
      "Category III AIF",
      "Angel Fund"
    ],
    "correctIndex": 2,
    "explanation": "Category III AIFs (such as hedge funds) employ diverse or complex trading strategies and are permitted to use leverage and derivatives to generate returns in both rising and falling markets.",
    "topic": "AIF Structure & Categories"
  },
  {
    "id": "nism-vd-q15",
    "courseId": "nism-vd",
    "question": "What is the maximum leverage permitted for Category III Alternative Investment Funds under SEBI regulations?",
    "options": [
      "No leverage is ever permitted",
      "Up to 2 times the Net Asset Value (200% of NAV)",
      "Up to 10 times the Net Asset Value",
      "Unlimited leverage with investor consent"
    ],
    "correctIndex": 1,
    "explanation": "Category III AIFs are permitted leverage up to 2 times their NAV (gross exposure cannot exceed 200% of NAV) under SEBI circular guidelines.",
    "topic": "AIF Leverage & Risk"
  },
  {
    "id": "nism-vd-q16",
    "courseId": "nism-vd",
    "question": "In private equity and venture capital funds, what is the term used for the pre-agreed minimum rate of return that must be paid to investors before the fund manager earns a performance fee (carried interest)?",
    "options": [
      "Risk-free rate",
      "Hurdle Rate",
      "Drawdown percentage",
      "Expense ratio cap"
    ],
    "correctIndex": 1,
    "explanation": "The Hurdle Rate (preferred return) is the minimum annualized return threshold (typically 8% to 10%) that must be achieved and distributed to investors before the General Partner earns carried interest.",
    "topic": "Fund Economics & Carried Interest"
  },
  {
    "id": "nism-vd-q17",
    "courseId": "nism-vd",
    "question": "What is a 'Capital Call' or 'Drawdown Notice' in the context of Specialized Investment Funds / AIFs?",
    "options": [
      "A request to redeem units immediately",
      "A formal request issued by the fund manager to committed investors demanding transfer of a portion of their committed capital to fund an identified investment",
      "A phone call from the custodian regarding dividend payouts",
      "A notice issued by SEBI suspending fund operations"
    ],
    "correctIndex": 1,
    "explanation": "In closed-end AIFs, investors commit a total amount upfront, and the manager issues capital calls (drawdowns) in tranches as target portfolio investments are negotiated.",
    "topic": "Fund Operations & Drawdowns"
  },
  {
    "id": "nism-vd-q18",
    "courseId": "nism-vd",
    "question": "What is the tax status of Category I and Category II AIFs under the Indian Income Tax Act (Section 115UB)?",
    "options": [
      "They are taxed as corporate entities at flat 30%",
      "They enjoy statutory pass-through tax status, meaning income is taxed directly in the hands of the unit holders as if they had invested directly",
      "They are completely exempt from all taxes forever",
      "Income is taxed at double the standard rate"
    ],
    "correctIndex": 1,
    "explanation": "Section 115UB provides pass-through status to Category I and II AIFs; any income earned by the fund is deemed to be income of the unit holders in the same proportion and nature.",
    "topic": "AIF Taxation"
  },
  {
    "id": "nism-vd-q19",
    "courseId": "nism-vd",
    "question": "Under SEBI AIF regulations, all units of Alternative Investment Funds issued after May 2024 must be issued in:",
    "options": [
      "Physical parchment certificates",
      "Demat (dematerialised) format only",
      "Bearer bond notes",
      "Printed paper receipts"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandated that all existing and newly issued units of Alternative Investment Funds must be held and issued exclusively in dematerialised (Demat) form to enhance transparency.",
    "topic": "AIF Dematerialisation Norms"
  },
  {
    "id": "nism-vd-q20",
    "courseId": "nism-vd",
    "question": "What is a 'Co-investment Portfolio' under SEBI AIF rules?",
    "options": [
      "Investing alongside family members in an ELSS fund",
      "An investment made by an AIF manager in an investee company alongside the AIF through a separate Co-investment Portfolio Manager (CPM) vehicle",
      "Investing 50% in equity and 50% in gold",
      "A joint bank account opened by two distributors"
    ],
    "correctIndex": 1,
    "explanation": "A Co-investment is an investment in an investee company made by a Category I or II AIF investor alongside the AIF itself, governed under SEBI's Co-investment Portfolio Manager framework.",
    "topic": "Co-investment Framework"
  },
  {
    "id": "nism-viii-q26",
    "courseId": "nism-viii",
    "question": "Under the Cost-of-Carry model for pricing futures contracts on dividend-paying stocks, the theoretical Futures Price is given by:",
    "options": [
      "Spot Price + Financing Cost - Dividends",
      "Spot Price - Financing Cost + Dividends",
      "Spot Price multiplied by Price-to-Earnings ratio",
      "Spot Price divided by Beta"
    ],
    "correctIndex": 0,
    "explanation": "The theoretical futures price equals Spot Price + Carrying Costs (interest cost on borrowed funds) minus Carrying Returns (dividends or yields earned during the holding period).",
    "topic": "Futures Pricing & Cost of Carry"
  },
  {
    "id": "nism-viii-q27",
    "courseId": "nism-viii",
    "question": "What does the option Greek 'Gamma' measure?",
    "options": [
      "The sensitivity of the option price to changes in interest rates",
      "The rate of change of Delta for a one-unit change in the underlying stock price",
      "The time decay of the option per day",
      "The sensitivity of the option price to changes in implied volatility"
    ],
    "correctIndex": 1,
    "explanation": "Gamma is the second derivative of the option price with respect to the underlying price; it measures the curvature or acceleration of Delta per unit move in the underlying asset.",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-q28",
    "courseId": "nism-viii",
    "question": "If an option trader executes a 'Bull Call Spread' strategy, the structure involves:",
    "options": [
      "Buying a lower strike Call option and selling a higher strike Call option with the same expiration date",
      "Selling a Call option and buying a Put option",
      "Buying both a Call and Put at the identical strike",
      "Selling naked Call options without underlying shares"
    ],
    "correctIndex": 0,
    "explanation": "A Bull Call Spread is constructed by purchasing an In-The-Money or At-The-Money Call option and selling an Out-Of-The-Money Call option to reduce the net premium outlay.",
    "topic": "Derivative Strategies"
  },
  {
    "id": "nism-viii-q29",
    "courseId": "nism-viii",
    "question": "What is a 'Long Straddle' options strategy?",
    "options": [
      "Simultaneously buying a Call and a Put option with the identical strike price and expiration date",
      "Selling a Call option and purchasing underlying equity shares",
      "Buying two Calls at different expiration months",
      "Investing only in liquid ETF derivatives"
    ],
    "correctIndex": 0,
    "explanation": "A Long Straddle involves buying both a Call and a Put with the same strike and expiration. It profits from significant volatility in either direction regardless of market trend.",
    "topic": "Derivative Strategies"
  },
  {
    "id": "nism-viii-q30",
    "courseId": "nism-viii",
    "question": "Under SEBI and exchange margining systems, what is SPAN (Standard Portfolio Analysis of Risk) designed to calculate?",
    "options": [
      "The average brokerage commission of the client",
      "The maximum possible portfolio loss over a one-day time horizon across 16 different market scenarios",
      "The historical dividend yield of Nifty 50",
      "The income tax deduction available on derivative trading"
    ],
    "correctIndex": 1,
    "explanation": "SPAN margin evaluates overall portfolio risk by calculating the largest loss the portfolio could suffer under 16 realistic scenarios of price changes and volatility shifts.",
    "topic": "Margining & Risk Management"
  },
  {
    "id": "nism-viii-q31",
    "courseId": "nism-viii",
    "question": "In an options contract, 'Theta' is almost always negative for long option holders because:",
    "options": [
      "Options gain value as time passes",
      "Option premium decays over time as expiration approaches, eroding the time value component of the option",
      "Stock markets never decline over time",
      "Theta represents the broker's commission rate"
    ],
    "correctIndex": 1,
    "explanation": "Theta measures time decay; as calendar time elapses towards expiration date, the time value of an option diminishes, causing a decay in the buyer's premium.",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-q32",
    "courseId": "nism-viii",
    "question": "What is 'Put-Call Ratio' (PCR) in open interest analysis, and what does a high PCR typically indicate?",
    "options": [
      "Total number of active put contracts divided by total call contracts; an unusually high PCR reflects excessive bearish hedging and potential oversold/bullish reversal conditions",
      "The ratio of stock price to dividend yield",
      "The exchange fee divided by the clearing fee",
      "The number of buy orders divided by sell orders in cash market"
    ],
    "correctIndex": 0,
    "explanation": "PCR = Open Interest of Puts / Open Interest of Calls. A contrarian indicator: very high PCR indicates heavy put writing or excessive hedging, signaling strong support or market bottom.",
    "topic": "Market Indicators & Open Interest"
  },
  {
    "id": "nism-viii-q33",
    "courseId": "nism-viii",
    "question": "Under SEBI regulations for equity derivatives, all physical delivery settlement of stock derivatives at expiration is conducted on:",
    "options": [
      "Cash settlement only",
      "Mandatory physical settlement where deliverable shares must be delivered/received in Demat form",
      "Gold bars delivery",
      "Postponement to next year"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandated physical settlement for all stock derivatives: in-the-money options and expiring futures positions result in the actual transfer of underlying shares in Demat accounts.",
    "topic": "Settlement & Delivery"
  },
  {
    "id": "nism-xiii-q1",
    "courseId": "nism-xiii",
    "question": "Which four asset classes are traded under the unified framework of NISM Series XIII Common Derivatives?",
    "options": [
      "Equities, Currencies, Commodities, and Interest Rates",
      "Real estate, Art, Antiques, and Cryptocurrencies",
      "Mutual funds, Fixed deposits, PPF, and NSC",
      "Life insurance, Health insurance, Motor insurance, and Marine insurance"
    ],
    "correctIndex": 0,
    "explanation": "NISM Series XIII Common Derivatives covers derivatives across Equity, Currency (FX), Commodity, and Interest Rate segments under a unified benchmark.",
    "topic": "Common Derivatives Overview"
  },
  {
    "id": "nism-xiii-q2",
    "courseId": "nism-xiii",
    "question": "What is the standard contract quotation and lot size for USD-INR Currency Futures on Indian exchanges?",
    "options": [
      "Quoted in INR per USD, with standard lot size of 1,000 USD",
      "Quoted in USD per INR, with lot size of 1,000,000 USD",
      "Quoted in Gold grams, with lot size of 100 USD",
      "Quoted in British Pounds with lot size of 10,000 USD"
    ],
    "correctIndex": 0,
    "explanation": "USD-INR currency futures on NSE/BSE are quoted in Indian Rupees per US Dollar with a standard contract size of USD 1,000.",
    "topic": "Currency Derivatives"
  },
  {
    "id": "nism-xiii-q3",
    "courseId": "nism-xiii",
    "question": "In Interest Rate Futures (IRF), what is the underlying benchmark for the 10-year GoI Bond Futures contract?",
    "options": [
      "A notional 10-year Government of India (GoI) coupon-bearing bond with a standardized 7% coupon",
      "The State Bank of India fixed deposit rate",
      "The US 10-Year Treasury Yield",
      "The Mumbai Interbank Offer Rate (MIBOR)"
    ],
    "correctIndex": 0,
    "explanation": "10-year Interest Rate Futures on Indian exchanges are based on notional 10-year GoI bonds with a standardized 7% coupon paid semi-annually.",
    "topic": "Interest Rate Derivatives"
  },
  {
    "id": "nism-xiii-q4",
    "courseId": "nism-xiii",
    "question": "In Commodity Derivatives trading on MCX/NCDEX, what is the role of an 'Assayer' and 'Accredited Warehouse'?",
    "options": [
      "To lend margin money to retail traders",
      "To inspect, certify quality, verify purity, and securely store the underlying physical commodity for exchange delivery",
      "To publish daily equity research notes",
      "To collect income tax at source"
    ],
    "correctIndex": 1,
    "explanation": "Accredited warehouses store physical commodities, while certified assayers test grade, purity, and moisture to ensure goods match contract delivery specifications.",
    "topic": "Commodity Derivatives & Logistics"
  },
  {
    "id": "nism-xiii-q5",
    "courseId": "nism-xiii",
    "question": "What is 'Contango' in commodity and futures markets?",
    "options": [
      "A situation where futures prices are higher than the spot price due to storage costs, financing, and insurance",
      "A situation where spot price is higher than futures price",
      "A sudden cancellation of derivative contracts by the regulator",
      "A tax deduction available on agricultural commodities"
    ],
    "correctIndex": 0,
    "explanation": "Contango describes a market condition where futures contracts trade at a premium over spot prices, reflecting positive carrying costs (cost of carry: interest + storage + insurance).",
    "topic": "Commodity Pricing & Market Structure"
  },
  {
    "id": "nism-xiii-q6",
    "courseId": "nism-xiii",
    "question": "What is 'Backwardation' in commodity markets?",
    "options": [
      "When spot prices exceed futures prices, usually due to immediate supply shortages or high convenience yield",
      "When futures prices are higher than spot prices",
      "When trading is halted due to a circuit breaker",
      "When clearing corporations fail to settle trades"
    ],
    "correctIndex": 0,
    "explanation": "Backwardation occurs when the spot price trades at a premium to futures prices, reflecting high convenience yield or immediate physical shortage of the commodity.",
    "topic": "Commodity Pricing & Market Structure"
  },
  {
    "id": "nism-xiii-q7",
    "courseId": "nism-xiii",
    "question": "Under RBI guidelines, resident Indians trading exchange-traded currency derivatives (ETCD) must ensure:",
    "options": [
      "An underlying contracted foreign currency exposure exists before participating in speculative trades",
      "All trades are executed solely in cash outside banking channels",
      "Trades are settled in physical foreign currency bank notes",
      "No margin is ever posted with the clearing corporation"
    ],
    "correctIndex": 0,
    "explanation": "RBI circulars under FEMA mandate that participants in ETCD markets must have an underlying contracted foreign exchange exposure to hedge currency risk.",
    "topic": "Currency Regulatory Framework"
  },
  {
    "id": "nism-xa-q11",
    "courseId": "nism-xa",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013, what is the maximum fixed advisory fee an RIA can charge per client across all financial services in a financial year?",
    "options": [
      "₹50,000",
      "₹1,25,000",
      "₹5,00,000",
      "₹10,00,000"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI RIA regulations, if the adviser charges a fixed fee model, the fee cannot exceed ₹1,25,000 per annum per client family across all services.",
    "topic": "SEBI RIA Regulations"
  },
  {
    "id": "nism-xa-q12",
    "courseId": "nism-xa",
    "question": "What is the Human Life Value (HLV) concept used for in financial planning?",
    "options": [
      "Estimating the medical expenses of a person in old age",
      "Determining the economic value of an individual to their dependents, used to calculate adequate life insurance cover required",
      "Calculating income tax rebate under Section 80C",
      "Valuing shares of healthcare companies"
    ],
    "correctIndex": 1,
    "explanation": "HLV calculates the present value of future earnings that would have been provided to dependents after deducting personal taxes and expenses, determining adequate life cover.",
    "topic": "Insurance Planning & Risk Management"
  },
  {
    "id": "nism-xa-q13",
    "courseId": "nism-xa",
    "question": "In financial mathematics, if an investor requires ₹50 Lakhs after 10 years and expected annual compounded return is 12%, which formula calculates the monthly SIP required?",
    "options": [
      "Future Value of an Ordinary Annuity / Annuity Due formula",
      "Present Value of a Perpetuity formula",
      "Capital Asset Pricing Model (CAPM)",
      "Price to Book ratio"
    ],
    "correctIndex": 0,
    "explanation": "The monthly investment required to reach a future financial goal is computed using the Future Value of Annuity formula: FV = P * [((1+r)^n - 1) / r] * (1+r).",
    "topic": "Financial Mathematics & Goal Planning"
  },
  {
    "id": "nism-xa-q14",
    "courseId": "nism-xa",
    "question": "Under SEBI RIA guidelines, how frequently must an Investment Adviser conduct an audit of compliance with RIA regulations?",
    "options": [
      "Every 5 years",
      "Annually, within six months from the end of each financial year",
      "Only when SEBI issues a show-cause notice",
      "Every month"
    ],
    "correctIndex": 1,
    "explanation": "SEBI regulations require all registered investment advisers to conduct an annual compliance audit through a practicing Chartered Accountant or Company Secretary within six months of year-end.",
    "topic": "Compliance & Audit Norms"
  },
  {
    "id": "nism-xa-q15",
    "courseId": "nism-xa",
    "question": "What is the difference between 'Strategic Asset Allocation' (SAA) and 'Tactical Asset Allocation' (TAA)?",
    "options": [
      "SAA establishes long-term baseline asset weights based on goals and risk profile; TAA makes short-term adjustments to exploit temporary market mispricings",
      "SAA is for debt funds only; TAA is for equity funds only",
      "SAA is illegal under SEBI guidelines; TAA is mandatory",
      "SAA is conducted daily; TAA is conducted once in a decade"
    ],
    "correctIndex": 0,
    "explanation": "Strategic Asset Allocation sets long-term targets aligned to client risk and horizon, while Tactical Asset Allocation takes short-to-medium opportunistic deviations to capture valuation anomalies.",
    "topic": "Portfolio Construction & Asset Allocation"
  },
  {
    "id": "nism-xb-q1",
    "courseId": "nism-xb",
    "question": "In advanced estate planning, what is the key legal distinction between a 'Revocable Trust' and an 'Irrevocable Trust'?",
    "options": [
      "A Revocable Trust can be altered or dissolved by the settlor during their lifetime, while an Irrevocable Trust cannot be revoked without beneficiary consent and provides superior asset protection from creditors",
      "A Revocable Trust avoids all income taxes; an Irrevocable Trust pays double tax",
      "Revocable Trusts can only hold cash; Irrevocable Trusts can only hold real estate",
      "Revocable Trusts must be registered with the Reserve Bank of India"
    ],
    "correctIndex": 0,
    "explanation": "In an irrevocable trust, the settlor relinquishes ownership and control of assets, shielding them from personal liabilities, litigation, and creditors, unlike revocable trusts.",
    "topic": "Estate Planning & Private Trusts"
  },
  {
    "id": "nism-xb-q2",
    "courseId": "nism-xb",
    "question": "Which of the following portfolio performance metrics measures excess return per unit of systematic risk (Beta)?",
    "options": [
      "Sharpe Ratio",
      "Treynor Ratio",
      "Sortino Ratio",
      "Maximum Drawdown"
    ],
    "correctIndex": 1,
    "explanation": "The Treynor Ratio measures excess return per unit of systematic risk (Beta): (Rp - Rf) / Beta, whereas the Sharpe Ratio measures excess return per unit of total risk (Standard Deviation).",
    "topic": "Portfolio Performance Evaluation"
  },
  {
    "id": "nism-xb-q3",
    "courseId": "nism-xb",
    "question": "What is 'Jensen's Alpha' in portfolio evaluation?",
    "options": [
      "The total dividend paid by the fund",
      "The difference between the actual return of a portfolio and the return predicted by the Capital Asset Pricing Model (CAPM) given its level of market risk",
      "The expense ratio charged by the portfolio manager",
      "The ratio of cash to debt in the fund"
    ],
    "correctIndex": 1,
    "explanation": "Jensen's Alpha = Actual Return - Expected Return under CAPM. A positive alpha indicates that the manager has added value over and above compensation for the systematic risk taken.",
    "topic": "Portfolio Performance Evaluation"
  },
  {
    "id": "nism-xb-q4",
    "courseId": "nism-xb",
    "question": "Under behavioral finance, what cognitive bias describes an investor who refuses to sell a losing stock because they refuse to acknowledge the emotional pain of a realised loss?",
    "options": [
      "Disposition Effect / Loss Aversion",
      "Self-Attribution Bias",
      "Overconfidence",
      "Anchoring"
    ],
    "correctIndex": 0,
    "explanation": "The Disposition Effect (rooted in Loss Aversion) causes investors to hold on to depreciating investments too long while selling winners prematurely to lock in small psychological gains.",
    "topic": "Behavioral Finance"
  },
  {
    "id": "nism-xb-q5",
    "courseId": "nism-xb",
    "question": "Under the Indian Income Tax Act post-Budget 2024, what is the exemption limit and tax rate for Long Term Capital Gains (LTCG) on listed equity shares and equity mutual funds held for more than 12 months?",
    "options": [
      "Exemption up to ₹1.25 Lakhs per financial year, with gains above ₹1.25 Lakhs taxed at flat 12.5% without indexation",
      "Exemption up to ₹1 Lakh, with gains above ₹1 Lakh taxed at 10%",
      "Flat 20% with indexation benefit",
      "Zero tax for all individual taxpayers"
    ],
    "correctIndex": 0,
    "explanation": "Budget 2024 increased the LTCG exemption limit to ₹1.25 Lakhs and revised the tax rate on listed equity and equity MF units held > 12 months to 12.5% without indexation.",
    "topic": "Taxation & Wealth Optimization"
  },
  {
    "id": "nism-xb-q6",
    "courseId": "nism-xb",
    "question": "What is the 'Information Ratio' (IR) in portfolio management?",
    "options": [
      "The number of quarterly reports sent to clients per year",
      "The active return of the portfolio relative to its benchmark divided by the tracking error (standard deviation of active returns)",
      "The ratio of equity to debt in a hybrid scheme",
      "The price-to-earnings ratio of the fund"
    ],
    "correctIndex": 1,
    "explanation": "Information Ratio = (Portfolio Return - Benchmark Return) / Tracking Error. It evaluates a manager's ability to generate excess returns relative to a benchmark on a risk-adjusted basis.",
    "topic": "Portfolio Performance Evaluation"
  },
  {
    "id": "nism-xv-q11",
    "courseId": "nism-xv",
    "question": "Under the SEBI (Research Analysts) Regulations, 2014, what is the minimum 'Quiet Period' during which a research analyst or research entity cannot publish research reports on an issuer following a public offering (IPO)?",
    "options": [
      "No quiet period exists",
      "At least 40 calendar days from the date of prospectus or 10 days for follow-on public offerings",
      "At least 1 year",
      "Only 24 hours"
    ],
    "correctIndex": 1,
    "explanation": "SEBI regulations prescribe quiet periods (e.g. 40 days for an IPO, 10 days for FPO) during which managing underwriters and syndicate members cannot issue research reports to prevent hype.",
    "topic": "SEBI Research Analyst Regulations"
  },
  {
    "id": "nism-xv-q12",
    "courseId": "nism-xv",
    "question": "Under the Discounted Cash Flow (DCF) valuation method, what is Free Cash Flow to Firm (FCFF)?",
    "options": [
      "Total cash deposited in the company's savings accounts",
      "Cash generated by operations available to all providers of capital (both equity shareholders and debt holders) after meeting working capital needs and capital expenditures",
      "Net profit after tax minus dividend payments",
      "Gross revenue minus administrative overheads"
    ],
    "correctIndex": 1,
    "explanation": "FCFF = Operating Cash Flow - Capex + Interest*(1 - Tax Rate). It represents the cash flow available to all capital providers (debt and equity) prior to financing cash outflows.",
    "topic": "Equity Valuation & Financial Modeling"
  },
  {
    "id": "nism-xv-q13",
    "courseId": "nism-xv",
    "question": "What is the Weighted Average Cost of Capital (WACC) used as in DCF valuation?",
    "options": [
      "The discount rate applied to future FCFF cash flows to calculate Enterprise Value",
      "The price target of the equity stock",
      "The interest rate charged on bank credit cards",
      "The growth rate of GDP"
    ],
    "correctIndex": 0,
    "explanation": "WACC represents the blended cost of debt and equity capital weighted by their proportions in the firm's capital structure, used as the discount rate for FCFF.",
    "topic": "Equity Valuation & Financial Modeling"
  },
  {
    "id": "nism-xv-q14",
    "courseId": "nism-xv",
    "question": "What are 'Chinese Walls' in the context of research entities and merchant banking institutions?",
    "options": [
      "Physical border barriers between countries",
      "Information barriers policies that physically and electronically segregate research analysts from investment banking, corporate advisory, and sales/trading divisions to prevent insider information leaks and conflicts of interest",
      "Software firewalls on company laptops",
      "Architectural guidelines for brokerage offices"
    ],
    "correctIndex": 1,
    "explanation": "Chinese Walls are stringent institutional policies separating research analysts from investment banking and trading to maintain research objectivity and prevent insider trading.",
    "topic": "Conflict of Interest & Governance"
  },
  {
    "id": "nism-xv-q15",
    "courseId": "nism-xv",
    "question": "In macroeconomic analysis, what does the Reserve Bank of India's 'Repo Rate' represent?",
    "options": [
      "The interest rate at which commercial banks borrow short-term funds from the RBI against sovereign government securities",
      "The rate at which retail customers take home loans",
      "The inflation rate measured by the CPI basket",
      "The tax levied on stock market transactions"
    ],
    "correctIndex": 0,
    "explanation": "Repo Rate is the key policy interest rate at which the RBI lends money to commercial banks against government collateral. Lowering repo stimulates borrowing; raising repo controls inflation.",
    "topic": "Economic & Industry Analysis"
  },
  {
    "id": "nism-xxia-q11",
    "courseId": "nism-xxia",
    "question": "Under SEBI (Portfolio Managers) Regulations, 2020, what is the statutory minimum investment amount required from a client opening a Portfolio Management Services (PMS) account?",
    "options": [
      "₹10 Lakhs",
      "₹25 Lakhs",
      "₹50 Lakhs",
      "₹1 Crore"
    ],
    "correctIndex": 2,
    "explanation": "SEBI enhanced the minimum ticket size for clients opening a Portfolio Management Services (PMS) account to ₹50 Lakhs to ensure only sophisticated investors enter PMS products.",
    "topic": "SEBI PMS Regulations"
  },
  {
    "id": "nism-xxia-q12",
    "courseId": "nism-xxia",
    "question": "What is the crucial operational distinction between 'Discretionary PMS' and 'Non-Discretionary PMS'?",
    "options": [
      "In Discretionary PMS, the portfolio manager makes investment decisions independently without prior client approval; in Non-Discretionary PMS, the manager advises and requires mandatory client approval before executing each trade",
      "Discretionary PMS is for retail investors; Non-Discretionary is for institutions",
      "Discretionary PMS charges zero fees; Non-Discretionary charges 10% fee",
      "Non-Discretionary PMS can only buy debt securities"
    ],
    "correctIndex": 0,
    "explanation": "In Discretionary PMS, the manager exercises full day-to-day investment discretion under a power of attorney; in Non-Discretionary, client trade-by-trade confirmation is legally required.",
    "topic": "PMS Types & Execution"
  },
  {
    "id": "nism-xxia-q13",
    "courseId": "nism-xxia",
    "question": "Under SEBI PMS regulations, which method is mandatory for calculating and reporting portfolio performance to clients?",
    "options": [
      "Simple Average Rate of Return",
      "Time-Weighted Rate of Return (TWRR)",
      "Internal Rate of Return (IRR) only",
      "Annual dividend yield only"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates the Time-Weighted Rate of Return (TWRR) methodology for calculating and reporting PMS performance because TWRR neutralizes the impact of client cash inflows and withdrawals.",
    "topic": "Performance Reporting & Metrics"
  },
  {
    "id": "nism-xxia-q14",
    "courseId": "nism-xxia",
    "question": "What is the 'High-Water Mark' principle applied to performance fees in PMS agreements?",
    "options": [
      "A rule that performance fee is charged only when the portfolio NAV exceeds the highest previous peak level reached, ensuring the manager is not rewarded twice for recovering lost capital",
      "A flood insurance policy for bank vaults",
      "A cap on the maximum number of shares in a portfolio",
      "A fee charged whenever the market index crosses an all-time high"
    ],
    "correctIndex": 0,
    "explanation": "The high-water mark ensures that the portfolio manager receives performance fees only on net new profits generated above the previous peak portfolio value, protecting client capital from double fees.",
    "topic": "PMS Fee Structures"
  },
  {
    "id": "nism-xxia-q15",
    "courseId": "nism-xxia",
    "question": "In PMS, how are securities held legally, and how does this contrast with Mutual Funds?",
    "options": [
      "In PMS, securities are held directly in the client's own individual Demat account and PAN; in Mutual Funds, securities are pooled and held in the name of the MF Trust",
      "In PMS, the portfolio manager owns the shares permanently",
      "In Mutual Funds, investors own individual stock certificates directly",
      "There is no legal difference between PMS and Mutual Fund holding structures"
    ],
    "correctIndex": 0,
    "explanation": "In PMS, the client retains legal ownership of individual securities in their personal Demat account under their PAN, whereas in a mutual fund, assets belong to the scheme trust.",
    "topic": "Custody & Asset Segregation"
  },
  {
    "id": "nism-cpe-q1",
    "courseId": "nism-cpe-mf",
    "question": "What is the primary objective of the NISM Continuing Professional Education (CPE) program for mutual fund distributors?",
    "options": [
      "To revalidate and renew the expiring NISM Series V-A certification for an additional 3-year term by updating candidates on latest SEBI regulations and market practices",
      "To register a new stockbroking firm with the exchange",
      "To obtain a commercial pilot license",
      "To open an overseas bank account"
    ],
    "correctIndex": 0,
    "explanation": "NISM CPE is a mandatory refresher course enabling certified distributors to renew their certificate and ARN for 3 years prior to expiry through accredited training.",
    "topic": "CPE Compliance & Revalidation"
  },
  {
    "id": "nism-cpe-q2",
    "courseId": "nism-cpe-mf",
    "question": "Under the updated SEBI Master Circular 2024, what is the mandatory nomination requirement for individual mutual fund folios?",
    "options": [
      "Investors must either register up to 3 nominees with percentage allocations or submit a formal declaration to opt out of nomination",
      "Nomination is strictly prohibited for mutual fund folios",
      "Only parents can be registered as nominees",
      "Nominees must hold an active ARN card"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that all individual unit holders must provide nomination details (up to 3 nominees with specified shares) or formally opt out using a prescribed signed declaration.",
    "topic": "Regulatory Updates 2024"
  },
  {
    "id": "nism-cpe-q3",
    "courseId": "nism-cpe-mf",
    "question": "Under the Prevention of Money Laundering Act (PMLA) guidelines, what is Customer Due Diligence (CDD) required for high-risk clients?",
    "options": [
      "Asking the client for a verbal confirmation only",
      "Enhanced Due Diligence (EDD), verifying source of wealth, verifying Politically Exposed Person (PEP) status, and ongoing transaction monitoring",
      "Waiving KYC requirements for high-net-worth clients",
      "Conducting background checks only after 5 years"
    ],
    "correctIndex": 1,
    "explanation": "Under PMLA, reporting entities must perform Enhanced Due Diligence (EDD) for high-risk accounts and PEPs, including verifying source of wealth and funds.",
    "topic": "AML & PMLA Compliance"
  },
  {
    "id": "nism-cpe-q4",
    "courseId": "nism-cpe-mf",
    "question": "What is the SEBI SMART ODR (Online Dispute Resolution) portal designed to facilitate?",
    "options": [
      "Online trading of derivatives",
      "Independent, digital conciliation and arbitration for resolving grievances between investors and regulated market intermediaries",
      "Direct buying of sovereign gold bonds",
      "Applying for IPOs via UPI"
    ],
    "correctIndex": 1,
    "explanation": "SEBI established the SMART ODR platform to harness online conciliation and arbitration for speedy, paperless, and neutral dispute resolution in the securities market.",
    "topic": "Investor Grievance Redressal"
  },
  {
    "id": "nism-cpe-q5",
    "courseId": "nism-cpe-mf",
    "question": "Under SEBI and AMFI guidelines, can a mutual fund distributor pass back any portion of their commission to investors as cash incentives or rebates?",
    "options": [
      "Yes, up to 50% of the commission",
      "No, rebating or passing back commissions in cash or kind to investors is strictly prohibited by SEBI and constitutes a code of conduct violation",
      "Yes, if the client invests more than ₹10 Lakhs",
      "Yes, if written permission is taken from the local bank branch manager"
    ],
    "correctIndex": 1,
    "explanation": "The AMFI Code of Ethics strictly prohibits distributors from rebating commissions or offering cash discounts/gifts to induce investors into mutual fund schemes.",
    "topic": "Code of Ethics & Regulatory Prohibitions"
  },
  {
    "id": "nism-vd-gen-q21",
    "courseId": "nism-vd",
    "question": "What is the primary role of a Specialized Investment Fund (SIF) distributor under SEBI guidelines?",
    "options": [
      "Distributing both standard mutual funds and specialized investment vehicles (including AIF Category I/II/III and private credit funds) to eligible investors",
      "Selling life insurance policies exclusively",
      "Conducting stock market audits for listed corporations",
      "Providing tax return filing software"
    ],
    "correctIndex": 0,
    "explanation": "A SIF distributor is accredited to market complex and specialized investment vehicles alongside mutual funds to eligible and accredited investors.",
    "topic": "SIF Distributor Framework"
  },
  {
    "id": "nism-vd-gen-q22",
    "courseId": "nism-vd",
    "question": "Under SEBI AIF Regulations, 2012, which of the following is categorized as a Category I AIF?",
    "options": [
      "Venture Capital Fund (VCF)",
      "Hedge Fund",
      "Private Equity Fund investing in listed equities",
      "Real Estate debt fund"
    ],
    "correctIndex": 0,
    "explanation": "Category I AIFs include Venture Capital Funds, Angel Funds, Social Venture Funds, and Infrastructure Funds.",
    "topic": "AIF Structure & Categories"
  },
  {
    "id": "nism-vd-gen-q23",
    "courseId": "nism-vd",
    "question": "What is the minimum corpus requirement for an Angel Fund under SEBI AIF Regulations?",
    "options": [
      "₹5 Crores",
      "₹10 Crores",
      "₹20 Crores",
      "₹50 Crores"
    ],
    "correctIndex": 0,
    "explanation": "SEBI AIF regulations specify that an Angel Fund must have a minimum corpus of ₹5 Crores.",
    "topic": "Angel Fund Norms"
  },
  {
    "id": "nism-vd-gen-q24",
    "courseId": "nism-vd",
    "question": "What is the minimum ticket size for an angel investor committing capital to an Angel Fund?",
    "options": [
      "₹10 Lakhs",
      "₹25 Lakhs",
      "₹1 Crore",
      "₹5 Crores"
    ],
    "correctIndex": 1,
    "explanation": "The minimum investment commitment for an angel investor in an Angel Fund is ₹25 Lakhs (compared to ₹1 Crore for regular AIFs).",
    "topic": "Angel Fund Norms"
  },
  {
    "id": "nism-vd-gen-q25",
    "courseId": "nism-vd",
    "question": "In private equity funds, 'J-Curve Effect' refers to:",
    "options": [
      "Initial negative cash flows and valuations due to upfront fees and capital deployment, followed by steep positive returns as portfolio companies mature",
      "A steady linear increase in returns every year",
      "A perpetual loss over the life of the fund",
      "The interest rate trajectory of sovereign debt"
    ],
    "correctIndex": 0,
    "explanation": "The J-Curve reflects early negative cash flow and J-shaped return curve in private equity as management fees and unharvested early investments turn into profitable exits later.",
    "topic": "Private Equity Dynamics"
  },
  {
    "id": "nism-vd-gen-q26",
    "courseId": "nism-vd",
    "question": "What is 'Carried Interest' earned by an AIF fund manager?",
    "options": [
      "A percentage of the fund's net capital gains (typically 20%) paid to the General Partner/Manager after returning capital and the hurdle rate to investors",
      "A fixed monthly salary paid by SEBI",
      "The brokerage commission paid to clearing brokers",
      "Interest paid on margin loans"
    ],
    "correctIndex": 0,
    "explanation": "Carried interest is the performance fee incentive paid to the fund manager only after investors have received their initial capital plus the minimum hurdle rate.",
    "topic": "Carried Interest & Fund Economics"
  },
  {
    "id": "nism-vd-gen-q27",
    "courseId": "nism-vd",
    "question": "What is a 'Catch-Up Clause' in an AIF private placement memorandum (PPM)?",
    "options": [
      "A clause permitting the manager to receive a larger share of profits until their total profit share equals the agreed carried interest percentage once the hurdle rate is cleared",
      "A late payment penalty imposed on unit holders",
      "A regulatory fine for delayed filing",
      "A clause allowing delayed NAV declarations"
    ],
    "correctIndex": 0,
    "explanation": "A catch-up clause allows the GP/manager to receive 50% to 100% of distributions after the hurdle rate until the agreed carried interest split (e.g. 80:20) is restored.",
    "topic": "Carried Interest & Fund Economics"
  },
  {
    "id": "nism-vd-gen-q28",
    "courseId": "nism-vd",
    "question": "Under SEBI rules, what is the maximum number of investors permitted in any scheme of an AIF (other than an Angel Fund)?",
    "options": [
      "50 investors",
      "200 investors",
      "1,000 investors",
      "Unlimited investors"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI AIF Regulations, no scheme of an AIF shall have more than 1,000 investors (Angel Funds can have up to 200 angel investors).",
    "topic": "AIF Investor Ceilings"
  },
  {
    "id": "nism-vd-gen-q29",
    "courseId": "nism-vd",
    "question": "What is the statutory tenure requirement for Category I and Category II AIFs?",
    "options": [
      "They must be close-ended with a minimum tenure of 3 years",
      "They must be open-ended with daily liquidity",
      "They must have a 20-year lock-in",
      "Tenure is decided on a daily basis"
    ],
    "correctIndex": 0,
    "explanation": "Category I and II AIFs are required by law to be close-ended schemes with a minimum statutory tenure of 3 years at the time of launch.",
    "topic": "AIF Scheme Tenures"
  },
  {
    "id": "nism-vd-gen-q30",
    "courseId": "nism-vd",
    "question": "Can Category I and Category II AIFs borrow funds for investment leverage?",
    "options": [
      "No, they cannot borrow funds directly or indirectly for leverage; they can only borrow for meeting temporary operational liquidity needs for up to 30 days",
      "Yes, up to 5 times their net worth",
      "Yes, without any restrictions",
      "Only with RBI Governor approval"
    ],
    "correctIndex": 0,
    "explanation": "SEBI regulations prohibit Cat I & II AIFs from leveraging; borrowing is permitted solely for operational requirements (up to 30 days and max 10% of investable funds).",
    "topic": "Borrowing & Leverage Restrictions"
  },
  {
    "id": "nism-viii-gen-q36",
    "courseId": "nism-viii",
    "question": "What is 'Basis' in the context of futures trading?",
    "options": [
      "Futures Price minus Spot Price (or Spot minus Futures)",
      "The strike price of an option",
      "The brokerage commission charged on trades",
      "The face value of the underlying equity share"
    ],
    "correctIndex": 0,
    "explanation": "Basis is defined as Spot Price minus Futures Price. In a normal contango market, basis is negative; during backwardation, basis is positive.",
    "topic": "Futures Pricing & Basis"
  },
  {
    "id": "nism-viii-gen-q37",
    "courseId": "nism-viii",
    "question": "What happens to the basis of a futures contract as the expiration date approaches?",
    "options": [
      "It fluctuates randomly without bounds",
      "It converges towards zero (Futures Price converges to Spot Price at expiration)",
      "It widens to infinity",
      "It turns strictly negative for all stocks"
    ],
    "correctIndex": 1,
    "explanation": "Basis convergence occurs because at expiration, the futures contract is settled against the spot price, eliminating carrying costs and forcing basis to zero.",
    "topic": "Convergence of Basis"
  },
  {
    "id": "nism-viii-gen-q38",
    "courseId": "nism-viii",
    "question": "What is 'Cash and Carry Arbitrage' in equity derivatives?",
    "options": [
      "Buying the underlying stock in the spot market and selling the overvalued futures contract while borrowing funds to finance the spot purchase until expiration",
      "Withdrawing cash from an ATM to buy options",
      "Selling stock in the spot market and buying physical gold",
      "Trading only during post-market sessions"
    ],
    "correctIndex": 0,
    "explanation": "Cash and carry arbitrage exploits a futures price trading above theoretical cost of carry by buying spot, shorting futures, and locking in risk-free carrying profits.",
    "topic": "Arbitrage Mechanisms"
  },
  {
    "id": "nism-viii-gen-q39",
    "courseId": "nism-viii",
    "question": "What is 'Reverse Cash and Carry Arbitrage'?",
    "options": [
      "Short selling the overvalued spot equity (or borrowing shares via SLB) and buying undervalued futures contracts, investing the sale proceeds at the risk-free rate",
      "Buying calls and puts simultaneously",
      "Borrowing from an NBFC to buy call options",
      "Exchanging futures for physical delivery"
    ],
    "correctIndex": 0,
    "explanation": "Reverse cash and carry arbitrage is triggered when futures trade below theoretical fair value (discount/backwardation), shorting spot and buying futures.",
    "topic": "Arbitrage Mechanisms"
  },
  {
    "id": "nism-viii-gen-q40",
    "courseId": "nism-viii",
    "question": "According to Put-Call Parity for European options, which relationship holds true (where S = Spot, C = Call, P = Put, PV(X) = Present Value of Strike)?",
    "options": [
      "C + PV(X) = P + S",
      "C + P = S + X",
      "C - P = S * X",
      "C / P = S / X"
    ],
    "correctIndex": 0,
    "explanation": "Put-Call Parity states that Fiduciary Call (Long Call + Zero Coupon Bond with face value X) equals Protective Put (Long Put + Underlying Stock): C + PV(X) = P + S.",
    "topic": "Put-Call Parity"
  },
  {
    "id": "nism-viii-gen-q41",
    "courseId": "nism-viii",
    "question": "What does the option Greek 'Delta' represent for a Call option?",
    "options": [
      "The rate of change of option price with respect to a change in the underlying asset's price, bounded between 0 and +1.0 for calls",
      "The volatility of the market",
      "The exchange margin percentage",
      "The interest rate sensitivity"
    ],
    "correctIndex": 0,
    "explanation": "Call Delta measures option price sensitivity to the underlying stock move; it ranges from 0 (deep out of the money) to +1.0 (deep in the money).",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-gen-q42",
    "courseId": "nism-viii",
    "question": "What does 'Delta' equal for an At-The-Money (ATM) call option?",
    "options": [
      "Approximately 0.50 (50%)",
      "Exactly 1.0",
      "Zero",
      "Minus 1.0"
    ],
    "correctIndex": 0,
    "explanation": "An ATM call option has a Delta close to 0.50, meaning the option price moves roughly ₹0.50 for every ₹1.00 move in the underlying stock price.",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-gen-q43",
    "courseId": "nism-viii",
    "question": "What does the option Greek 'Vega' measure?",
    "options": [
      "The sensitivity of the option price to a 1% change in implied volatility of the underlying asset",
      "The effect of elapsed time on the option",
      "The dividend yield of the index",
      "The loan-to-value ratio of the margin"
    ],
    "correctIndex": 0,
    "explanation": "Vega measures the change in option price for a 1% change in implied volatility. Both long calls and long puts have positive Vega.",
    "topic": "Option Greeks"
  },
  {
    "id": "nism-viii-gen-q44",
    "courseId": "nism-viii",
    "question": "What is a 'Protective Put' strategy?",
    "options": [
      "Holding long equity shares and simultaneously buying a Put option on the same stock to cap downside risk",
      "Selling a put option without owning cash",
      "Buying two call options at the same strike",
      "Pledging shares for personal loans"
    ],
    "correctIndex": 0,
    "explanation": "A Protective Put strategy combines long stock with a long put option, establishing a synthetic floor against catastrophic market declines while retaining upside.",
    "topic": "Hedging Strategies"
  },
  {
    "id": "nism-viii-gen-q45",
    "courseId": "nism-viii",
    "question": "What is a 'Covered Call' strategy?",
    "options": [
      "Holding underlying long stock and selling an Out-Of-The-Money Call option against it to generate recurring cash premium income",
      "Buying calls and puts at different expirations",
      "Selling put options without cash margin",
      "Trading futures during earnings week"
    ],
    "correctIndex": 0,
    "explanation": "A Covered Call generates income by selling upside call options against an existing portfolio of shares, trading future upside beyond strike for immediate premium.",
    "topic": "Derivative Strategies"
  },
  {
    "id": "nism-xiii-gen-q11",
    "courseId": "nism-xiii",
    "question": "What is the primary objective of NISM Series XIII Common Derivatives examination?",
    "options": [
      "To establish a comprehensive, single-window qualification across Equity, Currency, Commodity, and Interest Rate derivative segments",
      "To certify chartered accountants in corporate auditing",
      "To license real estate property brokers",
      "To inspect commercial banks on NPA provisioning"
    ],
    "correctIndex": 0,
    "explanation": "Series XIII unified derivative licensing across equity, FX, commodities, and interest rates under SEBI's integrated market framework.",
    "topic": "Common Derivatives Scope"
  },
  {
    "id": "nism-xiii-gen-q12",
    "courseId": "nism-xiii",
    "question": "In Currency Derivatives, which regulatory authority jointly regulates exchange-traded currency markets alongside SEBI?",
    "options": [
      "Reserve Bank of India (RBI)",
      "Insurance Regulatory and Development Authority (IRDAI)",
      "Pension Fund Regulatory and Development Authority (PFRDA)",
      "Insolvency and Bankruptcy Board of India (IBBI)"
    ],
    "correctIndex": 0,
    "explanation": "Exchange-traded currency futures and options are regulated under the joint jurisdiction of SEBI (exchange oversight) and RBI (foreign exchange policy under FEMA).",
    "topic": "Regulatory Framework"
  },
  {
    "id": "nism-xiii-gen-q13",
    "courseId": "nism-xiii",
    "question": "What is the tick size (minimum price movement) for USD-INR currency futures on Indian exchanges?",
    "options": [
      "0.0025 INR (0.25 paise)",
      "1.00 INR",
      "0.05 INR",
      "0.50 INR"
    ],
    "correctIndex": 0,
    "explanation": "The minimum price movement (tick size) for currency futures contracts such as USD-INR is 0.0025 INR (a quarter of a paisa).",
    "topic": "Currency Contract Specifications"
  },
  {
    "id": "nism-xiii-gen-q14",
    "courseId": "nism-xiii",
    "question": "What is 'Conversion Factor' (CF) in 10-Year Government of India Bond Futures?",
    "options": [
      "A mathematical coefficient used to equalize deliverable coupon-bearing bonds of differing maturities and coupons to the standardized 7% notional contract",
      "The currency exchange rate between USD and INR",
      "The broker's clearing commission rate",
      "The income tax deduction factor"
    ],
    "correctIndex": 0,
    "explanation": "Conversion Factors normalize the price of various eligible deliverable GoI securities relative to the hypothetical 7% coupon notional bond at contract expiration.",
    "topic": "Interest Rate Futures"
  },
  {
    "id": "nism-xiii-gen-q15",
    "courseId": "nism-xiii",
    "question": "What does 'Cheapest-to-Deliver' (CTD) bond mean in Interest Rate Futures delivery?",
    "options": [
      "The deliverable bond that minimizes the short position seller's net cost of purchasing and delivering the security against the futures contract",
      "A bond with zero credit rating",
      "The bond with the highest coupon regardless of market price",
      "A bond issued by a distressed municipal corporation"
    ],
    "correctIndex": 0,
    "explanation": "The CTD bond maximizes the delivery payoff or minimizes delivery cost for the short seller among all eligible basket bonds.",
    "topic": "Interest Rate Futures"
  },
  {
    "id": "nism-xiii-gen-q16",
    "courseId": "nism-xiii",
    "question": "In Commodity Futures, what is the role of an 'Electronic Negotiable Warehouse Receipt' (e-NWR)?",
    "options": [
      "A legally recognized digital title representing ownership of physical commodities stored in a WDRA-regulated repository, facilitating delivery and bank financing",
      "A paper bill sent by postal mail",
      "An insurance receipt for shipping containers",
      "A tax clearance certificate"
    ],
    "correctIndex": 0,
    "explanation": "e-NWRs issued via repositories (like CCRL/NERL) represent standardized, digital proof of physical commodity ownership for exchange settlement and bank pledges.",
    "topic": "Commodity Warehousing & e-NWR"
  },
  {
    "id": "nism-xiii-gen-q17",
    "courseId": "nism-xiii",
    "question": "Which of the following commodities is typically cash-settled rather than physically settled on Indian commodity exchanges?",
    "options": [
      "Crude Oil and Natural Gas futures",
      "Soybean futures",
      "Chana futures",
      "Cotton futures"
    ],
    "correctIndex": 0,
    "explanation": "Energy commodities like Crude Oil and Natural Gas contracts on MCX are compulsory cash-settled based on international benchmark settlement prices.",
    "topic": "Commodity Settlement Norms"
  },
  {
    "id": "nism-xiii-gen-q18",
    "courseId": "nism-xiii",
    "question": "What is 'Convenience Yield' in commodity storage and pricing theory?",
    "options": [
      "The non-monetary benefit or operational advantage of physically holding the tangible commodity inventory rather than holding derivative contracts during shortages",
      "A fee charged by banks for convenience UPI transfers",
      "The annual dividend paid by agricultural companies",
      "A subsidy provided by the government to farmers"
    ],
    "correctIndex": 0,
    "explanation": "Convenience yield is the implicit benefit of having physical stock on hand to prevent production interruptions during unexpected supply pinches.",
    "topic": "Commodity Pricing Theory"
  },
  {
    "id": "nism-xiii-gen-q19",
    "courseId": "nism-xiii",
    "question": "What is a 'Calendar Spread' in commodity and equity derivatives?",
    "options": [
      "Simultaneously buying and selling futures contracts on the same underlying asset with different expiration months",
      "Trading exclusively on the first day of each calendar month",
      "Buying options on two completely unrelated stocks",
      "A spread between spot gold and spot silver"
    ],
    "correctIndex": 0,
    "explanation": "A calendar spread exploits price differences across time horizons by holding opposing long and short positions in different contract expiration months.",
    "topic": "Derivative Spread Strategies"
  },
  {
    "id": "nism-xiii-gen-q20",
    "courseId": "nism-xiii",
    "question": "Under SEBI Commodity Derivatives norms, what is the purpose of the 'Client Level Position Limit'?",
    "options": [
      "To prevent market manipulation, hoarding, and excessive speculative concentration by any single participant in physical commodities",
      "To maximize trading fees collected by the exchange",
      "To guarantee 100% profits for hedgers",
      "To restrict trading only to institutional banks"
    ],
    "correctIndex": 0,
    "explanation": "SEBI imposes strict individual and member position limits to prevent market abuse, cornering of deliverable supplies, and artificial price distortions.",
    "topic": "Position Limits & Surveillance"
  },
  {
    "id": "nism-xa-gen-q21",
    "courseId": "nism-xa",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013, can an individual RIA also be a director or partner in a mutual fund distribution firm?",
    "options": [
      "No, an individual RIA cannot provide distribution services or hold directorship/partnership in a distributing entity under client segregation rules",
      "Yes, provided they pay an additional fee to SEBI",
      "Yes, if the client signs an informal email waiver",
      "Yes, with permission from the local police station"
    ],
    "correctIndex": 0,
    "explanation": "SEBI regulations prohibit individual investment advisers from holding distribution licenses or partnering with distributors, maintaining absolute segregation.",
    "topic": "SEBI RIA Regulations"
  },
  {
    "id": "nism-xa-gen-q22",
    "courseId": "nism-xa",
    "question": "What is the minimum net worth requirement for a corporate / body corporate entity seeking registration as a SEBI Registered Investment Adviser?",
    "options": [
      "₹50 Lakhs",
      "₹1 Crore",
      "₹5 Crores",
      "₹10 Lakhs"
    ],
    "correctIndex": 0,
    "explanation": "Under amended SEBI RIA Regulations, non-individual (corporate) investment advisers must maintain a minimum net worth of ₹50 Lakhs (individuals require ₹5 Lakhs).",
    "topic": "RIA Registration Criteria"
  },
  {
    "id": "nism-xa-gen-q23",
    "courseId": "nism-xa",
    "question": "What is the mandatory cooling-off period if an existing RIA wishes to surrender their advisory license and register as a mutual fund distributor?",
    "options": [
      "No cooling-off period is required",
      "A cooling-off period of 6 months is required",
      "3 years",
      "10 years"
    ],
    "correctIndex": 1,
    "explanation": "SEBI guidelines require a mandatory cooling-off period of at least 6 months when switching between RIA registration and intermediary distribution roles.",
    "topic": "Transition & Cooling-Off Norms"
  },
  {
    "id": "nism-xa-gen-q24",
    "courseId": "nism-xa",
    "question": "In client risk profiling, an investor who has stable high income, owns their home, has no loans, and plans to retire in 25 years has:",
    "options": [
      "High Risk Capacity and potential for high equity allocation",
      "Low Risk Capacity",
      "Zero ability to absorb market fluctuations",
      "Mandatory requirement to hold 100% cash"
    ],
    "correctIndex": 0,
    "explanation": "Young age, long horizon, absence of liabilities, and steady surplus give this investor high objective risk capacity to withstand market cycles.",
    "topic": "Client Profiling & Suitability"
  },
  {
    "id": "nism-xa-gen-q25",
    "courseId": "nism-xa",
    "question": "Under SEBI regulations, how long must an Investment Adviser maintain records of client risk profiling, advisory agreements, and suitability assessments?",
    "options": [
      "At least 5 years",
      "1 year",
      "Only until the client pays the fee",
      "10 years"
    ],
    "correctIndex": 0,
    "explanation": "Regulation 19 of SEBI RIA Regulations mandates that advisers must maintain all client records, investment advice provided, and agreements for at least 5 years.",
    "topic": "Record Keeping & Retention"
  },
  {
    "id": "nism-xa-gen-q26",
    "courseId": "nism-xa",
    "question": "What is the Capital Asset Pricing Model (CAPM) formula for expected return of an asset?",
    "options": [
      "Expected Return = Rf + Beta * (Rm - Rf)",
      "Expected Return = Spot Price / P/E Ratio",
      "Expected Return = Dividend Yield + Inflation",
      "Expected Return = Debt / Equity * Beta"
    ],
    "correctIndex": 0,
    "explanation": "CAPM defines Expected Return as the Risk-Free Rate (Rf) plus the product of Beta and the Market Risk Premium (Rm - Rf).",
    "topic": "Modern Portfolio Theory"
  },
  {
    "id": "nism-xa-gen-q27",
    "courseId": "nism-xa",
    "question": "What does 'Sharpe Ratio' measure in portfolio performance analysis?",
    "options": [
      "Excess return earned per unit of total risk (Standard Deviation): (Portfolio Return - Risk Free Rate) / Standard Deviation",
      "Total dividend received per share",
      "The percentage of trading days with positive returns",
      "The turnover ratio of portfolio stocks"
    ],
    "correctIndex": 0,
    "explanation": "The Sharpe Ratio evaluates risk-adjusted return by dividing the portfolio's excess return over the risk-free benchmark by its standard deviation.",
    "topic": "Portfolio Risk Metrics"
  },
  {
    "id": "nism-xa-gen-q28",
    "courseId": "nism-xa",
    "question": "In personal tax planning, what is the maximum deduction allowed for health insurance premium for senior citizen parents under Section 80D?",
    "options": [
      "₹50,000",
      "₹25,000",
      "₹1,00,000",
      "₹15,000"
    ],
    "correctIndex": 0,
    "explanation": "Under Section 80D of the Income Tax Act, deduction up to ₹50,000 per financial year is available for health insurance premiums paid for senior citizen parents.",
    "topic": "Tax Planning & Deductions"
  },
  {
    "id": "nism-xa-gen-q29",
    "courseId": "nism-xa",
    "question": "What is the maximum investment limit per financial year in Public Provident Fund (PPF)?",
    "options": [
      "₹1,50,000",
      "₹2,50,000",
      "₹5,00,000",
      "Unlimited"
    ],
    "correctIndex": 0,
    "explanation": "The statutory maximum contribution permitted in a Public Provident Fund (PPF) account is ₹1.5 Lakhs per financial year under government rules.",
    "topic": "Small Savings Schemes"
  },
  {
    "id": "nism-xa-gen-q30",
    "courseId": "nism-xa",
    "question": "What is 'Systematic Withdrawal Plan' (SWP) tax treatment post Budget 2024?",
    "options": [
      "Each SWP installment is treated as a partial redemption of capital and capital gains, with the capital gains portion taxed as STCG or LTCG based on holding period",
      "SWP is subject to flat 30% TDS regardless of amount",
      "SWP is completely tax-free under Section 10(10D)",
      "SWP is taxed as salary income"
    ],
    "correctIndex": 0,
    "explanation": "SWP redemptions are taxed on a First-In-First-Out (FIFO) capital gains basis: each withdrawal consists of principal return (tax-free) and capital gain (taxed per holding period).",
    "topic": "Taxation of Redemptions"
  },
  {
    "id": "nism-xb-gen-q11",
    "courseId": "nism-xb",
    "question": "In estate planning, what is a 'Probate' of a Will?",
    "options": [
      "A court-issued legal certificate under the seal of a competent civil court certifying the genuineness and validity of the Will and executor's authority",
      "A tax notice issued by the Income Tax Department",
      "An insurance claim document",
      "A receipt for property stamp duty"
    ],
    "correctIndex": 0,
    "explanation": "Probate is the official court decree validating a Will and confirming the executor's legal power to administer the deceased testator's estate.",
    "topic": "Estate Planning & Wills"
  },
  {
    "id": "nism-xb-gen-q12",
    "courseId": "nism-xb",
    "question": "What is the legal implication of creating an 'Irrevocable Discretionary Private Trust' in India?",
    "options": [
      "The settlor permanently gives up ownership, the trustee has discretion on timing and amount of distribution to beneficiaries, and trust assets are shielded from beneficiaries' future creditors",
      "The settlor can cancel the trust at any time and take back the assets",
      "The trust is exempt from all corporate and individual tax forever",
      "The trust must be listed on the National Stock Exchange"
    ],
    "correctIndex": 0,
    "explanation": "In an irrevocable discretionary trust, assets are separated from the settlor and beneficiaries lack fixed rights to distributions, offering maximum creditor protection.",
    "topic": "Estate Planning & Private Trusts"
  },
  {
    "id": "nism-xb-gen-q13",
    "courseId": "nism-xb",
    "question": "Under behavioral finance, what is 'Anchoring Bias'?",
    "options": [
      "Fixating on a specific piece of historical information (such as purchase price or 52-week high) when making subsequent investment decisions, even when new fundamentals change",
      "Holding ships in a harbor",
      "Diversifying equally across all sectors",
      "Setting stop-loss orders on all trades"
    ],
    "correctIndex": 0,
    "explanation": "Anchoring bias causes an investor to over-rely on initial reference figures (e.g. initial buy price) instead of objective current valuations.",
    "topic": "Behavioral Biases"
  },
  {
    "id": "nism-xb-gen-q14",
    "courseId": "nism-xb",
    "question": "What does the 'Sortino Ratio' measure, and how does it differ from the Sharpe Ratio?",
    "options": [
      "It measures excess return divided solely by Downside Deviation, penalizing only negative volatility rather than total volatility",
      "It measures turnover ratio divided by dividend yield",
      "It uses Beta instead of Standard Deviation",
      "It is identical in every way to the Sharpe Ratio"
    ],
    "correctIndex": 0,
    "explanation": "While Sharpe penalizes all volatility (both upside and downside), Sortino divides excess return only by downside semi-deviation, focusing on harmful downside risk.",
    "topic": "Portfolio Performance Evaluation"
  },
  {
    "id": "nism-xb-gen-q15",
    "courseId": "nism-xb",
    "question": "What is 'Tracking Error' in index fund and passive portfolio management?",
    "options": [
      "The annualized standard deviation of the difference in returns between the portfolio and its underlying benchmark index",
      "A computer software glitch in trade execution",
      "The total expense ratio charged by the AMC",
      "The delay in physical delivery of shares"
    ],
    "correctIndex": 0,
    "explanation": "Tracking error measures the volatility of active return: standard deviation of (Portfolio Return - Benchmark Return), indicating how closely the fund replicates its index.",
    "topic": "Portfolio Performance Evaluation"
  },
  {
    "id": "nism-xb-gen-q16",
    "courseId": "nism-xb",
    "question": "In retirement planning, what percentage of the accumulated pension corpus can be withdrawn tax-free as a lump-sum upon reaching age 60 under NPS Tier 1?",
    "options": [
      "Up to 60% of the corpus can be commuted tax-free; the remaining minimum 40% must be used to purchase an annuity",
      "100% tax-free lump sum",
      "Zero, 100% must be annuitized",
      "Up to 25% only"
    ],
    "correctIndex": 0,
    "explanation": "Under PFRDA regulations, an NPS Tier 1 subscriber can withdraw up to 60% of the accumulated corpus tax-free upon maturity, with at least 40% annuitized.",
    "topic": "Retirement Planning & NPS"
  },
  {
    "id": "nism-xb-gen-q17",
    "courseId": "nism-xb",
    "question": "What is the primary difference between a 'Defined Benefit' (DB) pension plan and a 'Defined Contribution' (DC) pension plan?",
    "options": [
      "DB guarantees a predetermined retirement payout based on salary and tenure, with investment risk borne by the employer; DC specifies fixed contributions, with retirement payout and investment risk borne by the employee",
      "DB is for corporate executives only; DC is for farmers",
      "DB has no tax benefits; DC has full exemption",
      "DB permits daily withdrawals; DC locks funds forever"
    ],
    "correctIndex": 0,
    "explanation": "In DB plans (like old pension scheme), the employer guarantees the retirement pension; in DC plans (like NPS/EPF), the employee bears the investment risk.",
    "topic": "Retirement Planning & Solutions"
  },
  {
    "id": "nism-xb-gen-q18",
    "courseId": "nism-xb",
    "question": "Under Section 54EC of the Income Tax Act, an investor can claim capital gains tax exemption on long-term capital gains from real estate by investing in specified bonds (REC, PFC, NHAI) up to a maximum limit of:",
    "options": [
      "₹50 Lakhs per financial year within 6 months of transfer",
      "₹1 Crore",
      "₹25 Lakhs",
      "Unlimited investment"
    ],
    "correctIndex": 0,
    "explanation": "Section 54EC allows exemption up to ₹50 Lakhs per financial year by investing in specified infrastructure capital gains bonds within 6 months of property transfer.",
    "topic": "Tax Exemption Framework"
  },
  {
    "id": "nism-xb-gen-q19",
    "courseId": "nism-xb",
    "question": "What is 'Overconfidence Bias' in investment decision making?",
    "options": [
      "The tendency of investors to overestimate their financial knowledge, predictive accuracy, and ability to control market outcomes, leading to excessive trading and inadequate diversification",
      "Being confident that bank deposits will be safe",
      "Checking stock prices once a week",
      "Investing solely in index funds"
    ],
    "correctIndex": 0,
    "explanation": "Overconfidence causes investors to misjudge risk, underestimate market uncertainty, and trade too frequently, resulting in substandard net returns.",
    "topic": "Behavioral Biases"
  },
  {
    "id": "nism-xb-gen-q20",
    "courseId": "nism-xb",
    "question": "What is 'Asset-Liability Matching' (ALM) in institutional and high-net-worth portfolio advisory?",
    "options": [
      "Structuring the cash flows, maturities, and liquidity profiles of investment assets to coincide precisely with the timing and magnitudes of future client liabilities and commitments",
      "Borrowing from credit cards to invest in equities",
      "Balancing ledger accounts at the end of the day",
      "Pledging assets to secure real estate mortgages"
    ],
    "correctIndex": 0,
    "explanation": "ALM ensures that an investor or institution holds adequate liquid and maturing assets matching their time-specific future debt obligations and spending commitments.",
    "topic": "Wealth Management & ALM"
  },
  {
    "id": "nism-xv-gen-q21",
    "courseId": "nism-xv",
    "question": "What is the statutory requirement under SEBI (Research Analysts) Regulations, 2014 regarding personal shareholding disclosure in a research report?",
    "options": [
      "The research analyst and research entity must disclose if they hold 1% or more financial interest in the subject company as on the date of publication",
      "They are strictly barred from publishing any disclosures",
      "They only need to disclose if they hold 51% majority control",
      "Disclosures are optional at the analyst's discretion"
    ],
    "correctIndex": 0,
    "explanation": "SEBI RA Regulations mandate explicit disclosure of whether the analyst, entity, or associates hold 1% or more beneficial ownership in the target company.",
    "topic": "SEBI Research Analyst Regulations"
  },
  {
    "id": "nism-xv-gen-q22",
    "courseId": "nism-xv",
    "question": "Under SEBI RA Regulations, can a research analyst trade against their own published recommendation within 30 days of report publication?",
    "options": [
      "No, research analysts are strictly prohibited from trading against their own recommendation or in a manner contrary to their research views within 30 days",
      "Yes, provided they do it on an overseas stock exchange",
      "Yes, if they need personal emergency cash",
      "Yes, without any restrictions"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that research analysts cannot execute personal trades contrary to their published recommendations for a period of 30 days from publication.",
    "topic": "Code of Conduct & Personal Trading"
  },
  {
    "id": "nism-xv-gen-q23",
    "courseId": "nism-xv",
    "question": "In equity valuation, what is Enterprise Value (EV)?",
    "options": [
      "Market Capitalization + Total Debt + Minority Interest + Preferred Stock - Cash and Cash Equivalents",
      "Total Revenue minus Total Expenses",
      "Current share price multiplied by total employees",
      "Net Worth divided by Book Value"
    ],
    "correctIndex": 0,
    "explanation": "Enterprise Value reflects the total economic takeover value of a firm, calculated as Market Cap plus Debt minus Cash & Liquid Investments.",
    "topic": "Valuation Metrics"
  },
  {
    "id": "nism-xv-gen-q24",
    "courseId": "nism-xv",
    "question": "Why is the EV/EBITDA multiple preferred over the Price-to-Earnings (P/E) ratio when comparing capital-intensive companies with differing capital structures and tax rates?",
    "options": [
      "Because EBITDA is independent of capital structure (debt vs equity financing), depreciation policies, and income tax variations, providing a clean operational comparison",
      "Because EV/EBITDA is always a smaller number than P/E",
      "Because EBITDA includes extraordinary non-operating income",
      "Because P/E ratios are illegal under SEBI guidelines"
    ],
    "correctIndex": 0,
    "explanation": "EV/EBITDA eliminates distortions caused by differences in debt leverage, depreciation accounting, and jurisdictional tax rates across competing firms.",
    "topic": "Valuation Metrics"
  },
  {
    "id": "nism-xv-gen-q25",
    "courseId": "nism-xv",
    "question": "In Michael Porter's Five Forces model for industry analysis, which force evaluates the bargaining leverage that consumers have over product pricing?",
    "options": [
      "Bargaining Power of Buyers",
      "Threat of New Entrants",
      "Bargaining Power of Suppliers",
      "Threat of Substitute Products"
    ],
    "correctIndex": 0,
    "explanation": "Bargaining Power of Buyers measures the ability of customers to drive down prices, demand higher quality, or switch to competitors.",
    "topic": "Industry Analysis"
  },
  {
    "id": "nism-xv-gen-q26",
    "courseId": "nism-xv",
    "question": "What does the 'Current Ratio' measure in financial statement analysis?",
    "options": [
      "Short-term liquidity: Current Assets divided by Current Liabilities",
      "Long-term solvency: Total Debt divided by Equity",
      "Profitability: Net Profit divided by Net Sales",
      "Operating efficiency: Inventory divided by COGS"
    ],
    "correctIndex": 0,
    "explanation": "The Current Ratio evaluates short-term liquidity by comparing current assets (convertible to cash within 1 year) against obligations due within 1 year.",
    "topic": "Financial Statement Analysis"
  },
  {
    "id": "nism-xv-gen-q27",
    "courseId": "nism-xv",
    "question": "What does Return on Capital Employed (ROCE) measure?",
    "options": [
      "Operating Profit (EBIT) divided by Total Capital Employed (Total Assets minus Current Liabilities), reflecting efficiency of capital deployment",
      "Net profit divided by dividend payments",
      "Market price divided by book value",
      "Cash generated from financing activities"
    ],
    "correctIndex": 0,
    "explanation": "ROCE measures how effectively a company generates operating profits from all the capital invested into the business by both debt holders and equity shareholders.",
    "topic": "Financial Statement Analysis"
  },
  {
    "id": "nism-xv-gen-q28",
    "courseId": "nism-xv",
    "question": "In macroeconomic analysis, what is 'Core Inflation'?",
    "options": [
      "Headline inflation excluding volatile components such as food and energy prices to reveal underlying medium-term price trends",
      "The inflation rate measured exclusively inside bank branches",
      "The annual percentage rise in real estate rents",
      "The inflation rate of technology software"
    ],
    "correctIndex": 0,
    "explanation": "Core inflation strips out volatile food and fuel prices, providing monetary authorities like the RBI with a stable measure of structural demand-driven price pressures.",
    "topic": "Macroeconomic Analysis"
  },
  {
    "id": "nism-xv-gen-q29",
    "courseId": "nism-xv",
    "question": "What does an inverted yield curve (where short-term bond yields are higher than long-term bond yields) traditionally signal to research analysts?",
    "options": [
      "An impending economic slowdown or recession as markets anticipate future central bank rate cuts",
      "A booming economic expansion with high inflation",
      "A surge in foreign institutional equity investments",
      "A sudden strengthening of the domestic currency"
    ],
    "correctIndex": 0,
    "explanation": "Yield curve inversion is a classic leading indicator of recession; investors lock into long-term bonds expecting economic deceleration and lower future rates.",
    "topic": "Economic & Bond Market Analysis"
  },
  {
    "id": "nism-xv-gen-q30",
    "courseId": "nism-xv",
    "question": "What is 'DuPont Analysis' in financial equity research?",
    "options": [
      "Decomposing Return on Equity (ROE) into three distinct components: Net Profit Margin (profitability) * Asset Turnover (operating efficiency) * Financial Leverage (equity multiplier)",
      "A chemical manufacturing process",
      "A technical charting pattern on candlestick charts",
      "A method of calculating brokerage commissions"
    ],
    "correctIndex": 0,
    "explanation": "DuPont analysis breaks down ROE to identify whether a company's return is driven by high profit margins, efficient asset utilization, or aggressive debt leverage.",
    "topic": "Financial Statement Analysis"
  },
  {
    "id": "nism-xxia-gen-q21",
    "courseId": "nism-xxia",
    "question": "Under SEBI (Portfolio Managers) Regulations, 2020, what is the minimum net worth requirement for a registered Portfolio Manager?",
    "options": [
      "₹5 Crores",
      "₹2 Crores",
      "₹1 Crore",
      "₹10 Crores"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that an entity registered as a Portfolio Manager must maintain a minimum net worth of ₹5 Crores at all times.",
    "topic": "SEBI PMS Regulations"
  },
  {
    "id": "nism-xxia-gen-q22",
    "courseId": "nism-xxia",
    "question": "What is the 'Disclosure Document' (Form C) provided by a Portfolio Manager to prospective clients prior to agreement signing?",
    "options": [
      "A comprehensive regulatory document detailing PMS history, investment strategies, performance track record, fee schedules, and pending litigation",
      "A marketing brochure with guaranteed profit claims",
      "A bank account opening letter",
      "An insurance policy document"
    ],
    "correctIndex": 0,
    "explanation": "Under Regulation 22, the Disclosure Document gives investors transparent, verified information on the manager's strategies, risks, fees, and past performance.",
    "topic": "Disclosure Document & Form C"
  },
  {
    "id": "nism-xxia-gen-q23",
    "courseId": "nism-xxia",
    "question": "How frequently must a Portfolio Manager provide detailed activity, transaction, and portfolio valuation statements to PMS clients?",
    "options": [
      "At least once every three months (quarterly), or monthly if requested",
      "Once every 5 years",
      "Only when the client explicitly issues a legal notice",
      "Annually at the Annual General Meeting"
    ],
    "correctIndex": 0,
    "explanation": "SEBI regulations mandate that portfolio managers provide reports to clients at least on a quarterly basis, detailing portfolio assets, transactions, and fees charged.",
    "topic": "Client Reporting & Statements"
  },
  {
    "id": "nism-xxia-gen-q24",
    "courseId": "nism-xxia",
    "question": "In PMS operations, what is the role of an independent 'Custodian'?",
    "options": [
      "To safe-keep client securities, maintain independent demat and bank accounts, and settle trades under the instructions of the portfolio manager",
      "To market PMS schemes across rural areas",
      "To audit the client's personal income tax returns",
      "To lend money to the portfolio manager"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates appointment of an independent, regulated custodian for safekeeping of client funds and securities to prevent misappropriation.",
    "topic": "Custody & Settlement"
  },
  {
    "id": "nism-xxia-gen-q25",
    "courseId": "nism-xxia",
    "question": "Under SEBI regulations, can a Portfolio Manager invest client funds in unlisted securities?",
    "options": [
      "Yes, but only in discretionary and non-discretionary PMS up to a maximum aggregate limit of 25% of the client's portfolio in unlisted securities",
      "No, zero percent unlisted investment is allowed",
      "Yes, 100% of the portfolio can be in unlisted shares",
      "Only if the client is a foreign citizen"
    ],
    "correctIndex": 0,
    "explanation": "SEBI permits investment in unlisted securities up to a maximum cap of 25% of the client's AUM under prudent risk diversification norms.",
    "topic": "PMS Investment Restrictions"
  },
  {
    "id": "nism-xxia-gen-q26",
    "courseId": "nism-xxia",
    "question": "What is the primary reason why Time-Weighted Rate of Return (TWRR) is mandated over Internal Rate of Return (IRR) for reporting PMS manager performance?",
    "options": [
      "TWRR eliminates the distorting effects of client cash deposits and withdrawals, measuring solely the manager's investment skill",
      "TWRR always produces a higher percentage return than IRR",
      "IRR is mathematically impossible to calculate on computers",
      "TWRR is required by the Income Tax Department for GST calculation"
    ],
    "correctIndex": 0,
    "explanation": "Since the timing and size of capital injections and withdrawals are controlled by the client, TWRR isolates the manager's true investment compounding ability.",
    "topic": "Performance Reporting & Metrics"
  },
  {
    "id": "nism-xxia-gen-q27",
    "courseId": "nism-xxia",
    "question": "Can a Portfolio Manager promise or guarantee fixed returns to a PMS client under SEBI regulations?",
    "options": [
      "No, SEBI strictly prohibits portfolio managers from promising, assuring, or indicating any guaranteed returns to clients",
      "Yes, if backed by an insurance policy",
      "Yes, up to 15% annual return",
      "Yes, if the client invests more than ₹10 Crores"
    ],
    "correctIndex": 0,
    "explanation": "Regulation 24(2) explicitly prohibits portfolio managers from guaranteeing or indicating guaranteed returns on any PMS product.",
    "topic": "Code of Conduct & Prohibitions"
  },
  {
    "id": "nism-xxia-gen-q28",
    "courseId": "nism-xxia",
    "question": "Under the SEBI PMS fee framework, how are distributor commissions paid for sourcing PMS clients?",
    "options": [
      "Only through a trail commission model out of the management fee; upfront commissions are strictly prohibited",
      "Full 5% upfront commission on day one",
      "Cash payment directly from client to distributor",
      "No commission is permitted under any circumstances"
    ],
    "correctIndex": 0,
    "explanation": "SEBI banned all upfront commissions in PMS distribution: distributors can only receive ongoing trail-based compensation deducted from management fees.",
    "topic": "Distributor Commission Norms"
  },
  {
    "id": "nism-xxia-gen-q29",
    "courseId": "nism-xxia",
    "question": "What is a 'Model Portfolio' in PMS operations?",
    "options": [
      "A standardized investment basket created by the research team representing an approved strategy, which is replicated across individual client accounts based on their mandates",
      "A portfolio created by fashion models",
      "A demonstration account with monopoly money",
      "An index ETF managed by a mutual fund"
    ],
    "correctIndex": 0,
    "explanation": "Model portfolios represent the institutional target allocations of a strategy; trades are proportionately executed across client accounts following that model.",
    "topic": "Portfolio Execution"
  },
  {
    "id": "nism-xxia-gen-q30",
    "courseId": "nism-xxia",
    "question": "What is the statutory requirement for auditing of client PMS accounts by an independent Chartered Accountant?",
    "options": [
      "An annual audit of each client's portfolio accounts must be conducted by an independent CA, and the report submitted to the client and SEBI",
      "Audit is only required if the client incurs a loss",
      "Audits are conducted once every 10 years",
      "Audits are conducted exclusively by RBI officials"
    ],
    "correctIndex": 0,
    "explanation": "SEBI regulations mandate an annual audit of individual client portfolio accounts by an independent practicing Chartered Accountant.",
    "topic": "Audit & Regulatory Compliance"
  },
  {
    "id": "nism-cpe-mf-gen-q6",
    "courseId": "nism-cpe-mf",
    "question": "What is the validity period of an initial NISM Series V-A Mutual Fund Distributors Certification, and how is it extended via CPE?",
    "options": [
      "Valid for 3 years from the date of examination; completing an approved 1-day CPE program prior to expiry extends certification for another 3 years",
      "Valid for lifetime with no renewal required",
      "Valid for 6 months only",
      "Valid for 10 years"
    ],
    "correctIndex": 0,
    "explanation": "NISM Series V-A certification is valid for 3 years. Candidates must complete a NISM CPE training session within 12 months prior to certificate expiration.",
    "topic": "CPE Revalidation Norms"
  },
  {
    "id": "nism-cpe-mf-gen-q7",
    "courseId": "nism-cpe-mf",
    "question": "Under the updated SEBI guidelines, what is Central KYC (CKYC) registry administered by CERSAI?",
    "options": [
      "A centralized repository storing verified digital KYC records of financial consumers, allowing one-time KYC verification across all SEBI, RBI, IRDAI, and PFRDA entities",
      "A national credit rating bureau",
      "A taxation database for GST returns",
      "A blacklist registry of loan defaulters"
    ],
    "correctIndex": 0,
    "explanation": "CKYC eliminates redundant document collection by storing verified records under a 14-digit CKYC number usable across all financial intermediaries.",
    "topic": "KYC & AML Compliance"
  },
  {
    "id": "nism-cpe-mf-gen-q8",
    "courseId": "nism-cpe-mf",
    "question": "Under SEBI regulations, what is the consequence of failing to link PAN with Aadhaar for mutual fund investments?",
    "options": [
      "The PAN becomes inoperative, leading to blocking of mutual fund transactions, higher TDS deductions, and rejection of fresh purchase and SIP orders",
      "The investor is arrested by local police",
      "The mutual fund units are confiscated by the AMC",
      "No consequence, transactions continue normally"
    ],
    "correctIndex": 0,
    "explanation": "An inoperative PAN due to non-linkage with Aadhaar prevents compliance with KYC laws, halting fresh investments, SIP installments, and redemptions.",
    "topic": "Statutory Compliance & PAN"
  },
  {
    "id": "nism-cpe-mf-gen-q9",
    "courseId": "nism-cpe-mf",
    "question": "What is the role of the Association of Mutual Funds in India (AMFI) in distributor regulation?",
    "options": [
      "Issuing AMFI Registration Numbers (ARN), maintaining the distributor code of conduct, and enforcing disciplinary actions for unethical selling practices",
      "Regulating monetary policy and repo rates",
      "Managing commercial real estate properties",
      "Printing sovereign currency notes"
    ],
    "correctIndex": 0,
    "explanation": "AMFI is the apex industry body that issues ARN cards, enforces the AMFI Code of Ethics, and coordinates with SEBI for orderly distribution growth.",
    "topic": "Industry Structure & AMFI"
  },
  {
    "id": "nism-cpe-mf-gen-q10",
    "courseId": "nism-cpe-mf",
    "question": "What is the maximum timeline prescribed by SEBI for processing mutual fund redemptions in standard open-ended schemes?",
    "options": [
      "Within 2 working days (T+2) for equity schemes and T+1 for liquid schemes",
      "Within 30 calendar days",
      "Within 12 hours of placing the order",
      "Redemptions can be delayed indefinitely without notice"
    ],
    "correctIndex": 0,
    "explanation": "SEBI amended mutual fund redemption transfer timelines to T+2 working days for general schemes and T+1 for liquid/overnight schemes to protect investor liquidity.",
    "topic": "Operational Turnaround Times"
  }
];
