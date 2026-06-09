import { UnlistedCart } from "@/components/UnlistedCart";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function CartPage() {
	return (
		<div className="container mx-auto py-6 px-4 max-w-4xl">
			<div className="flex items-center gap-4 mb-6">
				<Link href="/unlisted/browse">
					<Button variant="ghost" size="sm" data-testid="button-back-to-browse">
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Marketplace
					</Button>
				</Link>
				<h1 className="text-2xl font-bold">Unlisted Shares Cart</h1>
			</div>

			<UnlistedCart />
		</div>
	);
}
