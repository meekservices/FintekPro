import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from "recharts";
import { TrendingUp, TrendingDown, IndianRupee, Target, Award, AlertCircle } from "lucide-react";

interface ProfitDashboardProps {
  analysis: any;
  suppliers: any[];
  optimalSupplier: any;
}

export function ProfitDashboard({ analysis, suppliers, optimalSupplier }: ProfitDashboardProps) {
  if (!analysis || suppliers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No supplier data available for analysis</p>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const marginChartData = suppliers.map(supplier => ({
    name: supplier.supplierName.substring(0, 15) + "...",
    margin: supplier.profitMargin,
    revenue: supplier.revenue,
    volume: supplier.salesVolume
  }));

  const scoreChartData = suppliers.map(supplier => ({
    name: supplier.supplierName.substring(0, 15) + "...",
    profitScore: supplier.profitScore,
    performance: supplier.performanceRating * 20,
    commission: supplier.commissionRate
  }));

  const pieChartData = suppliers.map((supplier, index) => ({
    name: supplier.supplierName,
    value: supplier.revenue,
    color: `hsl(${index * 137.5}, 70%, 50%)`
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Profit Margin</p>
                <p className="text-2xl font-bold" data-testid="text-avg-profit-margin">
                  {analysis.avgProfitMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Best Margin</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-best-profit-margin">
                  {analysis.bestMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <IndianRupee className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold" data-testid="text-dashboard-total-revenue">
                  ₹{analysis.totalRevenue.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Top Performer</p>
                <p className="text-lg font-bold truncate" data-testid="text-top-performer">
                  {optimalSupplier?.supplierName || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profit Margin Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Profit Margin Comparison</CardTitle>
            <CardDescription>Compare profit margins across suppliers</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={marginChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'margin' ? `${value}%` : `₹${value.toLocaleString()}`,
                    name === 'margin' ? 'Profit Margin' : 'Revenue'
                  ]}
                />
                <Legend />
                <Bar dataKey="margin" fill="#10b981" name="Profit Margin %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution</CardTitle>
            <CardDescription>Revenue share by supplier</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance Scorecard */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Performance Scorecard</CardTitle>
          <CardDescription>Comprehensive performance analysis including profit score, performance rating, and commission rates</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={scoreChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="profitScore" fill="#8b5cf6" name="Profit Score" />
              <Bar dataKey="performance" fill="#06b6d4" name="Performance Rating" />
              <Bar dataKey="commission" fill="#f59e0b" name="Commission Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Optimization Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span>Profit Optimization Recommendations</span>
            </CardTitle>
            <CardDescription>AI-powered suggestions to maximize profitability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.recommendations.map((recommendation: string, index: number) => (
                <div key={index} className="flex items-start space-x-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <p className="text-sm" data-testid={`text-dashboard-recommendation-${index}`}>
                    {recommendation}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Supplier Highlight */}
      {optimalSupplier && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-green-500" />
                <span>Recommended Supplier</span>
              </CardTitle>
              <Badge variant="secondary" className="bg-green-500 text-white">
                Best Choice
              </Badge>
            </div>
            <CardDescription>Highest profit score based on comprehensive analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Supplier</p>
                <p className="font-semibold" data-testid="text-optimal-supplier-name">
                  {optimalSupplier.supplierName}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Profit Margin</p>
                <p className="font-semibold text-green-600" data-testid="text-optimal-profit-margin">
                  {optimalSupplier.profitMargin.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Profit Score</p>
                <div className="flex items-center space-x-2">
                  <Progress value={optimalSupplier.profitScore} className="flex-1" />
                  <span className="text-sm font-medium" data-testid="text-optimal-profit-score">
                    {optimalSupplier.profitScore.toFixed(1)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                <p className="font-semibold" data-testid="text-optimal-revenue">
                  ₹{optimalSupplier.revenue.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}