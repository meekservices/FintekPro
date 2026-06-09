import { useEffect } from "react";
import { useLocation } from "wouter";

export default function ProposalsPage() {
	const [, setLocation] = useLocation();

	useEffect(() => {
		// Redirect to cart page with proposals tab active
		setLocation("/cart?tab=proposals");
	}, [setLocation]);

	return (
		<div className="min-h-screen bg-muted flex items-center justify-center">
			<div className="text-center">
				<p className="text-lg text-muted-foreground">
					Redirecting to proposals...
				</p>
			</div>
		</div>
	);
}
