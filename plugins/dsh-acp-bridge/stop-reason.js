const REASON_TO_STOP_REASON = {
	completed: "end_turn",
	"max-tokens": "max_tokens",
	aborted: "cancelled",
};

/**
 * Map a dsh `turn/end` event's reason to an ACP `PromptResponse.stopReason`.
 * dsh reason kinds without a clean ACP equivalent (e.g. "blocked") fall back
 * to "end_turn" rather than inventing protocol-incompatible values.
 *
 * @param {{kind: string} | undefined} reason
 * @returns {import("@agentclientprotocol/sdk").schema.StopReason}
 */
export function stopReasonFor(reason) {
	return REASON_TO_STOP_REASON[reason?.kind] ?? "end_turn";
}
