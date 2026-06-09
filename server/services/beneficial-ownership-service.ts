/**
 * Beneficial Ownership Disclosure Service
 *
 * Implements MCA (Ministry of Corporate Affairs) compliance:
 * - Companies (Significant Beneficial Owners) Rules 2018
 * - Prevention of Money Laundering Act (PMLA) requirements
 * - Collects and maintains beneficial ownership information for entity clients
 * - Tracks ultimate beneficial owners (UBOs) with >10% or >25% thresholds
 */

export interface BeneficialOwner {
	id: string;
	name: string;
	dateOfBirth: string;
	nationality: string;
	residentialAddress: string;
	pan?: string;
	passport?: string;
	ownershipPercentage: number;
	votingRightsPercentage: number;
	controlType: "direct" | "indirect" | "joint";
	controlDescription?: string;
	isUltimateOwner: boolean;
	identificationDocuments: {
		type: string;
		number: string;
		issuingAuthority: string;
		validUntil?: string;
	}[];
	declarationDate: Date;
}

export interface BeneficialOwnershipDeclaration {
	declarationId: string;
	entityClientId: string;
	companyName: string;
	cin?: string;
	registeredAddress: string;
	declarationType: "initial" | "annual_update" | "change_notification";

	significantBeneficialOwners: BeneficialOwner[];

	noSBODeclaration?: {
		declared: boolean;
		reason: "no_sbo_exists" | "government_company" | "listed_company" | "other";
		otherReason?: string;
	};

	declaringOfficer: {
		name: string;
		designation: string;
		din?: string;
		email: string;
		phone: string;
	};

	complianceDetails: {
		formBen1Filed: boolean;
		formBen1Date?: Date;
		formBen2Filed: boolean;
		formBen2Date?: Date;
		registerOfSBOMaintained: boolean;
		lastUpdated: Date;
	};

	regulatoryReference: string;
	declarationDate: Date;
	validUntil: Date;
	status: "draft" | "submitted" | "verified" | "expired" | "needs_update";
	verifiedBy?: string;
	verifiedAt?: Date;

	auditTrail: {
		action: string;
		performedBy: string;
		performedAt: Date;
		details?: string;
	}[];
}

interface CreateDeclarationInput {
	entityClientId: string;
	companyName: string;
	cin?: string;
	registeredAddress: string;
	declarationType: "initial" | "annual_update" | "change_notification";
	significantBeneficialOwners: Omit<
		BeneficialOwner,
		"id" | "declarationDate"
	>[];
	noSBODeclaration?: BeneficialOwnershipDeclaration["noSBODeclaration"];
	declaringOfficer: BeneficialOwnershipDeclaration["declaringOfficer"];
	agentId: string;
}

class BeneficialOwnershipService {
	private readonly REGULATORY_REFERENCE =
		"Companies (Significant Beneficial Owners) Rules 2018";
	private readonly SBO_THRESHOLD_VOTING = 10;
	private readonly SBO_THRESHOLD_SHARES = 10;
	private readonly UBO_THRESHOLD = 25;
	private readonly DECLARATION_VALIDITY_DAYS = 365;

	private declarationsStore: Map<string, BeneficialOwnershipDeclaration> =
		new Map();

