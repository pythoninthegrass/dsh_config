import { test } from "node:test";
import assert from "node:assert/strict";
import { commandResultUpdate } from "./command-result.js";

test("a successful command result with text becomes an agent_message_chunk update", () => {
	assert.deepEqual(commandResultUpdate({ kind: "success", text: "saved transcript to out.log" }), {
		sessionUpdate: "agent_message_chunk",
		content: { type: "text", text: "saved transcript to out.log" },
	});
});

test("a successful command result without text produces no update", () => {
	assert.equal(commandResultUpdate({ kind: "success" }), null);
});

test("an error command result becomes an agent_message_chunk update", () => {
	assert.deepEqual(commandResultUpdate({ kind: "error", text: "dsh: unknown command" }), {
		sessionUpdate: "agent_message_chunk",
		content: { type: "text", text: "dsh: unknown command" },
	});
});
