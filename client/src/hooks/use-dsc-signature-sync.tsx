import { useEffect, useCallback } from "react";
import { useNetworkState } from "./use-network-state";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "./use-toast";

type QueuedSignature = {
	id: string;
	transactionId: string;
	signature: string;
	signatureAlgorithm: string;
	signedAt: string;
	documentName: string;
	queuedAt: string;
};

const QUEUE_KEY = "dsc_pending_signatures";

export function useDSCSignatureSync() {
	const { status } = useNetworkState();
	const { toast } = useToast();

	const getQueuedSignatures = useCallback(() => {
		try {
			const stored = localStorage.getItem(QUEUE_KEY);
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	}, []);

	const removeFromQueue = useCallback(
		(id: string) => {
			const queue = getQueuedSignatures();
			const updated = queue.filter((sig: QueuedSignature) => sig.id !== id);
			localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
		},
		[getQueuedSignatures],
	);

	const submitSignature = useCallback(async (sig: QueuedSignature) => {
		try {
			const submitResponse = await apiRequest(
				"/api/esign/dsc/submit-signature",
				{
					method: "POST",
					body: JSON.stringify({
						transactionId: sig.transactionId,
						signature: sig.signature,
						signatureAlgorithm: sig.signatureAlgorithm,
						signedAt: sig.signedAt,
					}),
				},
			);

			if (submitResponse.success) {
				console.log(
					"[DSC Sync] Successfully submitted queued signature:",
					sig.id,
					"for transaction:",
					sig.transactionId,
				);
				return true;
			}

			console.error("[DSC Sync] Submission failed:", submitResponse.message);
			return false;
		} catch (error) {
			console.error("[DSC Sync] Error submitting signature:", error);
			return false;
		}
	}, []);

	const syncQueuedSignatures = useCallback(async () => {
		const queue = getQueuedSignatures();

		if (queue.length === 0) {
			return;
		}

		console.log(
			`[DSC Sync] Attempting to sync ${queue.length} queued signature(s)`,
		);

		let successCount = 0;
		let failureCount = 0;

		for (const sig of queue) {
			const success = await submitSignature(sig);
			if (success) {
				removeFromQueue(sig.id);
				successCount++;
			} else {
				failureCount++;
			}
		}

		if (successCount > 0) {
			toast({
				title: "Signatures Synced",
				description: `${successCount} queued signature(s) submitted successfully.`,
			});
		}

		if (failureCount > 0) {
			toast({
				title: "Some Signatures Failed",
				description: `${failureCount} signature(s) could not be submitted. They will be retried later.`,
				variant: "destructive",
			});
		}
	}, [getQueuedSignatures, submitSignature, removeFromQueue, toast]);

	useEffect(() => {
		if (status === "online") {
			const queue = getQueuedSignatures();
			if (queue.length > 0) {
				console.log(
					"[DSC Sync] Network restored, syncing queued signatures...",
				);
				syncQueuedSignatures();
			}
		}
	}, [status, getQueuedSignatures, syncQueuedSignatures]);

	return {
		queuedCount: getQueuedSignatures().length,
		syncQueuedSignatures,
		getQueuedSignatures,
	};
}

export default useDSCSignatureSync;
