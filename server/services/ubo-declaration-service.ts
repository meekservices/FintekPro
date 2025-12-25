/**
 * Ultimate Beneficial Owner (UBO) Declaration Service (Task 4)
 * 
 * PMLA-compliant UBO declaration for corporate entities
 * Requires declaration of beneficial owners with ≥25% ownership
 */

interface BeneficialOwner {
  id: string;
  name: string;
  panNumber: string;
  panVerified: boolean;
  ownershipPercentage: number;
  designation?: string;
  nationality: string;
  dateOfBirth?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  isAuthorizedSignatory: boolean;
  kycStatus: 'pending' | 'verified' | 'rejected';
  documentIds: string[];
  addedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
}

interface UBODeclaration {
  declarationId: string;
  entityUserId: string;
  entityPAN: string;
  entityName: string;
  entityType: 'company' | 'llp' | 'partnership' | 'trust' | 'aop';
  beneficialOwners: BeneficialOwner[];
  totalOwnershipDeclared: number;
  declarationDate: Date;
  declarationSignedBy: string;
  declarationSignature?: string;
  noUBODeclaration: boolean;
  noUBOReason?: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComments?: string;
  auditTrail: {
    action: string;
    timestamp: Date;
    performedBy: string;
    details?: string;
  }[];
}

interface UBOValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

class UBODeclarationService {
  private declarations: Map<string, UBODeclaration> = new Map();
  
  private readonly MIN_OWNERSHIP_THRESHOLD = 25;
  private readonly MAX_TOTAL_OWNERSHIP = 100;

  /**
   * Create new UBO declaration
   */
  createDeclaration(
    entityUserId: string,
    entityPAN: string,
    entityName: string,
    entityType: UBODeclaration['entityType']
  ): UBODeclaration {
    const declarationId = this.generateDeclarationId();

    const declaration: UBODeclaration = {
      declarationId,
      entityUserId,
      entityPAN,
      entityName,
      entityType,
      beneficialOwners: [],
      totalOwnershipDeclared: 0,
      declarationDate: new Date(),
      declarationSignedBy: '',
      noUBODeclaration: false,
      status: 'draft',
      auditTrail: [{
        action: 'declaration_created',
        timestamp: new Date(),
        performedBy: entityUserId,
        details: `UBO declaration created for ${entityName}`
      }]
    };

    this.declarations.set(declarationId, declaration);
    console.log(`📋 [UBO] Created declaration ${declarationId} for entity ${entityName}`);

    return declaration;
  }

  /**
   * Add beneficial owner to declaration
   */
  addBeneficialOwner(
    declarationId: string,
    owner: Omit<BeneficialOwner, 'id' | 'addedAt' | 'kycStatus'>
  ): UBOValidationResult & { owner?: BeneficialOwner } {
    const declaration = this.declarations.get(declarationId);
    if (!declaration) {
      return { isValid: false, errors: ['Declaration not found'], warnings: [] };
    }

    if (declaration.status !== 'draft') {
      return { isValid: false, errors: ['Cannot modify submitted declaration'], warnings: [] };
    }

    // Validate ownership percentage
    const validation = this.validateOwnership(declaration, owner.ownershipPercentage);
    if (!validation.isValid) {
      return validation;
    }

    // Check for duplicate PAN
    if (declaration.beneficialOwners.some(bo => bo.panNumber === owner.panNumber)) {
      return { isValid: false, errors: ['Beneficial owner with this PAN already exists'], warnings: [] };
    }

    const newOwner: BeneficialOwner = {
      ...owner,
      id: this.generateOwnerId(),
      addedAt: new Date(),
      kycStatus: 'pending'
    };

    declaration.beneficialOwners.push(newOwner);
    declaration.totalOwnershipDeclared = this.calculateTotalOwnership(declaration);
    declaration.auditTrail.push({
      action: 'owner_added',
      timestamp: new Date(),
      performedBy: declaration.entityUserId,
      details: `Added UBO: ${owner.name} (${owner.ownershipPercentage}%)`
    });

    this.declarations.set(declarationId, declaration);
    console.log(`➕ [UBO] Added beneficial owner (${owner.ownershipPercentage}%) to declaration ${declarationId}`);

    return { isValid: true, errors: [], warnings: validation.warnings, owner: newOwner };
  }

