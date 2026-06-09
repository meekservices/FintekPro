import { useState, useRef, useCallback, useEffect } from "react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Camera,
	Video,
	VideoOff,
	CheckCircle2,
	AlertCircle,
	RefreshCw,
	Shield as LucideShield,
	User,
	Smile,
	Eye,
	MoveUp,
	MoveDown,
	MoveLeft,
	MoveRight,
	Loader2,
	ArrowRight,
	Info,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type VerificationStep =
	| "intro"
	| "camera-check"
	| "face-detection"
	| "liveness-blink"
	| "liveness-turn"
	| "document-capture"
	| "review"
	| "complete";

interface LivenessChallenge {
	id: string;
	instruction: string;
	icon: any;
	completed: boolean;
}

export default function VideoKYC() {
	const { user, isAuthenticated } = useAuth();
	const { toast } = useToast();
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const [currentStep, setCurrentStep] = useState<VerificationStep>("intro");
	const [isStreaming, setIsStreaming] = useState(false);
	const [capturedImage, setCapturedImage] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [livenessProgress, setLivenessProgress] = useState(0);
	const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const livenessChecks: LivenessChallenge[] = [
		{
			id: "blink",
			instruction: "Please blink your eyes twice",
			icon: Eye,
			completed: false,
		},
		{
			id: "smile",
			instruction: "Please smile for the camera",
			icon: Smile,
			completed: false,
		},
		{
			id: "turn-left",
			instruction: "Turn your head slowly to the left",
			icon: MoveLeft,
			completed: false,
		},
		{
			id: "turn-right",
			instruction: "Turn your head slowly to the right",
			icon: MoveRight,
			completed: false,
		},
	];

	const [challenges, setChallenges] = useState(livenessChecks);

	const startCamera = useCallback(async () => {
		try {
			setErrorMessage(null);
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode: "user",
				},
				audio: false,
			});

			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				streamRef.current = stream;
				setIsStreaming(true);
			}
		} catch (error: any) {
			console.error("Camera access error:", error);
			setErrorMessage(
				"Unable to access camera. Please ensure camera permissions are enabled.",
			);
			toast({
				title: "Camera Access Required",
				description: "Please allow camera access to continue with video KYC.",
				variant: "destructive",
			});
		}
	}, [toast]);

	const stopCamera = useCallback(() => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
			setIsStreaming(false);
		}
	}, []);

	const captureFrame = useCallback(() => {
		if (videoRef.current && canvasRef.current) {
			const video = videoRef.current;
			const canvas = canvasRef.current;
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.drawImage(video, 0, 0);
				const imageData = canvas.toDataURL("image/jpeg", 0.9);
				setCapturedImage(imageData);
				return imageData;
			}
		}
		return null;
	}, []);

	const simulateLivenessCheck = useCallback(async () => {
		setIsProcessing(true);

		for (let i = currentChallengeIndex; i < challenges.length; i++) {
			await new Promise((resolve) => setTimeout(resolve, 2000));

			setChallenges((prev) =>
				prev.map((c, idx) => (idx === i ? { ...c, completed: true } : c)),
			);
			setCurrentChallengeIndex(i + 1);
			setLivenessProgress(((i + 1) / challenges.length) * 100);
		}

		setIsProcessing(false);
		captureFrame();
		setCurrentStep("review");
	}, [challenges.length, currentChallengeIndex, captureFrame]);

	const handleStartVerification = () => {
		setCurrentStep("camera-check");
	};

	const handleCameraReady = async () => {
		await startCamera();
		setTimeout(() => setCurrentStep("face-detection"), 500);
	};

	const handleFaceDetected = () => {
		setCurrentStep("liveness-blink");
		simulateLivenessCheck();
	};

	const handleRetake = () => {
		setCapturedImage(null);
		setChallenges(livenessChecks);
		setCurrentChallengeIndex(0);
		setLivenessProgress(0);
		setCurrentStep("face-detection");
	};

	const handleSubmit = async () => {
		setIsProcessing(true);

		await new Promise((resolve) => setTimeout(resolve, 2000));

		toast({
			title: "Video KYC Submitted",
			description:
				"Your verification is being processed. You will be notified once complete.",
		});

		setIsProcessing(false);
		setCurrentStep("complete");
		stopCamera();
	};

	useEffect(() => {
		return () => {
			stopCamera();
		};
	}, [stopCamera]);

	if (!isAuthenticated) {
		return (
			<div className="max-w-2xl mx-auto py-12">
				<Card className="text-center">
					<CardContent className="pt-6">
						<LucideShield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
						<h2 className="text-xl font-semibold mb-2">Login Required</h2>
						<p className="text-muted-foreground mb-4">
							Please log in to complete video KYC verification.
						</p>
						<Link href="/auth">
							<Button data-testid="video-kyc-login-btn">
								Login to Continue
							</Button>
						</Link>
					</CardContent>
				</Card>
			</div>
		);
	}

	const renderStep = () => {
		switch (currentStep) {
			case "intro":
				return (
					<Card className="max-w-2xl mx-auto" data-testid="video-kyc-intro">
						<CardHeader className="text-center">
							<div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
								<Video className="h-8 w-8 text-blue-600 dark:text-blue-400" />
							</div>
							<CardTitle className="text-2xl">Video KYC Verification</CardTitle>
							<CardDescription>
								Complete your identity verification through our secure video KYC
								process
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<Alert>
								<Info className="h-4 w-4" />
								<AlertTitle>Before you begin</AlertTitle>
								<AlertDescription>
									<ul className="list-disc list-inside mt-2 space-y-1 text-sm">
										<li>Ensure you are in a well-lit environment</li>
										<li>Keep your face clearly visible within the frame</li>
										<li>Have your original PAN card or Aadhaar ready</li>
										<li>The process takes approximately 2-3 minutes</li>
									</ul>
								</AlertDescription>
							</Alert>

							<div className="grid grid-cols-2 gap-4">
								<div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
									<CheckCircle2 className="h-6 w-6 text-green-600 mb-2" />
									<h4 className="font-medium text-green-800 dark:text-green-200">
										Good Lighting
									</h4>
									<p className="text-sm text-green-600 dark:text-green-400">
										Natural light preferred
									</p>
								</div>
								<div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
									<CheckCircle2 className="h-6 w-6 text-green-600 mb-2" />
									<h4 className="font-medium text-green-800 dark:text-green-200">
										Clear Background
									</h4>
									<p className="text-sm text-green-600 dark:text-green-400">
										Plain background works best
									</p>
								</div>
							</div>

							<Button
								className="w-full"
								size="lg"
								onClick={handleStartVerification}
								data-testid="start-video-kyc-btn"
							>
								Start Verification
								<ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						</CardContent>
					</Card>
				);

			case "camera-check":
				return (
					<Card
						className="max-w-2xl mx-auto"
						data-testid="video-kyc-camera-check"
					>
						<CardHeader className="text-center">
							<CardTitle>Camera Access</CardTitle>
							<CardDescription>
								We need access to your camera to proceed with verification
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{errorMessage ? (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>Camera Error</AlertTitle>
									<AlertDescription>{errorMessage}</AlertDescription>
								</Alert>
							) : (
								<div className="text-center py-8">
									<Camera className="h-16 w-16 text-blue-600 mx-auto mb-4" />
									<p className="text-muted-foreground mb-4">
										Click the button below to enable your camera
									</p>
								</div>
							)}

							<Button
								className="w-full"
								size="lg"
								onClick={handleCameraReady}
								data-testid="enable-camera-btn"
							>
								<Camera className="h-4 w-4 mr-2" />
								Enable Camera
							</Button>
						</CardContent>
					</Card>
				);

			case "face-detection":
			case "liveness-blink":
			case "liveness-turn": {
				const currentChallenge = challenges[currentChallengeIndex];
				const ChallengeIcon = currentChallenge?.icon || Eye;

				return (
					<Card className="max-w-3xl mx-auto" data-testid="video-kyc-liveness">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Liveness Verification</CardTitle>
									<CardDescription>
										Follow the instructions to verify you are a real person
									</CardDescription>
								</div>
								<Badge variant="secondary">
									{currentChallengeIndex + 1} / {challenges.length}
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="relative aspect-video bg-black rounded-xl overflow-hidden">
								<video
									ref={videoRef}
									autoPlay
									playsInline
									muted
									className="w-full h-full object-cover transform scale-x-[-1]"
								/>
								<canvas ref={canvasRef} className="hidden" />

								{!isStreaming && (
									<div className="absolute inset-0 flex items-center justify-center bg-card">
										<Loader2 className="h-8 w-8 text-foreground animate-spin" />
									</div>
								)}

								<div className="absolute inset-0 border-4 border-blue-500/50 rounded-xl pointer-events-none">
									<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-dashed border-white/50 rounded-full" />
								</div>
							</div>

							<Progress value={livenessProgress} className="h-2" />

							<div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 text-center">
								<ChallengeIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
								<p className="font-medium text-lg">
									{currentChallenge?.instruction ||
										"Position your face in the oval"}
								</p>
							</div>

							<div className="flex gap-2 justify-center">
								{challenges.map((challenge, idx) => (
									<div
										key={challenge.id}
										className={`w-3 h-3 rounded-full ${
											challenge.completed
												? "bg-green-500"
												: idx === currentChallengeIndex
													? "bg-blue-500 animate-pulse"
													: "bg-muted"
										}`}
									/>
								))}
							</div>

							{currentStep === "face-detection" && !isProcessing && (
								<Button
									className="w-full"
									onClick={handleFaceDetected}
									data-testid="face-detected-btn"
								>
									Face Detected - Continue
								</Button>
							)}
						</CardContent>
					</Card>
				);
			}

			case "review":
				return (
					<Card className="max-w-2xl mx-auto" data-testid="video-kyc-review">
						<CardHeader className="text-center">
							<CardTitle>Review Your Photo</CardTitle>
							<CardDescription>
								Make sure your face is clearly visible and well-lit
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{capturedImage ? (
								<div className="aspect-video bg-black rounded-xl overflow-hidden">
									<img
										src={capturedImage}
										alt="Captured"
										className="w-full h-full object-cover transform scale-x-[-1]"
									/>
								</div>
							) : (
								<div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
									<User className="h-16 w-16 text-muted-foreground" />
								</div>
							)}

							<div className="grid grid-cols-4 gap-2">
								{challenges.map((challenge) => (
									<div
										key={challenge.id}
										className="flex flex-col items-center p-2 bg-green-50 dark:bg-green-950 rounded-lg"
									>
										<CheckCircle2 className="h-5 w-5 text-green-600 mb-1" />
										<span className="text-xs text-green-700 dark:text-green-300 text-center">
											{challenge.id}
										</span>
									</div>
								))}
							</div>

							<div className="flex gap-3">
								<Button
									variant="outline"
									className="flex-1"
									onClick={handleRetake}
									data-testid="retake-photo-btn"
								>
									<RefreshCw className="h-4 w-4 mr-2" />
									Retake
								</Button>
								<Button
									className="flex-1"
									onClick={handleSubmit}
									disabled={isProcessing}
									data-testid="submit-video-kyc-btn"
								>
									{isProcessing ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Processing...
										</>
									) : (
										<>
											<CheckCircle2 className="h-4 w-4 mr-2" />
											Submit for Verification
										</>
									)}
								</Button>
							</div>
						</CardContent>
					</Card>
				);

			case "complete":
				return (
					<Card
						className="max-w-2xl mx-auto text-center"
						data-testid="video-kyc-complete"
					>
						<CardContent className="pt-12 pb-8">
							<div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
								<CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
							</div>
							<h2 className="text-2xl font-bold mb-2">
								Verification Submitted!
							</h2>
							<p className="text-muted-foreground mb-6">
								Your video KYC has been submitted successfully. Our team will
								review it within 24-48 hours.
							</p>

							<div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 mb-6">
								<p className="text-sm text-blue-800 dark:text-blue-200">
									You will receive an email and SMS notification once your
									verification is complete.
								</p>
							</div>

							<div className="flex gap-3 justify-center">
								<Link href="/kyc-dashboard">
									<Button variant="outline" data-testid="back-to-dashboard-btn">
										Back to KYC Dashboard
									</Button>
								</Link>
								<Link href="/portfolio">
									<Button data-testid="explore-portfolio-btn">
										Explore Portfolio
									</Button>
								</Link>
							</div>
						</CardContent>
					</Card>
				);

			default:
				return null;
		}
	};

	return (
		<div className="container py-8" data-testid="video-kyc-page">
			<div className="mb-8">
				<div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
					<Link href="/kyc-dashboard" className="hover:text-foreground">
						KYC Dashboard
					</Link>
					<span>/</span>
					<span>Video KYC</span>
				</div>
				<h1 className="text-3xl font-bold">Video KYC Verification</h1>
				<p className="text-muted-foreground">
					Complete enhanced KYC with face verification for premium features
				</p>
			</div>

			{renderStep()}
		</div>
	);
}
