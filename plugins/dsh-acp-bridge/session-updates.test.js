import { test } from "node:test";
import assert from "node:assert/strict";
import { toSessionUpdate } from "./session-updates.js";

test("text-delta chunk becomes an agent_message_chunk update", () => {
	const event = { type: "assistant/chunk", data: { chunk: { type: "text-delta", text: "hi" } } };
	assert.deepEqual(toSessionUpdate(event), {
		sessionUpdate: "agent_message_chunk",
		content: { type: "text", text: "hi" },
	});
});

test("reasoning-delta chunk becomes an agent_thought_chunk update", () => {
	const event = { type: "assistant/chunk", data: { chunk: { type: "reasoning-delta", text: "thinking" } } };
	assert.deepEqual(toSessionUpdate(event), {
		sessionUpdate: "agent_thought_chunk",
		content: { type: "text", text: "thinking" },
	});
});

test("tool/call becomes an in-progress tool_call update", () => {
	const event = { type: "tool/call", data: { callId: "call-1", name: "bash", arguments: { command: "pwd" } } };
	assert.deepEqual(toSessionUpdate(event), {
		sessionUpdate: "tool_call",
		toolCallId: "call-1",
		title: "bash",
		kind: "other",
		status: "in_progress",
		rawInput: { command: "pwd" },
	});
});

test("successful tool/result becomes a completed tool_call_update with text content", () => {
	const event = {
		type: "tool/result",
		data: {
			message: {
				content: [
					{
						type: "tool-result",
						toolCallId: "call-1",
						isError: false,
						content: [{ type: "text", text: "/home/lance" }],
					},
				],
			},
		},
	};
	assert.deepEqual(toSessionUpdate(event), {
		sessionUpdate: "tool_call_update",
		toolCallId: "call-1",
		status: "completed",
		content: [{ type: "content", content: { type: "text", text: "/home/lance" } }],
	});
});

test("failed tool/result becomes a failed tool_call_update", () => {
	const event = {
		type: "tool/result",
		data: {
			message: {
				content: [{ type: "tool-result", toolCallId: "call-2", isError: true, content: [] }],
			},
		},
	};
	assert.deepEqual(toSessionUpdate(event), {
		sessionUpdate: "tool_call_update",
		toolCallId: "call-2",
		status: "failed",
		content: [],
	});
});

test("unrelated event types produce no update", () => {
	assert.equal(toSessionUpdate({ type: "turn/start", data: {} }), null);
	assert.equal(toSessionUpdate({ type: "turn/end", data: { reason: { kind: "completed" } } }), null);
});
