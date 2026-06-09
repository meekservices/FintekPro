import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface ProfileData {
	isProfileCompleted?: boolean;
	profileCompleteness?: number;
}

interface ProfileCompletionHook {
	isComplete: boolean;
	completeness: number;
	isLoading: boolean;
	shouldShowReminders: boolean;
	getReminderMessage: () => string;
	getReminderPriority: () => "low" | "medium" | "high";
}

export function useProfileCompletion(): ProfileCompletionHook {
	const { user } = useAuth();

	const { data: profile, isLoading } = useQuery<ProfileData>({
		queryKey: ["/api/profile", user?.id],
		enabled: !!user?.id,
	});

	const isComplete = profile?.isProfileCompleted === true;
	const completeness = profile?.profileCompleteness || 0;
	const shouldShowReminders =
		!isComplete &&
		!!user?.id &&
		!user?.roles?.includes("agent") &&
		!user?.roles?.includes("admin");

	const getReminderMessage = () => {
		if (completeness < 25) {
			return "Get started with your profile to secure your account and access all features";
		}
		if (completeness < 50) {
			return "You're making progress! Complete a few more steps to unlock full platform access";
		}
		if (completeness < 75) {
			return "Almost there! Just a few more details needed to finish your profile";
		}
		return "You're so close! Finish the last few steps to complete your profile setup";
	};

	const getReminderPriority = (): "low" | "medium" | "high" => {
		if (completeness < 25) return "high";
		if (completeness < 50) return "medium";
		return "low";
	};

	return {
		isComplete,
		completeness,
		isLoading,
		shouldShowReminders,
		getReminderMessage,
		getReminderPriority,
	};
}
