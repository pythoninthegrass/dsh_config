const PERMISSION_OPTIONS = [
	{ optionId: "allow_once", name: "Allow", kind: "allow_once" },
	{ optionId: "reject_once", name: "Reject", kind: "reject_once" },
];

const OPTION_ID_TO_APPROVAL = {
	allow_once: "allowed-once",
	reject_once: "rejected",
};

/**
 * Build an ACP `session/request_permission` payload from a dsh
 * `approval/request` event. Offers exactly the two grants
 * {@link outcomeToApproval} knows how to translate back.
 *
 * @param {string} sessionId
 * @param {{toolName: string, callId?: string, reason?: string}} req
 * @returns {object}
 */
export function toPermissionRequest(sessionId, req) {
	return {
		sessionId,
		toolCall: { toolCallId: req.callId ?? req.toolName, title: req.toolName, status: "pending" },
		options: PERMISSION_OPTIONS,
	};
}

/**
 * Map an ACP `RequestPermissionOutcome` back to a dsh `ApprovalOutcome`.
 *
 * @param {{outcome: "cancelled"} | {outcome: "selected", optionId: string}} outcome
 * @returns {"allowed-once" | "rejected" | "cancelled"}
 */
export function outcomeToApproval(outcome) {
	if (outcome.outcome === "cancelled") return "cancelled";
	return OPTION_ID_TO_APPROVAL[outcome.optionId] ?? "cancelled";
}
