import { AppLayout } from "@/components/layout/app-layout";
import { MultiStepKYCWizard } from "@/components/kyc/multi-step-kyc-wizard";

export default function CkycVerification() {
	return (
		<AppLayout>
			<div className="container mx-auto py-6 px-4">
				<MultiStepKYCWizard />
			</div>
		</AppLayout>
	);
}
