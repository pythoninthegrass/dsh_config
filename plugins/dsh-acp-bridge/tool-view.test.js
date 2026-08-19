import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCallView, backscanToolCall } from "./tool-view.js";

test("resolveCallView returns the presenter's view for a matching tool", () => {
	const view = { card: "diff", diffs: [{ path: "/repo/a.txt", oldText: "old", newText: "new" }] };
	const tools = { get: () => ({ presentCall: (args) => (args.command === "str_replace" ? view : void 0) }) };
	assert.deepEqual(resolveCallView(tools, "scope", "str_replace_editor", '{"command":"str_replace"}'), view);
});

test("resolveCallView passes name and scope straight through to tools.get", () => {
	let seen;
	const tools = { get: (name, scope) => (seen = { name, scope }) && { presentCall: () => "view" } };
	resolveCallView(tools, "the-scope", "bash", "{}");
	assert.deepEqual(seen, { name: "bash", scope: "the-scope" });
});

test("resolveCallView returns undefined when there is no tool registry", () => {
	assert.equal(resolveCallView(void 0, "scope", "bash", "{}"), void 0);
});

test("resolveCallView returns undefined when the tool is unknown", () => {
	const tools = { get: () => void 0 };
	assert.equal(resolveCallView(tools, "scope", "unknown_tool", "{}"), void 0);
});

test("resolveCallView returns undefined when the tool defines no presentCall", () => {
	const tools = { get: () => ({}) };
	assert.equal(resolveCallView(tools, "scope", "bash", "{}"), void 0);
});

test("resolveCallView returns undefined when rawArgs is not valid JSON", () => {
	const tools = { get: () => ({ presentCall: () => "view" }) };
	assert.equal(resolveCallView(tools, "scope", "bash", "not json"), void 0);
});

test("resolveCallView returns undefined when presentCall itself throws", () => {
	const tools = {
		get: () => ({
			presentCall: () => {
				throw new Error("boom");
			},
		}),
	};
	assert.equal(resolveCallView(tools, "scope", "bash", "{}"), void 0);
});

test("backscanToolCall finds the tool/call event matching a callId", () => {
	const events = [
		{ type: "turn/start", data: {} },
		{ type: "tool/call", data: { callId: "call-1", name: "bash", arguments: "{}" } },
		{ type: "tool/result", data: {} },
		{ type: "tool/call", data: { callId: "call-2", name: "str_replace_editor", arguments: '{"path":"/a"}' } },
	];
	assert.deepEqual(backscanToolCall(events, "call-2"), { callId: "call-2", name: "str_replace_editor", arguments: '{"path":"/a"}' });
	assert.deepEqual(backscanToolCall(events, "call-1"), { callId: "call-1", name: "bash", arguments: "{}" });
});

test("backscanToolCall returns undefined when no tool/call event matches", () => {
	const events = [{ type: "tool/call", data: { callId: "call-1", name: "bash", arguments: "{}" } }];
	assert.equal(backscanToolCall(events, "call-2"), void 0);
});

test("backscanToolCall returns undefined for an empty event log", () => {
	assert.equal(backscanToolCall([], "call-1"), void 0);
});
