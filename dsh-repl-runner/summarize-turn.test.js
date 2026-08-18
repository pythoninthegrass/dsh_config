import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeTurn } from "./summarize-turn.js";

function textMessage(seq, text) {
	return {
		seq,
		type: "assistant/message",
		data: { message: { content: [{ type: "text", text }] } },
	};
}

test("ignores events before firstSeq", () => {
	const events = [
		{ seq: 1, type: "turn/start" },
		textMessage(2, "stale answer"),
		{ seq: 3, type: "turn/end", data: { reason: { kind: "completed" } } },
		{ seq: 4, type: "turn/start" },
		textMessage(5, "fresh answer"),
		{ seq: 6, type: "turn/end", data: { reason: { kind: "completed" } } },
	];
	assert.deepEqual(summarizeTurn(events, 4), {
		text: "fresh answer",
		reason: { kind: "completed" },
	});
});

test("ignores assistant messages before turn/start", () => {
	const events = [
		textMessage(1, "leftover from a prior turn"),
		{ seq: 2, type: "turn/start" },
		textMessage(3, "this turn's answer"),
		{ seq: 4, type: "turn/end", data: { reason: { kind: "completed" } } },
	];
	assert.equal(summarizeTurn(events, 1).text, "this turn's answer");
});

test("keeps the last non-empty assistant message, not the first", () => {
	const events = [
		{ seq: 1, type: "turn/start" },
		textMessage(2, "thinking preamble"),
		textMessage(3, "final answer"),
		{ seq: 4, type: "turn/end", data: { reason: { kind: "completed" } } },
	];
	assert.equal(summarizeTurn(events, 1).text, "final answer");
});

test("skips non-text content blocks and empty joins", () => {
	const events = [
		{ seq: 1, type: "turn/start" },
		{
			seq: 2,
			type: "assistant/message",
			data: { message: { content: [{ type: "tool_call", name: "bash" }] } },
		},
		textMessage(3, "real text"),
		{ seq: 4, type: "turn/end", data: { reason: { kind: "completed" } } },
	];
	assert.equal(summarizeTurn(events, 1).text, "real text");
});

test("reports an error reason without clearing prior text", () => {
	const events = [
		{ seq: 1, type: "turn/start" },
		textMessage(2, "partial answer"),
		{
			seq: 3,
			type: "turn/end",
			data: { reason: { kind: "error", error: { code: "E_TIMEOUT", message: "timed out" } } },
		},
	];
	const outcome = summarizeTurn(events, 1);
	assert.equal(outcome.text, "partial answer");
	assert.equal(outcome.reason.kind, "error");
});

test("returns empty text and undefined reason for an empty interval", () => {
	assert.deepEqual(summarizeTurn([], 1), { text: "", reason: undefined });
});
