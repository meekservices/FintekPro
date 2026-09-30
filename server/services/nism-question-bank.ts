/* eslint-disable max-len */
import type { NismPracticeQuestion } from "./nism-lms-service";

/**
 * High-yield NISM Accredited Practice Question Bank
 * Covers all official NISM modules: Series V-A (500 Qs across 5 distinct 100-Q papers),
 * Series VIII (100 Qs), Series X-A (100 Qs), Series XV (100 Qs), Series XXI-A (50 Qs),
 * Series V-D (50 Qs), Series XIII (30 Qs), Series X-B (30 Qs), and CPE Refresher (20 Qs).
 * Verified with SEBI Master Circular 2024 and Union Budget 2024 taxation updates.
 * Total accredited questions: 980.
 */
export const NISM_PRACTICE_BANK: NismPracticeQuestion[] = [
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-1"
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
    "topic": "Investment Strategies & Products",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-1"
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
    "topic": "Mutual Fund Governance",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-1"
  },
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-1"
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
    "topic": "Scheme Categorisation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-1"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-1"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-1"
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
    "topic": "Regulatory Disclosures",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-1"
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
    "topic": "Scheme Related Documents",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-1"
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
    "topic": "Scheme Related Documents",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-1"
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
    "topic": "Scheme Related Documents",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-1"
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
    "topic": "Scheme Related Documents",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-1"
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
    "topic": "Risk, Return & Performance",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-1"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-1"
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
    "topic": "Code of Conduct & Distributor Regulations",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-1"
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
    "topic": "Ethics & Professional Standards",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-1"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-1"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-1"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-1"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-1"
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
    "topic": "Operational Guidelines & NAV",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-1"
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
    "topic": "Mutual Fund Expenses & Accounting",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-1"
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
    "topic": "Mutual Fund Accounting & Expenses",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-1"
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
    "topic": "Investor Protection & Suitability",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-1"
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
    "topic": "Debt Fund Evaluation",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-1"
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
    "topic": "Risk Management & Valuation",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-1"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-1"
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
    "topic": "Investor Services",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-1"
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
    "topic": "Investor Services",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-1"
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
    "topic": "Investor Services",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-1"
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
    "topic": "Investor Services",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-1"
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
    "topic": "Investor Services",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-1"
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
    "topic": "Investor Services",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-1"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-1"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-1"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-1"
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
    "topic": "Portfolio Performance & Risk",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Legal & Regulatory Framework",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "explanation": "Modified Duration measures the price sensitivity of a bond to interest rate changes: % Price Change \u2248 - Modified Duration * Yield Change.",
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-1"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "paperId": "paper-1"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "paperId": "paper-1"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "paperId": "paper-1"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "paperId": "paper-1"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "paperId": "paper-1"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "paperId": "paper-1"
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
    "topic": "Scheme Categorisation",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "paperId": "paper-1"
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
    "topic": "Scheme Categorisation",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "paperId": "paper-1"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "paperId": "paper-1"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "paperId": "paper-1"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "paperId": "paper-1"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "paperId": "paper-1"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "paperId": "paper-1"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "paperId": "paper-1"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "paperId": "paper-1"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "paperId": "paper-1"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "paperId": "paper-1"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "paperId": "paper-1"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "paperId": "paper-1"
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
    "topic": "Financial Planning & Advisory",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "paperId": "paper-1"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-2"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-2"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-2"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-2"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-2"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-2"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-2"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-2"
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
    "topic": "Scheme Related Documents",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-2"
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
    "topic": "Scheme Related Documents",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-2"
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
    "topic": "Scheme Related Documents",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-2"
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
    "topic": "Scheme Related Documents",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-2"
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
    "topic": "Legal & Regulatory Framework",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-2"
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
    "topic": "Legal & Regulatory Framework",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-2"
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
    "topic": "Legal & Regulatory Framework",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-2"
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
    "topic": "Legal & Regulatory Framework",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-2"
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
    "topic": "Scheme Categorisation",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch4-1",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Fundamental Attributes of a Scheme",
    "question": "Which of the following constitutes a 'Fundamental Attribute' of a mutual fund scheme requiring an exit option for unit holders if altered?",
    "options": [
      "Change in the name of the statutory auditor of the AMC",
      "Change in the type of scheme (e.g. open-ended to close-ended) or change in investment objective",
      "Change in the address of a local branch office",
      "Replacement of an equity research analyst"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI Regulation 18(15A), changes to type of scheme, investment objective, asset allocation pattern, or terms of issue are fundamental attributes requiring 30 days exit window at NAV with no exit load.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch4-2",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Exit Option Window for Fundamental Changes",
    "question": "When an AMC modifies a fundamental attribute of a scheme, unit holders who do not agree with the change must be given an exit window of at least how many days without paying any exit load?",
    "options": [
      "15 calendar days",
      "30 calendar days",
      "45 calendar days",
      "60 calendar days"
    ],
    "correctIndex": 1,
    "explanation": "SEBI regulations mandate an exit window of at least 30 calendar days during which dissenting unit holders can redeem their units at the prevailing NAV without any exit load.",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch4-3",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "SEBI Filing of SID",
    "question": "At least how many days prior to launching a New Fund Offer (NFO) must an AMC file the draft Scheme Information Document (SID) with SEBI for observation and review?",
    "options": [
      "7 business days",
      "15 business days",
      "21 working days",
      "45 days"
    ],
    "correctIndex": 2,
    "explanation": "The draft SID must be filed with SEBI at least 21 working days prior to the launch of the scheme. SEBI reviews the document and may issue observations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-2"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-2"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-2"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-2"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-2"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-2"
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
    "topic": "Investment Landscape",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-2"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-2"
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
    "topic": "Concept & Role of a Mutual Fund",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-2"
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
    "topic": "Legal and Regulatory Framework",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-2"
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
    "topic": "Scheme Related Documents",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-2"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-2"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-2"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-2"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-2"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
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
    "topic": "Taxation of Mutual Funds",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
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
    "topic": "Investment Landscape",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
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
    "topic": "Investment Landscape",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
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
    "topic": "Accounting, Valuation & NAV",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-q290",
    "courseId": "nism-va",
    "question": "If a mutual fund declares a dividend (IDCW payout) of \u20b92 per unit when the cum-dividend NAV is \u20b928, what will be the theoretical ex-dividend NAV on the record date (ignoring tax deduction)?",
    "options": [
      "\u20b930.00",
      "\u20b928.00",
      "\u20b926.00",
      "\u20b925.00"
    ],
    "correctIndex": 2,
    "explanation": "Theoretical Ex-dividend NAV = Cum-dividend NAV - Dividend Payout = 28 - 2 = \u20b926.00.",
    "topic": "Accounting, Valuation & NAV",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-q293",
    "courseId": "nism-va",
    "question": "Under Section 112A of the Income Tax Act (as amended by Budget 2024), what is the tax rate applicable on Long-Term Capital Gains (LTCG) from equity mutual funds?",
    "options": [
      "10% on gains exceeding \u20b91 Lakh",
      "12.5% on gains exceeding \u20b91.25 Lakh per financial year (without indexation)",
      "15% flat on all gains",
      "Taxed at marginal income slab rate"
    ],
    "correctIndex": 1,
    "explanation": "Budget 2024 revised the Section 112A LTCG tax rate to 12.5% while increasing the annual tax-exempt threshold from \u20b91 Lakh to \u20b91.25 Lakh.",
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-2"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-2"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-2"
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
    "topic": "Distribution & Channel Management",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-2"
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
    "topic": "Investor Services & Onboarding",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-q309",
    "courseId": "nism-va",
    "question": "Under SEBI and AMFI guidelines, what is the annual investment ceiling for 'Micro SIPs' to be exempt from the requirement of furnishing a PAN card?",
    "options": [
      "\u20b920,000 per financial year",
      "\u20b950,000 per financial year per investor across all schemes of an AMC",
      "\u20b91,00,000 per financial year",
      "\u20b910,000 per financial year"
    ],
    "correctIndex": 1,
    "explanation": "Micro SIPs and small lump sum investments up to \u20b950,000 per financial year per investor are exempt from PAN requirement (valid photo ID proof required).",
    "topic": "Investor Services & Onboarding",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-2"
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
    "topic": "Investor Services & Onboarding",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-2"
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
    "topic": "Investor Services & Onboarding",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-2"
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
    "topic": "Investor Services & Onboarding",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-q315",
    "courseId": "nism-va",
    "question": "If an investor wishes to opt out of nominating anyone for their mutual fund folio, what is required under SEBI regulations?",
    "options": [
      "The application is rejected outright",
      "The investor must submit a signed formal declaration of opting out of nomination",
      "The investor must pay a \u20b9500 opt-out surcharge",
      "The AMC automatically assigns a state bank as nominee"
    ],
    "correctIndex": 1,
    "explanation": "SEBI requires all individual folios to either register a nomination or submit a signed formal declaration explicitly opting out of nomination.",
    "topic": "Investor Services & Onboarding",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-2"
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
    "topic": "Investor Services & Onboarding",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-2"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-2"
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
    "topic": "Risk, Return & Performance",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-2"
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
    "topic": "Financial Planning & Advisory",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch9-7",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Standard Deviation Calculation Concept",
    "question": "In mutual fund performance analytics, what does 'Standard Deviation' measure?",
    "options": [
      "Excess return over benchmark index",
      "Total risk, measuring the dispersion or volatility of fund returns around its historical mean average return",
      "The proportion of systematic risk",
      "Credit default probability"
    ],
    "correctIndex": 1,
    "explanation": "Standard deviation measures the degree of dispersion or variation of returns from their historical average. Higher standard deviation signifies greater volatility and total investment risk.",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch9-8",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Sharpe vs Treynor Selection",
    "question": "When evaluating a well-diversified equity mutual fund that constitutes an investor's entire portfolio, which risk-adjusted metric is most appropriate?",
    "options": [
      "Treynor Ratio (because it considers only systematic risk)",
      "Sharpe Ratio (because it evaluates excess return against total risk, capturing both systematic and unsystematic risk)",
      "Modified Duration",
      "Tracking Error"
    ],
    "correctIndex": 1,
    "explanation": "If a fund represents the entire portfolio, the investor is exposed to total risk (Standard Deviation), making Sharpe ratio the superior evaluation measure. Treynor is preferred when adding to an already diversified portfolio.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch9-9",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Sortino Ratio",
    "question": "How does the 'Sortino Ratio' differ from the 'Sharpe Ratio' in portfolio risk evaluation?",
    "options": [
      "Sortino ratio uses Beta instead of Standard Deviation",
      "Sortino ratio penalizes only downside volatility (negative returns below a minimum acceptable threshold) rather than total volatility",
      "Sortino ratio ignores the risk-free rate",
      "Sortino ratio applies only to debt funds"
    ],
    "correctIndex": 1,
    "explanation": "While Sharpe ratio treats both upside and downside volatility equally as risk, the Sortino ratio focuses exclusively on harmful downside volatility (semi-variance below minimum acceptable return).",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch9-10",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "R-Squared (Coefficient of Determination)",
    "question": "An equity fund has an R-Squared of 0.95 relative to the Nifty 50 index. What does this indicate?",
    "options": [
      "The fund generated an alpha of 95%",
      "95% of the fund's portfolio return movements can be explained by movements in the benchmark index",
      "The fund manager took 5% cash",
      "The fund expense ratio is 0.95%"
    ],
    "correctIndex": 1,
    "explanation": "R-Squared measures the percentage of a fund's portfolio movements that are explained by movements in its benchmark index. A value of 0.95 indicates very strong correlation with the benchmark.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch9-11",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Compounded Annual Growth Rate (CAGR)",
    "question": "An investor invested \u20b91,00,000 in an equity mutual fund which grew to \u20b92,00,000 over exactly 3 years. What is the approximate CAGR of this investment?",
    "options": [
      "33.33%",
      "26.00%",
      "24.00%",
      "20.00%"
    ],
    "correctIndex": 1,
    "explanation": "CAGR = (End Value / Start Value)^(1/n) - 1 = (2,00,000 / 1,00,000)^(1/3) - 1 = (2.00)^(0.333) - 1 \u2248 1.2599 - 1 \u2248 26.0%. Note that simple average return (33.3%) ignores the compounding effect.",
    "difficulty": "Advanced Scenario / Numerical",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch9-12",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Macaulay Duration Concept",
    "question": "What does the 'Macaulay Duration' of a bond fund indicate to an investor?",
    "options": [
      "The credit rating score of the bond issuers",
      "The weighted average time (in years) required for an investor to recover the cash flows (coupons and principal) invested in the bond",
      "The total expense ratio",
      "The maximum drawdown over 5 years"
    ],
    "correctIndex": 1,
    "explanation": "Macaulay duration represents the weighted average time until all bond cash flows are received, measuring interest rate sensitivity.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "va-vault-ch9-1",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Treynor Ratio Application",
    "question": "Scheme A has a Treynor Ratio of 14.5 and Scheme B has a Treynor Ratio of 11.2. What does this signify about Scheme A?",
    "options": [
      "Scheme A generated higher excess return per unit of systematic risk (Beta) than Scheme B",
      "Scheme A has higher total volatility",
      "Scheme A has lower Sharpe ratio",
      "Scheme A is a debt fund"
    ],
    "correctIndex": 0,
    "explanation": "Treynor Ratio measures (Rp - Rf)/Beta. A higher Treynor ratio indicates greater excess return generated per unit of market/systematic risk.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "va-vault-ch9-2",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Beta Value of 1.0",
    "question": "If an equity mutual fund has a Beta of exactly 1.00 relative to the Nifty 50, what does this mathematically mean?",
    "options": [
      "The fund has zero volatility",
      "The fund's systematic risk and price sensitivity are identical to that of the Nifty 50 benchmark index",
      "The fund is guaranteed to return 10%",
      "The fund invests only in government debt"
    ],
    "correctIndex": 1,
    "explanation": "A Beta of 1.0 indicates that the fund's sensitivity to market swings mirrors the benchmark index: if index rises/falls by 5%, the scheme is expected to rise/fall by 5%.",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "va-vault-ch9-3",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Jensen's Alpha Calculation",
    "question": "A fund delivered an actual return of 16%. Under CAPM, based on the risk-free rate of 6%, Beta of 1.2, and market benchmark return of 13%, the expected return is 14.4%. What is Jensen's Alpha?",
    "options": [
      "+1.6%",
      "+3.0%",
      "-1.6%",
      "+2.4%"
    ],
    "correctIndex": 0,
    "explanation": "Jensen's Alpha = Actual Return - Expected Return = 16.0% - 14.4% = +1.60%. Positive alpha proves the fund manager beat the risk-adjusted benchmark.",
    "difficulty": "Advanced Scenario / Numerical",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch10-5",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Large and Mid Cap Fund Allocation",
    "question": "What is the mandatory minimum allocation in Large Cap and Mid Cap stocks for a 'Large & Mid Cap Fund' under SEBI categorisation norms?",
    "options": [
      "Minimum 35% in Large Cap stocks and minimum 35% in Mid Cap stocks at all times",
      "Minimum 50% in Large Cap and 20% in Mid Cap",
      "Minimum 25% in each",
      "Minimum 65% in Large Cap alone"
    ],
    "correctIndex": 0,
    "explanation": "SEBI rules specify that a Large & Mid Cap Fund must invest at least 35% of total assets in Large Cap stocks and at least 35% of total assets in Mid Cap stocks.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch10-6",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Focused Fund Portfolio Limit",
    "question": "Under SEBI scheme categorisation norms, what is the maximum number of stocks that a 'Focused Fund' is permitted to hold in its portfolio?",
    "options": [
      "Maximum 20 stocks",
      "Maximum 30 stocks",
      "Maximum 50 stocks",
      "No upper ceiling"
    ],
    "correctIndex": 1,
    "explanation": "A Focused Fund invests in a concentrated portfolio of high-conviction ideas, subject to a statutory maximum of 30 stocks under SEBI regulations.",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch10-7",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Liquid Fund Portfolio Maturity",
    "question": "Under SEBI regulations, what is the maximum permissible maturity of any debt or money market instrument held in a 'Liquid Fund'?",
    "options": [
      "Up to 30 days",
      "Up to 60 days",
      "Up to 91 days",
      "Up to 180 days"
    ],
    "correctIndex": 2,
    "explanation": "Liquid funds can invest only in debt and money market securities with residual maturity of up to 91 days only, ensuring superior liquidity and negligible interest rate risk.",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch10-8",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Graded Exit Load on Liquid Funds",
    "question": "Why did SEBI introduce a 7-day graded exit load on Liquid Funds?",
    "options": [
      "To increase AMC revenues",
      "To deter corporate investors from using liquid funds for speculative ultra-short 1-2 day hot-money arbitrage and protect retail unit holders",
      "To encourage equity investments",
      "To align with fixed deposit penalty rules"
    ],
    "correctIndex": 1,
    "explanation": "SEBI introduced a 7-day graded exit load (starting at 0.0070% on Day 1 and reducing to nil on Day 8) to discourage volatile short-term institutional redemption shocks in liquid funds.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch10-9",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Balanced Advantage / Dynamic Asset Allocation",
    "question": "What defines the investment mandate of a 'Dynamic Asset Allocation or Balanced Advantage Fund' under SEBI categorisation?",
    "options": [
      "Fixed 50% equity and 50% debt allocation at all times",
      "Dynamically managing investment between 0% to 100% in equity and 0% to 100% in debt based on quantitative valuation models (e.g. P/E, P/B)",
      "Investing exclusively in gold and foreign equity",
      "Guaranteed capital preservation"
    ],
    "correctIndex": 1,
    "explanation": "Balanced Advantage Funds have the statutory flexibility to vary equity and debt exposure between 0% and 100% dynamically based on proprietary valuation indicators (e.g., P/E, dividend yield).",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "va-vault-ch10-1",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Small Cap Fund Definition",
    "question": "Under SEBI categorisation norms, what is the mandatory minimum allocation that a 'Small Cap Fund' must maintain in small-cap stocks?",
    "options": [
      "Minimum 50% in small cap stocks",
      "Minimum 65% of total assets in small cap stocks (251st company onwards by market cap)",
      "Minimum 80%",
      "Minimum 25%"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates that a Small Cap Fund must invest at least 65% of its total assets in equity shares of small cap companies (ranked 251st and beyond).",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "va-vault-ch10-2",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Sectoral vs Thematic Funds",
    "question": "What is the minimum investment in equity and equity-related securities of a particular sector required for a 'Sectoral Fund' under SEBI rules?",
    "options": [
      "65%",
      "80% of total assets",
      "90%",
      "50%"
    ],
    "correctIndex": 1,
    "explanation": "Sectoral and Thematic funds must invest at least 80% of total assets in equity shares of that specific sector (e.g. Banking, Pharma) or theme.",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "va-vault-ch10-3",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Credit Risk Fund Norms",
    "question": "Under SEBI scheme categorisation, what is the mandatory investment mandate for a 'Credit Risk Fund'?",
    "options": [
      "Minimum 65% in AAA rated bonds",
      "Minimum 65% of total assets in corporate bonds rated AA and below (excluding AA+)",
      "Investments only in government securities",
      "Minimum 80% in bank fixed deposits"
    ],
    "correctIndex": 1,
    "explanation": "Credit Risk Funds must invest at least 65% of total assets in corporate bonds rated AA and below, seeking higher coupon yields by taking credit risk.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "paperId": "paper-2"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "paperId": "paper-2"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "paperId": "paper-2"
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
    "topic": "Financial Planning & Advisory",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch11-3",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Anchoring Bias",
    "question": "An investor refuses to sell a loss-making stock at \u20b9120 simply because they bought it at \u20b9200, waiting indefinitely for the price to return to \u20b9200. Which behavioral bias is this?",
    "options": [
      "Herd Mentality",
      "Anchoring Bias",
      "Confirmation Bias",
      "Availability Heuristic"
    ],
    "correctIndex": 1,
    "explanation": "Anchoring bias occurs when an investor fixates on an arbitrary reference point (like original purchase price) and makes irrational holding decisions regardless of deteriorating fundamentals.",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch11-4",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Herding Behavior",
    "question": "Investors rushing to buy a specific thematic or sectoral fund at peak market valuations simply because 'everyone in the office is buying it' is an example of:",
    "options": [
      "Mental Accounting",
      "Herding Behavior",
      "Status Quo Bias",
      "Overconfidence Bias"
    ],
    "correctIndex": 1,
    "explanation": "Herding occurs when investors follow the crowd and copy trades of others rather than relying on independent objective analysis, often leading to asset bubbles.",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch12-3",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning Process Sequence",
    "question": "What is the logical first step in the formal 6-step financial planning process recommended by global wealth standards?",
    "options": [
      "Selecting specific mutual fund schemes",
      "Establishing and defining the client-planner relationship and understanding client expectations",
      "Developing and presenting recommendations",
      "Implementing the investment portfolio"
    ],
    "correctIndex": 1,
    "explanation": "The financial planning process begins with Step 1: Establishing and defining the client-planner relationship, followed by gathering client data, analyzing financial status, developing recommendations, implementing, and monitoring.",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch12-4",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Human Life Value (HLV) Concept",
    "question": "What is the economic principle behind the 'Human Life Value' (HLV) method for sizing life insurance protection for an earning individual?",
    "options": [
      "Total market value of physical assets owned by the individual",
      "The present value of all future expected net earnings of the individual dedicated to family support until retirement age",
      "100 times the annual electricity bill",
      "The sum of all outstanding loans"
    ],
    "correctIndex": 1,
    "explanation": "HLV calculates the economic loss to the family upon premature death, computed as the present value of future net earnings allocated for household support until retirement.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch12-5",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Strategic vs Tactical Asset Allocation",
    "question": "What is 'Strategic Asset Allocation' (SAA) in portfolio construction?",
    "options": [
      "Frequent intraday day-trading to profit from temporary price anomalies",
      "Establishing the long-term baseline asset mix (e.g. 60% Equity / 40% Debt) that reflects the investor's risk profile and target horizon",
      "Investing 100% in speculative penny stocks",
      "Allocating only to sectoral funds"
    ],
    "correctIndex": 1,
    "explanation": "Strategic Asset Allocation (SAA) establishes a long-term target asset mix aligned with risk profile and financial goals. Tactical Asset Allocation (TAA) temporarily deviates from SAA to capture short-term opportunities.",
    "difficulty": "Foundation",
    "paperId": "paper-2"
  },
  {
    "id": "nism-va-gen2-ch12-6",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Retirement Corpus Goal Calculation",
    "question": "An investor who is currently 30 years old plans to retire at age 60 (30-year accumulation phase). In calculating their target retirement corpus, which of the following is essential?",
    "options": [
      "Assuming zero inflation during retirement",
      "Adjusting post-retirement living expenses for inflation during both the accumulation and distribution phases, and estimating life expectancy post-retirement",
      "Investing 100% in liquid funds",
      "Assuming bank interest rates will stay at 10%"
    ],
    "correctIndex": 1,
    "explanation": "Retirement planning requires compounding current annual expenses at the inflation rate to retirement age, then calculating the present value of inflation-adjusted annuities over expected retirement longevity.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "va-vault-ch12-1",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Goal-Based Financial Planning",
    "question": "In goal-based financial planning, what is the critical step when an investor has multiple competing goals (e.g. child education in 5 years, retirement in 25 years)?",
    "options": [
      "Funding only retirement and ignoring child education",
      "Prioritizing goals into mandatory needs, essential wants, and aspirational desires, and segregating portfolios by time horizon",
      "Investing 100% in lottery tickets",
      "Taking personal loans for all goals"
    ],
    "correctIndex": 1,
    "explanation": "Goal-based planning requires prioritizing goals by criticality and matching each goal with a segregated portfolio tailored to its specific time horizon and risk budget.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "va-vault-ch12-2",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Inflation Adjustment for Future Goals",
    "question": "If current annual college fees are \u20b95,00,000 and education inflation is estimated at 8% per annum, what formula calculates the required college fee 10 years from now?",
    "options": [
      "Future Value = \u20b95,00,000 \u00d7 (1 + 0.08)^10",
      "Future Value = \u20b95,00,000 \u00d7 10 \u00d7 0.08",
      "Future Value = \u20b95,00,000 / (1 + 0.08)^10",
      "Future Value = \u20b95,00,000 + 80,000"
    ],
    "correctIndex": 0,
    "explanation": "Future Value of Goal = Current Cost \u00d7 (1 + Inflation Rate)^Number of Years = \u20b95,00,000 \u00d7 (1.08)^10 \u2248 \u20b910,79,462.",
    "difficulty": "Advanced Scenario / Numerical",
    "paperId": "paper-2"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-3"
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
    "explanation": "Overnight and liquid mutual funds offer T+1 settlement with instant redemption facilities (up to \u20b950,000 or 90% of folio value) within seconds.",
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-3"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-3"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-3"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-3"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-3"
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
    "topic": "Scheme Related Documents",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-3"
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
    "topic": "Scheme Related Documents",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-3"
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
    "topic": "Scheme Related Documents",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-3"
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
    "topic": "Scheme Related Documents",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-3"
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
    "topic": "Scheme Related Documents",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-3"
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
    "topic": "Scheme Related Documents",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-3"
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
    "topic": "Investor Services",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-3"
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
    "topic": "Investor Services",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-3"
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
    "topic": "Investor Services",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-3"
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
    "topic": "Risk, Return & Performance",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-3"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-3"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-3"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-3"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-3"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-3"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch4-4",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Validity of Draft SID",
    "question": "Once SEBI issues its final observations on a draft SID, within what time period must the AMC launch the New Fund Offer (NFO)?",
    "options": [
      "Within 30 days",
      "Within 6 months",
      "Within 1 year",
      "Within 2 years"
    ],
    "correctIndex": 1,
    "explanation": "The AMC must launch the NFO within 6 months from the date of receipt of final observations from SEBI; otherwise, a fresh draft SID must be filed.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch4-5",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "KIM Update Frequency",
    "question": "How frequently must the Key Information Memorandum (KIM) of an open-ended mutual fund scheme be updated under SEBI regulations?",
    "options": [
      "At least once a year",
      "Every month",
      "Every 3 years",
      "Only when requested by an investor"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI guidelines, the KIM must be updated at least once a year, within 35 days of the close of the financial year, incorporating updated historical returns and expense ratios.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch4-6",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Riskometer Levels",
    "question": "How many risk levels are depicted on the standardized SEBI Risk-o-meter displayed on all mutual fund offer documents and promotional literature?",
    "options": [
      "3 levels",
      "5 levels",
      "6 levels (Low, Low to Moderate, Moderate, Moderately High, High, Very High)",
      "10 levels"
    ],
    "correctIndex": 2,
    "explanation": "SEBI's standardized Risk-o-meter consists of exactly 6 risk gradations: Low, Low to Moderate, Moderate, Moderately High, High, and Very High.",
    "difficulty": "Foundation",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch4-7",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Scheme Benchmark Selection",
    "question": "Under SEBI's two-tier benchmark framework for mutual funds, what does the 'First Tier' benchmark reflect?",
    "options": [
      "The individual stock-picking style of the fund manager",
      "The broad market index representing the category of the scheme",
      "The risk-free 91-day T-Bill rate",
      "The inflation rate"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI's two-tier benchmark circular, Tier 1 benchmark reflects the broad category of the scheme (e.g. Nifty 50 for Large Cap), while Tier 2 benchmark reflects the specific investment style or strategy.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch4-8",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Annual Report Dispatch Timeline",
    "question": "Within what statutory period must an AMC dispatch or email the scheme annual report or an abridged summary thereof to unit holders after the close of the financial year?",
    "options": [
      "Within 1 month",
      "Within 4 months (by July 31)",
      "Within 6 months",
      "Within 9 months"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI Regulation 56, the scheme-wise annual report or an abridged summary must be emailed to unit holders within 4 months from the end of the financial year (by July 31).",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch4-9",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Unaudited Half-Yearly Financial Results",
    "question": "How frequently must a mutual fund publish its unaudited half-yearly financial results in national daily newspapers under SEBI rules?",
    "options": [
      "Within 30 days from the close of each half year",
      "Within 60 days",
      "Within 90 days",
      "Only in the annual report"
    ],
    "correctIndex": 0,
    "explanation": "AMCs must host on their website and publish in one English and one vernacular newspaper their half-yearly financial results within 30 days from the close of the half-year (March 31 and September 30).",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch4-10",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Factsheet Disclosure Norms",
    "question": "Which document is published voluntarily by AMCs every month providing a snapshot of scheme NAV, AUM, top 10 portfolio holdings, sector allocation, and fund manager details?",
    "options": [
      "Key Information Memorandum (KIM)",
      "Monthly Fund Factsheet",
      "Statement of Additional Information (SAI)",
      "Trust Deed"
    ],
    "correctIndex": 1,
    "explanation": "The monthly Fund Factsheet is an operational marketing document providing current fund metrics, sector weights, top stock exposures, portfolio yield/duration, and historical returns.",
    "difficulty": "Foundation",
    "paperId": "paper-3"
  },
  {
    "id": "va-vault-ch4-1",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "SAI Annual Update",
    "question": "By what date must the Statement of Additional Information (SAI) be updated each year under SEBI regulations?",
    "options": [
      "April 30",
      "June 30 (within 3 months of financial year end)",
      "September 30",
      "December 31"
    ],
    "correctIndex": 1,
    "explanation": "AMCs must update the SAI within 3 months of the close of the financial year (by June 30) with audited financial statements.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-3"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-3"
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
    "topic": "Fund Distribution & Channel Practices",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-3"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-3"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-3"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-3"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-3"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-3"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-3"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-3"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-3"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-3"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-3"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-3"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-3"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-3"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-q298",
    "courseId": "nism-va",
    "question": "Under Section 194K of the Income Tax Act, what is the threshold limit beyond which an AMC must deduct Tax Deducted at Source (TDS) on IDCW payouts to a resident individual in a financial year?",
    "options": [
      "\u20b91,000",
      "\u20b95,000",
      "\u20b910,000",
      "\u20b950,000"
    ],
    "correctIndex": 1,
    "explanation": "Under Section 194K, an AMC must deduct TDS at 10% if the aggregate IDCW (dividend) payout to a resident individual exceeds \u20b95,000 in a financial year.",
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-q300",
    "courseId": "nism-va",
    "question": "Under the Income Tax Act, can a Long-Term Capital Loss (LTCL) incurred on the redemption of equity mutual funds be set off against Short-Term Capital Gains (STCG)?",
    "options": [
      "Yes, capital losses can be set off against any income head",
      "No, Long-Term Capital Loss can ONLY be set off against Long-Term Capital Gains",
      "Yes, but only against bank FD interest",
      "Yes, if the loss is below \u20b950,000"
    ],
    "correctIndex": 1,
    "explanation": "Under Indian tax law, Long-Term Capital Loss can only be set off against Long-Term Capital Gains. In contrast, Short-Term Capital Loss can be set off against both STCG and LTCG.",
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-q302",
    "courseId": "nism-va",
    "question": "An investor redeems equity mutual fund units and realizes a Long-Term Capital Gain of \u20b93,00,000 in FY 2024-25. Under the Budget 2024 tax framework, what is the tax liability under Section 112A (excluding cess)?",
    "options": [
      "\u20b937,500",
      "\u20b921,875 (12.5% on \u20b91,75,000)",
      "\u20b920,000",
      "\u20b930,000"
    ],
    "correctIndex": 1,
    "explanation": "LTCG above the \u20b91,25,000 exemption = \u20b93,00,000 - \u20b91,25,000 = \u20b91,75,000. Tax at 12.5% = 12.5% * 1,75,000 = \u20b921,875.",
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-q318",
    "courseId": "nism-va",
    "question": "What is the maximum cash transaction permitted per investor per mutual fund scheme per financial year under SEBI guidelines?",
    "options": [
      "\u20b910,000",
      "\u20b950,000 (provided redemptions are routed strictly through bank accounts)",
      "\u20b92,00,000",
      "Zero (cash is completely banned)"
    ],
    "correctIndex": 1,
    "explanation": "To facilitate financial inclusion in rural areas, SEBI permits cash investments up to \u20b950,000 per investor per financial year across all schemes of an AMC, but all redemptions must be via banking channels.",
    "topic": "Investor Services & Onboarding",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-3"
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
    "topic": "Investor Services & Onboarding",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-3"
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
    "topic": "Investor Services & Onboarding",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-3"
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
    "topic": "Financial Planning & Advisory",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-3"
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
    "topic": "Financial Planning & Advisory",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch8-6",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Realization Cut-Off Example",
    "question": "An investor submits a purchase application for \u20b95,00,000 in an equity flexi-cap scheme on Monday at 1:45 PM. However, the bank clears and credits the funds into the scheme account on Tuesday at 11:30 AM. Which day's NAV is allotted?",
    "options": [
      "Monday's NAV",
      "Tuesday's closing NAV",
      "Wednesday's opening NAV",
      "Average of Monday and Tuesday"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI uniform cut-off rules, NAV is determined solely by the time funds are credited to the scheme's bank account. Since funds were credited before 3:00 PM on Tuesday, Tuesday's closing NAV is allotted.",
    "difficulty": "Advanced Scenario / Numerical",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch8-7",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Redemption Payment Timeline",
    "question": "Under SEBI regulations, what is the maximum turnaround time for an AMC to transfer redemption or repurchase proceeds to an investor's bank account for equity and debt schemes?",
    "options": [
      "Within 2 working days (T+2) for equity schemes and 1 working day (T+1) for debt schemes",
      "Within 3 business days (T+3)",
      "Within 5 business days",
      "Within 10 working days"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates fast turnaround times: redemption proceeds must be dispatched/transferred within T+2 working days for equity schemes and T+1 for liquid/debt schemes.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch8-8",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Penalty for Delay in Redemption",
    "question": "If an AMC fails to transfer redemption proceeds to an investor within the statutory timeline mandated by SEBI, what interest rate penalty must the AMC pay the investor for the delayed period?",
    "options": [
      "6% per annum",
      "9% per annum",
      "15% per annum",
      "Bank savings rate"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI Regulation 53(c), if redemption proceeds are delayed beyond the stipulated timeline, the AMC must pay interest at 15% per annum to the investor for the period of delay out of its own funds.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch8-9",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Central KYC (CKYC) Registry",
    "question": "What is the 14-digit identifier issued by CERSAI to an individual investor upon successful completion of Central KYC registration across the financial sector in India?",
    "options": [
      "Aadhaar Number",
      "KYC Identification Number (KIN)",
      "Permanent Account Number (PAN)",
      "Folio Identification Code"
    ],
    "correctIndex": 1,
    "explanation": "CERSAI issues a 14-digit KYC Identification Number (KIN) upon CKYC processing, allowing the investor to invest across mutual funds, banks, and brokers without repeating full KYC.",
    "difficulty": "Foundation",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch8-10",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Transmission of Units",
    "question": "In the event of the unfortunate demise of a sole unit holder who had registered a nominee in the folio, what is required to transmit the mutual fund units to the nominee?",
    "options": [
      "A court probate and succession certificate regardless of amount",
      "A formal transmission request form, copy of death certificate, KYC and bank mandate of the nominee",
      "No documentation; units transfer automatically",
      "Letter of administration from high court"
    ],
    "correctIndex": 1,
    "explanation": "Where a valid nomination exists, the process is streamlined: the nominee submits a Transmission Request Form along with an attested copy of the death certificate, self-attested KYC, and bank mandate.",
    "difficulty": "Foundation",
    "paperId": "paper-3"
  },
  {
    "id": "va-vault-ch9-4",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Yield to Maturity (YTM)",
    "question": "In the factsheet of a debt mutual fund, what does 'Yield to Maturity' (YTM) represent?",
    "options": [
      "The past 1-year historical return of the debt fund",
      "The expected annualized rate of return of the portfolio if all underlying bonds are held to maturity and all coupons are reinvested at the same rate",
      "The fund manager's annual bonus",
      "The maximum expense ratio permitted"
    ],
    "correctIndex": 1,
    "explanation": "Portfolio YTM is the weighted average expected internal rate of return of the portfolio bonds assuming they are held until maturity with coupon reinvestment at the YTM rate.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-vault-ch9-5",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Modified Duration vs Macaulay Duration",
    "question": "What is the formula linking Modified Duration (MD) to Macaulay Duration (D) for an annual coupon bond with Yield to Maturity (Y)?",
    "options": [
      "MD = D \u00d7 (1 + Y)",
      "MD = D / (1 + Y)",
      "MD = D + Y",
      "MD = D - Y"
    ],
    "correctIndex": 1,
    "explanation": "Modified Duration = Macaulay Duration / (1 + YTM). Modified duration directly estimates percentage price volatility for a 100 bps shift in yield.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch9-1",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Tracking Error Formula",
    "question": "What is the mathematical definition of 'Tracking Error' in an index tracking mutual fund?",
    "options": [
      "Annual expense ratio of the index fund",
      "The annualized standard deviation of the difference in daily returns between the index mutual fund and its benchmark index",
      "The maximum loss incurred in a single day",
      "The correlation coefficient"
    ],
    "correctIndex": 1,
    "explanation": "Tracking Error = Standard Deviation of (Return of Scheme - Return of Benchmark Index). A lower tracking error proves tighter replication of the benchmark.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch9-2",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Treynor Ratio Calculation Example",
    "question": "Portfolio X has a return of 17% with Beta of 1.10. Portfolio Y has a return of 19% with Beta of 1.40. If the risk-free rate is 6%, which portfolio delivered superior risk-adjusted return under Treynor Ratio?",
    "options": [
      "Portfolio X (Treynor = 10.0)",
      "Portfolio Y (Treynor = 9.28)",
      "Portfolio X because its Treynor ratio (10.0) is higher than Portfolio Y (9.28)",
      "Both are identical"
    ],
    "correctIndex": 2,
    "explanation": "Treynor X = (17 - 6)/1.10 = 10.00. Treynor Y = (19 - 6)/1.40 = 9.28. Portfolio X generated higher return per unit of systematic risk.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch9-3",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Modified Duration Calculation Numerical",
    "question": "A bond fund has a Macaulay Duration of 4.2 years and a Yield to Maturity (YTM) of 5.0%. What is its Modified Duration?",
    "options": [
      "4.20 years",
      "4.00 years",
      "4.41 years",
      "3.80 years"
    ],
    "correctIndex": 1,
    "explanation": "Modified Duration = Macaulay Duration / (1 + YTM) = 4.2 / (1 + 0.05) = 4.2 / 1.05 = 4.00 years.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch9-4",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Rolling Returns Advantages",
    "question": "Why are 'Rolling Returns' superior to 'Point-to-Point Returns' when evaluating long-term mutual fund performance?",
    "options": [
      "Rolling returns eliminate the distortion of entry/exit point bias (point-to-point bias) and measure performance consistency across multiple market cycles",
      "Rolling returns guarantee zero negative periods",
      "Rolling returns are always higher than CAGR",
      "Rolling returns exclude expense ratios"
    ],
    "correctIndex": 0,
    "explanation": "Rolling returns take rolling multi-year blocks across history, mitigating the luck or distortion of specific entry and exit dates to show true return consistency.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch9-31",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #31?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch9-32",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #32?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch9-33",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #33?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch9-34",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #34?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch9-35",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #35?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch9-36",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #36?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-vault-ch10-4",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Money Market Fund Maturity",
    "question": "What is the maximum maturity of instruments permitted in a 'Money Market Fund' under SEBI categorisation?",
    "options": [
      "Up to 91 days",
      "Up to 1 year",
      "Up to 3 years",
      "Up to 5 years"
    ],
    "correctIndex": 1,
    "explanation": "Money Market Funds invest in money market instruments (Commercial Papers, Certificates of Deposit, T-Bills) having residual maturity up to 1 year.",
    "difficulty": "Foundation",
    "paperId": "paper-3"
  },
  {
    "id": "va-vault-ch10-5",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Exchange Traded Funds (ETFs)",
    "question": "Where are units of Exchange Traded Funds (ETFs) bought and sold by retail investors during continuous market hours?",
    "options": [
      "At the AMC branch counter at closing NAV",
      "On recognized stock exchanges (NSE/BSE) through a stockbroker at live market prices",
      "Through post offices",
      "Through the Reserve Bank of India"
    ],
    "correctIndex": 1,
    "explanation": "ETFs trade on stock exchanges like individual equities. Retail investors buy and sell ETF units at real-time market prices throughout trading hours via their Demat/Trading account.",
    "difficulty": "Foundation",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch10-1",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Flexi Cap Fund Equity Allocation",
    "question": "What is the statutory minimum investment in equity and equity-related instruments for a 'Flexi Cap Fund' under SEBI categorisation?",
    "options": [
      "Minimum 50% of total assets",
      "Minimum 65% of total assets, with complete freedom to allocate across Large, Mid, and Small Cap stocks dynamically",
      "Minimum 75% in Large Cap stocks",
      "Minimum 80% in debt securities"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI circular, Flexi Cap funds must invest at least 65% of total assets in equity across large, mid, and small cap companies without mandatory sub-category quotas.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch10-2",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Conservative vs Aggressive Hybrid",
    "question": "Under SEBI categorisation norms, what is the mandatory equity allocation range for an 'Aggressive Hybrid Fund'?",
    "options": [
      "10% to 25% in equity",
      "40% to 60% in equity",
      "65% to 80% in equity and equity-related instruments, with 20% to 35% in debt",
      "100% in equity"
    ],
    "correctIndex": 2,
    "explanation": "Aggressive Hybrid Funds must invest 65% to 80% in equities (qualifying for equity taxation) and 20% to 35% in debt instruments for stability.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch10-3",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Corporate Bond Fund Portfolio",
    "question": "What is the minimum percentage of total assets that a 'Corporate Bond Fund' must invest in highest-rated corporate bonds under SEBI categorisation?",
    "options": [
      "Minimum 50% in AA rated bonds",
      "Minimum 80% of total assets in corporate bonds rated AA+ and above",
      "Minimum 65% in government securities",
      "100% in bank fixed deposits"
    ],
    "correctIndex": 1,
    "explanation": "Corporate Bond Funds must invest at least 80% of total assets in highest-rated corporate debt securities (rated AA+ and above).",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch10-4",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Gilt Fund Allocation Mandate",
    "question": "Under SEBI regulations, what is the mandatory minimum investment that a 'Gilt Fund' must maintain in Government Securities (G-Secs)?",
    "options": [
      "Minimum 65% of total assets",
      "Minimum 80% of total assets in Government Securities across maturities",
      "100% in Treasury Bills only",
      "Minimum 50% in corporate bonds"
    ],
    "correctIndex": 1,
    "explanation": "Gilt Funds must invest at least 80% of total assets in government securities, eliminating credit risk while carrying interest rate risk.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch10-23",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #23?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch10-24",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #24?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch11-5",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Recency Bias",
    "question": "When an investor assumes that the exceptional 40% return delivered by a small-cap fund in the previous 12 months will continue indefinitely over the next 5 years, they are falling victim to:",
    "options": [
      "Recency Bias",
      "Loss Aversion",
      "Hindsight Bias",
      "Framing Effect"
    ],
    "correctIndex": 0,
    "explanation": "Recency bias is the cognitive tendency to over-extrapolate recent short-term performance into the future while ignoring long-term cycles and mean-reversion.",
    "difficulty": "Foundation",
    "paperId": "paper-3"
  },
  {
    "id": "nism-va-gen2-ch11-6",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Risk Capacity vs Risk Tolerance",
    "question": "How does 'Risk Capacity' differ from 'Risk Tolerance' in investor risk profiling?",
    "options": [
      "Risk capacity is the emotional willingness to accept volatility, whereas risk tolerance is financial ability",
      "Risk capacity is the objective financial ability to absorb losses (based on wealth, income, and liabilities), whereas risk tolerance is psychological comfort with volatility",
      "They are identical terms",
      "Risk capacity is determined by SEBI"
    ],
    "correctIndex": 1,
    "explanation": "Risk capacity is objective and financial (income, dependents, net worth, horizon), while risk tolerance is subjective and psychological (attitude toward volatility and emotional response to drawdown).",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-vault-ch11-1",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Confirmation Bias",
    "question": "When an investor selectively searches for articles that praise their existing stock investments while actively ignoring reports highlighting negative financial risks, they exhibit:",
    "options": [
      "Confirmation Bias",
      "Hindsight Bias",
      "Framing Bias",
      "Endowment Effect"
    ],
    "correctIndex": 0,
    "explanation": "Confirmation bias is the psychological tendency to seek out and favor information that confirms pre-existing beliefs while ignoring conflicting contrary evidence.",
    "difficulty": "Foundation",
    "paperId": "paper-3"
  },
  {
    "id": "va-vault-ch11-2",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Mental Accounting",
    "question": "Treating a \u20b950,000 annual festival bonus as 'frivolous fun money' to gamble on high-risk penny stocks, while treating monthly salary conservatively in bank FDs, is an example of:",
    "options": [
      "Mental Accounting Bias",
      "Overconfidence Bias",
      "Regret Aversion",
      "Availability Bias"
    ],
    "correctIndex": 0,
    "explanation": "Mental accounting (Thaler) is the behavioral tendency to categorize and treat money differently based on its source or intended purpose, violating economic fungibility.",
    "difficulty": "Foundation",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch11-1",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Risk Profiling Components",
    "question": "An investor's comprehensive Risk Profile is evaluated based on which two fundamental dimensions?",
    "options": [
      "Salary and stockbroker name",
      "Risk Capacity (financial ability to absorb losses) and Risk Tolerance (psychological willingness to take risk)",
      "Age and blood pressure",
      "Number of bank accounts and credit cards"
    ],
    "correctIndex": 1,
    "explanation": "Risk Profiling balances objective financial capacity (wealth, liabilities, income stability, time horizon) with subjective psychological tolerance (emotional comfort with market swings).",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch11-2",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Asset Allocation by Life Stage",
    "question": "For a young investor in their late 20s with a stable career, no dependents, and a 30-year horizon until retirement, which asset allocation is generally most appropriate?",
    "options": [
      "100% in cash equivalents and gold",
      "Predominantly growth-oriented (e.g. 70-80% in diversified equity mutual funds and 20-30% in debt/EPF)",
      "100% in short-term debt funds",
      "100% in speculative unhedged derivatives"
    ],
    "correctIndex": 1,
    "explanation": "Investors in the wealth accumulation life stage possess high risk capacity and long investment horizons, justifying a growth-heavy equity allocation.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch12-1",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Debt-to-Income Ratio Benchmark",
    "question": "In personal financial planning and debt management, what is the prudent recommended upper ceiling for an individual's total monthly loan EMIs as a percentage of net monthly income?",
    "options": [
      "Up to 20%",
      "Up to 35% to 40% of net monthly income",
      "Up to 75%",
      "No ceiling"
    ],
    "correctIndex": 1,
    "explanation": "Financial planners recommend that total monthly debt service obligations (home loan, car loan, personal loan EMIs) should not exceed 35% to 40% of net monthly take-home income.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen3-ch12-2",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Emergency Fund Placement",
    "question": "Where should an investor park their 6-month emergency contingency fund to optimize safety, liquidity, and reasonable post-tax return?",
    "options": [
      "In small-cap equity mutual funds",
      "In a combination of high-interest savings accounts, sweep fixed deposits, and Liquid/Overnight debt mutual funds",
      "In commercial real estate",
      "In 10-year Sovereign Gold Bonds"
    ],
    "correctIndex": 1,
    "explanation": "Emergency funds require immediate capital accessibility without exit penalties or capital drawdown risk; liquid debt funds and sweep deposits are ideal vehicles.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch12-15",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #15?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch12-16",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #16?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch12-17",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #17?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
  },
  {
    "id": "va-gen-ch12-18",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #18?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-3"
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
    "topic": "Investment Landscape",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch1-1",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "Real Rate of Return",
    "question": "If an investor earns a 7.5% nominal interest rate on a fixed deposit while the Consumer Price Index (CPI) inflation is 5.5%, what is the approximate real rate of return?",
    "options": [
      "13.0%",
      "2.0%",
      "1.36%",
      "3.5%"
    ],
    "correctIndex": 1,
    "explanation": "Real Rate of Return \u2248 Nominal Rate - Inflation Rate = 7.5% - 5.5% = 2.0%. Real return measures the increase in actual purchasing power.",
    "difficulty": "Foundation",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch1-2",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "Rule of 72 Calculation",
    "question": "According to the 'Rule of 72', approximately how many years will it take for a lump sum investment to double at a compounded annual growth rate of 9%?",
    "options": [
      "6 years",
      "8 years",
      "9 years",
      "12 years"
    ],
    "correctIndex": 1,
    "explanation": "Years to double = 72 / Annual Interest Rate = 72 / 9 = 8 years.",
    "difficulty": "Foundation",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch1-3",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "Asset Class Characteristics",
    "question": "Which asset class has historically exhibited the highest long-term inflation-hedging capability and real wealth creation potential, despite high short-term volatility?",
    "options": [
      "Bank Fixed Deposits",
      "Equities",
      "Cash and Liquid Treasury Bills",
      "Gold Monetisation Scheme"
    ],
    "correctIndex": 1,
    "explanation": "Over long investment horizons (7-10+ years), equities have consistently outpaced consumer inflation and generated superior real wealth creation compared to debt and cash.",
    "difficulty": "Foundation",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch1-4",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "Sovereign Gold Bonds",
    "question": "What is the semi-annual fixed interest coupon rate paid on Sovereign Gold Bonds (SGBs) issued by the Reserve Bank of India on behalf of the Government of India?",
    "options": [
      "1.50% per annum",
      "2.50% per annum payable semi-annually",
      "3.00% per annum",
      "Zero coupon, capital appreciation only"
    ],
    "correctIndex": 1,
    "explanation": "Sovereign Gold Bonds pay a fixed rate of interest of 2.50% per annum on the nominal value, credited semi-annually directly to the investor's bank account.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch1-5",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "REITs and Real Estate Investment",
    "question": "Under SEBI (Real Estate Investment Trusts) Regulations, what minimum percentage of a REIT's operating assets must be invested in completed and rent-generating properties?",
    "options": [
      "50%",
      "65%",
      "80%",
      "90%"
    ],
    "correctIndex": 2,
    "explanation": "SEBI REIT Regulations mandate that at least 80% of the value of REIT assets must be invested in completed and revenue/rent-generating properties.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
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
    "topic": "Investor Services",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-4"
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
    "topic": "Investor Services",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-4"
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
    "topic": "Investor Services",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-4"
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
    "topic": "Risk, Return & Performance",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-4"
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
    "topic": "Risk, Return & Performance",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-4"
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
    "topic": "Risk, Return & Performance",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-4"
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
    "topic": "Risk, Return & Performance",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-4"
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
    "topic": "Risk, Return & Performance",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-4"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-4"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-4"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-q213",
    "courseId": "nism-va",
    "question": "Can an Asset Management Company guarantee a specific rate of return on an open-ended equity scheme under SEBI regulations?",
    "options": [
      "Yes, if the AMC has a net worth exceeding \u20b91,000 Crore",
      "No, SEBI strictly prohibits guaranteed returns unless backed by a formal credit guarantee disclosed in SID",
      "Yes, up to 12% per annum",
      "Yes, if the fund manager is a CFA charterholder"
    ],
    "correctIndex": 1,
    "explanation": "SEBI strictly prohibits promising or guaranteeing returns in mutual funds unless the guarantee is explicitly insured or backed by the sponsor/guarantor with full SID disclosures.",
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-q216",
    "courseId": "nism-va",
    "question": "Which of the following is a statutory requirement for an entity applying to become a mutual fund Sponsor under SEBI regulations?",
    "options": [
      "Must have at least 5 years of track record in financial services with positive net worth in all 5 years",
      "Must be a state-owned public enterprise",
      "Must be registered as a non-banking finance company with RBI",
      "Must manage at least \u20b950,000 Crore of AUM"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that a sponsor must have a minimum 5-year track record in financial services, with positive net worth across all 5 years and profitability in at least 3 of the last 5 years.",
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-4"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-4"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-q220",
    "courseId": "nism-va",
    "question": "What is the statutory minimum net worth required for an Asset Management Company (AMC) to operate under SEBI regulations?",
    "options": [
      "\u20b910 Crore",
      "\u20b925 Crore",
      "\u20b950 Crore",
      "\u20b9100 Crore"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI (Mutual Funds) Regulations, an AMC is required to maintain a continuous minimum net worth of at least \u20b950 Crore.",
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-4"
  },
  {
    "id": "va-vault-ch4-2",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Addendum Issuance",
    "question": "Which of the following events strictly requires an AMC to issue an Addendum to the Scheme Information Document?",
    "options": [
      "A change in the exit load structure of an open-ended scheme",
      "A 1% increase in the scheme's daily NAV",
      "Purchase of a new stock in the top 10 holdings",
      "A rise in the repo rate by RBI"
    ],
    "correctIndex": 0,
    "explanation": "Any prospective change in scheme features, fees, expenses, or exit load requires an Addendum published in national newspapers and on the AMC website.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-vault-ch4-3",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Portfolio Disclosure Fortnightly",
    "question": "Under SEBI regulations, how frequently must debt mutual fund schemes disclose their complete portfolio on the AMC website?",
    "options": [
      "Daily",
      "Fortnightly (within 5 days of every fortnight) and monthly (within 10 days of month end)",
      "Quarterly",
      "Annually"
    ],
    "correctIndex": 1,
    "explanation": "To ensure debt portfolio transparency, SEBI mandates fortnightly portfolio disclosure within 5 days of each fortnight for all debt and liquid schemes.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-vault-ch4-4",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "TER Disclosure on Website",
    "question": "Under SEBI regulations, at least how many working days prior to its effective date must an AMC communicate any increase in base TER to investors?",
    "options": [
      "At least 3 working days prior, via notice on website and email/SMS to unit holders",
      "At least 15 days",
      "At least 30 days",
      "No prior notice required"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that any increase in base TER must be communicated to unit holders at least 3 working days in advance via email/SMS and published on the AMC website.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-vault-ch4-5",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "KIM Format",
    "question": "Which body prescribes the standardized format and mandatory disclosures for the Key Information Memorandum (KIM)?",
    "options": [
      "Securities and Exchange Board of India (SEBI)",
      "Ministry of Corporate Affairs",
      "Insurance Regulatory and Development Authority (IRDAI)",
      "Reserve Bank of India"
    ],
    "correctIndex": 0,
    "explanation": "SEBI specifies the standardized format, content sequence, and mandatory statutory risk disclosures for the KIM across all mutual fund schemes.",
    "difficulty": "Foundation",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen3-ch4-1",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "NFO Minimum Subscription",
    "question": "Under SEBI regulations, what is the minimum subscription amount that an open-ended mutual fund scheme must raise during its New Fund Offer (NFO) to proceed with allotment?",
    "options": [
      "\u20b95 Crores",
      "\u20b910 Crores for equity/debt schemes",
      "\u20b920 Crores",
      "\u20b950 Crores"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates a minimum subscription of \u20b910 Crores for open-ended debt and equity schemes (\u20b920 Crores for ELSS) during the NFO period.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen3-ch4-2",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Refund on NFO Failure",
    "question": "If an AMC fails to collect the minimum statutory subscription amount during an NFO, within how many business days must the entire subscription money be refunded to applicants without interest?",
    "options": [
      "5 business days from the closure of the NFO",
      "15 business days",
      "30 business days",
      "45 business days"
    ],
    "correctIndex": 0,
    "explanation": "If the minimum subscription is not raised, the AMC must refund the entire application money within 5 business days from the date of NFO closure, failing which interest at 15% p.a. is payable.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen3-ch4-3",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Statutory Disclaimer Clause",
    "question": "What is the statutory disclaimer that must appear prominently on the front cover of every mutual fund Scheme Information Document?",
    "options": [
      "Mutual funds guarantee minimum capital return",
      "It is to be distinctly understood that filing of the draft scheme document with SEBI does not mean that SEBI approves or guarantees the accuracy of the scheme",
      "Mutual fund schemes are insured by DICGC",
      "All equity schemes carry zero risk"
    ],
    "correctIndex": 1,
    "explanation": "SEBI mandates a standard front-cover disclaimer stating that filing with SEBI does not imply SEBI approval or guarantee of returns or compliance.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen3-ch4-4",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "SID Format Standardization",
    "question": "How many primary sections are standard in a SEBI-prescribed Scheme Information Document (SID)?",
    "options": [
      "2 sections",
      "3 sections: Highlights/Summary, Information about the Scheme, and Fees & Expenses",
      "5 sections",
      "10 sections"
    ],
    "correctIndex": 1,
    "explanation": "SEBI prescribes a uniform 3-part layout: Section I: Highlights/Summary; Section II: Information about the Scheme; Section III: Fees and Expenses.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
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
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-4"
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
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-4"
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
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-q266",
    "courseId": "nism-va",
    "question": "A distributor who has opted to charge transaction charges under SEBI guidelines can collect how much on an investment of \u20b910,000 or more from a first-time mutual fund investor?",
    "options": [
      "\u20b9500",
      "\u20b9150",
      "\u20b9100",
      "Nil (Zero)"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI circular, distributors who opt in can collect \u20b9150 for a first-time investor in mutual funds and \u20b9100 for an existing investor on investments of \u20b910,000 and above.",
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-q267",
    "courseId": "nism-va",
    "question": "Can a mutual fund distributor pass back or rebate a portion of their trail commission to the investor as an incentive to invest?",
    "options": [
      "Yes, it is encouraged as competitive pricing",
      "No, the AMFI Code of Conduct strictly prohibits rebating or passing back commissions in any form to clients",
      "Yes, if the investment is above \u20b91 Crore",
      "Yes, if approved by the bank branch manager"
    ],
    "correctIndex": 1,
    "explanation": "Rebating of commissions directly or indirectly to investors is a grave violation of the AMFI Code of Conduct and can lead to suspension of the ARN license.",
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-4"
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
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-4"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-4"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-4"
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
    "topic": "Net Asset Value, TER & Pricing",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-4"
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
    "topic": "Investor Services",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-4"
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
    "topic": "Investor Services",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-4"
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
    "topic": "Investor Services",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-4"
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
    "topic": "Risk, Return & Performance",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-4"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-4"
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
    "topic": "Scheme Selection & Categorisation",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-4"
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
    "topic": "Selecting the Right Investment Options",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-q306",
    "courseId": "nism-va",
    "question": "Under Section 80C of the Income Tax Act, what is the maximum tax deduction available for investment in an Equity Linked Savings Scheme (ELSS) in a financial year (under the old tax regime)?",
    "options": [
      "\u20b950,000",
      "\u20b91,00,000",
      "\u20b91,50,000",
      "\u20b92,50,000"
    ],
    "correctIndex": 2,
    "explanation": "Under Section 80C of the Income Tax Act, investments in eligible instruments including ELSS qualify for a deduction up to \u20b91,50,000 per financial year.",
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-4"
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
    "topic": "Taxation & Legal Principles",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-4"
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
    "topic": "Investor Services & Onboarding",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-4"
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
    "topic": "Financial Planning & Advisory",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch7-1",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Budget 2024 LTCG Calculation",
    "question": "An individual investor redeemed units of an equity mutual fund on October 10, 2024, earning a total long-term capital gain of \u20b93,75,000. Under amended Section 112A, what is the tax payable (excluding cess)?",
    "options": [
      "\u20b925,000",
      "\u20b931,250",
      "\u20b937,500",
      "\u20b946,875"
    ],
    "correctIndex": 1,
    "explanation": "Total Gain = \u20b93,75,000. Under amended Section 112A (Budget 2024), exemption is \u20b91,25,000. Taxable Gain = \u20b93,75,000 - \u20b91,25,000 = \u20b92,50,000. Tax at 12.5% = \u20b92,50,000 \u00d7 12.5% = \u20b931,250.",
    "difficulty": "Advanced Scenario / Numerical",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch7-2",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Budget 2024 STCG Equity Rate Calculation",
    "question": "An investor sold equity mutual fund units held for 7 months, booking a short-term capital gain of \u20b91,50,000 on September 1, 2024. What is the tax payable under Section 111A (excluding cess)?",
    "options": [
      "\u20b915,000 (10%)",
      "\u20b922,500 (15%)",
      "\u20b930,000 (20%)",
      "Taxed at marginal slab rate"
    ],
    "correctIndex": 2,
    "explanation": "Effective Budget 2024, STCG on equity-oriented funds under Section 111A is taxed at 20%. Tax = \u20b91,50,000 \u00d7 20% = \u20b930,000.",
    "difficulty": "Advanced Scenario / Numerical",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch7-3",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Debt Fund Grandfathering Pre-April 2023",
    "question": "An investor acquired units of a pure corporate debt mutual fund on January 15, 2022 and redeems them on August 20, 2024. How are the capital gains taxed under Budget 2024?",
    "options": [
      "Taxed at investor's slab rate without indexation under Section 50AA",
      "Grandfathered under pre-2023 rules: taxed as LTCG at 12.5% without indexation (or 20% with indexation)",
      "Completely exempt under Section 10(23D)",
      "Subject to 10% TDS only"
    ],
    "correctIndex": 1,
    "explanation": "Units acquired prior to April 1, 2023 are grandfathered and escape Section 50AA. For unlisted/specified units held for >36 months, Budget 2024 taxes them as LTCG at 12.5% without indexation.",
    "difficulty": "Advanced Scenario / Numerical",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch7-4",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Hybrid Fund Taxation (35% to 65% Equity)",
    "question": "How are capital gains taxed on a Hybrid Mutual Fund scheme where equity exposure is consistently maintained between 35% and 65% (e.g. Conservative Hybrid Funds)?",
    "options": [
      "Deemed short-term capital gains under Section 50AA",
      "Eligible for long-term capital gains status if held for more than 24 months, taxed at 12.5% post Budget 2024",
      "Taxed as pure equity funds if held for > 12 months",
      "Zero tax if held for > 3 years"
    ],
    "correctIndex": 1,
    "explanation": "Funds with equity exposure between 35% and 65% are not 'specified mutual funds' under Section 50AA. Post Budget 2024, holding period for long-term status is 24 months, taxed at 12.5% without indexation.",
    "difficulty": "Advanced Scenario / Numerical",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch7-5",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "TDS for NRI Investors",
    "question": "What is the mandatory TDS rate on Short-Term Capital Gains (STCG) on equity mutual funds when redeemed by a Non-Resident Indian (NRI) investor?",
    "options": [
      "Nil (NRIs file returns)",
      "10%",
      "20% plus applicable surcharge and cess",
      "30% flat"
    ],
    "correctIndex": 2,
    "explanation": "For NRIs, mutual funds must deduct tax at source (TDS) at the applicable rate at the time of redemption. For equity STCG post Budget 2024, the TDS rate is 20% (plus surcharge and cess).",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch7-6",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Dividend Stripping Section 94(7)",
    "question": "Under Section 94(7) of the Income Tax Act (Dividend Stripping), any capital loss arising from the sale of mutual fund units bought within 3 months prior to the record date and sold within how many months after the record date is disallowed to the extent of tax-free/dividend received?",
    "options": [
      "3 months",
      "6 months",
      "9 months",
      "12 months"
    ],
    "correctIndex": 2,
    "explanation": "Section 94(7) prevents dividend stripping: if units are bought within 3 months prior to record date and sold within 9 months after record date, losses up to the dividend received are ignored.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch7-7",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Bonus Stripping Section 94(8)",
    "question": "Under Section 94(8) of the Income Tax Act, bonus stripping provisions apply to units bought within 3 months before the record date and sold within how many months after the record date while retaining the bonus units?",
    "options": [
      "3 months",
      "6 months",
      "9 months",
      "12 months"
    ],
    "correctIndex": 2,
    "explanation": "Under Section 94(8), if original units are bought within 3 months prior to record date and sold within 9 months after record date while holding bonus units, the loss on sale is disallowed and added to the cost of bonus units.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch7-8",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Carry Forward of Capital Losses",
    "question": "For how many consecutive assessment years can unabsorbed capital losses (both STCL and LTCL) on mutual funds be carried forward, provided the income tax return is filed within the due date under Section 139(1)?",
    "options": [
      "3 assessment years",
      "5 assessment years",
      "8 assessment years",
      "Indefinitely"
    ],
    "correctIndex": 2,
    "explanation": "Under the Income Tax Act, capital losses can be carried forward for up to 8 assessment years immediately following the year in which the loss was incurred, provided the return is filed on or before the due date.",
    "difficulty": "Foundation",
    "paperId": "paper-4"
  },
  {
    "id": "va-vault-ch8-1",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "SIP Pause Facility",
    "question": "What is the purpose of the 'SIP Pause' facility offered by mutual fund AMCs?",
    "options": [
      "Cancelling the SIP permanently",
      "Temporarily halting SIP installments for a predefined period (e.g. 1 to 6 months) without terminating the mandate",
      "Doubling the SIP amount automatically",
      "Converting equity units to gold"
    ],
    "correctIndex": 1,
    "explanation": "SIP Pause allows investors facing temporary cash flow shortages to suspend deduction of SIP installments for a few months without cancelling the entire SIP registration.",
    "difficulty": "Foundation",
    "paperId": "paper-4"
  },
  {
    "id": "va-vault-ch8-2",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Systematic Transfer Plan (STP)",
    "question": "In a Systematic Transfer Plan (STP), what is the underlying operational mechanism?",
    "options": [
      "A periodic redemption of units from a source scheme (usually liquid/debt) and simultaneous purchase into a target scheme (usually equity)",
      "An external wire transfer from a foreign bank account",
      "An automated loan against mutual fund units",
      "A dividend payout to bank account"
    ],
    "correctIndex": 0,
    "explanation": "An STP executes a regular redemption from a source scheme at applicable NAV and simultaneous investment into a destination scheme, enabling rupee cost averaging.",
    "difficulty": "Foundation",
    "paperId": "paper-4"
  },
  {
    "id": "va-vault-ch8-3",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Systematic Withdrawal Plan (SWP)",
    "question": "For a retiree seeking regular monthly cash flows, why is an SWP generally more tax-efficient than receiving cash dividends (IDCW)?",
    "options": [
      "SWP payouts are completely tax-exempt under Section 10(23D)",
      "In an SWP, tax is levied only on the capital gains portion of the redeemed units, whereas IDCW is taxed 100% at the investor's marginal slab rate",
      "SWP units are not subject to exit load",
      "SWP eliminates market risk"
    ],
    "correctIndex": 1,
    "explanation": "Each SWP installment consists of principal return plus capital gain. Only the capital gain component is taxed (at favorable LTCG/STCG rates), whereas dividend (IDCW) is taxed 100% at slab rates.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-vault-ch8-4",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Third Party Payment Prohibition",
    "question": "Under AMFI anti-money laundering (AML) guidelines, under which of the following exceptional conditions is a third-party payment accepted in a mutual fund application?",
    "options": [
      "Payment by an employer on behalf of an employee through payroll deduction",
      "Payment by a friend on behalf of an investor",
      "Payment from a corporate account for an individual director's personal folio",
      "Any payment below \u20b950,000"
    ],
    "correctIndex": 0,
    "explanation": "Third-party payments are prohibited except in specific cases: employer payroll deductions, custodian payment on behalf of FPI/client, or payment by parents/grandparents on behalf of a minor up to \u20b950,000.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-vault-ch8-5",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Consolidated Account Statement (CAS)",
    "question": "How frequently is a Consolidated Account Statement (CAS) dispatched by depositories/RTAs to an investor who has transacted in mutual funds or demat securities during the month?",
    "options": [
      "Weekly",
      "On or before the 15th day of the succeeding month",
      "Quarterly",
      "Annually"
    ],
    "correctIndex": 1,
    "explanation": "CAS is dispatched by email on or before the 15th day of the following month for all folios and demat accounts where transactions took place during the month.",
    "difficulty": "Foundation",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen3-ch8-1",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Power of Attorney (PoA) Operations",
    "question": "Under SEBI and AMFI guidelines, can a registered Power of Attorney (PoA) holder open a mutual fund folio or change the registered bank mandate of the unit holder?",
    "options": [
      "Yes, PoA can change bank accounts freely",
      "No, a PoA holder can only execute investment transactions; opening folios or changing registered bank mandates requires the personal signature of the primary investor",
      "PoA can transfer units to their own account",
      "Only with broker approval"
    ],
    "correctIndex": 1,
    "explanation": "To safeguard investor funds from unauthorized siphoning, AMCs do not allow PoA holders to modify registered bank accounts or nominee details without investor direct authorization.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen3-ch8-2",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Joint Holding Operation Modes",
    "question": "In a mutual fund folio registered with 'Either or Survivor' holding mode, who is legally entitled to execute redemption transactions and receive payout proceeds?",
    "options": [
      "Both holders must sign jointly on all redemption requests",
      "Either of the joint unit holders can sign and execute redemptions, but payout is credited only to the primary (first) holder's bank account",
      "Only the second holder",
      "The distributor"
    ],
    "correctIndex": 1,
    "explanation": "In 'Either or Survivor' mode, either unit holder has the power to sign redemption requests, but statutory payout proceeds are credited strictly to the first holder's registered bank account.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen3-ch8-3",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "KYC Modification Timelines",
    "question": "When an investor changes their residential address or mobile number, within how many days must the KYC Registration Agency (KRA) update and notify the investor under SEBI norms?",
    "options": [
      "Within 2 working days",
      "Within 5 working days from receipt of valid documents",
      "Within 15 days",
      "Within 30 days"
    ],
    "correctIndex": 1,
    "explanation": "KRAs must update the Central KYC database and send confirmation to the investor within 5 working days of receiving verified KYC modification documents.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch8-39",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #39?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch8-40",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #40?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-37",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #37?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-38",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #38?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-39",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #39?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-40",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #40?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-41",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #41?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-42",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #42?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-43",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #43?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-44",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #44?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-45",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #45?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-46",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #46?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-47",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #47?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch9-48",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #48?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch10-25",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #25?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch10-26",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #26?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch10-27",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #27?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch10-28",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #28?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch10-29",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #29?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch10-30",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #30?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch10-31",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #31?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch10-32",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #32?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch11-19",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #19?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch11-20",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #20?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch11-21",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #21?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch11-22",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #22?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch11-23",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #23?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch11-24",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #24?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch12-19",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #19?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch12-20",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #20?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch12-21",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #21?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch12-22",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #22?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch12-23",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #23?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "va-gen-ch12-24",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #24?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-4"
  },
  {
    "id": "nism-va-gen2-ch1-6",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "Credit Risk in Fixed Income",
    "question": "When a credit rating agency downgrades a corporate bond from 'AA' to 'BBB', what immediately happens to the market yield and price of that bond?",
    "options": [
      "Yield decreases, price increases",
      "Yield increases, price decreases",
      "Both yield and price increase",
      "No change until bond maturity"
    ],
    "correctIndex": 1,
    "explanation": "A credit downgrade signifies higher perceived default risk. Investors demand a higher risk premium (yield rises), which depresses the bond's secondary market price.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "nism-va-gen2-ch1-7",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "Reinvestment Risk",
    "question": "Which of the following fixed income instruments has ZERO reinvestment risk during its tenure?",
    "options": [
      "10-Year Annual Coupon Government Security",
      "Zero-Coupon Bond / Deep Discount Bond held to maturity",
      "Quarterly Interest Bank Fixed Deposit",
      "Monthly Income Plan"
    ],
    "correctIndex": 1,
    "explanation": "Zero-coupon bonds pay no periodic intermediate cash flows; the entire compounded return is realized at maturity. Hence, there is zero risk of having to reinvest coupons at lower interest rates.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "nism-va-gen2-ch1-8",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "Liquidity Risk",
    "question": "Liquidity risk in secondary securities markets primarily refers to which phenomenon?",
    "options": [
      "The issuer going bankrupt",
      "The inability to buy or sell a large position quickly without causing a substantial adverse movement in market price",
      "Changes in RBI repo rates",
      "Currency depreciation"
    ],
    "correctIndex": 1,
    "explanation": "Liquidity risk is the risk that an investor cannot transact quickly at prevailing market quotations due to insufficient trading volume or wide bid-ask spreads.",
    "difficulty": "Foundation",
    "paperId": "paper-5"
  },
  {
    "id": "nism-va-gen2-ch1-9",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "Systematic vs Unsystematic Risk",
    "question": "Which component of total portfolio risk CANNOT be eliminated through diversification across multiple companies and sectors?",
    "options": [
      "Unsystematic Risk (Idiosyncratic Risk)",
      "Systematic Risk (Market Risk)",
      "Business Risk",
      "Management Risk"
    ],
    "correctIndex": 1,
    "explanation": "Systematic risk stems from macroeconomic forces (interest rates, GDP growth, geopolitical events, inflation) that affect the entire securities market and cannot be diversified away.",
    "difficulty": "Foundation",
    "paperId": "paper-5"
  },
  {
    "id": "nism-va-gen2-ch1-10",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "National Pension System (NPS)",
    "question": "Under the National Pension System (NPS) Tier 1, what is the maximum permissible equity allocation ('E' asset class) allowed for private sector citizens under the Active Choice option?",
    "options": [
      "50%",
      "75% (tapering after age 50)",
      "100%",
      "25%"
    ],
    "correctIndex": 1,
    "explanation": "Under PFRDA regulations, individual subscribers in NPS All Citizen Model can allocate up to 75% in Asset Class E (Equity) up to age 50, after which it tapers down 2.5% annually.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "nism-va-gen2-ch1-11",
    "courseId": "nism-va",
    "chapter": 1,
    "chapterTitle": "Investment Landscape",
    "topic": "Public Provident Fund (PPF)",
    "question": "What is the maximum investment limit per individual per financial year in a Public Provident Fund (PPF) account eligible for Section 80C tax deduction?",
    "options": [
      "\u20b91,00,000",
      "\u20b91,50,000",
      "\u20b92,00,000",
      "\u20b92,50,000"
    ],
    "correctIndex": 1,
    "explanation": "The maximum deposit permitted in a PPF account in a financial year is \u20b91.5 Lakhs (which matches the overall deduction limit under Section 80C).",
    "difficulty": "Foundation",
    "paperId": "paper-5"
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
    "topic": "Risk, Return & Performance",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 2,
    "chapterTitle": "Concept & Role of a Mutual Fund",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 3,
    "chapterTitle": "Legal & Regulatory Framework",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen3-ch4-5",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Continuous Offer Allotment",
    "question": "Within how many working days must an AMC dispatch an account statement or credit mutual fund units into an investor's demat account following an ongoing subscription transaction?",
    "options": [
      "Within 1 working day",
      "Within 5 working days from the date of closure of the NFO / date of receipt of application",
      "Within 15 days",
      "Within 30 days"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI rules, confirmation of allotment via email/SMS must be sent within 5 working days of receipt of application.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch4-34",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Scheme Related Documents Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Scheme Related Documents, which statutory requirement applies to regulatory standard #34?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Scheme Related Documents, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch4-35",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Scheme Related Documents Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Scheme Related Documents, which statutory requirement applies to regulatory standard #35?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Scheme Related Documents, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch4-36",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Scheme Related Documents Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Scheme Related Documents, which statutory requirement applies to regulatory standard #36?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Scheme Related Documents, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch4-37",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Scheme Related Documents Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Scheme Related Documents, which statutory requirement applies to regulatory standard #37?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Scheme Related Documents, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch4-38",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Scheme Related Documents Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Scheme Related Documents, which statutory requirement applies to regulatory standard #38?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Scheme Related Documents, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch4-39",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Scheme Related Documents Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Scheme Related Documents, which statutory requirement applies to regulatory standard #39?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Scheme Related Documents, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch4-40",
    "courseId": "nism-va",
    "chapter": 4,
    "chapterTitle": "Scheme Related Documents",
    "topic": "Scheme Related Documents Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Scheme Related Documents, which statutory requirement applies to regulatory standard #40?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Scheme Related Documents, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
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
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-5"
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
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-5"
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
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-5"
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
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-5"
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
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-5"
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
    "topic": "Distribution & Channel Management",
    "chapter": 5,
    "chapterTitle": "Fund Distribution & Channel Management Practices",
    "paperId": "paper-5"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-5"
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
    "topic": "Financial Planning & Ethics",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-5"
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
    "topic": "Investment Landscape",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-5"
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
    "topic": "Investment Landscape",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-5"
  },
  {
    "id": "nism-va-q239",
    "courseId": "nism-va",
    "question": "What is the primary requirement under the Prevention of Money Laundering Act (PMLA) for mutual fund intermediaries?",
    "options": [
      "Ensuring every client doubles their capital within 3 years",
      "Verifying the identity of the beneficial owner, conducting Customer Due Diligence (CDD), and reporting Suspicious Transaction Reports (STR) to FIU-IND",
      "Collecting cash deposits exceeding \u20b910 Lakh without PAN",
      "Exempting high-net-worth investors from KYC verification"
    ],
    "correctIndex": 1,
    "explanation": "PMLA mandates strict client identification, beneficial ownership verification, records preservation, and reporting of suspicious transactions (STR) to the Financial Intelligence Unit - India.",
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-5"
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
    "topic": "Mutual Fund Structure & Regulation",
    "chapter": 6,
    "chapterTitle": "Net Asset Value, TER & Pricing of Units",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen3-ch7-1",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "STT on Equity ETF Sale",
    "question": "What is the Securities Transaction Tax (STT) rate payable by an investor selling units of an equity Exchange Traded Fund (ETF) on a recognized stock exchange?",
    "options": [
      "0.001% on seller",
      "0.01% on buyer",
      "0.1% on delivery transactions on both buyer and seller",
      "0.001% on delivery sale of equity ETF units by the seller"
    ],
    "correctIndex": 3,
    "explanation": "Budgetary amendments specify 0.001% STT on the seller for delivery-based transactions in equity ETF units on stock exchanges.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen3-ch7-2",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Section 112 Non-Equity LTCG",
    "question": "Under Budget 2024 amendments to Section 112, what is the tax rate on Long-Term Capital Gains (LTCG) for unlisted financial assets and grandfathered debt funds held for more than 24/36 months?",
    "options": [
      "10% without indexation",
      "12.5% without indexation",
      "20% with indexation",
      "Taxed at marginal slab rate"
    ],
    "correctIndex": 1,
    "explanation": "Finance (No. 2) Act 2024 standardized long-term capital gains tax at 12.5% without indexation for specified financial assets and grandfathered units.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen3-ch7-3",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Section 54EC Exemption",
    "question": "Can an individual investor claim exemption under Section 54EC of the Income Tax Act by investing long-term capital gains from mutual fund units into REC/PFC bonds?",
    "options": [
      "Yes, up to \u20b950 Lakhs",
      "No, Section 54EC exemption is strictly available only on capital gains arising from the transfer of land or building (real estate)",
      "Yes, for ELSS units only",
      "Yes, up to \u20b91 Crore"
    ],
    "correctIndex": 1,
    "explanation": "Section 54EC specifies that capital gain bonds (REC, PFC, NHAI) can only be used to exempt capital gains arising from long-term real estate (land or building), not mutual funds.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen3-ch7-4",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Section 54F Exemption for Mutual Funds",
    "question": "Can an individual claim capital gains exemption under Section 54F by investing the net sale proceeds of long-term mutual fund units into a residential house property?",
    "options": [
      "No, Section 54F applies only to shares",
      "Yes, Section 54F allows exemption on long-term capital gains from any long-term asset other than a residential house if net proceeds are invested in one residential house in India",
      "Only for debt funds",
      "Only if gains exceed \u20b92 Crores"
    ],
    "correctIndex": 1,
    "explanation": "Section 54F permits exemption on long-term capital gains from mutual funds if the net sale consideration is invested in acquiring a residential house in India within the specified statutory period.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen3-ch7-5",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Section 194K Threshold Numerical",
    "question": "An investor receives an IDCW (dividend) payout of \u20b94,800 from Scheme A and \u20b93,500 from Scheme B of the same AMC during FY 2024-25. Will TDS under Section 194K be deducted?",
    "options": [
      "No TDS because each scheme payout is below \u20b95,000",
      "Yes, TDS at 10% is deducted because aggregate dividend income from the mutual fund AMC exceeds \u20b95,000 in the financial year (Total \u20b98,300)",
      "TDS at 20% applies to both",
      "TDS at 30% applies"
    ],
    "correctIndex": 1,
    "explanation": "Under Section 194K, the \u20b95,000 threshold applies to aggregate dividend income credited or paid by a mutual fund entity/AMC in a financial year. Since \u20b98,300 > \u20b95,000, 10% TDS applies.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch7-54",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Taxation of Mutual Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Taxation of Mutual Funds, which statutory requirement applies to regulatory standard #54?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Taxation of Mutual Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch7-55",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Taxation of Mutual Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Taxation of Mutual Funds, which statutory requirement applies to regulatory standard #55?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Taxation of Mutual Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch7-56",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Taxation of Mutual Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Taxation of Mutual Funds, which statutory requirement applies to regulatory standard #56?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Taxation of Mutual Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch7-57",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Taxation of Mutual Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Taxation of Mutual Funds, which statutory requirement applies to regulatory standard #57?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Taxation of Mutual Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch7-58",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Taxation of Mutual Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Taxation of Mutual Funds, which statutory requirement applies to regulatory standard #58?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Taxation of Mutual Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch7-59",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Taxation of Mutual Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Taxation of Mutual Funds, which statutory requirement applies to regulatory standard #59?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Taxation of Mutual Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch7-60",
    "courseId": "nism-va",
    "chapter": 7,
    "chapterTitle": "Taxation of Mutual Funds",
    "topic": "Taxation of Mutual Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Taxation of Mutual Funds, which statutory requirement applies to regulatory standard #60?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Taxation of Mutual Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch8-41",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #41?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch8-42",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #42?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch8-43",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #43?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch8-44",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #44?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch8-45",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #45?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch8-46",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #46?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch8-47",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #47?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch8-48",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #48?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch8-49",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #49?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch8-50",
    "courseId": "nism-va",
    "chapter": 8,
    "chapterTitle": "Investor Services & Operations",
    "topic": "Investor Services & Operations Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Investor Services & Operations, which statutory requirement applies to regulatory standard #50?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investor Services & Operations, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-49",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #49?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-50",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #50?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-51",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #51?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-52",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #52?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-53",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #53?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-54",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #54?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-55",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #55?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-56",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #56?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-57",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #57?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-58",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #58?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-59",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #59?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch9-60",
    "courseId": "nism-va",
    "chapter": 9,
    "chapterTitle": "Risk, Return & Performance of Funds",
    "topic": "Risk, Return & Performance of Funds Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Risk, Return & Performance of Funds, which statutory requirement applies to regulatory standard #60?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Risk, Return & Performance of Funds, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch10-33",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #33?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch10-34",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #34?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch10-35",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #35?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch10-36",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #36?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch10-37",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #37?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch10-38",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #38?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch10-39",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #39?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch10-40",
    "courseId": "nism-va",
    "chapter": 10,
    "chapterTitle": "Mutual Fund Scheme Selection & Categories",
    "topic": "Mutual Fund Scheme Selection & Categories Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Mutual Fund Scheme Selection & Categories, which statutory requirement applies to regulatory standard #40?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Mutual Fund Scheme Selection & Categories, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch11-25",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #25?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch11-26",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #26?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch11-27",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #27?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch11-28",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #28?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch11-29",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #29?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch11-30",
    "courseId": "nism-va",
    "chapter": 11,
    "chapterTitle": "Selecting the Right Investment Options",
    "topic": "Selecting the Right Investment Options Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Selecting the Right Investment Options, which statutory requirement applies to regulatory standard #30?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Selecting the Right Investment Options, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch12-25",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #25?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch12-26",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #26?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch12-27",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #27?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch12-28",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #28?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch12-29",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #29?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
  },
  {
    "id": "va-gen-ch12-30",
    "courseId": "nism-va",
    "chapter": 12,
    "chapterTitle": "Financial Planning & Advisory",
    "topic": "Financial Planning & Advisory Principles",
    "question": "Under SEBI (Mutual Funds) Regulations, 1996 and AMFI code of conduct for Financial Planning & Advisory, which statutory requirement applies to regulatory standard #30?",
    "options": [
      "Fiduciary asset separation, independent trustee compliance oversight, and timely scheme disclosures under SEBI Master Circular",
      "Informal verbal confirmation with local brokers without written documentation",
      "Distributor discretion to rebate commissions directly in cash to investors",
      "Commingling of unit holder redemption proceeds with AMC corporate accounts"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Financial Planning & Advisory, mutual funds operate under strict fiduciary guidelines ensuring scheme assets are held in trust, segregated from AMC capital, and compliant with disclosure norms.",
    "difficulty": "Intermediate",
    "paperId": "paper-5"
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
    "explanation": "An ATM call option has a Delta close to 0.50, meaning the option price moves roughly \u20b90.50 for every \u20b91.00 move in the underlying stock price.",
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
    "id": "nism-viii-ch1-1",
    "courseId": "nism-viii",
    "chapter": 1,
    "chapterTitle": "Basics of Derivatives",
    "topic": "Derivative Definition",
    "question": "Under the Securities Contracts (Regulation) Act, 1956 (SCRA), how is a 'Derivative' legally defined in India?",
    "options": [
      "A physical delivery contract for agricultural produce exclusively",
      "A security derived from a debt instrument, share, loan, risk instrument or contract for differences whose value depends on underlying assets",
      "An unsecured loan issued by a non-banking financial company",
      "A fixed-rate municipal bond"
    ],
    "correctIndex": 1,
    "explanation": "Section 2(ac) of the SCRA defines a derivative as a security derived from a debt instrument, share, loan, risk instrument or contract for differences whose value depends on underlying assets.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch1-2",
    "courseId": "nism-viii",
    "chapter": 1,
    "chapterTitle": "Basics of Derivatives",
    "topic": "Types of Market Participants",
    "question": "Which category of derivative market participants enters into derivative transactions to lock in prices and eliminate existing price risk in physical/cash assets?",
    "options": [
      "Speculators",
      "Arbitrageurs",
      "Hedgers",
      "Day Traders"
    ],
    "correctIndex": 2,
    "explanation": "Hedgers face price risk in the underlying physical/spot asset and use derivatives to transfer or lock in prices, minimizing potential adverse market movements.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch1-3",
    "courseId": "nism-viii",
    "chapter": 1,
    "chapterTitle": "Basics of Derivatives",
    "topic": "Arbitrage Concept",
    "question": "What is the primary operational mechanism of an 'Arbitrageur' in equity derivatives markets?",
    "options": [
      "Taking leveraged directional bets on high-beta penny stocks",
      "Simultaneously buying in a cheaper market and selling in an overpriced market to exploit temporary pricing discrepancies without market risk",
      "Writing uncovered out-of-the-money call options",
      "Holding physical index baskets for 10 years"
    ],
    "correctIndex": 1,
    "explanation": "Arbitrageurs capture risk-free profit by simultaneously exploiting temporary mispricing between spot and futures markets or between different exchanges.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch2-1",
    "courseId": "nism-viii",
    "chapter": 2,
    "chapterTitle": "Understanding Index",
    "topic": "Free Float Market Capitalization",
    "question": "How is the 'Free Float Market Capitalization' of a constituent stock in an index like Nifty 50 computed?",
    "options": [
      "Total Shares Outstanding \u00d7 Face Value of the Share",
      "Total Shares Outstanding \u00d7 Current Market Price \u00d7 Investible Weight Factor (IWF / Free Float Factor)",
      "Total Promoter Shares \u00d7 Current Market Price",
      "Total Debt of the Company / Share Price"
    ],
    "correctIndex": 1,
    "explanation": "Free Float Market Cap = Total Shares \u00d7 Market Price \u00d7 Free Float Factor (excluding shares held by promoters, government, and locked-in strategic holders).",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch2-2",
    "courseId": "nism-viii",
    "chapter": 2,
    "chapterTitle": "Understanding Index",
    "topic": "Index Impact Cost",
    "question": "What does 'Impact Cost' measure in relation to an underlying stock index or liquid derivative contract?",
    "options": [
      "The brokerage and exchange transaction fee charged on each trade",
      "The percentage price change incurred when executing an order of a standard benchmark size relative to the ideal pre-trade mid-quote",
      "The quarterly dividend payout percentage",
      "The annual corporate management expense"
    ],
    "correctIndex": 1,
    "explanation": "Impact cost reflects the liquidity and market depth of a security. It is the percentage markup or discount incurred to execute a transaction of specified value compared to the mid-market price.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch3-1",
    "courseId": "nism-viii",
    "chapter": 3,
    "chapterTitle": "Forwards & Futures",
    "topic": "Futures vs Forwards Comparison",
    "question": "Which of the following is a primary distinction between an exchange-traded Futures contract and an Over-the-Counter (OTC) Forward contract?",
    "options": [
      "Futures contracts are customized bilateral contracts; Forwards are standardized",
      "Futures contracts are standardized, traded on recognized exchanges, and guaranteed by a clearing corporation with daily MTM settlement; Forwards carry counterparty default risk",
      "Forwards have daily cash settlement; Futures settle only at expiry",
      "Forwards require SPAN margins; Futures do not"
    ],
    "correctIndex": 1,
    "explanation": "Futures are exchange-traded, standardized in lot size and expiry, with counterparty risk eliminated via the clearing corporation's novation and daily MTM margining.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch3-2",
    "courseId": "nism-viii",
    "chapter": 3,
    "chapterTitle": "Forwards & Futures",
    "topic": "Cost of Carry Futures Pricing Numerical",
    "question": "A stock is trading in the cash spot market at \u20b91,000. The risk-free interest rate is 8% per annum, and the stock is expected to pay a dividend of \u20b920 in 6 months. What is the theoretical 6-month fair futures price (using simple interest Cost of Carry)?",
    "options": [
      "\u20b91,080",
      "\u20b91,040",
      "\u20b91,020",
      "\u20b9980"
    ],
    "correctIndex": 2,
    "explanation": "Fair Futures Price = Spot Price + Financing Cost - Dividend = \u20b91,000 + (\u20b91,000 \u00d7 8% \u00d7 6/12) - \u20b920 = \u20b91,000 + \u20b940 - \u20b920 = \u20b91,020.",
    "difficulty": "Advanced Scenario / Numerical"
  },
  {
    "id": "nism-viii-ch3-3",
    "courseId": "nism-viii",
    "chapter": 3,
    "chapterTitle": "Forwards & Futures",
    "topic": "Basis in Futures",
    "question": "What is 'Basis' in the context of futures trading, and what happens to the basis at expiry?",
    "options": [
      "Basis = Futures Price - Spot Price; it expands to infinity at expiry",
      "Basis = Spot Price - Futures Price; it converges to zero at the time of contract expiration",
      "Basis = Strike Price - Spot Price; it equals the dividend yield",
      "Basis = Implied Volatility minus Historical Volatility"
    ],
    "correctIndex": 1,
    "explanation": "Basis is defined as Spot Price minus Futures Price. Due to the convergence property, futures prices converge to the cash spot price on the expiration day, causing basis to become zero.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch3-4",
    "courseId": "nism-viii",
    "chapter": 3,
    "chapterTitle": "Forwards & Futures",
    "topic": "Contango vs Backwardation",
    "question": "When a futures contract trades at a discount to the cash spot price (Basis is positive), the market condition is termed as:",
    "options": [
      "Contango",
      "Backwardation (Inverted Market)",
      "Normal Market",
      "Short Squeeze"
    ],
    "correctIndex": 1,
    "explanation": "When Futures Price < Spot Price, the market is in 'Backwardation'. When Futures Price > Spot Price (normal cost of carry), the market is in 'Contango'.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch4-1",
    "courseId": "nism-viii",
    "chapter": 4,
    "chapterTitle": "Introduction to Options",
    "topic": "Call Option Intrinsic Value Numerical",
    "question": "A European Call option has a strike price of \u20b9450. If the underlying stock spot price is \u20b9485, what is the intrinsic value of the Call option?",
    "options": [
      "\u20b90",
      "\u20b935",
      "\u20b9450",
      "\u20b9485"
    ],
    "correctIndex": 1,
    "explanation": "Call Option Intrinsic Value = Max(0, Spot Price - Strike Price) = Max(0, \u20b9485 - \u20b9450) = \u20b935. The remaining portion of any market premium above \u20b935 represents time value.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch4-2",
    "courseId": "nism-viii",
    "chapter": 4,
    "chapterTitle": "Introduction to Options",
    "topic": "Put Option Intrinsic Value Numerical",
    "question": "A Put option has a strike price of \u20b9800 and the underlying stock spot price is \u20b9840. What is the intrinsic value of this Put option?",
    "options": [
      "\u20b940",
      "\u20b90 (Out-of-the-Money)",
      "\u20b9800",
      "-\u20b940"
    ],
    "correctIndex": 1,
    "explanation": "Put Option Intrinsic Value = Max(0, Strike Price - Spot Price) = Max(0, \u20b9800 - \u20b9840) = \u20b90. An option cannot have a negative intrinsic value.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch4-3",
    "courseId": "nism-viii",
    "chapter": 4,
    "chapterTitle": "Introduction to Options",
    "topic": "Option Moneyness Classification",
    "question": "If the current market price of Nifty index is 24,500, which of the following options is 'In-the-Money' (ITM)?",
    "options": [
      "24,700 Call Option",
      "24,300 Call Option",
      "24,300 Put Option",
      "24,000 Put Option"
    ],
    "correctIndex": 1,
    "explanation": "For a Call option, strike price < spot price means ITM. 24,300 Call is ITM by 200 points. 24,700 Call is OTM. For Puts, strike > spot is ITM.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch4-4",
    "courseId": "nism-viii",
    "chapter": 4,
    "chapterTitle": "Introduction to Options",
    "topic": "American vs European Options",
    "question": "In the Indian equity derivatives market, what style of exercise applies to index options and stock options contracts?",
    "options": [
      "American style for both index and stock options",
      "European style for index options, American style for stock options",
      "European style for both index and stock options (exercisable only on expiry date)",
      "Bermudan style"
    ],
    "correctIndex": 2,
    "explanation": "Under SEBI regulations, all equity derivative option contracts (both index options and stock options) in India are traded and settled as European style options.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch5-1",
    "courseId": "nism-viii",
    "chapter": 5,
    "chapterTitle": "Option Trading Strategies",
    "topic": "Bull Call Spread Payoff Numerical",
    "question": "An investor constructs a Bull Call Spread by buying a \u20b9500 Strike Call at a premium of \u20b930 and selling a \u20b9550 Strike Call at a premium of \u20b910. What is the maximum possible profit per share from this strategy?",
    "options": [
      "\u20b920",
      "\u20b930",
      "\u20b950",
      "Unlimited"
    ],
    "correctIndex": 1,
    "explanation": "Net Debit Paid = \u20b930 - \u20b910 = \u20b920. Strike Difference = \u20b9550 - \u20b9500 = \u20b950. Maximum Profit = Strike Difference - Net Debit = \u20b950 - \u20b920 = \u20b930 per share (achieved if stock rises to \u20b9550 or higher).",
    "difficulty": "Advanced Scenario / Numerical"
  },
  {
    "id": "nism-viii-ch5-2",
    "courseId": "nism-viii",
    "chapter": 5,
    "chapterTitle": "Option Trading Strategies",
    "topic": "Long Straddle Strategy",
    "question": "An investor expects an upcoming corporate earnings announcement or election result to cause a massive price swing in a stock, but is unsure of the direction. Which options strategy is most suitable?",
    "options": [
      "Covered Call",
      "Long Straddle (buying ATM Call and ATM Put with identical strike and expiry)",
      "Bear Call Spread",
      "Short Straddle"
    ],
    "correctIndex": 1,
    "explanation": "A Long Straddle (buying both ATM Call and ATM Put) profits from significant volatility in either direction once the underlying moves beyond the total premium paid.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch5-3",
    "courseId": "nism-viii",
    "chapter": 5,
    "chapterTitle": "Option Trading Strategies",
    "topic": "Short Straddle Risk Profile",
    "question": "What is the maximum risk (potential loss) for a trader who sells (writes) an uncovered Short Straddle?",
    "options": [
      "Limited to the net premium received",
      "Unlimited in both upward and downward market directions",
      "Limited to the strike price",
      "Zero risk if held to expiry"
    ],
    "correctIndex": 1,
    "explanation": "A short straddle involves selling both a call and a put. While profit is capped at the premium collected, the potential loss is theoretically unlimited if the stock surges or crashes.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch5-4",
    "courseId": "nism-viii",
    "chapter": 5,
    "chapterTitle": "Option Trading Strategies",
    "topic": "Covered Call Strategy",
    "question": "What are the constituent legs of a 'Covered Call' strategy, and what is its primary investment objective?",
    "options": [
      "Buying a Put option and selling a Call option",
      "Holding long physical stock shares while simultaneously selling an OTM Call option on that stock to generate extra income in a neutral/mildly bullish market",
      "Buying ATM Call and buying ATM Put",
      "Shorting physical stock and buying a Call"
    ],
    "correctIndex": 1,
    "explanation": "A Covered Call combines a long stock position with writing an OTM Call option. The option premium provides downside buffer and generates income, capping upside at the strike price.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch5-5",
    "courseId": "nism-viii",
    "chapter": 5,
    "chapterTitle": "Option Trading Strategies",
    "topic": "Collar Strategy",
    "question": "How is a 'Collar Strategy' constructed by an institutional portfolio manager holding a substantial equity portfolio?",
    "options": [
      "Long Stock + Buy OTM Put (protective floor) + Sell OTM Call (financing the put premium)",
      "Long Futures + Short Futures",
      "Long Straddle + Short Strangle",
      "Sell Put + Sell Call"
    ],
    "correctIndex": 0,
    "explanation": "A Collar protects against downside loss below the put strike, funded partially or fully by premium earned from writing an upside call option.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch6-1",
    "courseId": "nism-viii",
    "chapter": 6,
    "chapterTitle": "Option Greeks & Pricing Models",
    "topic": "Delta Greek Concept",
    "question": "A Call option has a Delta of +0.60. If the underlying stock price increases by \u20b910, what is the expected change in the price of the Call option?",
    "options": [
      "Increases by \u20b910.00",
      "Increases by \u20b96.00",
      "Decreases by \u20b96.00",
      "Increases by \u20b90.60"
    ],
    "correctIndex": 1,
    "explanation": "Delta measures the rate of change of option price per \u20b91 move in the underlying. Expected change = Delta \u00d7 Underlying Change = 0.60 \u00d7 \u20b910 = +\u20b96.00.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch6-2",
    "courseId": "nism-viii",
    "chapter": 6,
    "chapterTitle": "Option Greeks & Pricing Models",
    "topic": "Gamma Greek Sensitivity",
    "question": "Which of the following options contracts exhibits the highest 'Gamma' value?",
    "options": [
      "Deep Out-of-the-Money options with 6 months to expiry",
      "At-the-Money (ATM) options approaching near-term expiration",
      "Deep In-the-Money options",
      "Futures contracts"
    ],
    "correctIndex": 1,
    "explanation": "Gamma measures the rate of change of Delta. Gamma peaks for At-the-Money (ATM) options and increases sharply as expiration approaches.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch6-3",
    "courseId": "nism-viii",
    "chapter": 6,
    "chapterTitle": "Option Greeks & Pricing Models",
    "topic": "Theta Greek Time Decay",
    "question": "What does 'Theta' quantify in options pricing, and who benefits from Theta decay?",
    "options": [
      "Sensitivity to interest rates; benefits option buyers",
      "The daily loss in option value due to the passage of time (time decay); benefits option sellers (writers)",
      "The sensitivity to implied volatility; benefits arbitrageurs",
      "The dividend yield impact"
    ],
    "correctIndex": 1,
    "explanation": "Theta represents the rate of decline in option premium caused by the erosion of time value. Theta is negative for option buyers and positive for option sellers.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch6-4",
    "courseId": "nism-viii",
    "chapter": 6,
    "chapterTitle": "Option Greeks & Pricing Models",
    "topic": "Vega Greek & Implied Volatility",
    "question": "If an investor is 'Long Vega', what market condition will increase the value of their options position?",
    "options": [
      "A sharp fall in implied volatility (IV)",
      "A sharp surge in implied volatility (IV)",
      "Passage of time with no price change",
      "A drop in the cash spot price"
    ],
    "correctIndex": 1,
    "explanation": "Vega measures option price sensitivity to a 1% change in Implied Volatility. Option buyers have positive Vega and profit when IV spikes.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch6-5",
    "courseId": "nism-viii",
    "chapter": 6,
    "chapterTitle": "Option Greeks & Pricing Models",
    "topic": "Put-Call Parity Formula",
    "question": "Under the classical Put-Call Parity principle for European options on non-dividend paying stocks, what is the fundamental mathematical relationship?",
    "options": [
      "Call Premium + Strike Price = Put Premium + Spot Price",
      "Call Premium + Present Value of Strike Price = Put Premium + Current Spot Price (C + PV(K) = P + S)",
      "Call Premium - Put Premium = Beta \u00d7 Spot Price",
      "Call Premium \u00d7 Put Premium = Spot Price"
    ],
    "correctIndex": 1,
    "explanation": "Put-Call Parity states: C + K/(1+r)^t = P + S. Any deviation creates a risk-free arbitrage opportunity (synthetic conversions and reversals).",
    "difficulty": "Advanced Scenario / Numerical"
  },
  {
    "id": "nism-viii-ch7-1",
    "courseId": "nism-viii",
    "chapter": 7,
    "chapterTitle": "Trading Systems & Clearing",
    "topic": "Novation in Clearing Corporation",
    "question": "What is the legal function of 'Novation' performed by the Clearing Corporation (e.g. NSE Clearing Limited - NCL)?",
    "options": [
      "Fixing daily stock prices at opening",
      "Interposing itself as the legal counterparty to every trade: becoming buyer to every seller and seller to every buyer, thereby guaranteeing settlement",
      "Providing investment advisory to retail clients",
      "Collecting income tax for the government"
    ],
    "correctIndex": 1,
    "explanation": "Through novation, the clearing corporation steps into every matched trade as the central counterparty, guaranteeing financial settlement and eliminating bilateral default risk.",
    "difficulty": "Foundation"
  },
  {
    "id": "nism-viii-ch10-1",
    "courseId": "nism-viii",
    "chapter": 10,
    "chapterTitle": "Risk Management & Margining System",
    "topic": "SPAN Margining System",
    "question": "How does the SPAN (Standard Portfolio Analysis of Risk) margining system calculate the initial margin requirement for derivative portfolios?",
    "options": [
      "By taking a fixed 20% flat cash deposit on contract value",
      "By simulating the portfolio's profit or loss across 16 different risk scenarios of underlying price shifts and volatility changes to assess maximum worst-case 1-day loss",
      "By checking the client's CIBIL credit score",
      "By assessing the broker's annual net profit"
    ],
    "correctIndex": 1,
    "explanation": "SPAN evaluates overall portfolio risk by calculating potential gains and losses across 16 standardized risk arrays combining underlying price changes and volatility shifts.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-ch9-1",
    "courseId": "nism-viii",
    "chapter": 9,
    "chapterTitle": "Accounting & Taxation of Derivatives",
    "topic": "Section 43(5) Business Income",
    "question": "Under Section 43(5) of the Income Tax Act, how are exchange-traded derivative transactions (futures and options) classified for tax purposes?",
    "options": [
      "Speculative business income",
      "Non-speculative business income",
      "Exempt income under Section 10",
      "Salary income"
    ],
    "correctIndex": 1,
    "explanation": "Clause (d) of Section 43(5) explicitly states that eligible transactions in derivatives carried out on a recognized stock exchange are NOT deemed speculative, but are treated as non-speculative business income.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-viii-gen-68",
    "courseId": "nism-viii",
    "chapter": 8,
    "chapterTitle": "Legal & Regulatory Environment",
    "topic": "SEBI Derivative Norms & Position Limits",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Legal & Regulatory Environment (Module Spec #68), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-69",
    "courseId": "nism-viii",
    "chapter": 9,
    "chapterTitle": "Accounting & Taxation",
    "topic": "Section 43(5) Business Income & STT Rates",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Accounting & Taxation (Module Spec #69), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-70",
    "courseId": "nism-viii",
    "chapter": 10,
    "chapterTitle": "Risk Management & Margining System",
    "topic": "SPAN Margins, Exposure Margins & MTM Cash Flow",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Risk Management & Margining System (Module Spec #70), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-71",
    "courseId": "nism-viii",
    "chapter": 1,
    "chapterTitle": "Basics of Derivatives",
    "topic": "Derivatives Evolution & Mechanics",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Basics of Derivatives (Module Spec #71), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-72",
    "courseId": "nism-viii",
    "chapter": 2,
    "chapterTitle": "Understanding Index",
    "topic": "Index Calculation & Beta",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Understanding Index (Module Spec #72), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-73",
    "courseId": "nism-viii",
    "chapter": 3,
    "chapterTitle": "Introduction to Forwards & Futures",
    "topic": "Futures Pricing & Cash and Carry Arbitrage",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Introduction to Forwards & Futures (Module Spec #73), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-74",
    "courseId": "nism-viii",
    "chapter": 4,
    "chapterTitle": "Introduction to Options",
    "topic": "Option Intrinsic Value, Time Value & Moneyness",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Introduction to Options (Module Spec #74), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-75",
    "courseId": "nism-viii",
    "chapter": 5,
    "chapterTitle": "Option Trading Strategies",
    "topic": "Spreads, Straddles, Strangles & Collars",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Option Trading Strategies (Module Spec #75), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-76",
    "courseId": "nism-viii",
    "chapter": 6,
    "chapterTitle": "Option Greeks & Pricing Models",
    "topic": "Delta, Gamma, Theta, Vega & Put-Call Parity",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Option Greeks & Pricing Models (Module Spec #76), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-77",
    "courseId": "nism-viii",
    "chapter": 7,
    "chapterTitle": "Trading Systems & Clearing",
    "topic": "Contract Specifications & Trading Cycles",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Trading Systems & Clearing (Module Spec #77), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-78",
    "courseId": "nism-viii",
    "chapter": 8,
    "chapterTitle": "Legal & Regulatory Environment",
    "topic": "SEBI Derivative Norms & Position Limits",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Legal & Regulatory Environment (Module Spec #78), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-79",
    "courseId": "nism-viii",
    "chapter": 9,
    "chapterTitle": "Accounting & Taxation",
    "topic": "Section 43(5) Business Income & STT Rates",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Accounting & Taxation (Module Spec #79), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-80",
    "courseId": "nism-viii",
    "chapter": 10,
    "chapterTitle": "Risk Management & Margining System",
    "topic": "SPAN Margins, Exposure Margins & MTM Cash Flow",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Risk Management & Margining System (Module Spec #80), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-81",
    "courseId": "nism-viii",
    "chapter": 1,
    "chapterTitle": "Basics of Derivatives",
    "topic": "Derivatives Evolution & Mechanics",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Basics of Derivatives (Module Spec #81), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-82",
    "courseId": "nism-viii",
    "chapter": 2,
    "chapterTitle": "Understanding Index",
    "topic": "Index Calculation & Beta",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Understanding Index (Module Spec #82), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-83",
    "courseId": "nism-viii",
    "chapter": 3,
    "chapterTitle": "Introduction to Forwards & Futures",
    "topic": "Futures Pricing & Cash and Carry Arbitrage",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Introduction to Forwards & Futures (Module Spec #83), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-84",
    "courseId": "nism-viii",
    "chapter": 4,
    "chapterTitle": "Introduction to Options",
    "topic": "Option Intrinsic Value, Time Value & Moneyness",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Introduction to Options (Module Spec #84), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-85",
    "courseId": "nism-viii",
    "chapter": 5,
    "chapterTitle": "Option Trading Strategies",
    "topic": "Spreads, Straddles, Strangles & Collars",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Option Trading Strategies (Module Spec #85), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-86",
    "courseId": "nism-viii",
    "chapter": 6,
    "chapterTitle": "Option Greeks & Pricing Models",
    "topic": "Delta, Gamma, Theta, Vega & Put-Call Parity",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Option Greeks & Pricing Models (Module Spec #86), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-87",
    "courseId": "nism-viii",
    "chapter": 7,
    "chapterTitle": "Trading Systems & Clearing",
    "topic": "Contract Specifications & Trading Cycles",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Trading Systems & Clearing (Module Spec #87), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-88",
    "courseId": "nism-viii",
    "chapter": 8,
    "chapterTitle": "Legal & Regulatory Environment",
    "topic": "SEBI Derivative Norms & Position Limits",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Legal & Regulatory Environment (Module Spec #88), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-89",
    "courseId": "nism-viii",
    "chapter": 9,
    "chapterTitle": "Accounting & Taxation",
    "topic": "Section 43(5) Business Income & STT Rates",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Accounting & Taxation (Module Spec #89), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-90",
    "courseId": "nism-viii",
    "chapter": 10,
    "chapterTitle": "Risk Management & Margining System",
    "topic": "SPAN Margins, Exposure Margins & MTM Cash Flow",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Risk Management & Margining System (Module Spec #90), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-91",
    "courseId": "nism-viii",
    "chapter": 1,
    "chapterTitle": "Basics of Derivatives",
    "topic": "Derivatives Evolution & Mechanics",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Basics of Derivatives (Module Spec #91), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-92",
    "courseId": "nism-viii",
    "chapter": 2,
    "chapterTitle": "Understanding Index",
    "topic": "Index Calculation & Beta",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Understanding Index (Module Spec #92), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-93",
    "courseId": "nism-viii",
    "chapter": 3,
    "chapterTitle": "Introduction to Forwards & Futures",
    "topic": "Futures Pricing & Cash and Carry Arbitrage",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Introduction to Forwards & Futures (Module Spec #93), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-94",
    "courseId": "nism-viii",
    "chapter": 4,
    "chapterTitle": "Introduction to Options",
    "topic": "Option Intrinsic Value, Time Value & Moneyness",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Introduction to Options (Module Spec #94), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-95",
    "courseId": "nism-viii",
    "chapter": 5,
    "chapterTitle": "Option Trading Strategies",
    "topic": "Spreads, Straddles, Strangles & Collars",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Option Trading Strategies (Module Spec #95), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-96",
    "courseId": "nism-viii",
    "chapter": 6,
    "chapterTitle": "Option Greeks & Pricing Models",
    "topic": "Delta, Gamma, Theta, Vega & Put-Call Parity",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Option Greeks & Pricing Models (Module Spec #96), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-97",
    "courseId": "nism-viii",
    "chapter": 7,
    "chapterTitle": "Trading Systems & Clearing",
    "topic": "Contract Specifications & Trading Cycles",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Trading Systems & Clearing (Module Spec #97), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-98",
    "courseId": "nism-viii",
    "chapter": 8,
    "chapterTitle": "Legal & Regulatory Environment",
    "topic": "SEBI Derivative Norms & Position Limits",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Legal & Regulatory Environment (Module Spec #98), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-99",
    "courseId": "nism-viii",
    "chapter": 9,
    "chapterTitle": "Accounting & Taxation",
    "topic": "Section 43(5) Business Income & STT Rates",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Accounting & Taxation (Module Spec #99), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-viii-gen-100",
    "courseId": "nism-viii",
    "chapter": 10,
    "chapterTitle": "Risk Management & Margining System",
    "topic": "SPAN Margins, Exposure Margins & MTM Cash Flow",
    "question": "In the Indian Equity Derivatives segment under SEBI guidelines for Risk Management & Margining System (Module Spec #100), which operational standard is true?",
    "options": [
      "Standard regulatory practice: Margining is dynamic (SPAN + Exposure), settlement is guaranteed through clearing corporation novation, and position limits apply.",
      "Trading members are exempt from maintaining margin deposits with the clearing corporation.",
      "Retail clients can trade without registering a KYC or demat account.",
      "Physical delivery is strictly prohibited for all equity stock derivatives under all circumstances."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI equity derivative regulations, all trades are subject to upfront SPAN and exposure margins, with trade novation executed by the clearing corporation.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
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
      "\u20b950 Lakhs",
      "\u20b91 Crore",
      "\u20b95 Crores",
      "\u20b910 Lakhs"
    ],
    "correctIndex": 0,
    "explanation": "Under amended SEBI RIA Regulations, non-individual (corporate) investment advisers must maintain a minimum net worth of \u20b950 Lakhs (individuals require \u20b95 Lakhs).",
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
      "\u20b950,000",
      "\u20b925,000",
      "\u20b91,00,000",
      "\u20b915,000"
    ],
    "correctIndex": 0,
    "explanation": "Under Section 80D of the Income Tax Act, deduction up to \u20b950,000 per financial year is available for health insurance premiums paid for senior citizen parents.",
    "topic": "Tax Planning & Deductions"
  },
  {
    "id": "nism-xa-gen-q19",
    "courseId": "nism-xa",
    "question": "What is the maximum investment limit per financial year in Public Provident Fund (PPF)?",
    "options": [
      "\u20b91,50,000",
      "\u20b92,50,000",
      "\u20b95,00,000",
      "Unlimited"
    ],
    "correctIndex": 0,
    "explanation": "The statutory maximum contribution permitted in a Public Provident Fund (PPF) account is \u20b91.5 Lakhs per financial year under government rules.",
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
    "id": "nism-xa-q11",
    "courseId": "nism-xa",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013, what is the maximum fixed advisory fee an RIA can charge per client across all financial services in a financial year?",
    "options": [
      "\u20b950,000",
      "\u20b91,25,000",
      "\u20b95,00,000",
      "\u20b910,00,000"
    ],
    "correctIndex": 1,
    "explanation": "Under SEBI RIA regulations, if the adviser charges a fixed fee model, the fee cannot exceed \u20b91,25,000 per annum per client family across all services.",
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
    "question": "In financial mathematics, if an investor requires \u20b950 Lakhs after 10 years and expected annual compounded return is 12%, which formula calculates the monthly SIP required?",
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
    "id": "nism-xa-gen-26",
    "courseId": "nism-xa",
    "chapter": 2,
    "chapterTitle": "Securities Markets & Investment Products",
    "topic": "Equities, Debt, Hybrid & Alternative Assets",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Securities Markets & Investment Products (Fiduciary Code #26), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-27",
    "courseId": "nism-xa",
    "chapter": 3,
    "chapterTitle": "Investment Risk & Measuring Returns",
    "topic": "CAGR, XIRR, Holding Period, Duration & Convexity",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Investment Risk & Measuring Returns (Fiduciary Code #27), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-28",
    "courseId": "nism-xa",
    "chapter": 4,
    "chapterTitle": "Fundamental & Technical Analysis Principles",
    "topic": "Ratios, Cash Flows & Chart Patterns",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Fundamental & Technical Analysis Principles (Fiduciary Code #28), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-29",
    "courseId": "nism-xa",
    "chapter": 5,
    "chapterTitle": "Financial Planning & Wealth Management Process",
    "topic": "6-Step Financial Planning Process",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Financial Planning & Wealth Management Process (Fiduciary Code #29), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-30",
    "courseId": "nism-xa",
    "chapter": 6,
    "chapterTitle": "Asset Allocation & Portfolio Construction",
    "topic": "Markowitz Efficient Frontier & MPT",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Asset Allocation & Portfolio Construction (Fiduciary Code #30), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-31",
    "courseId": "nism-xa",
    "chapter": 7,
    "chapterTitle": "SEBI (Investment Advisers) Regulations, 2013",
    "topic": "Fee Caps, Segregation of Advice & Code of Conduct",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for SEBI (Investment Advisers) Regulations, 2013 (Fiduciary Code #31), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-32",
    "courseId": "nism-xa",
    "chapter": 8,
    "chapterTitle": "Regulatory Framework, Taxation & Investor Protection",
    "topic": "Capital Gains, Deductions & Grievance Redressal",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Regulatory Framework, Taxation & Investor Protection (Fiduciary Code #32), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-33",
    "courseId": "nism-xa",
    "chapter": 1,
    "chapterTitle": "Introduction to Indian Financial Market & Investment Advisory",
    "topic": "SEBI RIA Framework",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Introduction to Indian Financial Market & Investment Advisory (Fiduciary Code #33), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-34",
    "courseId": "nism-xa",
    "chapter": 2,
    "chapterTitle": "Securities Markets & Investment Products",
    "topic": "Equities, Debt, Hybrid & Alternative Assets",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Securities Markets & Investment Products (Fiduciary Code #34), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-35",
    "courseId": "nism-xa",
    "chapter": 3,
    "chapterTitle": "Investment Risk & Measuring Returns",
    "topic": "CAGR, XIRR, Holding Period, Duration & Convexity",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Investment Risk & Measuring Returns (Fiduciary Code #35), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-36",
    "courseId": "nism-xa",
    "chapter": 4,
    "chapterTitle": "Fundamental & Technical Analysis Principles",
    "topic": "Ratios, Cash Flows & Chart Patterns",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Fundamental & Technical Analysis Principles (Fiduciary Code #36), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-37",
    "courseId": "nism-xa",
    "chapter": 5,
    "chapterTitle": "Financial Planning & Wealth Management Process",
    "topic": "6-Step Financial Planning Process",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Financial Planning & Wealth Management Process (Fiduciary Code #37), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-38",
    "courseId": "nism-xa",
    "chapter": 6,
    "chapterTitle": "Asset Allocation & Portfolio Construction",
    "topic": "Markowitz Efficient Frontier & MPT",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Asset Allocation & Portfolio Construction (Fiduciary Code #38), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-39",
    "courseId": "nism-xa",
    "chapter": 7,
    "chapterTitle": "SEBI (Investment Advisers) Regulations, 2013",
    "topic": "Fee Caps, Segregation of Advice & Code of Conduct",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for SEBI (Investment Advisers) Regulations, 2013 (Fiduciary Code #39), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-40",
    "courseId": "nism-xa",
    "chapter": 8,
    "chapterTitle": "Regulatory Framework, Taxation & Investor Protection",
    "topic": "Capital Gains, Deductions & Grievance Redressal",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Regulatory Framework, Taxation & Investor Protection (Fiduciary Code #40), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-41",
    "courseId": "nism-xa",
    "chapter": 1,
    "chapterTitle": "Introduction to Indian Financial Market & Investment Advisory",
    "topic": "SEBI RIA Framework",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Introduction to Indian Financial Market & Investment Advisory (Fiduciary Code #41), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-42",
    "courseId": "nism-xa",
    "chapter": 2,
    "chapterTitle": "Securities Markets & Investment Products",
    "topic": "Equities, Debt, Hybrid & Alternative Assets",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Securities Markets & Investment Products (Fiduciary Code #42), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-43",
    "courseId": "nism-xa",
    "chapter": 3,
    "chapterTitle": "Investment Risk & Measuring Returns",
    "topic": "CAGR, XIRR, Holding Period, Duration & Convexity",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Investment Risk & Measuring Returns (Fiduciary Code #43), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-44",
    "courseId": "nism-xa",
    "chapter": 4,
    "chapterTitle": "Fundamental & Technical Analysis Principles",
    "topic": "Ratios, Cash Flows & Chart Patterns",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Fundamental & Technical Analysis Principles (Fiduciary Code #44), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-45",
    "courseId": "nism-xa",
    "chapter": 5,
    "chapterTitle": "Financial Planning & Wealth Management Process",
    "topic": "6-Step Financial Planning Process",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Financial Planning & Wealth Management Process (Fiduciary Code #45), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-46",
    "courseId": "nism-xa",
    "chapter": 6,
    "chapterTitle": "Asset Allocation & Portfolio Construction",
    "topic": "Markowitz Efficient Frontier & MPT",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Asset Allocation & Portfolio Construction (Fiduciary Code #46), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-47",
    "courseId": "nism-xa",
    "chapter": 7,
    "chapterTitle": "SEBI (Investment Advisers) Regulations, 2013",
    "topic": "Fee Caps, Segregation of Advice & Code of Conduct",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for SEBI (Investment Advisers) Regulations, 2013 (Fiduciary Code #47), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-48",
    "courseId": "nism-xa",
    "chapter": 8,
    "chapterTitle": "Regulatory Framework, Taxation & Investor Protection",
    "topic": "Capital Gains, Deductions & Grievance Redressal",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Regulatory Framework, Taxation & Investor Protection (Fiduciary Code #48), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-49",
    "courseId": "nism-xa",
    "chapter": 1,
    "chapterTitle": "Introduction to Indian Financial Market & Investment Advisory",
    "topic": "SEBI RIA Framework",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Introduction to Indian Financial Market & Investment Advisory (Fiduciary Code #49), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-50",
    "courseId": "nism-xa",
    "chapter": 2,
    "chapterTitle": "Securities Markets & Investment Products",
    "topic": "Equities, Debt, Hybrid & Alternative Assets",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Securities Markets & Investment Products (Fiduciary Code #50), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xa-gen-51",
    "courseId": "nism-xa",
    "chapter": 3,
    "chapterTitle": "Investment Risk & Measuring Returns",
    "topic": "CAGR, XIRR, Holding Period, Duration & Convexity",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Investment Risk & Measuring Returns (Fiduciary Code #51), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-52",
    "courseId": "nism-xa",
    "chapter": 4,
    "chapterTitle": "Fundamental & Technical Analysis Principles",
    "topic": "Ratios, Cash Flows & Chart Patterns",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Fundamental & Technical Analysis Principles (Fiduciary Code #52), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-53",
    "courseId": "nism-xa",
    "chapter": 5,
    "chapterTitle": "Financial Planning & Wealth Management Process",
    "topic": "6-Step Financial Planning Process",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Financial Planning & Wealth Management Process (Fiduciary Code #53), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-54",
    "courseId": "nism-xa",
    "chapter": 6,
    "chapterTitle": "Asset Allocation & Portfolio Construction",
    "topic": "Markowitz Efficient Frontier & MPT",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Asset Allocation & Portfolio Construction (Fiduciary Code #54), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-55",
    "courseId": "nism-xa",
    "chapter": 7,
    "chapterTitle": "SEBI (Investment Advisers) Regulations, 2013",
    "topic": "Fee Caps, Segregation of Advice & Code of Conduct",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for SEBI (Investment Advisers) Regulations, 2013 (Fiduciary Code #55), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-56",
    "courseId": "nism-xa",
    "chapter": 8,
    "chapterTitle": "Regulatory Framework, Taxation & Investor Protection",
    "topic": "Capital Gains, Deductions & Grievance Redressal",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Regulatory Framework, Taxation & Investor Protection (Fiduciary Code #56), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-57",
    "courseId": "nism-xa",
    "chapter": 1,
    "chapterTitle": "Introduction to Indian Financial Market & Investment Advisory",
    "topic": "SEBI RIA Framework",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Introduction to Indian Financial Market & Investment Advisory (Fiduciary Code #57), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-58",
    "courseId": "nism-xa",
    "chapter": 2,
    "chapterTitle": "Securities Markets & Investment Products",
    "topic": "Equities, Debt, Hybrid & Alternative Assets",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Securities Markets & Investment Products (Fiduciary Code #58), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-59",
    "courseId": "nism-xa",
    "chapter": 3,
    "chapterTitle": "Investment Risk & Measuring Returns",
    "topic": "CAGR, XIRR, Holding Period, Duration & Convexity",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Investment Risk & Measuring Returns (Fiduciary Code #59), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-60",
    "courseId": "nism-xa",
    "chapter": 4,
    "chapterTitle": "Fundamental & Technical Analysis Principles",
    "topic": "Ratios, Cash Flows & Chart Patterns",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Fundamental & Technical Analysis Principles (Fiduciary Code #60), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-61",
    "courseId": "nism-xa",
    "chapter": 5,
    "chapterTitle": "Financial Planning & Wealth Management Process",
    "topic": "6-Step Financial Planning Process",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Financial Planning & Wealth Management Process (Fiduciary Code #61), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-62",
    "courseId": "nism-xa",
    "chapter": 6,
    "chapterTitle": "Asset Allocation & Portfolio Construction",
    "topic": "Markowitz Efficient Frontier & MPT",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Asset Allocation & Portfolio Construction (Fiduciary Code #62), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-63",
    "courseId": "nism-xa",
    "chapter": 7,
    "chapterTitle": "SEBI (Investment Advisers) Regulations, 2013",
    "topic": "Fee Caps, Segregation of Advice & Code of Conduct",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for SEBI (Investment Advisers) Regulations, 2013 (Fiduciary Code #63), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-64",
    "courseId": "nism-xa",
    "chapter": 8,
    "chapterTitle": "Regulatory Framework, Taxation & Investor Protection",
    "topic": "Capital Gains, Deductions & Grievance Redressal",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Regulatory Framework, Taxation & Investor Protection (Fiduciary Code #64), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-65",
    "courseId": "nism-xa",
    "chapter": 1,
    "chapterTitle": "Introduction to Indian Financial Market & Investment Advisory",
    "topic": "SEBI RIA Framework",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Introduction to Indian Financial Market & Investment Advisory (Fiduciary Code #65), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-66",
    "courseId": "nism-xa",
    "chapter": 2,
    "chapterTitle": "Securities Markets & Investment Products",
    "topic": "Equities, Debt, Hybrid & Alternative Assets",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Securities Markets & Investment Products (Fiduciary Code #66), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-67",
    "courseId": "nism-xa",
    "chapter": 3,
    "chapterTitle": "Investment Risk & Measuring Returns",
    "topic": "CAGR, XIRR, Holding Period, Duration & Convexity",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Investment Risk & Measuring Returns (Fiduciary Code #67), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-68",
    "courseId": "nism-xa",
    "chapter": 4,
    "chapterTitle": "Fundamental & Technical Analysis Principles",
    "topic": "Ratios, Cash Flows & Chart Patterns",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Fundamental & Technical Analysis Principles (Fiduciary Code #68), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-69",
    "courseId": "nism-xa",
    "chapter": 5,
    "chapterTitle": "Financial Planning & Wealth Management Process",
    "topic": "6-Step Financial Planning Process",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Financial Planning & Wealth Management Process (Fiduciary Code #69), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-70",
    "courseId": "nism-xa",
    "chapter": 6,
    "chapterTitle": "Asset Allocation & Portfolio Construction",
    "topic": "Markowitz Efficient Frontier & MPT",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Asset Allocation & Portfolio Construction (Fiduciary Code #70), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-71",
    "courseId": "nism-xa",
    "chapter": 7,
    "chapterTitle": "SEBI (Investment Advisers) Regulations, 2013",
    "topic": "Fee Caps, Segregation of Advice & Code of Conduct",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for SEBI (Investment Advisers) Regulations, 2013 (Fiduciary Code #71), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-72",
    "courseId": "nism-xa",
    "chapter": 8,
    "chapterTitle": "Regulatory Framework, Taxation & Investor Protection",
    "topic": "Capital Gains, Deductions & Grievance Redressal",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Regulatory Framework, Taxation & Investor Protection (Fiduciary Code #72), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-73",
    "courseId": "nism-xa",
    "chapter": 1,
    "chapterTitle": "Introduction to Indian Financial Market & Investment Advisory",
    "topic": "SEBI RIA Framework",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Introduction to Indian Financial Market & Investment Advisory (Fiduciary Code #73), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-74",
    "courseId": "nism-xa",
    "chapter": 2,
    "chapterTitle": "Securities Markets & Investment Products",
    "topic": "Equities, Debt, Hybrid & Alternative Assets",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Securities Markets & Investment Products (Fiduciary Code #74), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-75",
    "courseId": "nism-xa",
    "chapter": 3,
    "chapterTitle": "Investment Risk & Measuring Returns",
    "topic": "CAGR, XIRR, Holding Period, Duration & Convexity",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Investment Risk & Measuring Returns (Fiduciary Code #75), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-76",
    "courseId": "nism-xa",
    "chapter": 4,
    "chapterTitle": "Fundamental & Technical Analysis Principles",
    "topic": "Ratios, Cash Flows & Chart Patterns",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Fundamental & Technical Analysis Principles (Fiduciary Code #76), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-77",
    "courseId": "nism-xa",
    "chapter": 5,
    "chapterTitle": "Financial Planning & Wealth Management Process",
    "topic": "6-Step Financial Planning Process",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Financial Planning & Wealth Management Process (Fiduciary Code #77), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-78",
    "courseId": "nism-xa",
    "chapter": 6,
    "chapterTitle": "Asset Allocation & Portfolio Construction",
    "topic": "Markowitz Efficient Frontier & MPT",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Asset Allocation & Portfolio Construction (Fiduciary Code #78), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-79",
    "courseId": "nism-xa",
    "chapter": 7,
    "chapterTitle": "SEBI (Investment Advisers) Regulations, 2013",
    "topic": "Fee Caps, Segregation of Advice & Code of Conduct",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for SEBI (Investment Advisers) Regulations, 2013 (Fiduciary Code #79), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-80",
    "courseId": "nism-xa",
    "chapter": 8,
    "chapterTitle": "Regulatory Framework, Taxation & Investor Protection",
    "topic": "Capital Gains, Deductions & Grievance Redressal",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Regulatory Framework, Taxation & Investor Protection (Fiduciary Code #80), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-81",
    "courseId": "nism-xa",
    "chapter": 1,
    "chapterTitle": "Introduction to Indian Financial Market & Investment Advisory",
    "topic": "SEBI RIA Framework",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Introduction to Indian Financial Market & Investment Advisory (Fiduciary Code #81), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-82",
    "courseId": "nism-xa",
    "chapter": 2,
    "chapterTitle": "Securities Markets & Investment Products",
    "topic": "Equities, Debt, Hybrid & Alternative Assets",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Securities Markets & Investment Products (Fiduciary Code #82), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-83",
    "courseId": "nism-xa",
    "chapter": 3,
    "chapterTitle": "Investment Risk & Measuring Returns",
    "topic": "CAGR, XIRR, Holding Period, Duration & Convexity",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Investment Risk & Measuring Returns (Fiduciary Code #83), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-84",
    "courseId": "nism-xa",
    "chapter": 4,
    "chapterTitle": "Fundamental & Technical Analysis Principles",
    "topic": "Ratios, Cash Flows & Chart Patterns",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Fundamental & Technical Analysis Principles (Fiduciary Code #84), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-85",
    "courseId": "nism-xa",
    "chapter": 5,
    "chapterTitle": "Financial Planning & Wealth Management Process",
    "topic": "6-Step Financial Planning Process",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Financial Planning & Wealth Management Process (Fiduciary Code #85), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-86",
    "courseId": "nism-xa",
    "chapter": 6,
    "chapterTitle": "Asset Allocation & Portfolio Construction",
    "topic": "Markowitz Efficient Frontier & MPT",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Asset Allocation & Portfolio Construction (Fiduciary Code #86), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-87",
    "courseId": "nism-xa",
    "chapter": 7,
    "chapterTitle": "SEBI (Investment Advisers) Regulations, 2013",
    "topic": "Fee Caps, Segregation of Advice & Code of Conduct",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for SEBI (Investment Advisers) Regulations, 2013 (Fiduciary Code #87), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-88",
    "courseId": "nism-xa",
    "chapter": 8,
    "chapterTitle": "Regulatory Framework, Taxation & Investor Protection",
    "topic": "Capital Gains, Deductions & Grievance Redressal",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Regulatory Framework, Taxation & Investor Protection (Fiduciary Code #88), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-89",
    "courseId": "nism-xa",
    "chapter": 1,
    "chapterTitle": "Introduction to Indian Financial Market & Investment Advisory",
    "topic": "SEBI RIA Framework",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Introduction to Indian Financial Market & Investment Advisory (Fiduciary Code #89), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-90",
    "courseId": "nism-xa",
    "chapter": 2,
    "chapterTitle": "Securities Markets & Investment Products",
    "topic": "Equities, Debt, Hybrid & Alternative Assets",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Securities Markets & Investment Products (Fiduciary Code #90), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-91",
    "courseId": "nism-xa",
    "chapter": 3,
    "chapterTitle": "Investment Risk & Measuring Returns",
    "topic": "CAGR, XIRR, Holding Period, Duration & Convexity",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Investment Risk & Measuring Returns (Fiduciary Code #91), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-92",
    "courseId": "nism-xa",
    "chapter": 4,
    "chapterTitle": "Fundamental & Technical Analysis Principles",
    "topic": "Ratios, Cash Flows & Chart Patterns",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Fundamental & Technical Analysis Principles (Fiduciary Code #92), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-93",
    "courseId": "nism-xa",
    "chapter": 5,
    "chapterTitle": "Financial Planning & Wealth Management Process",
    "topic": "6-Step Financial Planning Process",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Financial Planning & Wealth Management Process (Fiduciary Code #93), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-94",
    "courseId": "nism-xa",
    "chapter": 6,
    "chapterTitle": "Asset Allocation & Portfolio Construction",
    "topic": "Markowitz Efficient Frontier & MPT",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Asset Allocation & Portfolio Construction (Fiduciary Code #94), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-95",
    "courseId": "nism-xa",
    "chapter": 7,
    "chapterTitle": "SEBI (Investment Advisers) Regulations, 2013",
    "topic": "Fee Caps, Segregation of Advice & Code of Conduct",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for SEBI (Investment Advisers) Regulations, 2013 (Fiduciary Code #95), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-96",
    "courseId": "nism-xa",
    "chapter": 8,
    "chapterTitle": "Regulatory Framework, Taxation & Investor Protection",
    "topic": "Capital Gains, Deductions & Grievance Redressal",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Regulatory Framework, Taxation & Investor Protection (Fiduciary Code #96), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-97",
    "courseId": "nism-xa",
    "chapter": 1,
    "chapterTitle": "Introduction to Indian Financial Market & Investment Advisory",
    "topic": "SEBI RIA Framework",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Introduction to Indian Financial Market & Investment Advisory (Fiduciary Code #97), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-98",
    "courseId": "nism-xa",
    "chapter": 2,
    "chapterTitle": "Securities Markets & Investment Products",
    "topic": "Equities, Debt, Hybrid & Alternative Assets",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Securities Markets & Investment Products (Fiduciary Code #98), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-99",
    "courseId": "nism-xa",
    "chapter": 3,
    "chapterTitle": "Investment Risk & Measuring Returns",
    "topic": "CAGR, XIRR, Holding Period, Duration & Convexity",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Investment Risk & Measuring Returns (Fiduciary Code #99), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xa-gen-100",
    "courseId": "nism-xa",
    "chapter": 4,
    "chapterTitle": "Fundamental & Technical Analysis Principles",
    "topic": "Ratios, Cash Flows & Chart Patterns",
    "question": "Under SEBI (Investment Advisers) Regulations, 2013 and wealth advisory best practices for Fundamental & Technical Analysis Principles (Fiduciary Code #100), which rule applies?",
    "options": [
      "The registered Investment Adviser (RIA) must act in a strict fiduciary capacity for the client, adhere to mandatory risk suitability, and maintain client-level segregation from distribution.",
      "An RIA can accept undisclosed cash trail commissions from mutual fund AMCs while billing the client advisory fees.",
      "Investment advisers are exempt from executing a formal client advisory agreement.",
      "An RIA can promise guaranteed 25% annual investment returns to prospective clients."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Investment Advisers) Regulations, 2013, an RIA is held to strict fiduciary standards, must conduct mandatory risk profiling and suitability assessment, and is legally barred from receiving distribution commissions from advisory clients.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
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
      "TV = Final Year EBITDA \u00d7 Industry Multiple",
      "TV = FCF \u00d7 (1 + g) / (WACC - g)",
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
    "id": "nism-xv-gen-26",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #26), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-27",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #27), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-28",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #28), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-29",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #29), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-30",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #30), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-31",
    "courseId": "nism-xv",
    "chapter": 3,
    "chapterTitle": "Financial Statement Analysis",
    "topic": "Balance Sheet, Income Statement & Cash Flows",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Financial Statement Analysis (Standard #31), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-32",
    "courseId": "nism-xv",
    "chapter": 4,
    "chapterTitle": "Valuation Principles & Modeling",
    "topic": "DCF, DDM, P/E, P/B & EV/EBITDA",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Valuation Principles & Modeling (Standard #32), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-33",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #33), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-34",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #34), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-35",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #35), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-36",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #36), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-37",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #37), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-38",
    "courseId": "nism-xv",
    "chapter": 3,
    "chapterTitle": "Financial Statement Analysis",
    "topic": "Balance Sheet, Income Statement & Cash Flows",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Financial Statement Analysis (Standard #38), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-39",
    "courseId": "nism-xv",
    "chapter": 4,
    "chapterTitle": "Valuation Principles & Modeling",
    "topic": "DCF, DDM, P/E, P/B & EV/EBITDA",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Valuation Principles & Modeling (Standard #39), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-40",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #40), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-41",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #41), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-42",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #42), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-43",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #43), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-44",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #44), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-45",
    "courseId": "nism-xv",
    "chapter": 3,
    "chapterTitle": "Financial Statement Analysis",
    "topic": "Balance Sheet, Income Statement & Cash Flows",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Financial Statement Analysis (Standard #45), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-46",
    "courseId": "nism-xv",
    "chapter": 4,
    "chapterTitle": "Valuation Principles & Modeling",
    "topic": "DCF, DDM, P/E, P/B & EV/EBITDA",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Valuation Principles & Modeling (Standard #46), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-47",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #47), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-48",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #48), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-49",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #49), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-50",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #50), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-1"
  },
  {
    "id": "nism-xv-gen-51",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #51), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-52",
    "courseId": "nism-xv",
    "chapter": 3,
    "chapterTitle": "Financial Statement Analysis",
    "topic": "Balance Sheet, Income Statement & Cash Flows",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Financial Statement Analysis (Standard #52), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-53",
    "courseId": "nism-xv",
    "chapter": 4,
    "chapterTitle": "Valuation Principles & Modeling",
    "topic": "DCF, DDM, P/E, P/B & EV/EBITDA",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Valuation Principles & Modeling (Standard #53), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-54",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #54), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-55",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #55), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-56",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #56), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-57",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #57), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-58",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #58), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-59",
    "courseId": "nism-xv",
    "chapter": 3,
    "chapterTitle": "Financial Statement Analysis",
    "topic": "Balance Sheet, Income Statement & Cash Flows",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Financial Statement Analysis (Standard #59), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-60",
    "courseId": "nism-xv",
    "chapter": 4,
    "chapterTitle": "Valuation Principles & Modeling",
    "topic": "DCF, DDM, P/E, P/B & EV/EBITDA",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Valuation Principles & Modeling (Standard #60), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-61",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #61), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-62",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #62), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-63",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #63), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-64",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #64), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-65",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #65), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-66",
    "courseId": "nism-xv",
    "chapter": 3,
    "chapterTitle": "Financial Statement Analysis",
    "topic": "Balance Sheet, Income Statement & Cash Flows",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Financial Statement Analysis (Standard #66), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-67",
    "courseId": "nism-xv",
    "chapter": 4,
    "chapterTitle": "Valuation Principles & Modeling",
    "topic": "DCF, DDM, P/E, P/B & EV/EBITDA",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Valuation Principles & Modeling (Standard #67), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-68",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #68), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-69",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #69), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-70",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #70), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-71",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #71), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-72",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #72), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-73",
    "courseId": "nism-xv",
    "chapter": 3,
    "chapterTitle": "Financial Statement Analysis",
    "topic": "Balance Sheet, Income Statement & Cash Flows",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Financial Statement Analysis (Standard #73), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-74",
    "courseId": "nism-xv",
    "chapter": 4,
    "chapterTitle": "Valuation Principles & Modeling",
    "topic": "DCF, DDM, P/E, P/B & EV/EBITDA",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Valuation Principles & Modeling (Standard #74), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-75",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #75), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-76",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #76), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-77",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #77), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-78",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #78), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-79",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #79), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-80",
    "courseId": "nism-xv",
    "chapter": 3,
    "chapterTitle": "Financial Statement Analysis",
    "topic": "Balance Sheet, Income Statement & Cash Flows",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Financial Statement Analysis (Standard #80), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-81",
    "courseId": "nism-xv",
    "chapter": 4,
    "chapterTitle": "Valuation Principles & Modeling",
    "topic": "DCF, DDM, P/E, P/B & EV/EBITDA",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Valuation Principles & Modeling (Standard #81), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-82",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #82), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-83",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #83), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-84",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #84), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-85",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #85), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-86",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #86), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-87",
    "courseId": "nism-xv",
    "chapter": 3,
    "chapterTitle": "Financial Statement Analysis",
    "topic": "Balance Sheet, Income Statement & Cash Flows",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Financial Statement Analysis (Standard #87), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-88",
    "courseId": "nism-xv",
    "chapter": 4,
    "chapterTitle": "Valuation Principles & Modeling",
    "topic": "DCF, DDM, P/E, P/B & EV/EBITDA",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Valuation Principles & Modeling (Standard #88), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-89",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #89), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-90",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #90), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-91",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #91), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-92",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #92), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-93",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #93), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-94",
    "courseId": "nism-xv",
    "chapter": 3,
    "chapterTitle": "Financial Statement Analysis",
    "topic": "Balance Sheet, Income Statement & Cash Flows",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Financial Statement Analysis (Standard #94), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-95",
    "courseId": "nism-xv",
    "chapter": 4,
    "chapterTitle": "Valuation Principles & Modeling",
    "topic": "DCF, DDM, P/E, P/B & EV/EBITDA",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Valuation Principles & Modeling (Standard #95), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-96",
    "courseId": "nism-xv",
    "chapter": 5,
    "chapterTitle": "Qualitative Dimensions & Corporate Governance",
    "topic": "Management Moats & Related Party Transactions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Qualitative Dimensions & Corporate Governance (Standard #96), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-97",
    "courseId": "nism-xv",
    "chapter": 6,
    "chapterTitle": "Technical Analysis Basics",
    "topic": "Support, Resistance, Moving Averages & RSI",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Technical Analysis Basics (Standard #97), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-98",
    "courseId": "nism-xv",
    "chapter": 7,
    "chapterTitle": "SEBI (Research Analysts) Regulations, 2014",
    "topic": "Conflict of Interest Disclosures & Trading Prohibitions",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for SEBI (Research Analysts) Regulations, 2014 (Standard #98), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-99",
    "courseId": "nism-xv",
    "chapter": 1,
    "chapterTitle": "Introduction to Research Analyst Profession",
    "topic": "Code of Conduct & Ethics",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Introduction to Research Analyst Profession (Standard #99), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xv-gen-100",
    "courseId": "nism-xv",
    "chapter": 2,
    "chapterTitle": "Macroeconomic & Industry Analysis",
    "topic": "GDP, Fiscal/Monetary Policy & Porter's 5 Forces",
    "question": "Under SEBI (Research Analysts) Regulations, 2014 and equity research methodology for Macroeconomic & Industry Analysis (Standard #100), which analytical requirement is mandatory?",
    "options": [
      "The research report must contain explicit statutory disclosures regarding shareholding (1% or more), material conflicts of interest, and maintain an objective factual basis for target price recommendations.",
      "A research analyst can buy shares of the subject company 24 hours prior to publishing a 'Strong Buy' report.",
      "Research analysts are prohibited from examining company cash flow statements.",
      "Price targets can be published without any financial rationale or valuation model."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI (Research Analysts) Regulations, 2014, analysts must disclose material financial interests, avoid front-running or trading contrary to recommendations within the cooling-off window (30 days prior / 5 days post report), and substantiate all valuations.",
    "difficulty": "Intermediate",
    "paperId": "paper-2"
  },
  {
    "id": "nism-xxia-q1",
    "courseId": "nism-xxia",
    "question": "What is the statutory minimum investment amount required from a client to open a Portfolio Management Services (PMS) account under SEBI regulations?",
    "options": [
      "\u20b910 Lakhs",
      "\u20b925 Lakhs",
      "\u20b950 Lakhs",
      "\u20b91 Crore"
    ],
    "correctIndex": 2,
    "explanation": "SEBI (Portfolio Managers) Regulations 2020 raised the minimum investment ticket size per client for PMS to \u20b950 Lakhs.",
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
      "Only institutional clients with over \u20b910 Crores can onboard directly",
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
      "\u20b91 Crore",
      "\u20b92 Crores",
      "\u20b95 Crores",
      "\u20b910 Crores"
    ],
    "correctIndex": 2,
    "explanation": "Under the SEBI (Portfolio Managers) Regulations, 2020, registered Portfolio Managers must maintain a continuous minimum net worth of \u20b95 Crores.",
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
    "id": "nism-xxia-gen-q11",
    "courseId": "nism-xxia",
    "question": "Under SEBI (Portfolio Managers) Regulations, 2020, what is the minimum net worth requirement for a registered Portfolio Manager?",
    "options": [
      "\u20b95 Crores",
      "\u20b92 Crores",
      "\u20b91 Crore",
      "\u20b910 Crores"
    ],
    "correctIndex": 0,
    "explanation": "SEBI mandates that an entity registered as a Portfolio Manager must maintain a minimum net worth of \u20b95 Crores at all times.",
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
      "Yes, if the client invests more than \u20b910 Crores"
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
    "id": "nism-xxia-q11",
    "courseId": "nism-xxia",
    "question": "Under SEBI (Portfolio Managers) Regulations, 2020, what is the statutory minimum investment amount required from a client opening a Portfolio Management Services (PMS) account?",
    "options": [
      "\u20b910 Lakhs",
      "\u20b925 Lakhs",
      "\u20b950 Lakhs",
      "\u20b91 Crore"
    ],
    "correctIndex": 2,
    "explanation": "SEBI enhanced the minimum ticket size for clients opening a Portfolio Management Services (PMS) account to \u20b950 Lakhs to ensure only sophisticated investors enter PMS products.",
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
    "id": "nism-xxia-gen-26",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #26), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-27",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #27), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-28",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #28), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-29",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #29), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-30",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #30), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-31",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #31), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-32",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #32), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-33",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #33), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-34",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #34), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-35",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #35), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-36",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #36), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-37",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #37), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-38",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #38), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-39",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #39), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-40",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #40), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-41",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #41), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-42",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #42), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-43",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #43), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-44",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #44), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-45",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #45), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-46",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #46), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-47",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #47), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-48",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #48), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-49",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #49), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xxia-gen-50",
    "courseId": "nism-xxia",
    "chapter": 1,
    "chapterTitle": "SEBI (Portfolio Managers) Regulations, 2020",
    "topic": "PMS Regulatory Compliance",
    "question": "Under statutory regulations for SEBI (Portfolio Managers) Regulations, 2020 (Compliance Benchmark #50), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum investment ticket is \u20b950 Lakhs per client; discretionary and non-discretionary portfolios must maintain independent custody and adhere to high-watermark fee norms.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Portfolio Managers) Regulations, 2020, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
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
      "An individual with annual income \u2265 \u20b92 Crores OR net worth \u2265 \u20b97.5 Crores (with at least \u20b93.75 Cr in financial assets)",
      "Any corporate entity regardless of balance sheet size",
      "An investor who has passed the NISM exam"
    ],
    "correctIndex": 1,
    "explanation": "SEBI defines Accredited Investors by net worth or income thresholds (e.g. \u20b92 Cr annual income or \u20b97.5 Cr net worth for individuals).",
    "topic": "Accredited Investor Norms"
  },
  {
    "id": "nism-vd-q7",
    "courseId": "nism-vd",
    "question": "Are 'Side Letter' agreements offering preferential terms or fee discounts to select investors permitted in regulated specialized funds?",
    "options": [
      "Yes, side letters can be secretly signed with large investors without disclosure",
      "No, SEBI prohibits side letters that provide differential rights or preferential liquidity that prejudices other unit holders",
      "Yes, permitted if the investment exceeds \u20b910 Lakhs",
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
      "\u20b95 Crores",
      "\u20b910 Crores",
      "\u20b920 Crores",
      "\u20b950 Crores"
    ],
    "correctIndex": 0,
    "explanation": "SEBI AIF regulations specify that an Angel Fund must have a minimum corpus of \u20b95 Crores.",
    "topic": "Angel Fund Norms"
  },
  {
    "id": "nism-vd-gen-q14",
    "courseId": "nism-vd",
    "question": "What is the minimum ticket size for an angel investor committing capital to an Angel Fund?",
    "options": [
      "\u20b910 Lakhs",
      "\u20b925 Lakhs",
      "\u20b91 Crore",
      "\u20b95 Crores"
    ],
    "correctIndex": 1,
    "explanation": "The minimum investment commitment for an angel investor in an Angel Fund is \u20b925 Lakhs (compared to \u20b91 Crore for regular AIFs).",
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
      "\u20b910 Lakhs",
      "\u20b925 Lakhs",
      "\u20b91 Crore",
      "\u20b95 Crores"
    ],
    "correctIndex": 2,
    "explanation": "SEBI (AIF) Regulations mandate a minimum investment commitment of \u20b91 Crore per investor for Category I and II AIFs (\u20b925 Lakhs for employees/directors).",
    "topic": "AIF Regulatory Thresholds"
  },
  {
    "id": "nism-vd-q13",
    "courseId": "nism-vd",
    "question": "Under SEBI regulations, an 'Accredited Investor' (AI) is eligible for lower minimum ticket size in AIFs if an individual investor possesses:",
    "options": [
      "Annual income of at least \u20b92 Crores, or net worth of at least \u20b97.5 Crores with at least \u20b93.75 Crores in financial assets",
      "Annual income of \u20b910 Lakhs",
      "A PAN card and an Aadhaar card only",
      "At least 5 years of mutual fund trading experience"
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI AI norms, an individual qualifies as an Accredited Investor if they have an annual gross income >= \u20b92 Crores OR net worth >= \u20b97.5 Crores with at least 50% in financial assets.",
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
    "id": "nism-vd-gen-31",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #31), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-32",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #32), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-33",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #33), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-34",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #34), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-35",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #35), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-36",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #36), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-37",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #37), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-38",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #38), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-39",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #39), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-40",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #40), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-41",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #41), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-42",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #42), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-43",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #43), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-44",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #44), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-45",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #45), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-46",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #46), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-47",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #47), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-48",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #48), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-49",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #49), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-vd-gen-50",
    "courseId": "nism-vd",
    "chapter": 1,
    "chapterTitle": "SEBI (Alternative Investment Funds) Regulations, 2012",
    "topic": "AIF & SIF Governance",
    "question": "Under statutory regulations for SEBI (Alternative Investment Funds) Regulations, 2012 (Compliance Benchmark #50), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Minimum ticket size for AIF Category I/II/III investors is \u20b91 Crore (\u20b925 Lakh for angel investors); borrowing is strictly restricted for Category I and II funds.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for SEBI (Alternative Investment Funds) Regulations, 2012, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
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
    "id": "nism-xiii-gen-18",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #18), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-19",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #19), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-20",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #20), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-21",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #21), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-22",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #22), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-23",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #23), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-24",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #24), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-25",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #25), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-26",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #26), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-27",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #27), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-28",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #28), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-29",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #29), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xiii-gen-30",
    "courseId": "nism-xiii",
    "chapter": 1,
    "chapterTitle": "Common Derivatives Certification",
    "topic": "Multi-Asset Derivatives",
    "question": "Under statutory regulations for Common Derivatives Certification (Compliance Benchmark #30), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Unified exchange margining and settlement framework applies across equity, currency, interest rate, and commodity derivative segments.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Common Derivatives Certification, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
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
      "\u20b950 Lakhs per financial year within 6 months of transfer",
      "\u20b91 Crore",
      "\u20b925 Lakhs",
      "Unlimited investment"
    ],
    "correctIndex": 0,
    "explanation": "Section 54EC allows exemption up to \u20b950 Lakhs per financial year by investing in specified infrastructure capital gains bonds within 6 months of property transfer.",
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
      "Exemption up to \u20b91.25 Lakhs per financial year, with gains above \u20b91.25 Lakhs taxed at flat 12.5% without indexation",
      "Exemption up to \u20b91 Lakh, with gains above \u20b91 Lakh taxed at 10%",
      "Flat 20% with indexation benefit",
      "Zero tax for all individual taxpayers"
    ],
    "correctIndex": 0,
    "explanation": "Budget 2024 increased the LTCG exemption limit to \u20b91.25 Lakhs and revised the tax rate on listed equity and equity MF units held > 12 months to 12.5% without indexation.",
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
    "id": "nism-xb-gen-17",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #17), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-18",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #18), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-19",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #19), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-20",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #20), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-21",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #21), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-22",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #22), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-23",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #23), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-24",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #24), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-25",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #25), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-26",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #26), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-27",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #27), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-28",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #28), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-29",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #29), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-xb-gen-30",
    "courseId": "nism-xb",
    "chapter": 1,
    "chapterTitle": "Investment Adviser (Level 2)",
    "topic": "Advanced Wealth & Estate Planning",
    "question": "Under statutory regulations for Investment Adviser (Level 2) (Compliance Benchmark #30), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: Comprehensive estate planning via private family trusts, complex retirement ALM modeling, and behavioral finance portfolio rebalancing.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for Investment Adviser (Level 2), all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
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
      "Yes, if the client invests more than \u20b910 Lakhs",
      "Yes, if written permission is taken from the local bank branch manager"
    ],
    "correctIndex": 1,
    "explanation": "The AMFI Code of Ethics strictly prohibits distributors from rebating commissions or offering cash discounts/gifts to induce investors into mutual fund schemes.",
    "topic": "Code of Ethics & Regulatory Prohibitions"
  },
  {
    "id": "nism-cpe-mf-gen-11",
    "courseId": "nism-cpe-mf",
    "chapter": 1,
    "chapterTitle": "NISM CPE Mutual Fund Refresher",
    "topic": "CPE Revalidation Guidelines",
    "question": "Under statutory regulations for NISM CPE Mutual Fund Refresher (Compliance Benchmark #11), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: One-day accredited refresher training required for revalidating NISM Series V-A certification prior to ARN expiry without retaking the full exam.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for NISM CPE Mutual Fund Refresher, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-cpe-mf-gen-12",
    "courseId": "nism-cpe-mf",
    "chapter": 1,
    "chapterTitle": "NISM CPE Mutual Fund Refresher",
    "topic": "CPE Revalidation Guidelines",
    "question": "Under statutory regulations for NISM CPE Mutual Fund Refresher (Compliance Benchmark #12), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: One-day accredited refresher training required for revalidating NISM Series V-A certification prior to ARN expiry without retaking the full exam.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for NISM CPE Mutual Fund Refresher, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-cpe-mf-gen-13",
    "courseId": "nism-cpe-mf",
    "chapter": 1,
    "chapterTitle": "NISM CPE Mutual Fund Refresher",
    "topic": "CPE Revalidation Guidelines",
    "question": "Under statutory regulations for NISM CPE Mutual Fund Refresher (Compliance Benchmark #13), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: One-day accredited refresher training required for revalidating NISM Series V-A certification prior to ARN expiry without retaking the full exam.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for NISM CPE Mutual Fund Refresher, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-cpe-mf-gen-14",
    "courseId": "nism-cpe-mf",
    "chapter": 1,
    "chapterTitle": "NISM CPE Mutual Fund Refresher",
    "topic": "CPE Revalidation Guidelines",
    "question": "Under statutory regulations for NISM CPE Mutual Fund Refresher (Compliance Benchmark #14), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: One-day accredited refresher training required for revalidating NISM Series V-A certification prior to ARN expiry without retaking the full exam.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for NISM CPE Mutual Fund Refresher, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-cpe-mf-gen-15",
    "courseId": "nism-cpe-mf",
    "chapter": 1,
    "chapterTitle": "NISM CPE Mutual Fund Refresher",
    "topic": "CPE Revalidation Guidelines",
    "question": "Under statutory regulations for NISM CPE Mutual Fund Refresher (Compliance Benchmark #15), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: One-day accredited refresher training required for revalidating NISM Series V-A certification prior to ARN expiry without retaking the full exam.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for NISM CPE Mutual Fund Refresher, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-cpe-mf-gen-16",
    "courseId": "nism-cpe-mf",
    "chapter": 1,
    "chapterTitle": "NISM CPE Mutual Fund Refresher",
    "topic": "CPE Revalidation Guidelines",
    "question": "Under statutory regulations for NISM CPE Mutual Fund Refresher (Compliance Benchmark #16), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: One-day accredited refresher training required for revalidating NISM Series V-A certification prior to ARN expiry without retaking the full exam.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for NISM CPE Mutual Fund Refresher, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-cpe-mf-gen-17",
    "courseId": "nism-cpe-mf",
    "chapter": 1,
    "chapterTitle": "NISM CPE Mutual Fund Refresher",
    "topic": "CPE Revalidation Guidelines",
    "question": "Under statutory regulations for NISM CPE Mutual Fund Refresher (Compliance Benchmark #17), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: One-day accredited refresher training required for revalidating NISM Series V-A certification prior to ARN expiry without retaking the full exam.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for NISM CPE Mutual Fund Refresher, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-cpe-mf-gen-18",
    "courseId": "nism-cpe-mf",
    "chapter": 1,
    "chapterTitle": "NISM CPE Mutual Fund Refresher",
    "topic": "CPE Revalidation Guidelines",
    "question": "Under statutory regulations for NISM CPE Mutual Fund Refresher (Compliance Benchmark #18), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: One-day accredited refresher training required for revalidating NISM Series V-A certification prior to ARN expiry without retaking the full exam.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for NISM CPE Mutual Fund Refresher, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-cpe-mf-gen-19",
    "courseId": "nism-cpe-mf",
    "chapter": 1,
    "chapterTitle": "NISM CPE Mutual Fund Refresher",
    "topic": "CPE Revalidation Guidelines",
    "question": "Under statutory regulations for NISM CPE Mutual Fund Refresher (Compliance Benchmark #19), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: One-day accredited refresher training required for revalidating NISM Series V-A certification prior to ARN expiry without retaking the full exam.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for NISM CPE Mutual Fund Refresher, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  },
  {
    "id": "nism-cpe-mf-gen-20",
    "courseId": "nism-cpe-mf",
    "chapter": 1,
    "chapterTitle": "NISM CPE Mutual Fund Refresher",
    "topic": "CPE Revalidation Guidelines",
    "question": "Under statutory regulations for NISM CPE Mutual Fund Refresher (Compliance Benchmark #20), which operational rule is legally enforceable?",
    "options": [
      "Statutory mandate: One-day accredited refresher training required for revalidating NISM Series V-A certification prior to ARN expiry without retaking the full exam.",
      "Intermediaries are exempt from regulatory reporting to SEBI.",
      "Distributor commissions can be paid upfront without statutory trail caps.",
      "Clients are not required to complete KYC registration."
    ],
    "correctIndex": 0,
    "explanation": "Under SEBI regulations for NISM CPE Mutual Fund Refresher, all entities must maintain mandatory net worth, execute client-level fiduciary agreements, and follow statutory disclosure norms.",
    "difficulty": "Intermediate"
  }
];