  /**
   * Remove beneficial owner
   */
  removeBeneficialOwner(declarationId: string, ownerId: string, removedBy: string): boolean {
    const declaration = this.declarations.get(declarationId);
    if (!declaration || declaration.status !== 'draft') return false;

    const ownerIndex = declaration.beneficialOwners.findIndex(bo => bo.id === ownerId);
    if (ownerIndex === -1) return false;

    const removedOwner = declaration.beneficialOwners[ownerIndex];
    declaration.beneficialOwners.splice(ownerIndex, 1);
    declaration.totalOwnershipDeclared = this.calculateTotalOwnership(declaration);
    declaration.auditTrail.push({
      action: 'owner_removed',
      timestamp: new Date(),
      performedBy: removedBy,
      details: `Removed UBO: ${removedOwner.name}`
    });

    this.declarations.set(declarationId, declaration);
    return true;
  }

  /**
   * Declare no UBO (for entities with no individual owning ≥25%)
   */
  declareNoUBO(declarationId: string, reason: string, declaredBy: string): UBOValidationResult {
    const declaration = this.declarations.get(declarationId);
    if (!declaration) {
      return { isValid: false, errors: ['Declaration not found'], warnings: [] };
    }

    if (declaration.beneficialOwners.length > 0) {
      return { 
        isValid: false, 
        errors: ['Cannot declare no UBO when beneficial owners are already added. Remove all owners first.'], 
        warnings: [] 
      };
    }

    declaration.noUBODeclaration = true;
    declaration.noUBOReason = reason;
    declaration.auditTrail.push({
      action: 'no_ubo_declared',
      timestamp: new Date(),
      performedBy: declaredBy,
      details: `Reason: ${reason}`
    });

    this.declarations.set(declarationId, declaration);
    console.log(`📋 [UBO] No UBO declared for ${declarationId}: ${reason}`);

    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Submit declaration for review
   */
  submitDeclaration(
    declarationId: string,
    signedBy: string,
    signature?: string
  ): UBOValidationResult {
    const declaration = this.declarations.get(declarationId);
    if (!declaration) {
      return { isValid: false, errors: ['Declaration not found'], warnings: [] };
    }

    // Validate declaration completeness
    const validation = this.validateDeclaration(declaration);
    if (!validation.isValid) {
      return validation;
    }

    declaration.status = 'submitted';
    declaration.declarationSignedBy = signedBy;
    declaration.declarationSignature = signature;
    declaration.declarationDate = new Date();
    declaration.auditTrail.push({
      action: 'declaration_submitted',
      timestamp: new Date(),
      performedBy: signedBy,
      details: 'Declaration submitted for review'
    });

    this.declarations.set(declarationId, declaration);
    console.log(`✅ [UBO] Declaration ${declarationId} submitted for review`);

    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Admin: Review and approve/reject declaration
   */
  reviewDeclaration(
    declarationId: string,
    reviewedBy: string,
    approved: boolean,
    comments?: string
  ): boolean {
    const declaration = this.declarations.get(declarationId);
    if (!declaration || declaration.status !== 'submitted') return false;

    declaration.status = approved ? 'approved' : 'rejected';
    declaration.reviewedBy = reviewedBy;
    declaration.reviewedAt = new Date();
    declaration.reviewComments = comments;
    declaration.auditTrail.push({
      action: approved ? 'declaration_approved' : 'declaration_rejected',
      timestamp: new Date(),
      performedBy: reviewedBy,
      details: comments || ''
    });

    this.declarations.set(declarationId, declaration);
    console.log(`📋 [UBO] Declaration ${declarationId} ${approved ? 'approved' : 'rejected'} by ${reviewedBy}`);

    return true;
  }

  /**
   * Verify individual UBO's KYC
   */
  verifyOwnerKYC(
    declarationId: string,
    ownerId: string,
    verified: boolean,
    verifiedBy: string
  ): boolean {
    const declaration = this.declarations.get(declarationId);
    if (!declaration) return false;

    const owner = declaration.beneficialOwners.find(bo => bo.id === ownerId);
    if (!owner) return false;

    owner.kycStatus = verified ? 'verified' : 'rejected';
    owner.verifiedAt = new Date();
    owner.verifiedBy = verifiedBy;

    declaration.auditTrail.push({
      action: verified ? 'owner_kyc_verified' : 'owner_kyc_rejected',
      timestamp: new Date(),
      performedBy: verifiedBy,
      details: `UBO ${owner.name} KYC ${verified ? 'verified' : 'rejected'}`
    });

    this.declarations.set(declarationId, declaration);
    return true;
  }

  /**
   * Get declaration by ID
   */
  getDeclaration(declarationId: string): UBODeclaration | null {
    return this.declarations.get(declarationId) || null;
  }

  /**
   * Get declaration by entity user ID
   */
  getDeclarationByEntity(entityUserId: string): UBODeclaration | null {
    for (const declaration of this.declarations.values()) {
      if (declaration.entityUserId === entityUserId) {
        return declaration;
      }
    }
    return null;
  }

  /**
   * Check if entity has valid UBO declaration
   */
  hasValidDeclaration(entityUserId: string): boolean {
    const declaration = this.getDeclarationByEntity(entityUserId);
    return declaration?.status === 'approved';
  }

  private validateOwnership(declaration: UBODeclaration, newPercentage: number): UBOValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (newPercentage < this.MIN_OWNERSHIP_THRESHOLD) {
      errors.push(`Beneficial owner must have at least ${this.MIN_OWNERSHIP_THRESHOLD}% ownership`);
    }

    if (newPercentage > this.MAX_TOTAL_OWNERSHIP) {
      errors.push('Ownership percentage cannot exceed 100%');
    }

    const newTotal = declaration.totalOwnershipDeclared + newPercentage;
    if (newTotal > this.MAX_TOTAL_OWNERSHIP) {
      errors.push(`Total ownership would exceed 100% (current: ${declaration.totalOwnershipDeclared}%, adding: ${newPercentage}%)`);
    }

    if (newTotal > 100 - this.MIN_OWNERSHIP_THRESHOLD && newTotal < 100) {
      warnings.push('Remaining ownership is less than 25%. Consider adding all remaining owners.');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateDeclaration(declaration: UBODeclaration): UBOValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!declaration.noUBODeclaration && declaration.beneficialOwners.length === 0) {
      errors.push('At least one beneficial owner must be declared, or select "No UBO" option');
    }

    if (declaration.noUBODeclaration && !declaration.noUBOReason) {
      errors.push('Reason is required when declaring no UBO');
    }

    // Check if all UBOs have PAN verified
    const unverifiedOwners = declaration.beneficialOwners.filter(bo => !bo.panVerified);
    if (unverifiedOwners.length > 0) {
      warnings.push(`${unverifiedOwners.length} beneficial owner(s) have unverified PAN`);
    }

    // Check for authorized signatory
    const hasSignatory = declaration.beneficialOwners.some(bo => bo.isAuthorizedSignatory);
    if (!hasSignatory && declaration.beneficialOwners.length > 0) {
      warnings.push('No authorized signatory designated among beneficial owners');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private calculateTotalOwnership(declaration: UBODeclaration): number {
    return declaration.beneficialOwners.reduce((sum, bo) => sum + bo.ownershipPercentage, 0);
  }

  private generateDeclarationId(): string {
    return `UBO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  private generateOwnerId(): string {
    return `BO-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  }
}

export const uboDeclarationService = new UBODeclarationService();
export type { UBODeclaration, BeneficialOwner, UBOValidationResult };
