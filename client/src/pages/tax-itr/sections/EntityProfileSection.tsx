import React from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Checkbox } from "@/components/ui/checkbox";
import { useTax } from "../TaxContext";
import { EntityProfileDetails, CorporateDetails, TrustDetails, PartnerDetails } from "../types";

export const EntityProfileSection: React.FC = () => {
  const {
    recommendedForm,
    entityProfile,
    setEntityProfile,
    corporateDetails,
    setCorporateDetails,
    trustDetails,
    setTrustDetails
  } = useTax();
  const formLabel = recommendedForm === "ITR-6" ? "Company" : recommendedForm === "ITR-7" ? "Trust / Institution" : "Firm / AOP / BOI";

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {recommendedForm}: {formLabel} details required. This information maps to Part A-GEN of the return.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{formLabel} Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Entity Name *</Label>
              <Input value={entityProfile.entityName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntityProfile((p: EntityProfileDetails) => ({ ...p, entityName: e.target.value }))} placeholder="Legal name of entity" />
            </div>
            <div>
              <Label>Entity PAN *</Label>
              <Input value={entityProfile.entityPAN} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntityProfile((p: EntityProfileDetails) => ({ ...p, entityPAN: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" maxLength={10} />
            </div>
            <div>
              <Label>Date of Incorporation</Label>
              <Input type="date" value={entityProfile.dateOfIncorporation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntityProfile((p: EntityProfileDetails) => ({ ...p, dateOfIncorporation: e.target.value }))} />
            </div>
            <div>
              <Label>Nature of Business</Label>
              <Input value={entityProfile.natureOfBusiness} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntityProfile((p: EntityProfileDetails) => ({ ...p, natureOfBusiness: e.target.value }))} placeholder="e.g. Manufacturing, IT Services" />
            </div>
            {recommendedForm === "ITR-5" && (
              <div>
                <Label>Constitution Type</Label>
                <Select value={entityProfile.constitutionType} onValueChange={(v: string) => setEntityProfile((p: EntityProfileDetails) => ({ ...p, constitutionType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partnership">Partnership Firm</SelectItem>
                    <SelectItem value="llp">LLP</SelectItem>
                    <SelectItem value="aop">AOP / BOI</SelectItem>
                    <SelectItem value="cooperative">Cooperative Society</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Registration Number</Label>
              <Input value={entityProfile.registrationNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntityProfile((p: EntityProfileDetails) => ({ ...p, registrationNumber: e.target.value }))} placeholder="LLPIN / CIN / Registration No." />
            </div>
          </div>
        </CardContent>
      </Card>

      {recommendedForm === "ITR-6" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Corporate Details (Schedule Part A-GEN)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Company Type</Label>
                <Select value={corporateDetails.companyType} onValueChange={(v: string) => setCorporateDetails((p: CorporateDetails) => ({ ...p, companyType: v as CorporateDetails['companyType'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private Limited</SelectItem>
                    <SelectItem value="public">Public Limited</SelectItem>
                    <SelectItem value="section_8">Section 8 Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CIN (Company Identification Number) *</Label>
                <Input value={corporateDetails.cin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCorporateDetails((p: CorporateDetails) => ({ ...p, cin: e.target.value.toUpperCase() }))} placeholder="U12345MH2020PTC123456" />
              </div>
              <div>
                <Label>Authorized Capital (₹)</Label>
                <Input type="number" value={corporateDetails.authorizedCapital || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCorporateDetails((p: CorporateDetails) => ({ ...p, authorizedCapital: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Paid-up Capital (₹)</Label>
                <Input type="number" value={corporateDetails.paidUpCapital || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCorporateDetails((p: CorporateDetails) => ({ ...p, paidUpCapital: Number(e.target.value) }))} />
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={corporateDetails.matApplicable} onCheckedChange={(c: boolean) => setCorporateDetails((p: CorporateDetails) => ({ ...p, matApplicable: !!c }))} />
                <Label>MAT (Minimum Alternate Tax) applicable under Section 115JB</Label>
              </div>
              {corporateDetails.matApplicable && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-6">
                  <div>
                    <Label>Book Profit (₹)</Label>
                    <Input type="number" value={corporateDetails.bookProfit || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCorporateDetails((p: CorporateDetails) => ({ ...p, bookProfit: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label>MAT Tax (₹)</Label>
                    <Input type="number" value={corporateDetails.matTax || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCorporateDetails((p: CorporateDetails) => ({ ...p, matTax: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label>MAT Credit c/f (₹)</Label>
                    <Input type="number" value={corporateDetails.matCredit || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCorporateDetails((p: CorporateDetails) => ({ ...p, matCredit: Number(e.target.value) }))} />
                  </div>
                </div>
              )}
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Dividend Declared (₹)</Label>
                <Input type="number" value={corporateDetails.dividendDeclared || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCorporateDetails((p: CorporateDetails) => ({ ...p, dividendDeclared: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Dividend Distribution Tax (₹)</Label>
                <Input type="number" value={corporateDetails.dividendDistributionTax || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCorporateDetails((p: CorporateDetails) => ({ ...p, dividendDistributionTax: Number(e.target.value) }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {recommendedForm === "ITR-7" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Trust / Institution Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Trust Type</Label>
                <Select value={trustDetails.trustType} onValueChange={(v: string) => setTrustDetails((p: TrustDetails) => ({ ...p, trustType: v as TrustDetails['trustType'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charitable">Charitable Trust</SelectItem>
                    <SelectItem value="religious">Religious Trust</SelectItem>
                    <SelectItem value="educational">Educational Institution</SelectItem>
                    <SelectItem value="medical">Medical Institution</SelectItem>
                    <SelectItem value="political_party">Political Party</SelectItem>
                    <SelectItem value="research">Research Association</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Registration Section</Label>
                <Select value={trustDetails.registrationSection} onValueChange={(v: string) => setTrustDetails((p: TrustDetails) => ({ ...p, registrationSection: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12A">Section 12A</SelectItem>
                    <SelectItem value="12AA">Section 12AA</SelectItem>
                    <SelectItem value="12AB">Section 12AB</SelectItem>
                    <SelectItem value="10(23C)">Section 10(23C)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Registration Number *</Label>
                <Input value={trustDetails.registrationNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrustDetails((p: TrustDetails) => ({ ...p, registrationNumber: e.target.value }))} />
              </div>
              <div>
                <Label>Registration Date</Label>
                <Input type="date" value={trustDetails.registrationDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrustDetails((p: TrustDetails) => ({ ...p, registrationDate: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {recommendedForm === "ITR-5" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Partners / Members (Schedule-IF)</CardTitle>
            <CardDescription>Add details of all partners or members as per the deed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {entityProfile.partners.map((partner: PartnerDetails, idx: number) => (
              <div key={idx} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Partner {idx + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => setEntityProfile((p: EntityProfileDetails) => ({ ...p, partners: p.partners.filter((_, i) => i !== idx) }))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input value={partner.partnerName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const updated = [...entityProfile.partners];
                      updated[idx] = { ...updated[idx], partnerName: e.target.value };
                      setEntityProfile((p: EntityProfileDetails) => ({ ...p, partners: updated }));
                    }} placeholder="Partner name" />
                  </div>
                  <div>
                    <Label className="text-xs">PAN</Label>
                    <Input value={partner.partnerPAN} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const updated = [...entityProfile.partners];
                      updated[idx] = { ...updated[idx], partnerPAN: e.target.value.toUpperCase() };
                      setEntityProfile((p: EntityProfileDetails) => ({ ...p, partners: updated }));
                    }} maxLength={10} />
                  </div>
                  <div>
                    <Label className="text-xs">Share %</Label>
                    <Input type="number" value={partner.sharePercentage || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const updated = [...entityProfile.partners];
                      updated[idx] = { ...updated[idx], sharePercentage: Number(e.target.value) };
                      setEntityProfile((p: EntityProfileDetails) => ({ ...p, partners: updated }));
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Remuneration (₹)</Label>
                    <Input type="number" value={partner.remuneration || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const updated = [...entityProfile.partners];
                      updated[idx] = { ...updated[idx], remuneration: Number(e.target.value) };
                      setEntityProfile((p: EntityProfileDetails) => ({ ...p, partners: updated }));
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Interest on Capital (₹)</Label>
                    <Input type="number" value={partner.interestOnCapital || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const updated = [...entityProfile.partners];
                      updated[idx] = { ...updated[idx], interestOnCapital: Number(e.target.value) };
                      setEntityProfile((p: EntityProfileDetails) => ({ ...p, partners: updated }));
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Capital Contribution (₹)</Label>
                    <Input type="number" value={partner.capitalContribution || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const updated = [...entityProfile.partners];
                      updated[idx] = { ...updated[idx], capitalContribution: Number(e.target.value) };
                      setEntityProfile((p: EntityProfileDetails) => ({ ...p, partners: updated }));
                    }} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setEntityProfile((p: EntityProfileDetails) => ({ ...p, partners: [...p.partners, { partnerName: "", partnerPAN: "", sharePercentage: 0, capitalContribution: 0, profitShareRatio: 0, remuneration: 0, interestOnCapital: 0, isManagingPartner: false }] }))}>
              <Plus className="h-4 w-4 mr-1" /> Add Partner
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
