import { AllocationOutput } from "../optimizer";

export interface SystemConstraints {
	max_single_asset: number;
	min_cash: number;
}

export class ConstraintEngine {
	/**
	 * Mangles generic math output boundaries structurally based on explicit risk profiles
	 * and regulatory requirements to cap extreme outlier allocations prior to generating the Target state.
	 */
	public applyConstraints(
		allocations: AllocationOutput[],
		limits: SystemConstraints,
	): AllocationOutput[] {
		const constrainedVector = [...allocations];
		let cashVector = constrainedVector.find((a) => a.asset_class === "cash");

		// Guarantee minimum Cash / liquidity parameter is absolute
		if (!cashVector) {
			cashVector = { asset_class: "cash", weight: limits.min_cash };
			constrainedVector.push(cashVector);
		} else if (cashVector.weight < limits.min_cash) {
			cashVector.weight = limits.min_cash;
		}

		// Pass 1: Apply global caps strictly against all non-cash asset classes
		let excessWeight = 0;
		constrainedVector.forEach((a) => {
			if (a.asset_class !== "cash" && a.weight > limits.max_single_asset) {
				excessWeight += a.weight - limits.max_single_asset;
				a.weight = limits.max_single_asset;
			}
		});

		// Pass 2: Redistribute stripped excess back into the safest bounded class (Cash or Bonds)
		// to strictly preserve the exactly 1.0 (100%) summation rule.
		if (excessWeight > 0) {
			const bondVector = constrainedVector.find(
				(a) => a.asset_class === "bonds",
			);
			if (bondVector) {
				bondVector.weight += excessWeight;
				// Ensure it doesn't accidentally breach logic limits too, otherwise dump everything left to pure cash.
				if (bondVector.weight > limits.max_single_asset) {
					const secondaryExcess = bondVector.weight - limits.max_single_asset;
					bondVector.weight = limits.max_single_asset;
					cashVector.weight += secondaryExcess;
				}
			} else {
				cashVector.weight += excessWeight;
			}
		}

		// Force trailing float precision normalization
		return this.normalizeWeights(constrainedVector);
	}

	private normalizeWeights(
		allocations: AllocationOutput[],
	): AllocationOutput[] {
		const totalWeight = allocations.reduce((sum, a) => sum + a.weight, 0);
		return allocations.map((a) => ({
			asset_class: a.asset_class,
			weight: Number.parseFloat((a.weight / totalWeight).toFixed(4)), // Rescale to perfectly exact 1.0
		}));
	}
}

export const constraintEngine = new ConstraintEngine();
