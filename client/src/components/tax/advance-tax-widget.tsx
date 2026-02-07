import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar, 
  Bell, 
  Clock, 
  IndianRupee, 
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Calculator
} from "lucide-react";
import { Link } from "wouter";
import { format, differenceInDays, isPast } from "date-fns";

interface AdvanceTaxDue {
  quarter: string;
  dueDate: Date;
  cumulativePercent: number;
  estimatedTax: number;
  paid: number;
  status: 'paid' | 'due' | 'overdue' | 'upcoming';
}

interface AdvanceTaxWidgetProps {
  estimatedAnnualTax?: number;
}

export function AdvanceTaxWidget({ estimatedAnnualTax = 200000 }: AdvanceTaxWidgetProps) {
  const currentYear = new Date().getFullYear();
  const fiscalYearStart = new Date(currentYear, 3, 1);
  
  const advanceTaxSchedule: AdvanceTaxDue[] = useMemo(() => {
    const now = new Date();
    
    return [
      {
        quarter: 'Q1',
        dueDate: new Date(currentYear, 5, 15),
        cumulativePercent: 15,
        estimatedTax: estimatedAnnualTax * 0.15,
        paid: 30000,
        status: isPast(new Date(currentYear, 5, 15)) ? 'paid' : 'upcoming'
      },
      {
        quarter: 'Q2',
        dueDate: new Date(currentYear, 8, 15),
        cumulativePercent: 45,
        estimatedTax: estimatedAnnualTax * 0.30,
        paid: 60000,
        status: isPast(new Date(currentYear, 8, 15)) ? 'paid' : 'upcoming'
      },
      {
        quarter: 'Q3',
        dueDate: new Date(currentYear, 11, 15),
        cumulativePercent: 75,
        estimatedTax: estimatedAnnualTax * 0.30,
        paid: 0,
        status: differenceInDays(new Date(currentYear, 11, 15), now) <= 30 && differenceInDays(new Date(currentYear, 11, 15), now) > 0 ? 'due' : 
               isPast(new Date(currentYear, 11, 15)) ? 'overdue' : 'upcoming'
      },
      {
        quarter: 'Q4',
        dueDate: new Date(currentYear + 1, 2, 15),
        cumulativePercent: 100,
        estimatedTax: estimatedAnnualTax * 0.25,
        paid: 0,
        status: 'upcoming'
      }
    ];
  }, [estimatedAnnualTax, currentYear]);

  const nextDue = advanceTaxSchedule.find(q => q.status === 'due' || q.status === 'upcoming');
  const overdueTax = advanceTaxSchedule.find(q => q.status === 'overdue');
  const totalPaid = advanceTaxSchedule.reduce((sum, q) => sum + q.paid, 0);
  const totalDue = advanceTaxSchedule.reduce((sum, q) => sum + q.estimatedTax, 0);
  const progressPercent = (totalPaid / totalDue) * 100;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'due': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-muted text-foreground';
    }
  };

  return (
    <Card data-testid="advance-tax-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-full">
              <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Advance Tax</CardTitle>
              <CardDescription>FY {currentYear}-{(currentYear + 1).toString().slice(2)}</CardDescription>
            </div>
          </div>
          <Link href="/tax-regime-comparison">
            <Button variant="ghost" size="sm" data-testid="calculate-tax-btn">
              <Calculator className="h-4 w-4 mr-1" />
              Calculate
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {overdueTax && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {overdueTax.quarter} tax is overdue! Pay {formatCurrency(overdueTax.estimatedTax)} immediately to avoid interest.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{formatCurrency(totalPaid)} / {formatCurrency(totalDue)}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {nextDue && (
          <div className={`p-3 rounded-lg ${nextDue.status === 'due' ? 'bg-yellow-50 dark:bg-yellow-950 border border-yellow-200' : 'bg-muted'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className={`h-4 w-4 ${nextDue.status === 'due' ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Next Due: {nextDue.quarter}</span>
              </div>
              <Badge className={getStatusColor(nextDue.status)}>
                {differenceInDays(nextDue.dueDate, new Date())} days left
              </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Due by {format(nextDue.dueDate, 'MMM d, yyyy')}
              </span>
              <span className="font-bold text-orange-600">
                {formatCurrency(nextDue.estimatedTax)}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {advanceTaxSchedule.map((quarter) => (
            <div 
              key={quarter.quarter}
              className="flex items-center justify-between text-sm py-2 border-b last:border-0"
            >
              <div className="flex items-center gap-2">
                {quarter.status === 'paid' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : quarter.status === 'overdue' ? (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{quarter.quarter} ({format(quarter.dueDate, 'MMM d')})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{quarter.cumulativePercent}%</span>
                <Badge variant="outline" className={getStatusColor(quarter.status)}>
                  {quarter.status === 'paid' ? formatCurrency(quarter.paid) : formatCurrency(quarter.estimatedTax)}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full" variant={overdueTax ? 'destructive' : 'default'} data-testid="pay-advance-tax-btn">
          <IndianRupee className="h-4 w-4 mr-2" />
          Pay Advance Tax
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
