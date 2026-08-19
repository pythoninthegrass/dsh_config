import { test } from "node:test";
import assert from "node:assert/strict";
import { promptText } from "./prompt-text.js";

test("joins text blocks", () => {
	assert.equal(promptText([{ type: "text", text: "hello " }, { type: "text", text: "world" }]), "hello world");
});

test("ignores non-text blocks", () => {
	assert.equal(
		promptText([
			{ type: "text", text: "see " },
			{ type: "resource_link", uri: "file:///x" },
			{ type: "text", text: "this" },
		]),
		"see this",
	);
});

test("empty prompt yields empty string", () => {
	assert.equal(promptText([]), "");
});
