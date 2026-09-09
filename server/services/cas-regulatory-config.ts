/**
 * CAS Regulatory Configuration
 *
 * Authoritative constants for SEBI Consolidated Account Statement (CAS) compliance.
 *
 * SEBI Circular: SEBI/HO/MRD/PoD1/CIR/P/2025/16
 * Date:          February 14, 2025
 * Effective:     May 14, 2025
 *
 * This module is the single source of truth for CAS dispatch timelines.
 * Any change to SEBI deadlines must be made here ONLY.
 *
 * GCR-compliant: engine_version exposed, structured logs on validation failures.
 */

export const CAS_REGULATORY_VERSION = "CAS-SEBI-CIR-2025-16-v1";

export const SEBI_CAS_CIRCULAR = {
	circularNo: "SEBI/HO/MRD/PoD1/CIR/P/2025/16",
	date: "2025-02-14",
	effectiveFrom: "2025-05-14",
	description:
		"Revised timelines for issuance of Consolidated Account Statement (CAS)",
} as const;

// ---------------------------------------------------------------------------
// Monthly CAS deadlines (for accounts with transactions in the month)
// ---------------------------------------------------------------------------
export const MONTHLY_CAS = {
	/**
	 * AMC / MF-RTA must submit common PAN data to depositories (CDSL/NSDL)
	 * within this many calendar days from month-end.
	 * Previous: 3 days. Revised: 5 days (effective May 14, 2025).
	 */
	amcDataSubmissionDays: 5,

	/**
	 * Depositary must dispatch electronic CAS (e-CAS) to investor
	 * by this day of the following month.
	 */
	eCASDispatchDay: 12,

	/**
	 * Depository must dispatch physical CAS to investor
	 * by this day of the following month.
	 */
	physicalDispatchDay: 15,
} as const;

// ---------------------------------------------------------------------------
// Half-Yearly CAS deadlines (for accounts with NO transactions — biannual)
// Half-yearly CAS covers: April (for Oct–Mar period) and October (for Apr–Sep period)
// ---------------------------------------------------------------------------
export const HALF_YEARLY_CAS = {
	/**
	 * Calendar months in which half-yearly CAS is dispatched (1-indexed).
	 * April = 4, October = 10.
	 */
	dispatchMonths: [4, 10] as const,

	/**
	 * AMC / MF-RTA data submission deadline: 8th of April / October.
	 */
	amcDataSubmissionDay: 8,

	/**
	 * e-CAS dispatch deadline: 18th of April / October.
	 */
	eCASDispatchDay: 18,

	/**
	 * Physical CAS dispatch deadline: 21st of April / October.
	 */
	physicalDispatchDay: 21,
} as const;

// ---------------------------------------------------------------------------
// Utility: compute CAS dispatch window for a given statement month
// ---------------------------------------------------------------------------

export interface CASDispatchWindow {
	/** The month this CAS covers (first day of that month) */
	statementMonth: Date;
	/** AMC/RTA must submit PAN data to depository by this date */
	amcSubmissionDeadline: Date;
	/** Depository must dispatch e-CAS by this date */
	eCASDeadline: Date;
	/** Depository must dispatch physical CAS by this date */
	physicalDeadline: Date;
	/** Whether this is a half-yearly CAS cycle */
	isHalfYearly: boolean;
}

/**
 * Compute the CAS dispatch deadlines for a given statement month.
 *
 * @param statementMonth - Any date within the month the CAS covers
 * @returns CASDispatchWindow with all SEBI-mandated deadlines
 *
 * Edge cases:
 * - For April and October, half-yearly rules apply if the account has no
 *   transactions (same dispatch month, different day limits).
 * - Uses UTC-neutral arithmetic (day-of-month only, no timezone shift).
 */
