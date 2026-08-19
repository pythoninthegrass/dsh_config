import { test } from "node:test";
import assert from "node:assert/strict";
import { stopReasonFor } from "./stop-reason.js";

test("completed turn ends normally", () => {
	assert.equal(stopReasonFor({ kind: "completed" }), "end_turn");
});

test("max-tokens maps to max_tokens", () => {
	assert.equal(stopReasonFor({ kind: "max-tokens" }), "max_tokens");
});

test("aborted maps to cancelled", () => {
	assert.equal(stopReasonFor({ kind: "aborted" }), "cancelled");
});

test("unknown or missing reason falls back to end_turn", () => {
	assert.equal(stopReasonFor({ kind: "blocked" }), "end_turn");
	assert.equal(stopReasonFor(undefined), "end_turn");
});
