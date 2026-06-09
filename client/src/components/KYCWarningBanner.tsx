import { useQuery } from "@tanstack/react-query";

interface KycNotificationData {
	hasIncompleteKyc: boolean;
}

export function KYCWarningBanner() {
	const { data: kycData } = useQuery<KycNotificationData>({
		queryKey: ["/api/kyc/notification-status"],
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});

	if (!kycData || !kycData.hasIncompleteKyc) {
		return null;
	}

	return null;
}