	async createDeclaration(
		input: CreateDeclarationInput,
	): Promise<BeneficialOwnershipDeclaration> {
		const declarationId = `BOD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const now = new Date();
		const validUntil = new Date(
			now.getTime() + this.DECLARATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
		);

		const beneficialOwners: BeneficialOwner[] =
			input.significantBeneficialOwners.map((sbo, index) => ({
				...sbo,
				id: `SBO_${declarationId}_${index + 1}`,
				declarationDate: now,
				isUltimateOwner:
					sbo.ownershipPercentage >= this.UBO_THRESHOLD ||
					sbo.votingRightsPercentage >= this.UBO_THRESHOLD,
			}));

		this.validateSBOThresholds(beneficialOwners);

		const declaration: BeneficialOwnershipDeclaration = {
			declarationId,
			entityClientId: input.entityClientId,
			companyName: input.companyName,
			cin: input.cin,
			registeredAddress: input.registeredAddress,
			declarationType: input.declarationType,
			significantBeneficialOwners: beneficialOwners,
			noSBODeclaration: input.noSBODeclaration,
			declaringOfficer: input.declaringOfficer,
			complianceDetails: {
				formBen1Filed: false,
				formBen2Filed: false,
				registerOfSBOMaintained: true,
				lastUpdated: now,
			},
			regulatoryReference: this.REGULATORY_REFERENCE,
			declarationDate: now,
			validUntil,
			status: "submitted",
			auditTrail: [
				{
					action: "DECLARATION_CREATED",
					performedBy: input.agentId,
					performedAt: now,
					details: `Initial ${input.declarationType} declaration with ${beneficialOwners.length} SBOs`,
				},
			],
		};

		this.declarationsStore.set(declarationId, declaration);

		return declaration;
	}

	private validateSBOThresholds(owners: BeneficialOwner[]): void {
		for (const owner of owners) {
			if (
				owner.ownershipPercentage < this.SBO_THRESHOLD_SHARES &&
				owner.votingRightsPercentage < this.SBO_THRESHOLD_VOTING
			) {
				console.warn(
					`Owner ${owner.name} may not qualify as SBO: ownership ${owner.ownershipPercentage}%, voting ${owner.votingRightsPercentage}%`,
				);
			}
		}

		const totalOwnership = owners.reduce(
			(sum, o) => sum + o.ownershipPercentage,
			0,
		);
		if (totalOwnership > 100) {
			console.warn(`Total ownership exceeds 100%: ${totalOwnership}%`);
		}
	}

	async verifyDeclaration(
		declarationId: string,
		verifierId: string,
	): Promise<{ success: boolean; message: string }> {
		const declaration = this.declarationsStore.get(declarationId);

		if (!declaration) {
			return { success: false, message: "Declaration not found" };
		}

		if (declaration.status === "verified") {
			return { success: false, message: "Declaration already verified" };
		}

		declaration.status = "verified";
		declaration.verifiedBy = verifierId;
		declaration.verifiedAt = new Date();
		declaration.auditTrail.push({
			action: "DECLARATION_VERIFIED",
			performedBy: verifierId,
			performedAt: new Date(),
			details: "Declaration verified and approved",
		});

		this.declarationsStore.set(declarationId, declaration);

		return { success: true, message: "Declaration verified successfully" };
	}

	async updateDeclaration(
		declarationId: string,
		updates: Partial<CreateDeclarationInput>,
		updatedBy: string,
	): Promise<BeneficialOwnershipDeclaration | null> {
		const existing = this.declarationsStore.get(declarationId);

		if (!existing) {
			return null;
		}

		const now = new Date();

		if (updates.significantBeneficialOwners) {
			existing.significantBeneficialOwners =
				updates.significantBeneficialOwners.map((sbo, index) => ({
					...sbo,
					id: `SBO_${declarationId}_${index + 1}`,
					declarationDate: now,
					isUltimateOwner:
						sbo.ownershipPercentage >= this.UBO_THRESHOLD ||
						sbo.votingRightsPercentage >= this.UBO_THRESHOLD,
				}));
		}

		if (updates.declaringOfficer) {
			existing.declaringOfficer = updates.declaringOfficer;
		}

		if (updates.noSBODeclaration !== undefined) {
			existing.noSBODeclaration = updates.noSBODeclaration;
		}

		existing.status = "submitted";
		existing.complianceDetails.lastUpdated = now;
		existing.auditTrail.push({
			action: "DECLARATION_UPDATED",
			performedBy: updatedBy,
			performedAt: now,
			details: "Beneficial ownership information updated",
		});

		this.declarationsStore.set(declarationId, existing);

		return existing;
	}

	getDeclaration(declarationId: string): BeneficialOwnershipDeclaration | null {
		return this.declarationsStore.get(declarationId) || null;
	}

	getEntityDeclarations(
		entityClientId: string,
	): BeneficialOwnershipDeclaration[] {
		const declarations: BeneficialOwnershipDeclaration[] = [];
		this.declarationsStore.forEach((declaration) => {
			if (declaration.entityClientId === entityClientId) {
				declarations.push(declaration);
			}
		});
		return declarations.sort(
			(a, b) => b.declarationDate.getTime() - a.declarationDate.getTime(),
		);
	}

	async checkComplianceStatus(entityClientId: string): Promise<{
		isCompliant: boolean;
		hasValidDeclaration: boolean;
		lastDeclaration?: BeneficialOwnershipDeclaration;
		issues: string[];
		nextActionRequired: string;
	}> {
		const declarations = this.getEntityDeclarations(entityClientId);
		const issues: string[] = [];

		if (declarations.length === 0) {
			return {
				isCompliant: false,
				hasValidDeclaration: false,
				issues: ["No beneficial ownership declaration on file"],
				nextActionRequired:
					"Submit initial beneficial ownership declaration (Form BEN-1)",
			};
		}

		const latestDeclaration = declarations[0];
		const now = new Date();

		if (
			latestDeclaration.status === "expired" ||
			latestDeclaration.validUntil < now
		) {
			issues.push("Declaration has expired");
		}

		if (latestDeclaration.status === "needs_update") {
			issues.push("Declaration requires update due to ownership changes");
		}

		if (!latestDeclaration.complianceDetails.formBen1Filed) {
			issues.push("Form BEN-1 not filed with MCA");
		}

		if (
			latestDeclaration.significantBeneficialOwners.length > 0 &&
			!latestDeclaration.complianceDetails.formBen2Filed
		) {
			issues.push("Form BEN-2 not filed with MCA");
		}

		const isCompliant =
			issues.length === 0 && latestDeclaration.status === "verified";

		return {
			isCompliant,
			hasValidDeclaration:
				latestDeclaration.validUntil >= now &&
				latestDeclaration.status !== "expired",
			lastDeclaration: latestDeclaration,
			issues,
			nextActionRequired:
				issues.length > 0
					? issues[0]
					: "No action required. Ensure annual review before expiry.",
		};
	}

	async markFormsFiled(
		declarationId: string,
		formType: "BEN-1" | "BEN-2",
		filedBy: string,
	): Promise<{ success: boolean; message: string }> {
		const declaration = this.declarationsStore.get(declarationId);

		if (!declaration) {
			return { success: false, message: "Declaration not found" };
		}

		const now = new Date();

		if (formType === "BEN-1") {
			declaration.complianceDetails.formBen1Filed = true;
			declaration.complianceDetails.formBen1Date = now;
		} else {
			declaration.complianceDetails.formBen2Filed = true;
			declaration.complianceDetails.formBen2Date = now;
		}

		declaration.auditTrail.push({
			action: `FORM_${formType}_FILED`,
			performedBy: filedBy,
			performedAt: now,
			details: `${formType} marked as filed with MCA`,
		});

		this.declarationsStore.set(declarationId, declaration);

		return {
			success: true,
			message: `${formType} filing recorded successfully`,
		};
	}

	getRequiredDisclosures(): string[] {
		return [
			"Name, nationality, and residential status of each Significant Beneficial Owner",
			"Date of birth and identification documents (PAN/Passport)",
			"Percentage of shares or voting rights held directly or indirectly",
			"The manner in which significant beneficial ownership is held",
			"Whether interest is held directly or through a chain of entities",
			"Changes in SBO must be notified within 30 days",
			"Annual declaration required even if no changes",
			"False declaration is punishable under Companies Act 2013",
		];
	}

	getSBOThresholds(): {
		shareThreshold: number;
		votingThreshold: number;
		uboThreshold: number;
	} {
		return {
			shareThreshold: this.SBO_THRESHOLD_SHARES,
			votingThreshold: this.SBO_THRESHOLD_VOTING,
			uboThreshold: this.UBO_THRESHOLD,
		};
	}
}

export const beneficialOwnershipService = new BeneficialOwnershipService();
