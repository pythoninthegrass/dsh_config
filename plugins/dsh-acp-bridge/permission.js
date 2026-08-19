import { kindFromView, diffContent } from "./session-updates.js";

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
 * `view` is the tool's own presenter render intent for this call
 * (`ctx.tools.get(req.toolName, scope)?.presentCall?.(args)`) — undefined
 * when there is no tool registry, no matching tool, or the tool defines no
 * `presentCall`. When it is a "diff" card, the embedded toolCall carries the
 * proposed diff so a client can preview it before granting approval.
 *
 * @param {string} sessionId
 * @param {{toolName: string, callId?: string, reason?: string}} req
 * @param {object} [view]
 * @returns {object}
 */
export function toPermissionRequest(sessionId, req, view) {
	return {
		sessionId,
		toolCall: {
			toolCallId: req.callId ?? req.toolName,
			title: req.toolName,
			status: "pending",
			...view !== undefined ? { kind: kindFromView(view) } : {},
			...view?.card === "diff" ? { content: diffContent(view) } : {},
		},
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
