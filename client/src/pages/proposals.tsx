import { Proposals } from "@/components/wealth/proposals";

export default function ProposalsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Investment Proposals</h1>
          <p className="text-xl text-muted-foreground">
            Manage your investment proposals and track their status
          </p>
        </div>
        
        <Proposals portfolioId="demo-portfolio-1" />
      </div>
    </div>
  );
}