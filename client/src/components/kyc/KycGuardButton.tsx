import { useKycGuard, TransactionType } from "@/hooks/use-kyc-guard";
import { KycGuardModal } from "./KycGuardModal";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ComponentProps } from "react";

interface KycGuardButtonProps extends ComponentProps<typeof Button> {
	transactionType: TransactionType;
	onGuardedClick: () => void;
	children: React.ReactNode;
}

/**
 * Drop-in replacement for <Button> on any transaction action.
 * Intercepts the click, checks KYC for the given transactionType,
 * and either proceeds immediately or shows the KYC requirements modal.
 *
 * Usage:
 *   <KycGuardButton transactionType="mutual_funds" onGuardedClick={handleInvest}>
 *     Invest Now
 *   </KycGuardButton>
 */
export function KycGuardButton({
	transactionType,
	onGuardedClick,
	children,
	disabled,
	onClick,
	...props
}: KycGuardButtonProps) {
	const { guardAction, isChecking, modalState, closeModal, proceedToKyc } =
		useKycGuard();

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		onClick?.(e);
		guardAction(transactionType, onGuardedClick);
	};

	return (
		<>
			<Button
				{...props}
				disabled={disabled || isChecking}
				onClick={handleClick}
			>
				{isChecking ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin mr-2" />
						Checking...
					</>
				) : (
					children
				)}
			</Button>

			<KycGuardModal
				open={modalState.open}
				checkResult={modalState.checkResult}
				onClose={closeModal}
				onProceedToKyc={() => proceedToKyc()}
			/>
		</>
	);
}
