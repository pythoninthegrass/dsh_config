import { test } from "node:test";
import assert from "node:assert/strict";
import { toPermissionRequest, outcomeToApproval } from "./permission.js";

test("builds a session/request_permission payload from an approval request", () => {
	const request = toPermissionRequest("session-1", { toolName: "bash", callId: "call-1", reason: "runs a shell command" });
	assert.deepEqual(request, {
		sessionId: "session-1",
		toolCall: { toolCallId: "call-1", title: "bash", status: "pending" },
		options: [
			{ optionId: "allow_once", name: "Allow", kind: "allow_once" },
			{ optionId: "reject_once", name: "Reject", kind: "reject_once" },
		],
	});
});

test("falls back to the tool name as the toolCallId when the approval request has no callId", () => {
	const request = toPermissionRequest("session-1", { toolName: "bash" });
	assert.equal(request.toolCall.toolCallId, "bash");
});

test("a selected allow_once outcome maps to allowed-once", () => {
	assert.equal(outcomeToApproval({ outcome: "selected", optionId: "allow_once" }), "allowed-once");
});

test("a selected reject_once outcome maps to rejected", () => {
	assert.equal(outcomeToApproval({ outcome: "selected", optionId: "reject_once" }), "rejected");
});

test("a cancelled outcome maps to cancelled", () => {
	assert.equal(outcomeToApproval({ outcome: "cancelled" }), "cancelled");
});
