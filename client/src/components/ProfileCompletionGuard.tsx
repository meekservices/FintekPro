import { ReactNode, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProfileCompletionGuardProps {
	children: ReactNode;
}

function LoadingFallback() {
	return (
		<div className="flex items-center justify-center min-h-[200px]">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}

export default function ProfileCompletionGuard({
	children,
}: ProfileCompletionGuardProps) {
	return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
}
