import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface ThemeToggleProps {
	className?: string;
	size?: "default" | "sm" | "lg" | "icon";
}

export function ThemeToggle({ className = "", size = "icon" }: ThemeToggleProps) {
	const { resolvedTheme, setTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	const toggleTheme = () => {
		setTheme(isDark ? "light" : "dark");
	};

	return (
		<TooltipProvider delayDuration={300}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size={size}
						onClick={toggleTheme}
						className={`relative rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors focus-visible:ring-2 focus-visible:ring-ring ${className}`}
						data-testid="theme-toggle-button"
						aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
					>
						{isDark ? (
							<Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
						) : (
							<Moon className="h-4 w-4 text-slate-700 transition-transform duration-200 rotate-0 hover:-rotate-12" />
						)}
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<span>{isDark ? "Switch to light theme" : "Switch to dark theme"}</span>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export default ThemeToggle;

