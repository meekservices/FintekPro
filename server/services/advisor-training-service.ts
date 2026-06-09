interface DiversificationScore {
	score: number;
	grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
	penalties: any[];
	stockExposures: any[];
	sectorExposures: any[];
}

interface ReplaceFundSuggestion {
	fundToReplace: string;
	overlapWith: string;
	overlapPercentage: number;
}

interface TrainingPrompt {
	id: string;
	category:
		| "OVERLAP"
		| "DIVERSIFICATION"
		| "SIP"
		| "REPLACEMENT"
		| "GOAL"
		| "GENERAL";
	priority: "HIGH" | "MEDIUM" | "LOW";
	prompt: string;
	context: string;
	suggestedApproach: string;
	doNotSay: string[];
}

interface PortfolioContext {
	diversificationScore: DiversificationScore;
	replaceFundSuggestions?: ReplaceFundSuggestion[];
	sipRoutingApplied?: boolean;
	selectedGoal?: string;
}

export class AdvisorTrainingService {
	private static instance: AdvisorTrainingService;

	private constructor() {}

	static getInstance(): AdvisorTrainingService {
		if (!AdvisorTrainingService.instance) {
			AdvisorTrainingService.instance = new AdvisorTrainingService();
		}
		return AdvisorTrainingService.instance;
	}

	generateTrainingPrompts(context: PortfolioContext): TrainingPrompt[] {
		const prompts: TrainingPrompt[] = [];
		let promptId = 1;

		// Overlap-related prompts
		const overlappingStocks =
			context.diversificationScore.stockExposures.filter(
				(s) => s.fundCount >= 2,
			);

		if (overlappingStocks.length > 0) {
			prompts.push({
				id: `ATP-${promptId++}`,
				category: "OVERLAP",
				priority: "HIGH",
				prompt: "Explain why reducing overlap improves long-term risk balance.",
				context: `The client has ${overlappingStocks.length} stocks appearing in multiple funds.`,
				suggestedApproach:
					"Use the analogy of putting eggs in different baskets. Explain that while the funds may have different names, they own similar stocks, which means the client's actual diversification is lower than it appears.",
				doNotSay: [
					"This guarantees better returns",
					"You will definitely reduce risk",
					"Other funds are bad investments",
				],
			});
		}

		// Diversification score prompts
		if (context.diversificationScore.score < 70) {
			prompts.push({
				id: `ATP-${promptId++}`,
				category: "DIVERSIFICATION",
				priority: "HIGH",
				prompt: "Explain the diversification score in simple terms.",
				context: `Current score is ${context.diversificationScore.score}/100, graded as ${context.diversificationScore.grade}.`,
				suggestedApproach:
					"Describe the score as a 'spread indicator' - how spread out the investments are. A higher score means investments are distributed across more different companies and sectors.",
				doNotSay: [
					"Your score is bad",
					"You need to change everything",
					"Higher score means higher returns",
				],
			});

			prompts.push({
				id: `ATP-${promptId++}`,
				category: "DIVERSIFICATION",
				priority: "MEDIUM",
				prompt: "Discuss how penalties affect the diversification score.",
				context: `${context.diversificationScore.penalties.length} penalties are currently reducing the score.`,
				suggestedApproach:
					"Explain that penalties are like deductions for concentration. When too much money is in similar stocks or sectors, the score is reduced to reflect this hidden concentration.",
				doNotSay: [
					"These penalties are bad",
					"You made mistakes",
					"This will lose you money",
				],
			});
		}

		// SIP routing prompts
		if (context.sipRoutingApplied) {
			prompts.push({
				id: `ATP-${promptId++}`,
				category: "SIP",
				priority: "HIGH",
				prompt: "Discuss SIP routing benefits without promising returns.",
				context: "Smart SIP allocation has been applied to minimize overlap.",
				suggestedApproach:
					"Focus on the process benefit: 'The SIP is structured to gradually improve how spread out your investments are. Each month, more money goes to funds that add diversity rather than duplicate what you already own.'",
				doNotSay: [
					"This will give you better returns",
					"You will make more money",
					"This is the best allocation",
				],
			});

			prompts.push({
				id: `ATP-${promptId++}`,
				category: "SIP",
				priority: "MEDIUM",
				prompt: "Explain why SIP amounts vary across funds.",
				context:
					"Different funds receive different SIP amounts based on overlap analysis.",
				suggestedApproach:
					"Explain that funds holding unique stocks get more allocation because they add more diversity. Funds with stocks you already own heavily get less to avoid further concentration.",
				doNotSay: [
					"These funds are better",
					"These funds will perform better",
					"The other funds are not worth investing in",
				],
			});
		}

		// Fund replacement prompts
		if (
			context.replaceFundSuggestions &&
			context.replaceFundSuggestions.length > 0
		) {
			const topSuggestion = context.replaceFundSuggestions[0];
			prompts.push({
				id: `ATP-${promptId++}`,
				category: "REPLACEMENT",
				priority: "HIGH",
				prompt: "Explain the rationale for suggesting a fund switch.",
				context: `${topSuggestion.fundToReplace} has ${topSuggestion.overlapPercentage}% overlap with ${topSuggestion.overlapWith}.`,
				suggestedApproach:
					"Focus on redundancy: 'These two funds own many of the same stocks. It's like having two copies of the same book. We can replace one with a fund that owns different stocks, giving you a broader library.'",
				doNotSay: [
					"This fund is bad",
					"The replacement is guaranteed to be better",
					"You should definitely switch",
				],
			});
		}

		// Goal-based prompts
		if (context.selectedGoal) {
			prompts.push({
				id: `ATP-${promptId++}`,
				category: "GOAL",
				priority: "MEDIUM",
				prompt: "Connect the diversification strategy to the client's goal.",
				context: `Selected investment goal: ${context.selectedGoal}`,
				suggestedApproach: `For ${context.selectedGoal}, emphasize how diversification helps manage risk over the investment horizon. Focus on risk management rather than return enhancement.`,
				doNotSay: [
					"This goal will definitely be achieved",
					"You will reach your target",
					"This guarantees success",
				],
			});
		}

		// General conversation prompts
		prompts.push({
			id: `ATP-${promptId++}`,
			category: "GENERAL",
			priority: "LOW",
			prompt: "Handle client questions about market timing.",
			context: "Client may ask when to make changes or if now is a good time.",
			suggestedApproach:
				"Avoid timing discussions. Focus on systematic investing: 'Rather than trying to predict market movements, we focus on building a well-structured portfolio that can weather different market conditions.'",
			doNotSay: [
				"Now is a good time to invest",
				"Markets will go up",
				"You should wait for a dip",
			],
		});

		prompts.push({
			id: `ATP-${promptId++}`,
			category: "GENERAL",
			priority: "LOW",
			prompt: "Address concerns about making changes to existing portfolio.",
			context: "Client may be hesitant to change their current investments.",
			suggestedApproach:
				"Acknowledge their concern: 'Change can feel risky. These suggestions are about improving structure, not criticizing past choices. You can make gradual adjustments over time.'",
			doNotSay: [
				"You made bad choices before",
				"You must change immediately",
				"Your current portfolio is wrong",
			],
		});

		return prompts.sort((a, b) => {
			const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
			return priorityOrder[a.priority] - priorityOrder[b.priority];
		});
	}
}

export const advisorTrainingService = AdvisorTrainingService.getInstance();
