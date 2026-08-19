import { test } from "node:test";
import assert from "node:assert/strict";
import { toSessionUpdate, kindFromView, diffContent } from "./session-updates.js";

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

test("tool/call with a diff-card view carries kind edit and diff content", () => {
	const event = { type: "tool/call", data: { callId: "call-1", name: "str_replace_editor", arguments: { command: "str_replace", path: "/repo/a.txt" } } };
	const view = { card: "diff", title: "str_replace /repo/a.txt", diffs: [{ path: "/repo/a.txt", oldText: "old", newText: "new" }] };
	assert.deepEqual(toSessionUpdate(event, view), {
		sessionUpdate: "tool_call",
		toolCallId: "call-1",
		title: "str_replace_editor",
		kind: "edit",
		status: "in_progress",
		rawInput: { command: "str_replace", path: "/repo/a.txt" },
		content: [{ type: "diff", path: "/repo/a.txt", oldText: "old", newText: "new" }],
	});
});

test("tool/call with a diff-card view whose oldText is null (a new file) passes oldText through as null", () => {
	const view = { card: "diff", diffs: [{ path: "/repo/new.txt", oldText: null, newText: "hi" }] };
	assert.deepEqual(diffContent(view), [{ type: "diff", path: "/repo/new.txt", oldText: null, newText: "hi" }]);
});

test("tool/call with no view keeps kind other and adds no content key", () => {
	const event = { type: "tool/call", data: { callId: "call-1", name: "bash", arguments: { command: "pwd" } } };
	const update = toSessionUpdate(event);
	assert.equal(update.kind, "other");
	assert.equal("content" in update, false);
});

test("kindFromView maps every shipped presenter card", () => {
	assert.equal(kindFromView({ card: "diff" }), "edit");
	assert.equal(kindFromView({ card: "terminal" }), "execute");
	assert.equal(kindFromView({ card: "read" }), "read");
	assert.equal(kindFromView({ card: "search" }), "search");
	assert.equal(kindFromView({ card: "generic", kind: "read" }), "read");
	assert.equal(kindFromView({ card: "generic", kind: "search" }), "search");
	assert.equal(kindFromView({ card: "generic", kind: "fetch" }), "fetch");
	assert.equal(kindFromView({ card: "generic", kind: "execute" }), "execute");
	assert.equal(kindFromView({ card: "generic", kind: "other" }), "other");
	assert.equal(kindFromView({ card: "web", kind: "search" }), "search");
	assert.equal(kindFromView({ card: "web", kind: "fetch" }), "fetch");
	assert.equal(kindFromView(undefined), "other");
	assert.equal(kindFromView({ card: "unrecognized-future-card" }), "other");
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

test("todo/write becomes a plan update with mapped statuses and medium priority", () => {
	const event = {
		type: "todo/write",
		data: {
			todos: [
				{ content: "Read the file", status: "completed" },
				{ content: "Edit the file", status: "in_progress" },
				{ content: "Run the tests", status: "pending" },
			],
		},
	};
	assert.deepEqual(toSessionUpdate(event), {
		sessionUpdate: "plan",
		entries: [
			{ content: "Read the file", priority: "medium", status: "completed" },
			{ content: "Edit the file", priority: "medium", status: "in_progress" },
			{ content: "Run the tests", priority: "medium", status: "pending" },
		],
	});
});

test("todo/write with no todos becomes an empty plan", () => {
	const event = { type: "todo/write", data: { todos: [] } };
	assert.deepEqual(toSessionUpdate(event), { sessionUpdate: "plan", entries: [] });
});

test("unrelated event types produce no update", () => {
	assert.equal(toSessionUpdate({ type: "turn/start", data: {} }), null);
	assert.equal(toSessionUpdate({ type: "turn/end", data: { reason: { kind: "completed" } } }), null);
});