export function computeCASDeadlines(statementMonth: Date): CASDispatchWindow {
	const year = statementMonth.getFullYear();
	const month = statementMonth.getMonth(); // 0-indexed

	const isHalfYearlyMonth = HALF_YEARLY_CAS.dispatchMonths.includes(
		(month + 1) as 4 | 10,
	);

	// Next month (for monthly CAS deadline dates)
	const nextMonth = month === 11 ? 0 : month + 1;
	const nextYear = month === 11 ? year + 1 : year;

	// Half-yearly deadlines land in the dispatch month itself (Apr/Oct)
	const deadlineYear = isHalfYearlyMonth ? year : nextYear;
	const deadlineMonth = isHalfYearlyMonth ? month : nextMonth;

	if (isHalfYearlyMonth) {
		return {
			statementMonth: new Date(year, month, 1),
			amcSubmissionDeadline: new Date(
				deadlineYear,
				deadlineMonth,
				HALF_YEARLY_CAS.amcDataSubmissionDay,
			),
			eCASDeadline: new Date(
				deadlineYear,
				deadlineMonth,
				HALF_YEARLY_CAS.eCASDispatchDay,
			),
			physicalDeadline: new Date(
				deadlineYear,
				deadlineMonth,
				HALF_YEARLY_CAS.physicalDispatchDay,
			),
			isHalfYearly: true,
		};
	}

	return {
		statementMonth: new Date(year, month, 1),
		amcSubmissionDeadline: new Date(
			deadlineYear,
			deadlineMonth,
			MONTHLY_CAS.amcDataSubmissionDays,
		),
		eCASDeadline: new Date(
			deadlineYear,
			deadlineMonth,
			MONTHLY_CAS.eCASDispatchDay,
		),
		physicalDeadline: new Date(
			deadlineYear,
			deadlineMonth,
			MONTHLY_CAS.physicalDispatchDay,
		),
		isHalfYearly: false,
	};
}

// ---------------------------------------------------------------------------
// Utility: validate whether an uploaded CAS arrived within the expected window
// ---------------------------------------------------------------------------

export type CASTimelinessStatus =
	| "ON_TIME"           // received within the legal dispatch window
	| "PREMATURE"         // received before the e-CAS dispatch date (possible error)
	| "LATE"              // received after physical dispatch deadline
	| "INDETERMINATE";    // cannot determine (statementDate missing)

export interface CASTimelinessResult {
	status: CASTimelinessStatus;
	/** Warning message to surface in CASStatementResult.warnings */
	warning?: string;
	dispatchWindow: CASDispatchWindow;
}

/**
 * Validate whether an uploaded/received CAS falls within the legally expected
 * dispatch window under SEBI/HO/MRD/PoD1/CIR/P/2025/16.
 *
 * IMPORTANT: SEBI's dispatch obligation falls on DEPOSITORIES, not investors.
 * A "LATE" status here means the depository may have missed its deadline —
 * it is a WARNING, never a hard block on the investor's upload.
 *
 * @param statementDate   - The "as-of" date printed on the CAS (end of period)
 * @param receivedDate    - The date the investor uploaded/received the CAS
 */
export function validateCASTimeliness(
	statementDate: Date | null,
	receivedDate: Date = new Date(),
): CASTimelinessResult {
	if (!statementDate || Number.isNaN(statementDate.getTime())) {
		return {
			status: "INDETERMINATE",
			dispatchWindow: computeCASDeadlines(new Date()),
		};
	}

	const window = computeCASDeadlines(statementDate);

	if (receivedDate < window.eCASDeadline) {
		return {
			status: "PREMATURE",
			warning:
				`CAS received before expected dispatch date (${window.eCASDeadline.toISOString().slice(0, 10)}). ` +
				`This may indicate the statement covers a different period. ` +
				`Ref: SEBI Circular ${SEBI_CAS_CIRCULAR.circularNo}.`,
			dispatchWindow: window,
		};
	}

	if (receivedDate > window.physicalDeadline) {
		const daysLate = Math.round(
			(receivedDate.getTime() - window.physicalDeadline.getTime()) /
				(1000 * 60 * 60 * 24),
		);
		return {
			status: "LATE",
			warning:
				`CAS received ${daysLate} day(s) after the depository dispatch deadline ` +
				`(${window.physicalDeadline.toISOString().slice(0, 10)}). ` +
				`Your depository may have missed the SEBI-mandated deadline. ` +
				`Ref: SEBI Circular ${SEBI_CAS_CIRCULAR.circularNo}.`,
			dispatchWindow: window,
		};
	}

	return { status: "ON_TIME", dispatchWindow: window };
}
