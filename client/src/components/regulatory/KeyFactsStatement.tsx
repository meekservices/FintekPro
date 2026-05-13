import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Building2, 
  Calculator, 
  Calendar, 
  Shield as LucideShield, 
  AlertTriangle, 
  Phone, 
  Mail, 
  ExternalLink,
  Download,
  Printer,
  CheckCircle,
  Clock,
  IndianRupee,
  Info
} from "lucide-react";
import { format } from "date-fns";

interface KeyFactsStatementProps {
  kfs: any;
  onAcknowledge?: () => void;
  showAcknowledgement?: boolean;
}

export function KeyFactsStatement({ kfs, onAcknowledge, showAcknowledgement = true }: KeyFactsStatementProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!kfs) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Key Facts Statement data is not available. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800" data-testid="key-facts-statement">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <div>
              <CardTitle className="text-xl text-blue-900 dark:text-blue-100">
                Key Facts Statement (KFS)
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300">
                As per RBI Digital Lending Guidelines 2022
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-card">
            Version {kfs.kfsVersion}
          </Badge>
        </div>
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Generated: {format(new Date(kfs.generatedAt), 'PPp')}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Valid until: {format(new Date(kfs.validUntil), 'PP')}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Regulatory Reference:</strong> {kfs.regulatoryReference}
            <br />
            Please read this document carefully before proceeding with your loan application.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                Lender Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lender Name</span>
                <span className="font-medium">{kfs.lenderDetails?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RBI Registration</span>
                <span className="font-mono text-xs">{kfs.lenderDetails?.rbiRegistrationNumber}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-green-600" />
                Loan Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loan Type</span>
                <span className="font-medium">{kfs.loanSummary?.loanType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Sanctioned</span>
                <span className="font-bold text-green-600">{formatCurrency(kfs.loanSummary?.loanAmountSanctioned || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenure</span>
                <span className="font-medium">{kfs.loanSummary?.tenureMonths} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest Rate</span>
                <span className="font-medium">{kfs.loanSummary?.interestRatePerAnnum}% p.a. ({kfs.loanSummary?.interestRateType})</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-green-600" />
              Annual Percentage Rate (APR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground">Total APR (including all costs)</span>
              <span className="text-3xl font-bold text-green-700 dark:text-green-400">
                {kfs.annualPercentageRate?.apr}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Interest Rate</span>
                <span>{kfs.annualPercentageRate?.aprBreakdown?.baseInterestRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing Fee Impact</span>
                <span>{kfs.annualPercentageRate?.aprBreakdown?.processingFeeImpact}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Calculation Method: {kfs.annualPercentageRate?.aprCalculationMethod}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Fees & Charges</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing Fee</span>
                <span>{formatCurrency(kfs.feesAndCharges?.processingFee?.amount || 0)} ({kfs.feesAndCharges?.processingFee?.percent}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stamp Duty</span>
                <span>{formatCurrency(kfs.feesAndCharges?.stampDuty || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST on Fees</span>
                <span>{formatCurrency(kfs.feesAndCharges?.gst || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Documentation Charges</span>
                <span>{formatCurrency(kfs.feesAndCharges?.documentationCharges || 0)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Total Upfront Charges</span>
                <span className="text-red-600">{formatCurrency(kfs.feesAndCharges?.totalUpfrontCharges || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-green-600">
                <span>Net Disbursement Amount</span>
                <span>{formatCurrency(kfs.feesAndCharges?.netDisbursementAmount || 0)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">EMI Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly EMI</span>
                <span className="text-2xl font-bold text-blue-600">{formatCurrency(kfs.loanSummary?.emiAmount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">First EMI Date</span>
                <span>{kfs.emiSchedule?.firstEmiDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total EMIs</span>
                <span>{kfs.emiSchedule?.totalEmis}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Interest Payable</span>
                <span className="text-orange-600">{formatCurrency(kfs.loanSummary?.totalInterestPayable || 0)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total Amount Repayable</span>
                <span>{formatCurrency(kfs.loanSummary?.totalAmountRepayable || 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LucideShield className="h-5 w-5 text-purple-600" />
              Cooling-Off Period (Look-Up Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="bg-card">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>You have {kfs.coolingOffPeriod?.lookUpPeriodDays} days</strong> from the date of disbursement to exit this loan without any penalty. 
                {kfs.coolingOffPeriod?.exitOptionAvailable && (
                  <span> Principal amount plus proportionate interest will be refunded within {kfs.coolingOffPeriod?.refundProcessDays} working days.</span>
                )}
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground mt-3">
              {kfs.coolingOffPeriod?.notes}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Prepayment Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prepayment Allowed</span>
                <Badge variant={kfs.prepaymentTerms?.prepaymentAllowed ? "default" : "secondary"}>
                  {kfs.prepaymentTerms?.prepaymentAllowed ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prepayment Charge</span>
                <span>{kfs.prepaymentTerms?.prepaymentChargePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lock-in Period</span>
                <span>{kfs.prepaymentTerms?.lockInPeriodMonths} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min Part-Prepayment</span>
                <span>{formatCurrency(kfs.prepaymentTerms?.partPrepaymentMinAmount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Foreclosure Charge</span>
                <span>{kfs.prepaymentTerms?.foreclosureChargePercent}%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Penal Charges</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Late Payment Charge</span>
                <span>{kfs.penalCharges?.latePaymentChargePercent}% or {formatCurrency(kfs.penalCharges?.latePaymentChargeFixed || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bounce Charges</span>
                <span>{formatCurrency(kfs.penalCharges?.bounceCharges || 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-600" />
              Grievance Redressal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium mb-2">Level 1: Customer Care</div>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {kfs.grievanceRedressal?.level1?.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {kfs.grievanceRedressal?.level1?.phone}
                  </div>
                  <div className="text-xs">Response: {kfs.grievanceRedressal?.level1?.responseTimeBusinessDays} business days</div>
                </div>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium mb-2">Level 2: Nodal Officer</div>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {kfs.grievanceRedressal?.level2?.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {kfs.grievanceRedressal?.level2?.phone}
                  </div>
                  <div className="text-xs">Response: {kfs.grievanceRedressal?.level2?.responseTimeBusinessDays} business days</div>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="font-medium mb-2">RBI Ombudsman</div>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    <a href={kfs.grievanceRedressal?.rbiOmbudsman?.portalLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      RBI CMS Portal
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {kfs.grievanceRedressal?.rbiOmbudsman?.phone}
                  </div>
                  <div className="text-xs">Escalate after: {kfs.grievanceRedressal?.rbiOmbudsman?.escalationTimelineDays} days</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Important Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <ul className="space-y-2 text-sm">
                {kfs.importantTerms?.map((term: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span className="text-muted-foreground">{term}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        {showAcknowledgement && (
          <Card className="border-2 border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Borrower Acknowledgement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Borrower Name:</span>
                  <span className="ml-2 font-medium">{kfs.acknowledgementRequired?.borrowerName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">PAN:</span>
                  <span className="ml-2 font-mono">{kfs.acknowledgementRequired?.borrowerPan}</span>
                </div>
              </div>
              
              <div className="p-4 bg-muted rounded-lg text-sm">
                {kfs.acknowledgementRequired?.declarationText}
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="acknowledge" 
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked as boolean)}
                />
                <label htmlFor="acknowledge" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I have read and understood all the terms in this Key Facts Statement
                </label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
              <Button 
                onClick={onAcknowledge}
                disabled={!acknowledged}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                I Acknowledge & Accept
              </Button>
            </CardFooter>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
