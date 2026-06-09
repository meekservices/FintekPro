import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Calendar,
	DollarSign,
	TrendingUp,
	Clock,
	ChevronLeft,
	ChevronRight,
	Filter,
	Download,
	Bell,
	Info,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import {
	format,
	addMonths,
	subMonths,
	startOfMonth,
	endOfMonth,
	eachDayOfInterval,
	isSameMonth,
	isToday,
	isSameDay,
} from "date-fns";

interface DividendEvent {
	id: string;
	symbol: string;
	companyName: string;
	exDate: Date;
	recordDate: Date;
	paymentDate: Date;
	dividendPerShare: number;
	sharesHeld: number;
	expectedPayout: number;
	type: "interim" | "final" | "special";
	frequency: "quarterly" | "annual" | "one-time";
}

export default function DividendCalendar() {
	const { user, isAuthenticated } = useAuth();
	const [currentMonth, setCurrentMonth] = useState(new Date());
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);
	const [viewType, setViewType] = useState<"calendar" | "list">("calendar");
	const [filterType, setFilterType] = useState<
		"all" | "interim" | "final" | "special"
	>("all");

	const { data: dividendsData, isLoading } = useQuery<DividendEvent[]>({
		queryKey: ["/api/portfolio/dividends"],
		enabled: isAuthenticated,
	});

	const dividends = useMemo(() => {
		return (dividendsData || [])
			.filter((d) => d?.exDate && d.recordDate && d.paymentDate)
			.map((d) => ({
				...d,
				exDate: new Date(d.exDate),
				recordDate: new Date(d.recordDate),
				paymentDate: new Date(d.paymentDate),
			}))
			.filter(
				(d) =>
					!Number.isNaN(d.exDate.getTime()) &&
					!Number.isNaN(d.recordDate.getTime()) &&
					!Number.isNaN(d.paymentDate.getTime()),
			);
	}, [dividendsData]);

	const filteredDividends = useMemo(() => {
		return dividends.filter(
			(d) => filterType === "all" || d.type === filterType,
		);
	}, [filterType, dividends]);

	const monthDividends = useMemo(() => {
		const start = startOfMonth(currentMonth);
		const end = endOfMonth(currentMonth);
		return filteredDividends.filter(
			(d) => d.exDate >= start && d.exDate <= end,
		);
	}, [currentMonth, filteredDividends]);

	const totalExpectedPayout = useMemo(() => {
		return filteredDividends.reduce((sum, d) => sum + d.expectedPayout, 0);
	}, [filteredDividends]);

	const quarterlyPayout = useMemo(() => {
		const now = new Date();
		const quarterStart = new Date(
			now.getFullYear(),
			Math.floor(now.getMonth() / 3) * 3,
			1,
		);
		const quarterEnd = new Date(
			now.getFullYear(),
			Math.floor(now.getMonth() / 3) * 3 + 3,
			0,
		);
		return filteredDividends
			.filter(
				(d) => d.paymentDate >= quarterStart && d.paymentDate <= quarterEnd,
			)
			.reduce((sum, d) => sum + d.expectedPayout, 0);
	}, [filteredDividends]);

	const daysInMonth = useMemo(() => {
		return eachDayOfInterval({
			start: startOfMonth(currentMonth),
			end: endOfMonth(currentMonth),
		});
	}, [currentMonth]);

	const getDividendsForDay = (date: Date) => {
		return filteredDividends.filter((d) => isSameDay(d.exDate, date));
	};

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(value);
	};

	const getTypeBadgeColor = (type: string) => {
		switch (type) {
			case "interim":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
			case "final":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
			case "special":
				return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
			default:
				return "bg-muted text-foreground";
		}
	};

	if (!isAuthenticated) {
		return (
			<div className="max-w-2xl mx-auto py-12">
				<Card className="text-center">
					<CardContent className="pt-6">
						<Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
						<h2 className="text-xl font-semibold mb-2">Login Required</h2>
						<p className="text-muted-foreground mb-4">
							Please log in to view your dividend calendar.
						</p>
						<Link href="/auth">
							<Button data-testid="dividend-login-btn">
								Login to Continue
							</Button>
						</Link>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div
			className="container py-8 space-y-6"
			data-testid="dividend-calendar-page"
		>
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-2">
						<Calendar className="h-8 w-8 text-green-500" />
						Dividend Calendar
					</h1>
					<p className="text-muted-foreground mt-1">
						Track expected dividend payouts from your portfolio
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" size="sm" data-testid="export-calendar-btn">
						<Download className="h-4 w-4 mr-2" />
						Export
					</Button>
					<Button variant="outline" size="sm" data-testid="set-reminders-btn">
						<Bell className="h-4 w-4 mr-2" />
						Set Reminders
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
					<CardContent className="pt-6">
						<div className="flex items-center gap-3">
							<div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
								<DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">
									Total Expected (Year)
								</p>
								<p className="text-2xl font-bold text-green-700 dark:text-green-300">
									{formatCurrency(totalExpectedPayout)}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-3">
							<div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
								<TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">This Quarter</p>
								<p className="text-2xl font-bold">
									{formatCurrency(quarterlyPayout)}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-3">
							<div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
								<Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Upcoming</p>
								<p className="text-2xl font-bold">
									{filteredDividends.length} dividends
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="pb-4">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
									data-testid="prev-month-btn"
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span className="font-semibold min-w-[140px] text-center">
									{format(currentMonth, "MMMM yyyy")}
								</span>
								<Button
									variant="outline"
									size="icon"
									onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
									data-testid="next-month-btn"
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Select
								value={filterType}
								onValueChange={(v: any) => setFilterType(v)}
							>
								<SelectTrigger
									className="w-[140px]"
									data-testid="filter-type-select"
								>
									<Filter className="h-4 w-4 mr-2" />
									<SelectValue placeholder="Filter" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									<SelectItem value="interim">Interim</SelectItem>
									<SelectItem value="final">Final</SelectItem>
									<SelectItem value="special">Special</SelectItem>
								</SelectContent>
							</Select>
							<Tabs value={viewType} onValueChange={(v: any) => setViewType(v)}>
								<TabsList>
									<TabsTrigger value="calendar" data-testid="calendar-view-tab">
										Calendar
									</TabsTrigger>
									<TabsTrigger value="list" data-testid="list-view-tab">
										List
									</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{viewType === "calendar" && (
						<div className="grid grid-cols-7 gap-1">
							{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
								<div
									key={day}
									className="text-center text-sm font-medium text-muted-foreground p-2"
								>
									{day}
								</div>
							))}
							{Array(startOfMonth(currentMonth).getDay())
								.fill(null)
								.map((_, i) => (
									<div key={`empty-${i}`} className="p-2" />
								))}
							{daysInMonth.map((day) => {
								const dayDividends = getDividendsForDay(day);
								const hasEvents = dayDividends.length > 0;
								return (
									<div
										key={day.toISOString()}
										className={`p-2 min-h-[80px] border rounded-lg cursor-pointer transition-colors ${
											isToday(day)
												? "bg-blue-50 dark:bg-blue-950 border-blue-300"
												: hasEvents
													? "bg-green-50 dark:bg-green-950 border-green-300"
													: "hover:bg-muted"
										}`}
										onClick={() => setSelectedDate(day)}
										data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
									>
										<span
											className={`text-sm font-medium ${
												isToday(day) ? "text-blue-600" : ""
											}`}
										>
											{format(day, "d")}
										</span>
										{hasEvents && (
											<div className="mt-1 space-y-1">
												{dayDividends.slice(0, 2).map((d) => (
													<div
														key={d.id}
														className="text-xs px-1 py-0.5 bg-green-100 dark:bg-green-800 rounded truncate"
														title={d.companyName}
													>
														{d.symbol}
													</div>
												))}
												{dayDividends.length > 2 && (
													<div className="text-xs text-muted-foreground">
														+{dayDividends.length - 2} more
													</div>
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}

					{viewType === "list" && (
						<div className="space-y-3">
							{filteredDividends.length === 0 ? (
								<div className="text-center py-8">
									<Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
									<p className="text-muted-foreground">
										No dividends scheduled
									</p>
								</div>
							) : (
								filteredDividends.map((dividend) => (
									<div
										key={dividend.id}
										className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted transition-colors"
										data-testid={`dividend-item-${dividend.id}`}
									>
										<div className="flex items-center gap-4">
											<div className="w-12 h-12 bg-card rounded-lg flex items-center justify-center font-bold text-sm">
												{dividend.symbol.slice(0, 4)}
											</div>
											<div>
												<p className="font-medium">{dividend.companyName}</p>
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<span>
														Ex-Date: {format(dividend.exDate, "MMM d, yyyy")}
													</span>
													<Badge className={getTypeBadgeColor(dividend.type)}>
														{(dividend.type || "dividend").toUpperCase()}
													</Badge>
												</div>
											</div>
										</div>
										<div className="text-right">
											<p className="font-bold text-green-600 dark:text-green-400">
												{formatCurrency(dividend.expectedPayout)}
											</p>
											<p className="text-sm text-muted-foreground">
												{formatCurrency(dividend.dividendPerShare)}/share x{" "}
												{dividend.sharesHeld}
											</p>
										</div>
									</div>
								))
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{selectedDate && getDividendsForDay(selectedDate).length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">
							Dividends on {format(selectedDate, "MMMM d, yyyy")}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{getDividendsForDay(selectedDate).map((dividend) => (
								<div key={dividend.id} className="p-4 border rounded-lg">
									<div className="flex items-center justify-between mb-2">
										<p className="font-bold">
											{dividend.symbol} - {dividend.companyName}
										</p>
										<Badge className={getTypeBadgeColor(dividend.type)}>
											{dividend.type}
										</Badge>
									</div>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
										<div>
											<p className="text-muted-foreground">Ex-Date</p>
											<p className="font-medium">
												{format(dividend.exDate, "MMM d")}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground">Record Date</p>
											<p className="font-medium">
												{format(dividend.recordDate, "MMM d")}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground">Payment Date</p>
											<p className="font-medium">
												{format(dividend.paymentDate, "MMM d")}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground">Expected</p>
											<p className="font-medium text-green-600">
												{formatCurrency(dividend.expectedPayout)}
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
